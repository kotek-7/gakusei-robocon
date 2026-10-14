import type { CandidateEvidence } from "../../engine/types";

/** Display provenance only; the command still stores and executes the exact path. */
export function candidateComparisonLabel(context: string, evidence: Pick<CandidateEvidence, "scores" | "node" | "path">, branchIndex?: number): string {
  let hash = 2166136261;
  for (const char of JSON.stringify(evidence.path)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const pathLabel = (hash >>> 0).toString(36).padStart(7, "0");
  const margin = evidence.scores[0] - evidence.scores[1];
  const branch = branchIndex === undefined ? "" : ` · 展開${branchIndex + 1}`;
  return `${context}${branch} · ${margin > 0 ? "+" : ""}${margin}点 (${evidence.scores[0]} 対 ${evidence.scores[1]}) · 局面${evidence.node} / 経路${pathLabel}`;
}
