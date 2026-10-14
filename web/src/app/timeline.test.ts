import { test } from "node:test";
import assert from "node:assert/strict";
import { eventTimes, nextEventTime } from "../editors/timeline/navigation";
import type { Marker } from "../engine/analysis";

const markers: Marker[] = [
  { t: 20, kind: "flip", robot: 1, team: 0, edge: 1 },
  { t: 10, kind: "place", robot: 1, team: 0, edge: 2 },
  { t: 30, kind: "flip", robot: 3, team: 1, edge: 3 },
  { t: 20, kind: "flip", robot: 0, team: 0, edge: 4 },
  { t: 40, kind: "mandate", robot: null, team: 1, edge: 5 },
];
test("event navigation matches kind and visible robot lanes, with unique sorted times", () => {
  assert.deepEqual(eventTimes(markers, "flip", [true, true, false, false]), [20]);
  assert.deepEqual(eventTimes(markers, "all", [false, false, true, false]), [40]);
  assert.deepEqual(eventTimes(markers, "all", [false, false, false, false]), []);
  assert.deepEqual(eventTimes(markers, "all", [true, true, true, true]), [10, 20, 30, 40]);
});
test("navigation skips the current timestamp and never wraps unexpectedly", () => {
  assert.equal(nextEventTime([10, 20, 30], 20, 1), 30);
  assert.equal(nextEventTime([10, 20, 30], 20, -1), 10);
  assert.equal(nextEventTime([10, 20, 30], 30, 1), null);
  assert.equal(nextEventTime([], 0, -1), null);
});
