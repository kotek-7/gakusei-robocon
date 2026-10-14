import test from "node:test";
import assert from "node:assert/strict";
import { milestoneCells } from "./milestones";

test("compact milestones retain robot, phase, spot zero and both earth owners with multiplicity", () => {
  const cells = milestoneCells(JSON.stringify([1, "finish", "place", null, 0, ["E0", "E0", "E1", "S"]]));
  assert.equal(cells.actor, "赤BR");
  assert.equal(cells.action, "設置");
  assert.equal(cells.phase, "完了");
  assert.equal(cells.location, "スポット 0");
  assert.equal(cells.objects, "赤アース×2・青アース×1・スカイ×1");
});
test("destination and spot remain distinct; start and blocked phases remain visible", () => {
  assert.equal(milestoneCells(JSON.stringify([2, "start", "move", "spot1-1", 2, []])).location, "青・スポット 1 / スポット 2");
  assert.equal(milestoneCells(JSON.stringify([3, "blocked", "flip", null, 1, []])).phase, "競合で不成立");
});
