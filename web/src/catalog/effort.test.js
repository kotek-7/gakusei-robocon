import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "./plans.js";
import { requirements, effort, defaultEstimates, rankedPlans, filterRows } from "./effort.js";
const plans = catalog(), estimates = defaultEstimates();
test("all catalog variants have a finite effort and unique capabilities", () => {
  for (const p of plans) {
    assert.ok(Number.isFinite(effort(p, estimates)));
    const ids = requirements(p).map(c => c.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.includes("base"));
  }
});
test("endgame reflection requires upper access even with private targets", () => {
  const p = { zones: ["P", "P"], mode: "build", mission: false, end: "flip" };
  assert.deepEqual(requirements(p).map(c => c.id), ["base", "shared", "upper", "flip"]);
  assert.equal(effort(p, estimates), 58);
  assert.equal(effort({ ...p, end: "expand" }, estimates), 30);
  assert.equal(effort(p, { ...estimates, flip: 0 }), 46);
});
test("always-flip does not double count a redundant late switch", () => {
  const p = { zones: ["S", "U"], mode: "flip", mission: true, end: "late" };
  assert.ok(!requirements(p).some(c => c.id === "late"));
});
test("Pareto frontier preserves ties, excludes dominated and uncomputed plans", () => {
  const p = { zones: ["P", "P"], mode: "build", mission: false, end: "expand" };
  const rows = rankedPlans([{ ...p, id: 1 }, { ...p, id: 2 }, { ...p, id: 3, mission: true }, { ...p, id: 4 }], new Map([[1,[10,0]],[2,[10,8]],[3,[9,0]]]), estimates);
  assert.deepEqual(rows.map(r => r.frontier), [true,true,false,false]);
  assert.deepEqual(filterRows(rows, { sort:"score" }, () => "").map(r => r.plan.id), [1,2,3,4]);
  assert.deepEqual(filterRows(rows, { frontier:true }, () => "").map(r => r.plan.id), [1,2]);
  assert.equal(filterRows(rows, { budget:"0" }, () => "").length, 0);
  assert.equal(rankedPlans(plans, new Map(), estimates).filter(r => r.frontier).length, 0);
});
