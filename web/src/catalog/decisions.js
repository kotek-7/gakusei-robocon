import { catalog } from './plans.js';
// Canonical predicates of choose(): flip mode makes the end setting redundant.
export function policyKey(p) {
  return JSON.stringify([p.zones, p.supply, p.mission, p.mode === 'reuse', flipCondition(p)]);
}
export function flipCondition(p) {
  return p.mode === 'flip' || p.end === 'flip' ? 'always' : p.end === 'late' ? 'late' : 'never';
}
export function responseGroup(p) {
  const flip = flipCondition(p);
  return { key: `${p.mission}/${flip}/${p.mode === 'reuse'}`, label: `${p.mission ? '奉納を狙う' : '奉納なし'}・${{always:'常時反転',late:'120秒以降に反転',never:'反転なし'}[flip]}・${p.mode === 'reuse' ? '既存土台を優先' : '場所を優先'}` };
}
export function opponents() {
  const unique = new Map();
  for (const p of catalog()) {
    const key = policyKey(p);
    if (!unique.has(key)) unique.set(key, { plan:p, ids:[] });
    unique.get(key).ids.push(p.id);
  }
  return [...unique.values()];
}
export function summarize(matches) {
  const groups = new Map();
  for (const m of matches) {
    const g = responseGroup(m.enemy);
    if (!groups.has(g.key)) groups.set(g.key, { ...g, matches:[] });
    groups.get(g.key).matches.push(m);
  }
  return [...groups.values()].map(g => {
    const range = fn => [Math.min(...g.matches.map(fn)), Math.max(...g.matches.map(fn))];
    return {...g, baseline:range(m=>m.before[0]), candidate:range(m=>m.after[0]), delta:range(m=>m.after[0]-m.before[0]), margin:range(m=>m.after[0]-m.after[1]), worst:g.matches.reduce((a,b)=>a.after[0]-a.after[1] <= b.after[0]-b.after[1] ? a : b)};
  });
}
