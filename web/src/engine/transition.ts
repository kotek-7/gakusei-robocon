import type { Action, Config, State, Variant } from "../engine/types";
import {
  action,
  concreteLegal,
  demand,
  duration,
  legal,
  matched,
  nodeAt,
  outcomeKey,
  payload,
  qualify,
  tower,
  validateState,
} from "./model";
import { assert, clone, equal } from "./util";
export type Event = { t: number; robot: number; phase: string; action: Action };
export type Outcome = {
  state: State;
  started: State;
  events: Event[];
  cases: number[];
};
function start(
  s: State,
  r: number,
  requested: Action,
  c: Config,
  v: Variant,
  events: Event[],
  reference: State,
) {
  const rob = s.robots[r];
  let a = requested,
    k = a.kind;
  if (k === "continue") return;
  const partner = a.partner === undefined ? null : s.robots[a.partner].job;
  const matching =
    k === "receive" &&
    partner?.action.kind === "give" &&
    equal(partner.action.objects, a.objects);
  const available = concreteLegal(s, r, c, v);
  if (k === "pick") {
    const wanted = demand(reference, a);
    a =
      available.find((x) => x.kind === "pick" && demand(s, x) === wanted) || a;
  }
  if (!matching && !available.some((x) => equal(x, a))) {
    events.push({ t: s.t, robot: r, phase: "blocked", action: a });
    a = action("wait", { seconds: 1 });
    k = "wait";
  }
  if (k === "retry")
    for (const o of payload(s, r))
      if (o.kind === "M" || c.rules.retry_payload === "return") {
        o.loc =
          o.kind === "E"
            ? `store${o.owner}`
            : o.kind === "S"
              ? "groundSky"
              : "groundBall";
        o.slot = o.id;
        o.layer = 0;
        if (o.kind === "M") o.owner = -1;
      }
  if (["pick", "take", "flip", "takeM"].includes(k))
    for (const oid of a.objects!) s.objects[oid].loc = `robot${r}`;
  rob.job = {
    action: clone(a),
    start: s.t,
    end: s.t + duration(a, c, v, k === "receive" ? r - 1 : r),
    from: rob.pos,
  };
  if (!["wait", "delay"].includes(k))
    events.push({ t: s.t, robot: r, phase: "start", action: a });
}
function finish(s: State, r: number, c: Config, events: Event[]) {
  const rob = s.robots[r],
    a = rob.job!.action,
    k = a.kind,
    team = r >> 1;
  rob.job = null;
  const credit = (id: number) => {
    const o = s.objects[id];
    if (o.kind !== "M" && (!o.delivered[team] || c.rules.repeat_transfer)) {
      s.transfer[team]++;
      o.delivered[team] = true;
    }
  };
  if (k === "move" || k === "retry") {
    rob.pos = a.dest!;
    if (r % 2 && nodeAt(rob.pos).p[1] >= 0.6) rob.entered = true;
  } else if (k === "drop")
    for (const id of a.objects!) {
      Object.assign(s.objects[id], {
        loc: `buffer${team}`,
        layer: 0,
        slot: id,
      });
      if (r % 2 === 0) credit(id);
    }
  else if (k === "give")
    for (const id of a.objects!) {
      s.objects[id].loc = `robot${a.partner}`;
      credit(id);
    }
  else if (k === "place" || k === "flip")
    for (const id of a.objects!) {
      const o = s.objects[id],
        layer = tower(s, a.spot!).length;
      Object.assign(o, { loc: `tower${a.spot}`, layer });
      if (o.kind === "S") o.face = team;
      else o.owner = team;
    }
  else if (k === "placeM")
    Object.assign(s.objects[52], { loc: "pillar", owner: team, layer: 0 });
  if (k === "wait" || k === "delay") rob.waited = true;
  else events.push({ t: s.t, robot: r, phase: "finish", action: a });
}
export function successors(
  s: State,
  red: Action[],
  blue: Action[],
  c: Config,
  v: Variant,
): Outcome[] {
  const acts = [...red, ...blue];
  assert(
    red.length === 2 && blue.length === 2 && matched(acts),
    "同期条件を満たさない行動です",
  );
  acts.forEach((a, r) =>
    assert(
      legal(s, r, c, v).some((x) => equal(x, a)),
      "この局面では選べない行動です",
    ),
  );
  const priorities =
      c.rules.conflict === "branch"
        ? [0, 1]
        : [c.rules.conflict === "red" ? 0 : 1],
    seen = new Map<string, Outcome>();
  for (const priority of priorities) {
    const child = clone(s),
      events: Event[] = [],
      order = [
        priority * 2,
        priority * 2 + 1,
        (1 - priority) * 2,
        (1 - priority) * 2 + 1,
      ];
    for (const r of order) start(child, r, acts[r], c, v, events, s);
    const started = clone(child),
      next = Math.min(
        c.horizon,
        ...child.robots.flatMap((r) => (r.job ? [r.job.end] : [])),
      );
    assert(next > s.t, "遷移後の時刻が進んでいません");
    child.t = next;
    for (const r of order)
      if (child.robots[r].job?.end === next) finish(child, r, c, events);
    if (events.some((e) => e.phase === "finish"))
      for (const rob of child.robots) {
        rob.waited = false;
        if (rob.job?.action.kind === "wait") rob.job = null;
      }
    qualify(child, c.rules);
    validateState(child);
    const ck = outcomeKey(child),
      old = seen.get(ck);
    if (old) old.cases.push(priority);
    else seen.set(ck, { state: child, started, events, cases: [priority] });
  }
  return [...seen.values()];
}
