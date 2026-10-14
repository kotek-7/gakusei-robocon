import { test } from "node:test";
import assert from "node:assert/strict";
import type { JobInterval, MatchAnalysis } from "../../engine/analysis";
import { executionRows, executionTotals, overlappingExecution } from "./execution";
const interval = (robot: number, start: number, end: number, kind: string): JobInterval => ({ robot, start, end, planned: end + 5, action: { kind }, edge: start, from: "startA0" });
const analysis = (intervals: JobInterval[]): MatchAnalysis => ({ start: 10, end: 40, intervals, samples: [], markers: [], spots: [], stock: [], mandate: [] });
test("execution uses observed durations, separates move/wait, retains unrecorded time", () => {
  const value = analysis([interval(0, 5, 15, "move"), interval(0, 15, 25, "place"), interval(0, 30, 35, "delay")]);
  const rows = executionRows(value, [0, 50]);
  assert.deepEqual(rows.map(row => [row.start, row.end]), [[10, 15], [15, 25], [30, 35]]);
  assert.deepEqual(executionTotals(rows, [10, 40], 0), { work: 10, move: 5, wait: 5, unrecorded: 10, count: 3 });
  assert.equal(value.intervals[0].start, 5);
  assert.equal(rows[0].interval.planned, 20);
});
test("simultaneous execution excludes same robot and touching endpoints, clips overlap", () => {
  const rows = executionRows(analysis([interval(0, 10, 20, "place"), interval(1, 15, 30, "move"), interval(2, 20, 30, "wait"), interval(3, 5, 15, "pick")]), [12, 25]);
  assert.deepEqual(overlappingExecution(rows, rows.find(row => row.interval.robot === 0)!).map(row => [row.interval.robot, row.overlap]), [[3, 3], [1, 5]]);
});
test("invalid and empty ranges cannot manufacture wait or activity", () => {
  const value = analysis([interval(0, 10, 20, "wait")]);
  assert.deepEqual(executionRows(value, [20, 10]), []);
  assert.deepEqual(executionRows(value, [NaN, 20]), []);
  assert.equal(executionTotals([], [10, 40], 3).unrecorded, 30);
});
