import type { ReplayContext } from "../../app/replayContext";
import type { Candidate, CandidateEvidence } from "../../engine/types";
import { evidenceKey } from "../strategy-detail/selection";
import { candidatePlanLabel } from "./collection";

/** Capture the opened result, even if later evaluation changes the worst response. */
export function candidateReplaySource(search: string, run: number, candidate: Candidate, evidence: CandidateEvidence): ReplayContext {
  return {
    search, run, candidate: candidate.id,
    evidence: evidenceKey(run, candidate, evidence),
    label: candidatePlanLabel(candidate.plan),
    opponent: "opponent" in evidence && typeof evidence.opponent === "string" ? evidence.opponent : undefined,
    node: evidence.node, path: [...evidence.path],
  };
}
