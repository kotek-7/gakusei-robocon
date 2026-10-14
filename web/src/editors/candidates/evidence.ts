import type { Candidate, CandidateEvidence } from "../../engine/types";
/** A shared response is comparable only after that opponent is common to this run. */
export function worstCommonResponse(candidate: Candidate, common: string[], opponent = ""): CandidateEvidence | null {
  return candidate.responses.filter((x) => x.shared && x.opponent && common.includes(x.opponent) && (!opponent || x.opponent === opponent))
    .reduce<CandidateEvidence | null>((lowest, x) => !lowest || x.scores[0] - x.scores[1] < lowest.scores[0] - lowest.scores[1] ? x : lowest, null);
}

/** Evidence selection survives filtering/reordering, but never crosses candidates. */
export function responseIdentity(run: number, candidate: string, evidence: Pick<Candidate["responses"][number], "opponent" | "node" | "path">): string {
  return JSON.stringify([run, candidate, evidence.opponent, evidence.node, evidence.path]);
}
