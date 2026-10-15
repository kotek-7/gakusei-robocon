import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { defaults } from "./model";
import { DiscoveryEngine } from "./discovery";
import { Store } from "./store";
import { Persistence, exportSearch, importSearch } from "./persistence";
import { Runtime } from "./runtime";

function engineFixture() {
  const store = Store.create({ ...defaults(), scenario: "endgame", horizon: 180 });
  const engine = new DiscoveryEngine(store);
  for (let i = 0; i < 1000 && (engine.d.runs[0]?.candidates.length ?? 0) < 2; i++) engine.tick();
  assert.ok(engine.d.runs[0].candidates.length >= 2);
  const candidate = engine.d.runs[0].candidates[0].id;
  return { store, engine, candidate, target: { run: 0, candidate, mode: "counter" as const } };
}

async function runtimeFixture() {
  const f = engineFixture();
  const persistence = new Persistence(crypto.randomUUID());
  await persistence.save(f.store);
  const runtime = new Runtime(persistence);
  const live = await runtime.get(f.store.data.id);
  return { ...f, persistence, runtime, live, search: f.store.data.id };
}

test("focused counter search advances only the selected candidate and preserves global scheduling", () => {
  const { engine, target } = engineFixture();
  const untouched = engine.d.jobs.filter(j => j.mode !== target.mode || j.candidate !== target.candidate).map(j => [j.id, j.ticks]);
  const count = engine.d.runs[0].candidates.length;
  const schedule = engine.d.schedule;
  const before = engine.analysis(0, target.candidate);
  for (let i = 0; i < 30; i++) engine.tick(target);
  assert.ok(engine.analysis(0, target.candidate).counter.ticks > before.counter.ticks);
  for (const [id, ticks] of untouched) assert.equal(engine.d.jobs.find(j => j.id === id)!.ticks, ticks);
  assert.equal(engine.d.runs[0].candidates.length, count);
  assert.equal(engine.d.schedule, schedule);
  engine.tick();
  assert.equal(engine.d.schedule, schedule + 1);
});

test("focused shared-procedure checks consume only that candidate's comparison jobs", () => {
  const { engine, target } = engineFixture();
  for (let i = 0; i < 200 && !Object.keys(engine.d.runs[0].opponents).length; i++) engine.tick(target);
  assert.ok(Object.keys(engine.d.runs[0].opponents).length);
  const other = engine.d.jobs.filter(j => j.mode !== "compare" || j.candidate !== target.candidate).map(j => [j.id, j.ticks]);
  const before = engine.analysis(0, target.candidate);
  let finished = false;
  for (let i = 0; i < 1000; i++) if (!engine.tick({ ...target, mode: "compare" })) { finished = true; break; }
  assert.ok(finished);
  const after = engine.analysis(0, target.candidate);
  assert.ok(after.compare.ticks > before.compare.ticks);
  assert.equal(after.compare.complete, true);
  assert.ok(after.checkedOpponents > 0);
  for (const [id, ticks] of other) assert.equal(engine.d.jobs.find(j => j.id === id)!.ticks, ticks);
  assert.equal(engine.d.runs[0].complete, false);
});

test("candidate analysis is read-only and rejects stale selections", async () => {
  const f = await runtimeFixture();
  try {
    const params = { search: f.search, run: 0, candidate: f.candidate };
    const before = JSON.stringify(f.live.data);
    const result = await f.runtime.call("candidate.analysis", params);
    assert.equal(JSON.stringify(f.live.data), before);
    result.counter.ticks = -999;
    assert.notEqual((await f.runtime.call("candidate.analysis", params)).counter.ticks, -999);
    for (const run of [-1, 0.5, NaN, 999]) await assert.rejects(f.runtime.call("candidate.analysis", { ...params, run }));
    await assert.rejects(f.runtime.call("candidate.analysis", { ...params, candidate: "missing" }));
    await assert.rejects(f.runtime.call("job.start", { search: f.search, kind: "discovery", seconds: 1, target: { ...f.target, candidate: "missing" } }));
    assert.equal(f.live.data.job, null);
    assert.equal(JSON.stringify(f.live.data), before);
  } finally { await f.persistence.close(); }
});

