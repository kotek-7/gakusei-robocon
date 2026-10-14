import type { Frame } from "../engine/types";
import type { Event } from "../engine/transition";
import type { Match } from "../study/match";
export const phaseName = (phase: string) =>
  ({ start: "開始", finish: "完了", blocked: "実行できず" })[phase] || phase;
export const frameAt = (
  frames: Frame[],
  time: number,
  fallback: Frame,
): Frame =>
  frames.find((f) => f.t === Math.floor(time)) ??
  [...frames].reverse().find((f) => f.t <= time) ??
  frames[0] ??
  fallback;
export const uniqueTimes = (events: { t: number }[]) =>
  [...new Set(events.map((e) => e.t))].sort((a, b) => a - b);
export function adjacentTime(times: number[], time: number, direction: -1 | 1) {
  return direction === 1
    ? times.find((t) => t > time)
    : [...times].reverse().find((t) => t < time);
}
export function related(event: Event, selection: string | null) {
  if (!selection) return true;
  const [kind, value] = selection.split(":"),
    id = Number(value);
  if (kind === "robot") return event.robot === id;
  if (kind === "tower")
    return (
      event.action.spot === id ||
      event.action.dest?.startsWith(`spot${id}-`) === true
    );
  return event.action.objects?.includes(id) === true;
}
export function filteredEvents(
  events: Event[],
  selection: string | null,
  kind: string,
  range: [number, number] | null,
) {
  return events.filter(
    (e) =>
      related(e, selection) &&
      (!kind || e.action.kind === kind) &&
      (!range || (e.t >= range[0] && e.t <= range[1])),
  );
}
export function scoreTimes(match: Match, baseline?: Match) {
  let previous: number[] | undefined;
  return match.frames.flatMap((f) => {
    const base = baseline
      ? frameAt(baseline.frames, f.t, baseline.frames[0])
      : undefined;
    const value = base
      ? [f.scores[0] - f.scores[1] - (base.scores[0] - base.scores[1])]
      : f.scores;
    const changed = previous && value.some((v, i) => v !== previous![i]);
    previous = value;
    return changed ? [f.t] : [];
  });
}
export function actionTiming(events: Event[], robot: number, time: number) {
  let index = events.length - 1;
  while (
    index >= 0 &&
    !(
      events[index].robot === robot &&
      events[index].t <= time &&
      events[index].phase === "start"
    )
  )
    index--;
  if (index < 0) return null;
  const latest = events[index];
  const end = events
    .slice(index + 1)
    .find(
      (e) =>
        e.robot === robot &&
        ["finish", "blocked"].includes(e.phase) &&
        e.action.kind === latest.action.kind,
    );
  if (end && end.t <= time) return null;
  return { start: latest.t, end: end?.t };
}
export function seekState(
  time: number,
  end: number,
  range: [number, number] | null,
  loop: boolean,
) {
  const t = Math.max(
    0,
    Math.min(end, Math.round(Number.isFinite(time) ? time : 0)),
  );
  return { t, loop: loop && !!range && t >= range[0] && t <= range[1] };
}
