import { test } from "node:test";
import assert from "node:assert/strict";
import type { MatchAnalysis, ScoreParts } from "../../engine/analysis";
import { scoreChangeTimes } from "./navigation";
const analysis = (points: [number, number, number][], start = 0, end = 30) => ({
  start, end,
  samples: points.map(([t, red, blue]) => ({ t, edge: null, parts: [{total:red}, {total:blue}] as ScoreParts[] })),
} as MatchAnalysis);
test("jumps only when B minus A changes, not when both scores change equally", () => {
  assert.deepEqual(scoreChangeTimes(
    analysis([[0,0,0], [5,10,0], [10,20,0], [15,20,10]]),
    analysis([[0,0,0], [5,10,0], [10,30,0], [15,30,10]]),
  ), [10]);
});
test("restricts navigation to shared coverage and uses the state at its start", () => {
  assert.deepEqual(scoreChangeTimes(
    analysis([[0,0,0], [8,10,0], [12,20,0], [25,40,0]], 0, 30),
    analysis([[10,0,0], [18,30,0]], 10, 20),
  ), [12,18]);
});
test("disjoint or empty paths have no navigable changes", () => {
  assert.deepEqual(scoreChangeTimes(analysis([[0,0,0]],0,5), analysis([[10,0,0]],10,20)), []);
  assert.deepEqual(scoreChangeTimes(analysis([]), analysis([[0,0,0]])), []);
});
