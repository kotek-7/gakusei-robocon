import type { ActivityNode } from "../../engine/types";

export const TRACE_WIDTH = 640;
export const TRACE_HEIGHT = 164;
/** Time is a fixed x axis. Y only separates identifiers; it carries no rank or score. */
export function tracePoint(node: ActivityNode, start: number, end: number, width = TRACE_WIDTH) {
  let hash = 2166136261;
  for (let i = 0; i < node.id.length; i++) hash = Math.imul(hash ^ node.id.charCodeAt(i), 16777619);
  const fraction = Math.max(0, Math.min(1, (node.time - start) / Math.max(1, end - start)));
  return { x: 20 + fraction * (width - 40), y: 20 + ((hash >>> 0) % 1009) / 1008 * 106 };
}

export function traceTime(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
