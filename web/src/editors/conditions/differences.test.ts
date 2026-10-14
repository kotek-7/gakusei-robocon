import { test } from "node:test";
import assert from "node:assert/strict";
import { defaults, MODEL as model } from "../../engine/model";
import { configDifferences } from "../common/configDifferences";
import { conditionHistory } from "./history";

test("candidate order is immaterial but shared profile positions are meaningful", () => {
  const a = defaults();
  const b = structuredClone(a);
  a.starts = [0, 1]; b.starts = [1, 0];
  assert.equal(configDifferences(a, b, model).length, 0);
  const key = Object.keys(b.profiles)[0];
  b.profiles[key].reverse();
  assert.ok(configDifferences(a, b, model).some((d) => d.id === `profiles.${key}`));
});
test("context includes time and rules; name and capability differences remain specifications", () => {
  const a = defaults(); const b = structuredClone(a);
  b.name = "changed"; b.horizon = 120;
  const key = Object.keys(b.teams[0].caps)[0]; b.teams[0].caps[key] = [false, true];
  assert.deepEqual(configDifferences(a, b, model).filter((d) => d.context).map((d) => d.id), ["horizon"]);
});
test("filtered multi-row restore is one undo step and leaves other changes", () => {
  const a = defaults(); const b = structuredClone(a); b.name = "different"; b.horizon = 120;
  const rows = configDifferences(a, b, model).filter((d) => d.id === "horizon");
  const state = { past: [], present: b, future: [] };
  const restored = conditionHistory(state, { type: "change", edit: (c) => rows.forEach((d) => d.restore(c)) });
  assert.equal(restored.present.horizon, a.horizon); assert.equal(restored.present.name, "different");
  assert.deepEqual(conditionHistory(restored, { type: "undo" }).present, b);
});
test("custom initial root and scenario restore together", () => {
  const a = defaults(); const b = structuredClone(a);
  b.scenario = "custom"; b.root = { t: 12, robots: [], objects: [], mandate: [], ever: [], transfer: [] };
  const initial = configDifferences(a, b, model).find((d) => d.id === "initial")!;
  assert.equal(initial.context, true); initial.restore(b);
  assert.equal(b.scenario, a.scenario); assert.equal(b.root, undefined);
});
