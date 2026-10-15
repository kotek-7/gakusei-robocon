/** The evidence explicitly opened for replay, independent of list/inspector selection. */
import type { ReplayContext } from "../engine/protocol";
export type { ReplayContext } from "../engine/protocol";
export function samePath(a: number[] | null, b: number[] | null): boolean {
  return a === b || !!a && !!b && a.length === b.length && a.every((edge, i) => edge === b[i]);
}
export function isReplayContext(value: unknown): value is ReplayContext {
  if (!value || typeof value !== "object") return false;
  const s = value as ReplayContext;
  return typeof s.search === "string" && typeof s.candidate === "string" && typeof s.evidence === "string" && typeof s.label === "string"
    && (s.opponent === undefined || typeof s.opponent === "string")
    && Number.isInteger(s.run) && s.run >= 0 && Number.isInteger(s.node) && s.node >= 0
    && Array.isArray(s.path) && s.path.every(e => Number.isInteger(e) && e >= 0);
}
export function matchesReplay(source: unknown, target: { search: string | null; run: number; node: number | null; path: number[] | null }): source is ReplayContext {
  return isReplayContext(source) && source.search === target.search && source.run === target.run && source.node === target.node && samePath(source.path, target.path);
}
export function decodeReplay(value: string | null): ReplayContext | null {
  if (!value || value.length > 32000) return null;
  try { const source: unknown = JSON.parse(value); return isReplayContext(source) ? source : null; }
  catch { return null; }
}
