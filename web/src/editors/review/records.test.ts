import { test } from "node:test";
import assert from "node:assert/strict";
import { filterRecords, reviewText } from "./records";
import type { ReviewRecord } from "../../engine/protocol";

const records: ReviewRecord[] = [
  { id: "one", title: "搬送待ち", note: "BR の復帰を確認", node: 12, path: [1, 3], time: 14, range: [10, 20], selection: "robot:1", status: "open", created: 1 },
  { id: "two", title: "反転", note: "終盤", node: 24, path: [2, 4], time: 175, range: null, selection: null, status: "keep", created: 2 },
];
test("review filters combine title, note and node without changing stored order", () => {
  assert.deepEqual(filterRecords(records, "br 12", "open").map(r => r.id), ["one"]);
  assert.deepEqual(filterRecords(records, "", "keep").map(r => r.id), ["two"]);
  assert.equal(filterRecords(records, "反転", "open").length, 0);
  assert.deepEqual(records.map(r => r.id), ["one", "two"]);
});
test("copied review text carries human decisions and the replay boundary", () => {
  const text = reviewText(records.slice(0, 1));
  assert.match(text, /判断: 未確認/);
  assert.match(text, /局面: 12 \/ 14秒 \/ 範囲: 10〜20秒/);
  assert.match(text, /BR の復帰を確認/);
  assert.equal(text.includes("反転"), false);
});
