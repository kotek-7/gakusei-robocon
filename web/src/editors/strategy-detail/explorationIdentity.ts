import type { CandidateAnalysisTarget } from "../../engine/types";
export function matchesExplorationSelection(selection: unknown, search: string, target: CandidateAnalysisTarget): boolean {
  if (!selection || typeof selection !== "object") return false;
  const s = selection as Record<string,unknown>;
  return s.search === search && s.run === target.run && s.candidate === target.candidate;
}
