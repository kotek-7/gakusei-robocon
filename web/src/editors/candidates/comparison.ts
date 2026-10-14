import type { Candidate, CandidateEvidence } from "../../engine/types";
import { worstCommonResponse } from "./evidence";

export type CandidateComparisonRow = { run: number; common: string[]; candidate: Candidate };
export const comparisonKey = (row: CandidateComparisonRow) => `${row.run}/${row.candidate.id}`;

/** Configuration boundaries are never flattened into a single ranking. */
export function comparisonGroups(rows: CandidateComparisonRow[]) {
  const groups = new Map<number, CandidateComparisonRow[]>();
  for (const row of rows) {
    const group = groups.get(row.run) ?? [];
    if (!group.some(existing => comparisonKey(existing) === comparisonKey(row))) group.push(row);
    groups.set(row.run, group);
  }
  return [...groups].map(([run, candidates]) => ({
    run,
    candidates,
    opponents: [...new Set(candidates[0].common)].filter(id => candidates.every(row => row.common.includes(id))).sort(),
  }));
}

export function comparisonEvidence(row: CandidateComparisonRow, opponent: string | null): CandidateEvidence | null {
  return opponent === null ? row.candidate.baseline : worstCommonResponse(row.candidate, row.common, opponent);
}

/** Every completed arbitration witness for one common opponent, ordered conservatively. */
export function comparisonBranches(row: CandidateComparisonRow, opponent: string | null): CandidateEvidence[] {
  if (opponent === null) return [row.candidate.baseline];
  if (!row.common.includes(opponent)) return [];
  return row.candidate.responses.filter(e => e.shared && e.opponent === opponent)
    .sort((a, b) => (a.scores[0] - a.scores[1]) - (b.scores[0] - b.scores[1]));
}
/** Branch ranges describe only one fixed opponent procedure under this model. */
export function arbitrationSummary(row: CandidateComparisonRow, opponent: string) {
  const branches = comparisonBranches(row, opponent);
  const margins = branches.map(e => e.scores[0] - e.scores[1]);
  return {
    count: branches.length,
    min: margins.length ? Math.min(...margins) : null,
    max: margins.length ? Math.max(...margins) : null,
    varies: new Set(margins).size > 1,
    scoreVaries: new Set(branches.map(e => JSON.stringify(e.scores))).size > 1,
    redBlocked: branches.some(e => e.blocked?.some(issue => issue.robot < 2)),
    blueBlocked: branches.some(e => e.blocked?.some(issue => issue.robot >= 2)),
  };
}

export function opponentComparison(rows: CandidateComparisonRow[], opponent: string) {
  const evidence = rows.map(row => comparisonEvidence(row, opponent));
  const margins = evidence.filter((e): e is CandidateEvidence => !!e).map(e => e.scores[0] - e.scores[1]);
  const complete = margins.length === rows.length;
  return {
    opponent,
    // A spread requires at least two candidates with evidence under the same configuration.
    spread: complete && rows.length > 1 && rows.every(row => row.run === rows[0].run) ? Math.max(...margins) - Math.min(...margins) : null,
    redBlocked: rows.some(row => arbitrationSummary(row, opponent).redBlocked),
    blueBlocked: rows.some(row => arbitrationSummary(row, opponent).blueBlocked),
    arbitrationVaries: rows.some(row => arbitrationSummary(row, opponent).varies),
    blocked: rows.some(row => comparisonBranches(row, opponent).some(e => !!e.blocked?.length)),
  };
}
export function visibleOpponents(rows: CandidateComparisonRow[], opponents: string[], options: { query: string; filter: string; sort: string }) {
  const entries = opponents.filter(id => id.toLocaleLowerCase().includes(options.query.trim().toLocaleLowerCase()))
    .map(id => opponentComparison(rows, id))
    .filter(entry => options.filter === "different" ? entry.spread !== null && entry.spread > 0 : options.filter === "blocked" ? entry.blocked : options.filter === "arbitration" ? entry.arbitrationVaries : options.filter === "red-blocked" ? entry.redBlocked : options.filter === "blue-blocked" ? entry.blueBlocked : true);
  if (options.sort === "spread") entries.sort((a, b) => (b.spread ?? -1) - (a.spread ?? -1) || a.opponent.localeCompare(b.opponent));
  return entries;
}
