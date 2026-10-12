import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../catalog/plans.ts";
import { createSession } from "./session.ts";
test("selection and performance changes preserve the export contract", () => {
  const session = createSession(catalog());
  session.changePerformance("speed", 2);
  session.select(50);
  assert.equal(session.run.cfg.speed, 2);
  assert.equal(session.run.plan.id, 50);
  assert.deepEqual(Object.keys(session.exportResult()), [
    "selected",
    "enemy",
    "cfg",
    "events",
    "finalScores",
    "modelVersion",
    "winner",
    "ranks",
  ]);
});
test("invalid changes preserve the last valid run", () => {
  const s = createSession(catalog()),
    before = s.run;
  assert.throws(() => s.changePerformance("speed", 0));
  assert.equal(s.run, before);
  assert.throws(() => s.changeOpponent("missing"));
  assert.equal(s.run, before);
});
