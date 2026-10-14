import type { Frame } from "../engine/types";
/** Use match history, never the order in which frames were visited. */
export function headingAt(
  frames: Frame[],
  frame: Frame,
  robot: number,
): number {
  const current = frame.robots[robot].p;
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i].t >= frame.t) continue;
    const previous = frames[i].robots[robot].p;
    const dx = current[0] - previous[0],
      dz = current[2] - previous[2];
    if (Math.hypot(dx, dz) > 0.001) return Math.atan2(dx, dz);
  }
  return robot < 2 ? Math.PI / 2 : -Math.PI / 2;
}
