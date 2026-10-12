import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../catalog/plans.js";
import { simulate } from "./engine.js";
const plans = catalog();
test("catalog enumerates bounded grammar without duplicate recipes", () => {
  assert.equal(plans.length, 441);
  assert.equal(
    new Set(plans.map(({ id, ...p }) => JSON.stringify(p))).size,
    441,
  );
  assert(
    plans.every(
      (p) => p.zones.join("") !== "PP" || (!p.mission && p.mode === "build"),
    ),
  );
});
test("replay is deterministic and mandates are permanent", () => {
  let a = simulate(plans[0], plans[140]),
    b = simulate(plans[0], plans[140]);
  assert.deepEqual(a, b);
  for (let i = 1; i < a.frames.length; i++)
    for (let t = 0; t < 2; t++)
      if (a.frames[i - 1].teams[t].mandate)
        assert(a.frames[i].teams[t].mandate);
});
test("resources and carrying limits are conserved across all recipes", () => {
  for (let p of plans) {
    let r = simulate(p, plans[140]);
    for (let f of r.frames) {
      let e =
        f.teams.reduce((n, t) => n + t.earth + t.bufferE, 0) +
        f.towers.reduce((n, t) => n + t.earth.length, 0) +
        f.robots.reduce(
          (n, r2) => n + r2.carry.filter((c) => c === "E").length,
          0,
        );
      let s =
        f.groundSky +
        f.teams.reduce((n, t) => n + t.bufferS, 0) +
        f.towers.filter((t) => t.sky !== null).length +
        f.robots.reduce(
          (n, r2) => n + r2.carry.filter((c) => c === "S").length,
          0,
        );
      assert.equal(e, 40, `earth plan ${p.id}`);
      assert.equal(s, 12, `sky plan ${p.id}`);
      assert(
        f.robots.every((r2) => r2.carry.length <= (r2.role === "TR" ? 3 : 2)),
      );
      assert(
        f.towers.every(
          (t) =>
            t.earth.length <= 2 && (t.sky === null || t.earth.length === 2),
        ),
      );
    }
  }
});
test("failed manipulations retain resources and scoring is nonnegative", () => {
  let r = simulate(plans[2], plans[80], { success: 0.55 });
  assert(r.events.some((e) => e.label.includes("再試行")));
  assert(r.scores.every((s) => s >= 0));
});
test("rejects invalid performance and plans instead of returning plausible scores", () => {
  for (const cfg of [
    { speed: 0 },
    { speed: NaN },
    { handling: -1 },
    { success: 1.1 },
    { priority: 2 },
    { seed: Infinity },
  ])
    assert.throws(() => simulate(plans[0], plans[1], cfg));
  assert.throws(() => simulate({ ...plans[0], zones: ["wrong"] }, plans[1]));
});
test("match ends exactly at 180 without dispatching new tasks", () => {
  const run = simulate(plans[0], plans[140]);
  assert.equal(run.frames.at(-1).t, 180);
  assert.deepEqual(run.frames.at(-1).scores, run.scores);
  assert(run.events.every((e) => e.t <= 180));
  assert(run.intervals.every((i) => i.start < 180));
  assert(
    run.events.some((e) => Math.abs(e.t * 2 - Math.round(e.t * 2)) > 1e-5),
    "events must not be rounded to half-seconds",
  );
});
test("held Sky is excluded from tower score during a flip", () => {
  const p = { ...plans[0], mode: "flip", end: "flip" };
  const run = simulate(p, p, { speed: 2.5, handling: 5 });
  let held = 0;
  for (const f of run.frames) {
    for (const r of f.robots)
      if (r.role === "BR" && r.state.includes("裏返す") && r.carry.includes("S"))
        held++;
    const expected = f.teams.map(
      (t, i) =>
        t.transfer +
        f.towers.reduce(
          (sum, w, k) =>
            sum +
            w.earth.reduce(
              (n, o, j) => n + (o === i ? (j ? 20 : 10) * (k >= 6 ? 2 : 1) : 0),
              0,
            ) +
            (w.sky === i ? 40 * (k >= 6 ? 2 : 1) : 0),
          0,
        ) +
        (f.mustika === i ? 250 : 0),
    );
    assert.deepEqual(f.scores, expected);
  }
  assert(held > 0);
});
test("Mustika is unique even with failed handling", () => {
  for (const success of [0, 0.55, 1]) {
    const r = simulate(plans[0], plans[140], {
      speed: 2.5,
      handling: 0.5,
      success,
    });
    for (const f of r.frames) {
      const count =
        Number(f.mustika === "ground" || typeof f.mustika === "number") +
        f.teams.filter((t) => t.mustika).length +
        f.robots.reduce(
          (n, r) => n + r.carry.filter((c) => c === "M").length,
          0,
        );
      assert.equal(count, 1);
    }
  }
});
test("mirrored identical policies do not inherit a left-hand target ordering bias", () => {
  for (const plan of plans) {
    const red = simulate(plan, plan, { priority: 0 }, false);
    const blue = simulate(plan, plan, { priority: 1 }, false);
    assert.deepEqual(
      red.scores,
      [blue.scores[1], blue.scores[0]],
      `plan ${plan.id}`,
    );
  }
});
