import type { CandidateEvidence } from "../../engine/types";

export type ExecutionIssue = NonNullable<CandidateEvidence["blocked"]>[number];
export type DiagnosticRow = ExecutionIssue & { key: string };
export const diagnosticRobotNames = ["赤TR", "赤BR", "青TR", "青BR"];

/** Only engine-recorded failure timestamps are chronological evidence. */
export function diagnosticRows(evidence: CandidateEvidence): DiagnosticRow[] {
  return (evidence.blocked ?? []).map((issue, index) => ({ ...issue, key: `${issue.robot}/${issue.instruction}/${issue.t}/${index}` }))
    .sort((a, b) => a.t - b.t || a.robot - b.robot || a.instruction - b.instruction);
}

export function filterDiagnostics(rows: DiagnosticRow[], robot: string, reason: string): DiagnosticRow[] {
  return rows.filter(row => (!robot || String(row.robot) === robot) && (!reason || row.reason === reason));
}

export function activeDiagnostic(rows: DiagnosticRow[], key: string): DiagnosticRow | undefined {
  return rows.find(row => row.key === key) ?? rows[0];
}
