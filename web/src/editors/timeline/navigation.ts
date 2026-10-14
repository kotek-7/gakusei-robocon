import type { Marker } from "../../engine/analysis";

/** Team-wide events remain visible when either robot in that team is shown. */
export function eventTimes(markers: Marker[], kind: string, lanes: boolean[]): number[] {
  return [...new Set(markers.filter((m) =>
    (kind === "all" || m.kind === kind) &&
    (m.robot === null ? lanes[m.team * 2] || lanes[m.team * 2 + 1] : lanes[m.robot]),
  ).map((m) => m.t))].sort((a, b) => a - b);
}

export function nextEventTime(times: number[], time: number, direction: -1 | 1): number | null {
  return direction > 0
    ? times.find((t) => t > time + 1e-6) ?? null
    : times.findLast((t) => t < time - 1e-6) ?? null;
}
