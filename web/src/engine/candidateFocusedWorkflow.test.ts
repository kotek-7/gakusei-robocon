import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { defaults } from "./model";
import { Store } from "./store";
import { DiscoveryEngine } from "./discovery";
import { Persistence } from "./persistence";
import { Runtime } from "./runtime";
import type { EngineEvent } from "./protocol";

function fixture() {
  const store = Store.create({ ...defaults(), scenario: "endgame", horizon: 180 });
  const engine = new DiscoveryEngine(store);
  for (let i = 0; i < 1000 && !engine.d.runs[0]?.candidates.length; i++) engine.tick();
  const candidate = engine.d.runs[0].candidates[0];
  assert.ok(candidate);
  return { store, engine, candidate, target: { run: 0, candidate: candidate.id, mode: "counter" as const } };
}

test("new opponent discovery reopens previously completed candidate checks", () => {
  const { engine, candidate, target } = fixture();
  const compare = { ...target, mode: "compare" as const };
  for (let i = 0; i < 2000 && engine.tick(compare); i++);
  assert.equal(engine.analysis(0, candidate.id).compare.complete, true);
  const before = engine.analysis(0, candidate.id).opponents;
  for (let i = 0; i < 2000 && engine.analysis(0, candidate.id).opponents === before; i++) engine.tick(target);
  assert.ok(engine.analysis(0, candidate.id).opponents > before);
  assert.equal(engine.analysis(0, candidate.id).compare.complete, false);
  const ticks = engine.analysis(0, candidate.id).compare.ticks;
  for (let i = 0; i < 4000 && engine.tick(compare); i++);
  const after = engine.analysis(0, candidate.id);
  assert.equal(after.compare.complete, true);
  assert.ok(after.compare.ticks > ticks);
  assert.equal(after.checkedOpponents, after.opponents);
  assert.equal(engine.d.runs[0].complete, false);
});

test("candidate analysis handles large saved response collections without argument overflow", () => {
  const { engine, candidate } = fixture();
  candidate.responses = Array.from({ length: 200_000 }, (_, i) => ({ ...candidate.baseline, kind: "procedure", scores: [i === 199_999 ? -7 : 100, 0] }));
  const analysis = engine.analysis(0, candidate.id);
  assert.equal(analysis.responses, 200_000);
  assert.equal(analysis.worstMargin, -7);
});


test("focused completion reports its target while global scope remains incomplete", async () => {
  const { store, target } = fixture();
  const persistence = new Persistence(crypto.randomUUID());
  const runtime = new Runtime(persistence);
  const events: EngineEvent[] = [];
  runtime.subscribe(event => events.push(event));
  const focused = { ...target, mode: "compare" as const };
  try {
    await persistence.save(store);
    await runtime.call("job.start", { search: store.data.id, kind: "discovery", seconds: 1, target: focused });
    await runtime.wait(store.data.id);
    const finished = events.filter(event => event.type === "job.finished");
    assert.equal(finished.length, 1);
    assert.deepEqual(finished[0].target, focused);
    assert.equal(finished[0].reason, "exhausted");
    const saved = await persistence.load(store.data.id);
    assert.equal(saved.summary().discovery?.scopeComplete, false);
    assert.equal(saved.summary().discovery?.activeTarget, null);
  } finally { await runtime.pause(store.data.id); await persistence.close(); }
});
