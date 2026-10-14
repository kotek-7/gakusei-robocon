import type { StrategyPolicy } from "../engine/types";
export const policyFields = [
  "targets",
  "height",
  "mustika",
  "opportunistic",
  "lateFlip",
  "skyFirst",
] as const;
export type PolicyField = (typeof policyFields)[number];
export const fieldNames: Record<PolicyField, string> = {
  targets: "建設する順序",
  height: "各塔の目標",
  mustika: "ムスティカへの切替",
  opportunistic: "相手塔の反転",
  lateFlip: "終盤の反転",
  skyFirst: "先に確保するスカイ",
};
export function signature(p: StrategyPolicy) {
  return JSON.stringify(policyFields.map((k) => p[k]));
}
export function copyPolicy(
  p: StrategyPolicy,
  name = `${p.name} のコピー`,
): StrategyPolicy {
  return { ...structuredClone(p), id: crypto.randomUUID(), name };
}
export function moveTarget(targets: number[], from: number, to: number) {
  const next = [...targets];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length)
    return next;
  const [target] = next.splice(from, 1);
  next.splice(to, 0, target);
  return next;
}
export function acceptVariants(
  existing: StrategyPolicy[],
  variants: StrategyPolicy[],
) {
  const seen = new Set(existing.map(signature));
  const result = [...existing];
  for (const p of variants) {
    if (result.length >= 100) break;
    const key = signature(p);
    if (!seen.has(key)) {
      result.push(structuredClone(p));
      seen.add(key);
    }
  }
  return result;
}
export function changes(base: StrategyPolicy, p: StrategyPolicy) {
  return policyFields.filter(
    (k) => JSON.stringify(base[k]) !== JSON.stringify(p[k]),
  );
}
