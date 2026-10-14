import test from "node:test";
import assert from "node:assert/strict";
import type { Frame } from "../engine/types";
import { headingAt } from "./heading";
const frame = (t: number, x: number, z: number): Frame => ({
  t,
  scores: [0, 0],
  robots: [
    {
      id: "赤TR",
      team: 0,
      role: "TR",
      p: [x, 0, z],
      state: "move",
      location: "base0",
      action: null,
      carry: [],
    },
  ],
  objects: [],
  mandate: [false, false],
});
test("robot heading is independent of forward, backward and random seek order", () => {
  const frames = [
    frame(0, 0, 0),
    frame(1, 1, 0),
    frame(2, 1, 1),
    frame(3, 1, 1),
  ];
  const expected = [Math.PI / 2, Math.PI / 2, 0, 0];
  for (const order of [
    [0, 1, 2, 3],
    [3, 2, 1, 0],
    [2, 0, 3, 1],
  ]) {
    for (const i of order)
      assert.equal(headingAt(frames, frames[i], 0), expected[i]);
  }
});
