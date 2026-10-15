import type { Candidate, CandidateAnalysisTarget, DiscoverySession } from "../../engine/types";

/** Response order is append-only. shared can change after the recorded run. */
export function sessionResponses(session: DiscoverySession, candidate: Candidate, target: Pick<CandidateAnalysisTarget, "run" | "candidate">) {
  const start = session.before?.responses, end = session.after?.responses;
  if (!session.target || session.target.run !== target.run || session.target.candidate !== target.candidate || candidate.id !== target.candidate || start == null || end == null || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > candidate.responses.length) return null;
  return candidate.responses.slice(start, end).map((evidence, index) => ({ evidence, ordinal: start + index + 1 }));
}
export function sessionGained(session: DiscoverySession) {
  return !!session.before && !!session.after && (session.after.responses > session.before.responses || session.after.opponents > session.before.opponents || session.after.checkedOpponents > session.before.checkedOpponents);
}
export function sessionWorst(rows: ReturnType<typeof sessionResponses>) {
  return rows?.reduce<(NonNullable<typeof rows>)[number] | undefined>((a, b) => !a || b.evidence.scores[0] - b.evidence.scores[1] < a.evidence.scores[0] - a.evidence.scores[1] ? b : a, undefined);
}
