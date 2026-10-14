import type { Candidate, CandidateEvidence, Search } from "../../engine/types";
import { responseIdentity, worstCommonResponse } from "../candidates/evidence";

export type StrategySelection = { search: string; run: number; candidate: string; evidence: string };
export function isStrategySelection(value: unknown): value is StrategySelection {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<StrategySelection>;
  return typeof s.search === "string" && Number.isInteger(s.run) && typeof s.candidate === "string" && typeof s.evidence === "string";
}
export function sameStrategySelection(a: unknown, b: StrategySelection): boolean {
  return isStrategySelection(a) && a.search === b.search && a.run === b.run && a.candidate === b.candidate && a.evidence === b.evidence;
}
export function strategyEvidenceOptions(run: number, candidate: Candidate, common: string[]) {
  const worst = worstCommonResponse(candidate, common);
  return [
    { key: "baseline", label: "相手待機", evidence: candidate.baseline },
    ...(worst ? [{ key: "worst", label: "共通手順で最小点差", evidence: worst }] : []),
    ...candidate.responses.map((evidence, i) => ({ key: responseIdentity(run, candidate.id, evidence), label: `対応${i + 1} · ${evidence.opponent?.slice(0, 10) ?? "相手手順"} · ${evidence.scores[0]} 対 ${evidence.scores[1]}`, evidence })),
  ];
}
export function evidenceKey(run: number, candidate: Candidate, evidence: CandidateEvidence) {
  return evidence === candidate.baseline || (!("opponent" in evidence) && !("kind" in evidence) && evidence.node === candidate.baseline.node && evidence.path.join() === candidate.baseline.path.join()) ? "baseline" : responseIdentity(run, candidate.id, evidence);
}
export function resolveStrategy(search: Search, selection?: StrategySelection) {
  if (!isStrategySelection(selection) || selection.search !== search.id) return null;
  const run = search.discovery?.runs.find(r => r.run === selection.run);
  const candidate = run?.candidates.find(c => c.id === selection.candidate);
  if (!run || !candidate) return null;
  const options = strategyEvidenceOptions(run.run, candidate, run.commonOpponents);
  const chosen = options.find(o => o.key === selection.evidence);
  return {run, candidate, options, chosen};
}
