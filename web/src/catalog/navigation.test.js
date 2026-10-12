import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalPlans,
  candidates,
  initialHardware,
  backTo,
  scoreRange,
} from "./navigation.js";
import { defaultEstimates, requirements } from "./effort.js";
import { simulate } from "../simulation/engine.js";
const plans = canonicalPlans(),
  estimates = defaultEstimates();
test("top-down leaf keys partition canonical policies and keep source IDs", () => {
  const leaves = new Set();
  for (const mission of ["no", "yes"])
    for (const flip of ["never", "late", "always"])
      for (const reuse of ["no", "yes"])
        for (const zones of [
          "PP",
          "PS",
          "PU",
          "SP",
          "SS",
          "SU",
          "UP",
          "US",
          "UU",
        ])
          for (const supply of ["balanced", "earth", "sky"]) {
            const rows = candidates(
              plans,
              { mission, flip, reuse, zones, supply },
              initialHardware(),
              estimates,
            );
            assert(rows.length <= 1);
            for (const p of rows) {
              assert(!leaves.has(p.id));
              leaves.add(p.id);
              assert(p.sourceIds.includes(p.id));
            }
          }
  assert.equal(leaves.size, 297);
});
test("L1 capability removes incompatible goals and targets; effort uses the same capability limit", () => {
  const h = { ...initialHardware(), level: "lower" },
    rows = candidates(plans, { mission: "no" }, h, estimates);
  assert(rows.length > 0);
  assert.equal(candidates(plans, { mission: "yes" }, h, estimates).length, 0);
  for (const p of rows) {
    assert(!p.zones.includes("U"));
    assert(!requirements(p).some((c) => c.id === "upper"));
    assert(requirements(p).some((c) => c.id === "br_stairs"));
  }
  const full = candidates(
    plans,
    { mission: "no", zones: "PP", flip: "never" },
    initialHardware(),
    estimates,
  )[0];
  assert(
    requirements(full).some((c) => c.id === "upper"),
    "fallback to L2 requires capability even if priority is P",
  );
});
test("L1 restriction applies to fallback building and reflection during simulation", () => {
  const h = { ...initialHardware(), level: "lower" };
  for (const flip of ["never", "late", "always"]) {
    const p = candidates(plans, { mission: "no", flip }, h, estimates)[0];
    const run = simulate(p, plans.at(-1));
    assert(
      run.frames.every((f) =>
        f.robots.filter((r) => r.team === 0).every((r) => r.p[1] <= 0.6),
      ),
    );
    assert(
      run.frames
        .at(-1)
        .towers.slice(6)
        .every((t) => !t.earth.includes(0) && t.sky !== 0),
    );
  }
  const invalid = { ...plans[0], mission: true, allowedZones: ["P", "S"] };
  assert.throws(() => simulate(invalid, plans[0]), /activity area/);
});
test("returning to a parent removes dependent answers; zero budget is not ignored", () => {
  assert.deepEqual(
    backTo(
      {
        mission: "no",
        flip: "always",
        reuse: "yes",
        zones: "SP",
        supply: "earth",
      },
      2,
    ),
    { mission: "no" },
  );
  assert.equal(
    candidates(plans, {}, initialHardware(), estimates, "0").length,
    0,
  );
  assert.equal(scoreRange(plans, new Map()), null);
  assert.deepEqual(
    scoreRange(plans, new Map([[plans[0].id, { scores: [20, 30] }]])),
    [20, 30],
  );
});
