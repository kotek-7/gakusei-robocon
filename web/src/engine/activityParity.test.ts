import { test } from "node:test";
import assert from "node:assert/strict";
import { ActivityTrace } from "./activity";
import { DiscoveryEngine } from "./discovery";
import { defaults } from "./model";
import { Store } from "./store";

// The observer must not change continuation cursors, choices, or generated evidence.
test("live observation preserves exact exploration and its continuation state", () => {
  const plain = Store.create({ ...defaults(), horizon: 2 });
  const observed = new Store(structuredClone(plain.data));
  observed.activity = new ActivityTrace("exact");
  for (const store of [plain, observed]) {
    let iterations = 0, processed = 0;
    while (processed < 200 && !store.summary().complete) {
      assert.ok(++iterations < 1000);
      processed += store.batch(Math.min(100, 200 - processed));
    }
  }
  assert.deepEqual(observed.data, plain.data);
  assert.ok(observed.activity.units > 0);
});

test("live observation preserves discovered branches and candidate evidence", () => {
  const plain = Store.create(defaults());
  const observed = new Store(structuredClone(plain.data));
  observed.activity = new ActivityTrace("discovery");
  const a = new DiscoveryEngine(plain), b = new DiscoveryEngine(observed);
  for (let i = 0; i < 150; i++) {
    assert.equal(a.tick(), b.tick());
  }
  assert.deepEqual(observed.data, plain.data);
  assert.ok(observed.activity.units > 0);
});
