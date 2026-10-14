import test from "node:test";
import assert from "node:assert/strict";
import { history, change, undo, redo } from "./history";
test("history is bounded and a new edit invalidates redo", () => {
  let h = history(0);
  for (let i = 1; i <= 60; i++) h = change(h, i);
  assert.equal(h.past.length, 50);
  h = undo(h);
  assert.equal(h.present, 59);
  h = redo(h);
  assert.equal(h.present, 60);
  h = change(undo(h), 100);
  assert.equal(h.future.length, 0);
  assert.equal(h.present, 100);
});
