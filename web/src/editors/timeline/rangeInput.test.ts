import { test } from "node:test";
import assert from "node:assert/strict";
import { editRangeEndpoint } from "./rangeInput";
test("range endpoint editing preserves opposite endpoint and order", () => {
  assert.deepEqual(editRangeEndpoint([10, 30], 0, "12.5", 180), [12.5, 30]);
  assert.deepEqual(editRangeEndpoint([10, 30], 0, "50", 180), [30, 30]);
  assert.deepEqual(editRangeEndpoint([10, 30], 1, "5", 180), [10, 10]);
  assert.deepEqual(editRangeEndpoint([10, 30], 1, "300", 180), [10, 180]);
  assert.deepEqual(editRangeEndpoint([10, 30], 0, "-5", 180), [0, 30]);
});
test("invalid drafts do not replace a valid selection", () => {
  for (const draft of ["", " ", "bad", "Infinity"]) assert.equal(editRangeEndpoint([10, 30], 1, draft, 180), null);
});
