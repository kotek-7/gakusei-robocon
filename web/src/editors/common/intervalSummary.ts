import type { JobInterval } from "../../engine/analysis";

/** Only observed intervals count; unobserved time is never inferred as waiting. */
export function intervalSummary(intervals: JobInterval[], range: [number, number], robot: number) {
  const rows = intervals.filter((iv) => range[1] > range[0] && iv.robot === robot && iv.end > range[0] && iv.start < range[1]);
  const duration = (iv: JobInterval) => Math.max(0, Math.min(iv.end, range[1]) - Math.max(iv.start, range[0]));
  const waiting = rows.filter((iv) => iv.action.kind === "wait" || iv.action.kind === "delay");
  return {
    count: rows.length,
    active: rows.filter((iv) => !waiting.includes(iv)).reduce((sum, iv) => sum + duration(iv), 0),
    waiting: waiting.reduce((sum, iv) => sum + duration(iv), 0),
    longestWait: waiting.reduce<JobInterval | null>((best, iv) => !best || duration(iv) > duration(best) ? iv : best, null),
  };
}

/** Preserve source intervals while exposing only the observed part of a range. */
export function intervalDetails(intervals: JobInterval[], range: [number, number], robot: number | null = null) {
  if (!range.every(Number.isFinite) || range[1] <= range[0]) return [];
  return intervals.filter((iv) => (robot === null || iv.robot === robot) && iv.end > range[0] && iv.start < range[1])
    .map((iv) => ({ interval: iv, start: Math.max(iv.start, range[0]), end: Math.min(iv.end, range[1]), seconds: Math.min(iv.end, range[1]) - Math.max(iv.start, range[0]) }))
    .sort((a, b) => a.start - b.start || a.interval.robot - b.interval.robot);
}

export function actionBreakdown(intervals: JobInterval[], range: [number, number], robot: number | null = null) {
  const groups = new Map<string, { kind: string; count: number; seconds: number }>();
  for (const row of intervalDetails(intervals, range, robot)) {
    const kind = row.interval.action.kind;
    const group = groups.get(kind) ?? { kind, count: 0, seconds: 0 };
    group.count++; group.seconds += row.seconds; groups.set(kind, group);
  }
  return [...groups.values()].sort((a, b) => b.seconds - a.seconds || a.kind.localeCompare(b.kind));
}
