import test from "node:test";
import assert from "node:assert/strict";
import { createRenderDemand } from "./renderDemand";

test("a stopped visible viewport renders once, then no draws across idle frames", () => {
  const demand = createRenderDemand();
  assert.equal(demand.consume(true), true);
  for (let frame = 0; frame < 120; frame++) assert.equal(demand.consume(true), false);
});

test("scene updates coalesce, and each camera damping change draws its new position", () => {
  const demand = createRenderDemand();
  demand.consume(true);
  demand.invalidate(); // actors
  demand.invalidate(); // labels
  demand.invalidate(); // trails
  assert.equal(demand.consume(true), true);
  assert.equal(demand.consume(true), false);
  for (let step = 0; step < 8; step++) {
    demand.invalidate(); // OrbitControls change
    assert.equal(demand.consume(true), true);
  }
  assert.equal(demand.consume(true), false);
});

test("hidden mutations are retained and showing an unchanged workspace redraws", () => {
  const demand = createRenderDemand();
  demand.consume(true);
  assert.equal(demand.consume(false), false);
  demand.invalidate();
  assert.equal(demand.consume(false), false);
  assert.equal(demand.consume(true), true);
  assert.equal(demand.consume(true), false);
  demand.consume(false);
  assert.equal(demand.consume(true), true);
  assert.equal(demand.consume(true), false);
});
