import type { Plan } from "../simulation/types";
import { catalog } from "./plans.ts";
// Canonical predicates of choose(): flip mode makes the end setting redundant.
export function policyKey(p: Plan) {
  return JSON.stringify([
    p.zones,
    p.supply,
    p.mission,
    p.mode === "reuse",
    flipCondition(p),
  ]);
}
export function flipCondition(p: Plan) {
  return p.mode === "flip" || p.end === "flip"
    ? "always"
    : p.end === "late"
      ? "late"
      : "never";
}
export function responseGroup(p: Plan) {
  const flip = flipCondition(p);
  return {
    key: `${p.mission}/${flip}/${p.mode === "reuse"}`,
    label: `${p.mission ? "奉納を狙う" : "奉納なし"}・${{ always: "常時反転", late: "120秒以降に反転", never: "反転なし" }[flip]}・${p.mode === "reuse" ? "既存土台を優先" : "場所を優先"}`,
  };
}
export function opponents() {
  const unique = new Map<string, { plan: Plan; ids: number[] }>();
  for (const p of catalog()) {
    const key = policyKey(p);
    if (!unique.has(key)) unique.set(key, { plan: p, ids: [] });
    unique.get(key)!.ids.push(p.id);
  }
  return [...unique.values()];
}
