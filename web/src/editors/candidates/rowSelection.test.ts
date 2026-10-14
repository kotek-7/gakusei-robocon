import test from "node:test";
import assert from "node:assert/strict";
import { rowIndexForKey } from "./rowSelection";

test("row selection clamps at ends and Home/End reach visible endpoints", () => {
  assert.equal(rowIndexForKey("ArrowUp", 0, 3), 0);
  assert.equal(rowIndexForKey("ArrowDown", 2, 3), 2);
  assert.equal(rowIndexForKey("ArrowDown", 0, 3), 1);
  assert.equal(rowIndexForKey("Home", 2, 3), 0);
  assert.equal(rowIndexForKey("End", 0, 3), 2);
});
test("activation and empty tables do not produce selection indices", () => {
  assert.equal(rowIndexForKey("Enter", 1, 3), null);
  assert.equal(rowIndexForKey("End", 0, 0), null);
  assert.equal(rowIndexForKey("Tab", 1, 3), null);
});