test("focused runs can pause and resume with target history surviving reload and backup", async () => {
  const f = await runtimeFixture();
  try {
    const params = { search: f.search, run: 0, candidate: f.candidate };
    await f.runtime.call("job.start", { search: f.search, kind: "discovery", seconds: 60, target: f.target });
    assert.deepEqual(f.live.summary().discovery!.activeTarget, f.target);
    await assert.rejects(f.runtime.call("job.pause", { search: f.search, target: { ...f.target, candidate: "other" } }));
    assert.equal(f.live.data.status, "running");
    assert.deepEqual(f.live.summary().discovery!.activeTarget, f.target);
    await f.runtime.call("job.pause", { search: f.search, target: f.target });
    const first = await f.runtime.call("candidate.analysis", params);
    assert.equal(first.sessions.length, 1);
    assert.equal(first.sessions[0].reason, "cancelled");
    assert.deepEqual(first.sessions[0].target, f.target);
    assert.ok(first.sessions[0].before);
    assert.ok(first.sessions[0].after);
    await f.runtime.call("job.start", { search: f.search, kind: "discovery", seconds: 1, target: f.target });
    await f.runtime.wait(f.search);
    const after = await f.runtime.call("candidate.analysis", params);
    assert.equal(after.sessions.length, 2);
    assert.ok(after.counter.ticks >= first.counter.ticks);
    assert.equal(f.live.summary().discovery!.activeTarget, null);
    const reloaded = new Runtime(f.persistence);
    assert.deepEqual(await reloaded.call("candidate.analysis", params), after);
    const imported = importSearch(exportSearch(f.live));
    await f.persistence.save(imported);
    assert.deepEqual(await reloaded.call("candidate.analysis", { ...params, search: imported.data.id }), after);
  } finally { await f.runtime.pause(f.search); await f.persistence.close(); }
});

test("focused target validation rejects incompatible jobs and malformed targets before mutation", async () => {
  const f = await runtimeFixture();
  try {
    const before = JSON.stringify(f.live.data);
    for (const kind of ["exact", "evaluation"] as const)
      await assert.rejects(f.runtime.call("job.start", { search: f.search, kind, target: f.target }));
    const invalid = [null, false, { ...f.target, mode: "baseline" }, { ...f.target, run: -1 }, { ...f.target, run: 0.5 }, { ...f.target, candidate: "missing" }, {}];
    for (const target of invalid)
      await assert.rejects(f.runtime.call("job.start", { search: f.search, kind: "discovery", target: target as typeof f.target }));
    await assert.rejects(f.runtime.call("job.start", { search: f.search, kind: "discovery", node: f.live.data.runs[0].root, target: f.target }));
    assert.equal(JSON.stringify(f.live.data), before);
  } finally { await f.persistence.close(); }
});

test("interrupted checkpoints retain candidate session evidence exactly once on recover and import", async () => {
  const f = await runtimeFixture();
  try {
    const engine = new DiscoveryEngine(f.live);
    const before = engine.snapshot(f.target);
    for (let i = 0; i < 20; i++) engine.tick(f.target);
    const after = engine.snapshot(f.target);
    engine.d.activeTarget = f.target;
    engine.d.activeSession = { target: f.target, started: Date.now(), seconds: 2, budget: 60, reason: "running", before, after, newCandidates: 0, newStrategies: 0, responses: after.responses - before.responses, scoreChanges: [] };
    f.live.data.status = "running";
    f.live.data.job = "discovery";
    await f.persistence.save(f.live);
    const imported = importSearch(exportSearch(f.live));
    const importedAnalysis = new DiscoveryEngine(imported).analysis(0, f.candidate);
    assert.equal(importedAnalysis.sessions.length, 1);
    assert.equal(importedAnalysis.sessions[0].reason, "interrupted");
    assert.deepEqual(importedAnalysis.sessions[0].after, after);
    await f.persistence.recover();
    await f.persistence.recover();
    const loaded = await f.persistence.load(f.search);
    assert.equal(loaded.data.status, "paused");
    assert.equal(loaded.summary().discovery!.activeTarget, null);
    const recovered = new DiscoveryEngine(loaded).analysis(0, f.candidate);
    assert.equal(recovered.sessions.length, 1);
    assert.equal(recovered.sessions[0].reason, "interrupted");
    assert.deepEqual(recovered.sessions[0].before, before);
    assert.deepEqual(recovered.sessions[0].after, after);
    assert.deepEqual(new DiscoveryEngine(importSearch(exportSearch(loaded))).analysis(0, f.candidate), recovered);
  } finally { await f.persistence.close(); }
});

