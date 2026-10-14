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
