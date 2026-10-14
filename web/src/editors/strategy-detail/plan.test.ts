import { test } from "node:test";
import assert from "node:assert/strict";
import { planRows, planTargets, spotDescription } from "./plan";

test("plan rows retain order and do not invent tower height, quantity or timing", () => {
  const rows = planRows([{ kind: "build", spot: 6 }, { kind: "flip", spot: 4 }, { kind: "build", spot: 6 }]);
  assert.deepEqual(rows.map(row => row.order), [1, 2, 3]);
  assert.ok(rows.every(row => row.recorded === ""));
  assert.equal(rows[0].area, "L2・共有");
  assert.equal(rows[0].action, "建設");
});
test("target grouping preserves revisits and original order", () => {
  const groups = planTargets([{ kind: "build", spot: 6 }, { kind: "flip", spot: 4 }, { kind: "flip", spot: 6 }, { kind: "mustika" }]);
  assert.deepEqual(groups.map(g => g.orders), [[1, 3], [2], [4]]);
  assert.deepEqual(groups[0].actions, ["建設", "スカイ反転"]);
  assert.equal(groups[2].target, "中央柱");
});
test("legacy optional fields and unknown locations remain explicit", () => {
  const rows = planRows([{ kind: "deliver", count: 2, at: 0 }, { kind: "build", spot: 100, height: 2 }]);
  assert.equal(rows[0].recorded, "数量指定 2・時刻指定 0秒");
  assert.equal(rows[1].recorded, "高さ指定 2段");
  assert.equal(spotDescription(100), "位置未記録");
  assert.deepEqual(planTargets([]), []);
});

import { instructionResources, instructionRow } from "./plan";
test("fixed instructions retain travel and zero-time waits independently of completions", () => {
  assert.equal(instructionRow({kind:"until", at:0}, 4).action, "0秒まで待機");
  assert.equal(instructionRow({kind:"travel", dest:"spot6-0"}, 0).location, "赤・建設スポット 6");
});
test("resource matching keeps stacks, selected layers, faces and transfer history", () => {
  const attrs=["S",-1,0,[true,false]];
  const demand=JSON.stringify([[JSON.stringify(["robot0",attrs]),JSON.stringify(["robot0",attrs])],[JSON.stringify(["store0",[["E",0,0,[false,false]],["E",0,0,[false,false]]],[1]])]]);
  const result=instructionResources(demand);
  assert.match(result[0],/スカイ（赤面）\[?/);
  assert.match(result[0],/赤受渡済/);
  assert.match(result[0],/×2/);
  assert.match(result[1],/下から2段目/);
  assert.deepEqual(instructionResources("[[],[]]"),[]);
  assert.deepEqual(instructionResources("invalid"),["物体条件を解読できません"]);
});

import { instructionSummary } from "./plan";
test("robot summary counts fixed commands and retains unique locations without claiming outcomes", () => {
  const result = instructionSummary([
    {kind:"travel",dest:"spot6-0"},
    {kind:"operation",at:"spot6-0",action:{kind:"place",spot:6},demand:"[[],[]]"},
    {kind:"operation",at:"spot6-0",action:{kind:"place",spot:6},demand:"[[],[]]"},
    {kind:"until",at:160},
    {kind:"travel",dest:"spot7-0"},
  ]);
  assert.equal(result.count, 5);
  assert.deepEqual(result.actions, [{action:"移動",count:2},{action:"設置",count:2},{action:"時刻待機",count:1}]);
  assert.deepEqual(result.destinations, ["赤・建設スポット 6", "赤・建設スポット 7"]);
  assert.deepEqual(instructionSummary([]), {count:0,actions:[],destinations:[]});
});
