import { test } from "node:test";
import assert from "node:assert/strict";
import { defaults } from "../engine/model";
import { valueAt, withValue, sweepCases, type Parameter } from "./values";
const speed: Parameter = {
  kind: "profiles",
  key: "move",
  label: "移動速度",
  unit: "m/s",
};
test("editing a resolved value preserves the other side and the source condition", () => {
  const source = defaults(),
    original = structuredClone(source),
    blue = valueAt(source, speed, 1);
  const red = withValue(source, speed, 0, 1.25);
  assert.equal(valueAt(red, speed, 0), 1.25);
  assert.equal(valueAt(red, speed, 1), blue);
  assert.deepEqual(source, original);
  const next = withValue(red, speed, 1, 2.5);
  assert.equal(valueAt(next, speed, 0), 1.25);
  assert.equal(valueAt(next, speed, 1), 2.5);
});
test("sweep expands independent singleton configurations and rejects invalid values", () => {
  const source = defaults();
  const cases = sweepCases(source, speed, 0, "1、1.5 2 1");
  assert.equal(cases.length, 3);
  assert.deepEqual(
    cases.map((c) => valueAt(c.config, speed, 0)),
    [1, 1.5, 2],
  );
  assert.ok(
    cases.every((c) =>
      c.config.teams.every((t) =>
        Object.values(t.speeds).every((v) => v.length === 1),
      ),
    ),
  );
  assert.throws(() => sweepCases(source, speed, 0, "0"));
  assert.throws(() => sweepCases(source, speed, 0, "NaN"));
  const capacity: Parameter = {
    kind: "caps",
    key: "capacity_br",
    label: "BR保持容量",
    unit: "個",
  };
  assert.throws(() => sweepCases(source, capacity, 0, "3"));
  assert.throws(() => sweepCases(source, capacity, 0, "1.5"));
});
test("boolean sweep supports explicit Japanese values", () => {
  const p: Parameter = { kind: "caps", key: "flip", label: "反転", unit: "" };
  assert.deepEqual(
    sweepCases(defaults(), p, 1, "あり、なし").map((c) =>
      valueAt(c.config, p, 1),
    ),
    [true, false],
  );
  assert.throws(() => sweepCases(defaults(), p, 1, "たぶん"));
});
