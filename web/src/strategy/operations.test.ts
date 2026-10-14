import test from "node:test";
import assert from "node:assert/strict";
import { createStudy, alternatives } from "../study/state";
import { copyPolicy, moveTarget, acceptVariants, changes } from "./operations";
test("copy across libraries owns its target array and ID", () => {
  const p = createStudy().policies[0];
  const copy = copyPolicy(p);
  assert.notEqual(copy.id, p.id);
  copy.targets.reverse();
  assert.notDeepEqual(copy.targets, p.targets);
});
test("target movement supports both ends without changing original", () => {
  const targets = [0, 1, 4, 5];
  assert.deepEqual(moveTarget(targets, 0, 3), [1, 4, 5, 0]);
  assert.deepEqual(moveTarget(targets, 3, 0), [5, 0, 1, 4]);
  assert.deepEqual(moveTarget(targets, 0, -1), targets);
  assert.deepEqual(targets, [0, 1, 4, 5]);
});
test("accepting variants deduplicates by behavior and obeys library capacity", () => {
  const p = createStudy().policies[0];
  const variants = alternatives(p, [p]);
  assert.ok(variants.length);
  assert.deepEqual(acceptVariants([p], [copyPolicy(p)]), [p]);
  const full = Array.from({ length: 99 }, () => copyPolicy(p));
  assert.equal(acceptVariants(full, variants).length, 100);
  assert.ok(changes(p, variants[0]).length > 0);
});
