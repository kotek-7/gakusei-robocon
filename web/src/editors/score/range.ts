import type { MatchAnalysis, ScoreParts } from "../../engine/analysis";

export function sampleAt(a: MatchAnalysis, t: number) {
  let sample = a.samples[0];
  for (const next of a.samples) if (next.t <= t + 1e-9) sample = next;
  return sample;
}

/** Endpoint scores include events at that endpoint. Never extrapolate a path. */
export function scoreRangeDelta(a: MatchAnalysis, range: [number, number]): ScoreParts[] | null {
  if (!a.samples.length || !range.every(Number.isFinite) || range[0] > range[1] || range[0] < a.start || range[1] > a.end) return null;
  const start = sampleAt(a, range[0]);
  const end = sampleAt(a, range[1]);
  return start.parts.map((parts, team) => Object.fromEntries(
    Object.keys(parts).map((key) => [key, end.parts[team][key as keyof ScoreParts] - parts[key as keyof ScoreParts]]),
  ) as ScoreParts);
}
