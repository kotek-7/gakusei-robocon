/** Derived reads for the active search, shared by all editors. */
import { useMemo } from "react";
import type { Frame, Replay } from "../engine/types";
import { useQuery, useSearches } from "./data";
import { useUI } from "./store";

export function useSearch() {
  const id = useUI((s) => s.session.search);
  return useSearches((s) => s.list.find((x) => x.id === id) ?? null);
}
export function useDetail() {
  const search = useUI((s) => s.session.search),
    node = useUI((s) => s.session.node);
  return useQuery("node.get", search && node !== null ? { search, node } : null);
}
/** Edges from the run root to the selected node (explicit trail or first-found path). */
export function usePath(): number[] | null {
  const explicit = useUI((s) => s.session.path);
  const detail = useDetail().data;
  const node = useUI((s) => s.session.node);
  if (explicit) return explicit;
  return detail && detail.id === node ? detail.path : null;
}
export function useReplay(path?: number[] | null) {
  const search = useUI((s) => s.session.search);
  const own = usePath();
  const edges = path === undefined ? own : path;
  return useQuery("replay.get", search && edges?.length ? { search, edges } : null);
}
export function useAnalysis(path?: number[] | null) {
  const search = useUI((s) => s.session.search);
  const own = usePath();
  const edges = path === undefined ? own : path;
  return useQuery("analysis.match", search && edges?.length ? { search, edges } : null);
}
export function frameAt(replay: Replay, time: number): Frame | null {
  if (!replay.frames.length) return null;
  const index = Math.max(0, replay.frames.findLastIndex((f) => f.t <= time));
  const frame = replay.frames[index],
    next = replay.frames[index + 1];
  if (!next || next.t <= frame.t || time <= frame.t) return frame;
  const f = Math.min(1, (time - frame.t) / (next.t - frame.t));
  return {
    ...frame,
    t: time,
    robots: frame.robots.map((r, i) => ({
      ...r,
      p: r.p.map((x, j) => x + (next.robots[i].p[j] - x) * f),
    })),
    objects: frame.objects.map((o) => {
      if (!o.loc.startsWith("robot")) return o;
      const i = Number(o.loc.slice(5));
      return {
        ...o,
        p: o.p!.map((x, j) => x + (next.robots[i].p[j] - frame.robots[i].p[j]) * f),
      };
    }),
  };
}
/** Frame at the playhead along the given path (default: current path). */
export function useFrame(path?: number[] | null): Frame | null {
  const replay = useReplay(path).data;
  const time = useUI((s) => s.playback.time);
  const detail = useDetail().data;
  return useMemo(() => {
    if (replay?.frames.length) {
      const first = replay.frames[0].t,
        last = replay.frames.at(-1)!.t;
      return frameAt(replay, Math.min(last, Math.max(first, time)));
    }
    return detail?.frame ?? null;
  }, [replay, time, detail]);
}
/** Time span of the current path. */
export function useSpan(): [number, number] {
  const replay = useReplay().data;
  const horizon = useSearch()?.config.horizon ?? 180;
  if (!replay?.frames.length) return [0, horizon];
  return [replay.frames[0].t, replay.frames.at(-1)!.t];
}
