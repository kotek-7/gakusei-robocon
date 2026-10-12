import test from "node:test";
import assert from "node:assert/strict";
import { createPlayback, frameAt } from "./playback.js";
test("seek clamps, playback uses speed and pauses at match end", () => {
  const p = createPlayback();
  p.seek(-1);
  assert.equal(p.time, 0);
  p.setSpeed(4);
  p.toggle();
  p.tick(2);
  assert.equal(p.time, 8);
  p.seek(179);
  p.tick(1);
  assert.equal(p.time, 180);
  assert.equal(p.playing, false);
});
test("interpolation moves only positions, preserving scores and source frames", () => {
  const run = {
    frames: [
      { scores: [0, 0], robots: [{ p: [0, 0, 0] }] },
      { scores: [10, 0], robots: [{ p: [2, 1, 4] }] },
    ],
  };
  let frame = frameAt(run, 0.25);
  assert.deepEqual(frame.robots[0].p, [1, 0.5, 2]);
  assert.deepEqual(frame.scores, [0, 0]);
  assert.deepEqual(run.frames[0].robots[0].p, [0, 0, 0]);
});
test("playing from the end restarts and invalid time inputs are ignored", () => {
  const p = createPlayback();
  p.seek(180);
  p.toggle();
  assert.equal(p.time, 0);
  p.tick(1);
  assert.equal(p.time, 1);
  p.seek(NaN);
  p.tick(-5);
  assert.equal(p.time, 1);
});
