import type { Config, Frame, Goal, StrategyPolicy } from "../engine/types";
import { configAt, initial, scores } from "../engine/model";
import { Planner } from "../engine/planner";
import { policyAction, policyGoal } from "../engine/policy";
import { frame } from "../engine/presentation";
import { successors, type Event } from "../engine/transition";

export type Match = {
  red: string;
  blue: string;
  priority: "red" | "blue";
  scores: number[];
  frames: Frame[];
  events: Event[];
};
/** Each match fixes conflict precedence. Two matches are sensitivity checks, not bounds. */
export function simulate(
  config: Config,
  red: StrategyPolicy,
  blue: StrategyPolicy,
  priority: Match["priority"],
): Match {
  const c = structuredClone(config);
  c.rules.conflict = priority;
  const v = configAt(c, 0),
    planner = new Planner(c, v);
  let state = initial(c, v);
  const goals: (Goal | null)[] = [null, null],
    frames: Frame[] = [],
    events: Event[] = [];
  while (state.t < c.horizon) {
    [red, blue].forEach((policy, team) => {
      goals[team] = policyGoal(planner, state, team, policy, goals[team]);
    });
    const acts = [0, 1, 2, 3].map((r) =>
      policyAction(planner, state, r, goals[r >> 1]),
    );
    const out = successors(state, acts.slice(0, 2), acts.slice(2), c, v)[0];
    for (let t = state.t; t < out.state.t; t++)
      frames.push(frame(out.started, t));
    events.push(...out.events);
    state = out.state;
  }
  frames.push(frame(state));
  return {
    red: red.id,
    blue: blue.id,
    priority,
    scores: scores(state),
    frames,
    events,
  };
}
