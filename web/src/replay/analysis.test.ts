import test from "node:test";
import assert from "node:assert/strict";
import type { Event } from "../engine/transition";
import type { Match } from "../study/match";
import type { Frame } from "../engine/types";
import {
  adjacentTime,
  filteredEvents,
  frameAt,
  scoreTimes,
  seekState,
  uniqueTimes,
  actionTiming,
} from "./analysis";
const events: Event[] = [
  { t: 0, robot: 0, phase: "start", action: { kind: "move", dest: "spot4-0" } },
  {
    t: 5,
    robot: 0,
    phase: "finish",
    action: { kind: "move", dest: "spot4-0" },
  },
  { t: 5, robot: 1, phase: "finish", action: { kind: "pick", objects: [9] } },
  {
    t: 8,
    robot: 0,
    phase: "start",
    action: { kind: "place", spot: 4, objects: [9] },
  },
  {
    t: 12,
    robot: 0,
    phase: "finish",
    action: { kind: "place", spot: 4, objects: [9] },
  },
];
const frame = (t: number, scores: number[]): Frame => ({
  t,
  scores,
  robots: [],
  objects: [],
  mandate: [],
});
const match = (scores: number[][]): Match => ({
  red: "r",
  blue: "b",
  priority: "red",
  scores: scores.at(-1)!,
  frames: scores.map((s, t) => frame(t, s)),
  events: [],
});
test("event navigation skips all simultaneous events and respects selected targets", () => {
  assert.deepEqual(uniqueTimes(events), [0, 5, 8, 12]);
  assert.equal(adjacentTime(uniqueTimes(events), 5, 1), 8);
  assert.equal(adjacentTime(uniqueTimes(events), 5, -1), 0);
  assert.equal(adjacentTime(uniqueTimes(events), 12, 1), undefined);
  assert.deepEqual(
    filteredEvents(events, "tower:4", "", [5, 8]).map((e) => e.t),
    [5, 8],
  );
  assert.equal(filteredEvents(events, "object:9", "pick", null).length, 1);
});
test("score and baseline difference navigation detect changes only", () => {
  const selected = match([
      [0, 0],
      [10, 0],
      [10, 0],
      [10, 5],
    ]),
    baseline = match([
      [0, 0],
      [10, 0],
      [20, 0],
      [20, 5],
    ]);
  assert.deepEqual(scoreTimes(selected), [1, 3]);
  assert.deepEqual(scoreTimes(selected, baseline), [2]);
  assert.equal(frameAt(selected.frames, 1.9, selected.frames[0]).t, 1);
});
test("seeking outside loop range disables loop and clamps time", () => {
  assert.deepEqual(seekState(30, 180, [10, 20], true), { t: 30, loop: false });
  assert.deepEqual(seekState(15, 180, [10, 20], true), { t: 15, loop: true });
  assert.deepEqual(seekState(999, 180, null, false), { t: 180, loop: false });
  assert.deepEqual(seekState(NaN, 180, null, false), { t: 0, loop: false });
});
test("inspector timing follows the active action and ends at completion", () => {
  assert.deepEqual(actionTiming(events, 0, 2), { start: 0, end: 5 });
  assert.equal(actionTiming(events, 0, 5), null);
  assert.deepEqual(actionTiming(events, 0, 9), { start: 8, end: 12 });
});

test("same-kind action beginning at previous completion uses its own finish", () => {
  const e: Event[] = [
    { t: 0, robot: 0, phase: "start", action: { kind: "move" } },
    { t: 5, robot: 0, phase: "finish", action: { kind: "move" } },
    { t: 5, robot: 0, phase: "start", action: { kind: "move" } },
    { t: 10, robot: 0, phase: "finish", action: { kind: "move" } },
  ];
  assert.deepEqual(actionTiming(e, 0, 5), { start: 5, end: 10 });
});
