import { locationName } from "../common/labels";
import type { Detail, Obj } from "../../engine/types";
export function objectChange(before: Obj, after: Obj) {
  return before.loc !== after.loc || before.owner !== after.owner || before.face !== after.face || before.layer !== after.layer || before.slot !== after.slot || before.delivered.some((v, i) => v !== after.delivered[i]);
}
export function stateDelta(before: Detail, after: Detail) {
  const previous = new Map(before.state.objects.map(object => [object.id, object]));
  return {
    from: before.id, to: after.id, seconds: after.state.t - before.state.t,
    scores: after.scores.map((score, i) => score - before.scores[i]),
    objects: after.state.objects.flatMap(object => {
      const old = previous.get(object.id);
      return old && objectChange(old, object) ? [{ before: old, after: object }] : [];
    }),
    robots: after.state.robots.flatMap((robot, i) => {
      const old = before.state.robots[i];
      return old && (old.pos !== robot.pos || JSON.stringify(old.job) !== JSON.stringify(robot.job)) ? [{ robot: i, before: old, after: robot }] : [];
    }),
  };
}

export function objectStateLabel(object: Obj, other: Obj) {
  const team = (value: number) => value === 0 ? "赤" : value === 1 ? "青" : "なし";
  return [
    object.loc !== other.loc && locationName(object.loc),
    object.layer !== other.layer && `段位置 ${object.layer + 1}`,
    object.slot !== other.slot && `配置位置 ${object.slot}`,
    object.owner !== other.owner && `所属 ${team(object.owner)}`,
    object.face !== other.face && `色 ${team(object.face)}`,
    object.delivered.some((v, i) => v !== other.delivered[i]) && `加点 赤/青 ${object.delivered.map(v => v ? "有" : "無").join("/")}`,
  ].filter(Boolean).join(" · ");
}
