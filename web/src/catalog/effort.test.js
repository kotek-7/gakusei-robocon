import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "./plans.ts";
import { requirements, effort, defaultEstimates } from "./effort.ts";
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
