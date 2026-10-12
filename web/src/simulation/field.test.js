import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  dimensions,
  spots,
  skyLayout,
  transfer,
  startPosition,
  skyApproach,
  earthApproach,
  mustikaApproach,
  spotApproach,
} from "./field.js";
import { planMovement } from "./movement.js";
test("CAD asset matches the supplied STEP and has expected real dimensions", () => {
  const cad = JSON.parse(
    fs.readFileSync(
      new URL("../viewport/generated/field.json", import.meta.url),
    ),
  );
  const step = fs.readFileSync(
    new URL("../../../rulebook/field-2027.step", import.meta.url),
  );
  assert.equal(cad.sha256, createHash("sha256").update(step).digest("hex"));
  const a = cad.meshes.flatMap((m) => m.positions);
  const size = [0, 1, 2].map((k) => {
    let xs = a.filter((_, i) => i % 3 === k);
    return Math.max(...xs) - Math.min(...xs);
  });
  assert.equal(size[0], 11);
  assert.equal(size[2], 11);
  assert(Math.abs(size[1] - 1.701) < 1e-6);
  assert.equal(dimensions.earth, 0.35);
  assert.equal(dimensions.sky, 0.2);
  assert.equal(dimensions.mustika, 0.21);
  assert.equal(spots.length, 10);
  assert.equal(skyLayout.length, 12);
  assert(skyLayout.every((s) => Math.hypot(s.p[0], s.p[2] - 4.607333306) > 0));
});
test("TR reaches transfer through the ramp, never through L1 or the platform", () => {
  for (let team = 0; team < 2; team++)
    for (const from of [
      startPosition(team, "TR"),
      earthApproach(team),
      skyApproach(team),
      mustikaApproach(team),
    ]) {
      const r = planMovement({ team, role: "TR", p: from }, transfer(team));
      assert(r.route.some((p) => Math.abs(p[0]) === 3.5 && p[2] === -2.694));
      assert(r.route.every((p) => p[1] <= 0.6));
      for (let k = 1; k < r.route.length; k++)
        for (let j = 0; j <= 20; j++) {
          const p = r.route[k].map(
            (v, i) => r.route[k - 1][i] + ((v - r.route[k - 1][i]) * j) / 20,
          );
          assert(
            !(Math.abs(p[0]) < 3 && Math.abs(p[2]) < 3),
            "TR must stay outside central L1",
          );
        }
    }
});
test("BR reaches every eligible tower via L1/L2 stairs without crossing the other private area", () => {
  for (let team = 0; team < 2; team++)
    for (let i = 0; i < spots.length; i++) {
      if (spots[i][4] >= 0 && spots[i][4] !== team) continue;
      const r = planMovement(
        { team, role: "BR", p: transfer(team) },
        spotApproach(i, team),
      );
      assert(r.route.every((p) => p[1] >= 0.6));
      assert(r.route.every((p) => p[1] > 0.6 || p[0] * (team ? 1 : -1) > 0));
      if (i >= 6) assert(r.route.some((p) => p[1] === 0.75));
    }
});