test("saved focused frontier resumes deterministically without restarting or duplicating responses", () => {
  const { store, engine, target } = engineFixture();
  for (let i = 0; i < 7; i++) engine.tick(target);
  const resumed = new DiscoveryEngine(importSearch(exportSearch(store)));
  assert.deepEqual(resumed.analysis(0, target.candidate), engine.analysis(0, target.candidate));
  for (let i = 0; i < 60; i++) {
    assert.equal(resumed.tick(target), engine.tick(target));
    assert.deepEqual(resumed.snapshot(target), engine.snapshot(target));
  }
  assert.deepEqual(resumed.d.runs[0].candidates, engine.d.runs[0].candidates);
  const responses = engine.d.runs[0].candidates[0].responses;
  assert.equal(new Set(responses.map(row => JSON.stringify([row.opponent, row.path]))).size, responses.length);
});

test("candidate run history excludes another candidate and survives global history trimming", async () => {
  const f = await runtimeFixture();
  try {
    const other = f.live.data.discovery!.runs[0].candidates[1].id;
    for (const candidate of [f.candidate, other]) {
      await f.runtime.call("job.start", { search: f.search, kind: "discovery", seconds: 1, target: { ...f.target, candidate } });
      await f.runtime.wait(f.search);
    }
    const params = { search: f.search, run: 0, candidate: f.candidate };
    const history = (await f.runtime.call("candidate.analysis", params)).sessions;
    assert.equal(history.length, 1);
    assert.equal(history[0].target!.candidate, f.candidate);
    assert.equal((await f.runtime.call("candidate.analysis", { ...params, candidate: other })).sessions.length, 1);
    f.live.data.discovery!.sessions = [];
    assert.deepEqual((await f.runtime.call("candidate.analysis", params)).sessions, history);
  } finally { await f.runtime.pause(f.search); await f.persistence.close(); }
});

test("a job reserves its search during the initial save and pause waits for final persistence", async () => {
  const f = await runtimeFixture();
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const saving = new Promise<void>(resolve => { entered = resolve; });
  const save = f.persistence.save.bind(f.persistence);
  let first = true;
  f.persistence.save = async store => {
    if (first) { first = false; entered(); await gate; }
    return save(store);
  };
  try {
    const start = f.runtime.call("job.start", { search: f.search, kind: "discovery", seconds: 60, target: f.target });
    await saving;
    await assert.rejects(f.runtime.call("job.start", { search: f.search, kind: "discovery", seconds: 60, target: f.target }), /実行中/);
    let paused = false;
    const pause = f.runtime.call("job.pause", { search: f.search, target: f.target }).then(result => { paused = true; return result; });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(paused, false);
    release();
    await start;
    const result = await pause;
    assert.equal(result.status, "paused");
    assert.equal((await f.persistence.load(f.search)).data.status, "paused");
    const analysis = await f.runtime.call("candidate.analysis", { search: f.search, run: 0, candidate: f.candidate });
    assert.equal(analysis.sessions.length, 1);
    assert.equal(analysis.sessions[0].reason, "cancelled");
  } finally { release(); await f.runtime.pause(f.search); await f.persistence.close(); }
});
