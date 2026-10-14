import type { Candidate, CandidateEvidence } from "../../engine/types";
/** A shared response is comparable only after that opponent is common to this run. */
export function worstCommonResponse(candidate: Candidate, common: string[], opponent = ""): CandidateEvidence | null {
  return candidate.responses.filter((x) => x.shared && x.opponent && common.includes(x.opponent) && (!opponent || x.opponent === opponent))
    .reduce<CandidateEvidence | null>((lowest, x) => !lowest || x.scores[0] - x.scores[1] < lowest.scores[0] - lowest.scores[1] ? x : lowest, null);
}
