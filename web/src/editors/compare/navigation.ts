import type { MatchAnalysis } from "../../engine/analysis";

/** Times when B−A changes, restricted to the interval both paths cover. */
export function scoreChangeTimes(a: MatchAnalysis, b: MatchAnalysis): number[] {
  const start = Math.max(a.start, b.start), end = Math.min(a.end, b.end);
  const times = [...new Set([start, ...a.samples.map((s) => s.t), ...b.samples.map((s) => s.t)])]
    .filter((t) => t >= start && t <= end).sort((x, y) => x - y);
  let ai = 0, bi = 0, previous: number | undefined;
  const changes: number[] = [];
  for (const t of times) {
    while (ai + 1 < a.samples.length && a.samples[ai + 1].t <= t) ai++;
    while (bi + 1 < b.samples.length && b.samples[bi + 1].t <= t) bi++;
    const ap = a.samples[ai]?.parts, bp = b.samples[bi]?.parts;
    if (!ap || !bp) continue;
    const delta = bp[0].total - bp[1].total - (ap[0].total - ap[1].total);
    if (previous !== undefined && previous !== delta) changes.push(t);
    previous = delta;
  }
  return changes;
}
