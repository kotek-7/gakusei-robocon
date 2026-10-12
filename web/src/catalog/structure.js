import { requirements } from "./effort.js";
export const families = [
  { id: "build", name: "積み上げに集中", description: "ブロックの積み上げを軸に、狙う場所と供給を調整。", flow: "搬送 → 積み上げを継続" },
  { id: "mission", name: "積み上げ＋ムスティカ設置", description: "設置条件を満たしてから、ムスティカを回収・設置。", flow: "搬送 → 積み上げ・条件達成 → ムスティカ設置" },
  { id: "flip", name: "積み上げ＋裏返し", description: "積み上げに加えて、相手の上段ブロックを裏返す。", flow: "搬送 → 積み上げ / 上段ブロックを裏返す" },
  { id: "combined", name: "ムスティカ設置＋裏返し", description: "ムスティカ設置と塔の取り合いの両方を狙う。", flow: "積み上げ・条件達成 → ムスティカ設置 / 裏返し" },
];
export function familyOf(plan) {
  const flips = requirements(plan).some(c => c.id === "flip");
  return plan.mission ? (flips ? "combined" : "mission") : (flips ? "flip" : "build");
}
export function technicalGroups(rows) {
  const groups = new Map();
  for (const row of rows) {
    const skills = requirements(row.plan), key = skills.map(c => c.id).join("-");
    if (!groups.has(key)) groups.set(key, { key, family: familyOf(row.plan), skills, days: row.days, rows: [] });
    groups.get(key).rows.push(row);
  }
  return [...groups.values()].map(group => {
    const scored = group.rows.filter(r => r.scores);
    const best = [...scored].sort((a,b) => b.scores[0] - a.scores[0] || (a.scores[1] - b.scores[1]) || a.plan.id - b.plan.id)[0];
    const names = { shared:"L1共有エリア", upper:"L2", reuse:"土台利用", late:"終盤切替" };
    const additions = group.skills.filter(c => names[c.id]).map(c => names[c.id]);
    return { ...group, name: additions.join("・") || "基本構成", best, scored: scored.length,
      minScore: scored.length ? Math.min(...scored.map(r => r.scores[0])) : null,
      maxScore: best?.scores[0], frontier: group.rows.some(r => r.frontier) };
  });
}
// Hasse edges of the capability-set inclusion order: only direct predecessors.
export function predecessors(group, groups) {
  const subset = (a,b) => a.skills.length < b.skills.length && a.skills.every(c => b.skills.includes(c));
  const candidates = groups.filter(g => subset(g, group));
  return candidates.filter(g => !candidates.some(mid => subset(g, mid))).sort((a,b) => b.days - a.days);
}
