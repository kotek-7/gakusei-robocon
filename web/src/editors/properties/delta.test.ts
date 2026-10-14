import { test } from "node:test";
import assert from "node:assert/strict";
import { stateDelta } from "./delta";
import type { Detail, Obj } from "../../engine/types";
const object: Obj = { id: 1, kind: "sky", loc: "tower1", owner: -1, face: 0, slot: 0, layer: 3, delivered: [false, false] };
const detail = { id: 1, scores: [10, 0], state: { t: 10, objects: [object], robots: [{ pos: "spot1-0", job: null }] } } as Detail;
test("state delta detects a flip at the same location and a transfer credit without motion", () => {
  const after = structuredClone(detail); after.id = 2; after.state.t = 14; after.scores = [0, 10];
  after.state.objects[0].face = 1;
  assert.deepEqual(stateDelta(detail, after).scores, [-10, 10]);
  assert.equal(stateDelta(detail, after).objects.length, 1);
  assert.equal(stateDelta(detail, after).seconds, 4);
  after.state.objects[0].face = 0;
  after.state.objects[0].delivered[0] = true;
  assert.equal(stateDelta(detail, after).objects.length, 1);
  assert.equal(stateDelta(detail, detail).objects.length, 0);
  assert.equal(detail.state.objects[0].delivered[0], false);
});
