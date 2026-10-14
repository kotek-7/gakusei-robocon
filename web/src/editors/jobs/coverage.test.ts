import { test } from "node:test";
import assert from "node:assert/strict";
import type { Discovery } from "../../engine/types";
import { coverageRows } from "./coverage";
test("coverage isolates unfinished comparisons and retains empty runs", () => {
  const report = { runs: [
    { run: 0, candidates: [{ pending: 2, responses: [] }, { pending: 4, responses: [{}] }], frontier: 2, scopeComplete: false },
    { run: 1, candidates: [], frontier: 4, scopeComplete: false },
    { run: 2, candidates: [{ pending: 0, responses: [] }], frontier: 0, scopeComplete: true },
  ] } as Discovery;
  assert.deepEqual(coverageRows(report, "pending", "id").map((r) => [r.run, r.pending, r.responses]), [[0, 6, 1]]);
  assert.deepEqual(coverageRows(report, "empty", "id").map((r) => r.run), [1]);
  assert.deepEqual(coverageRows(report, "all", "frontier").map((r) => r.run), [1, 0, 2]);
  assert.equal(report.runs[0].run, 0);
});
