import type { JobInterval, MatchAnalysis } from "../../engine/analysis";
import { intervalDetails } from "../common/intervalSummary";

export type ExecutionRow = ReturnType<typeof intervalDetails>[number] & { key: string };
export type ExecutionCategory = "work" | "move" | "wait";
export const executionCategory = (interval: JobInterval): ExecutionCategory => interval.action.kind === "move" ? "move" : ["wait", "delay"].includes(interval.action.kind) ? "wait" : "work";
export function executionRows(analysis: MatchAnalysis, range: [number, number]): ExecutionRow[] {
  return intervalDetails(analysis.intervals, [Math.max(analysis.start, range[0]), Math.min(analysis.end, range[1])])
    .map(row => ({ ...row, key: `${row.interval.robot}:${row.interval.start}:${row.interval.edge}:${row.interval.action.kind}` }));
}
export function executionTotals(rows: ExecutionRow[], range: [number, number], robot: number) {
  const own = rows.filter(row => row.interval.robot === robot);
  const totals = { work: 0, move: 0, wait: 0, unrecorded: 0, count: own.length };
  for (const row of own) totals[executionCategory(row.interval)] += row.seconds;
  // Union observed intervals so missing coverage is not hidden by overlap.
  let covered = 0, end = range[0];
  for (const row of [...own].sort((a, b) => a.start - b.start)) { covered += Math.max(0, row.end - Math.max(end, row.start)); end = Math.max(end, row.end); }
  totals.unrecorded = Math.max(0, range[1] - range[0] - covered);
  return totals;
}
export function overlappingExecution(rows: ExecutionRow[], selected: ExecutionRow) {
  return rows.filter(row => row.interval.robot !== selected.interval.robot && row.start < selected.end && row.end > selected.start)
    .map(row => ({ ...row, overlap: Math.min(row.end, selected.end) - Math.max(row.start, selected.start) }));
}
