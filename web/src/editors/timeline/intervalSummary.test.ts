import { test } from "node:test";
import assert from "node:assert/strict";
import type { JobInterval } from "../../engine/analysis";
import { actionBreakdown, intervalDetails, intervalSummary } from "./intervalSummary";
const iv = (robot: number, start: number, end: number, kind: string) => ({ robot, start, end, action: { kind } }) as JobInterval;
test("区間端を切り詰め、待機・動作・別機体を区別する", () => {
  const intervals = [iv(0, 0, 5, "move"), iv(0, 5, 12, "wait"), iv(0, 12, 14, "delay"), iv(1, 0, 15, "move")];
  const result = intervalSummary(intervals, [3, 13], 0);
  assert.equal(result.active, 2);
  assert.equal(result.waiting, 8);
  assert.equal(result.count, 3);
  assert.equal(result.longestWait, intervals[1]);
});
test("経路外を待機と見なさず、境界だけ接する動作を除外する", () => {
  assert.deepEqual(intervalSummary([iv(0, 0, 5, "wait")], [5, 20], 0), { count: 0, active: 0, waiting: 0, longestWait: null });
});
test("長さ0の区間は動作を数えない", () => {
  assert.equal(intervalSummary([iv(0, 0, 10, "wait")], [5, 5], 0).count, 0);
});

test("動作内訳は区間で切り詰め、同時に動く機体の時間を加算する", () => {
  const intervals = [iv(0, 0, 5, "move"), iv(0, 5, 10, "wait"), iv(1, 0, 10, "move")];
  assert.deepEqual(actionBreakdown(intervals, [3, 8]), [{ kind: "move", count: 2, seconds: 7 }, { kind: "wait", count: 1, seconds: 3 }]);
  assert.deepEqual(actionBreakdown(intervals, [3, 8], 0), [{ kind: "wait", count: 1, seconds: 3 }, { kind: "move", count: 1, seconds: 2 }]);
});
test("動作詳細は時系列を維持し、元データを変更しない", () => {
  const original = iv(1, 1, 9, "wait");
  const rows = intervalDetails([original, iv(0, 1, 6, "move")], [3, 8]);
  assert.equal(rows[0].interval.robot, 0);
  assert.deepEqual([rows[1].start, rows[1].end, rows[1].seconds], [3, 8, 5]);
  assert.equal(original.start, 1);
  assert.deepEqual(intervalDetails([original], [8, 3]), []);
  assert.deepEqual(intervalDetails([original], [0, Infinity]), []);
});
