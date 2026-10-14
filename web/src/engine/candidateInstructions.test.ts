import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { defaults } from "./model";
import { DiscoveryEngine } from "./discovery";
import { Store } from "./store";
import { Persistence, exportSearch, importSearch } from "./persistence";
import { Runtime } from "./runtime";
import { QUERY_METHODS } from "./protocol";
import type { Instruction } from "./planner";

async function fixture() {
  const store = Store.create({ ...defaults(), horizon: 2 });
  const engine = new DiscoveryEngine(store);
  for (let i = 0; i < 1000 && !engine.d.runs[0]?.candidates.length; i++) engine.tick();
  assert.ok(engine.d.runs[0]?.candidates.length);
  const persistence = new Persistence(crypto.randomUUID());
  await persistence.save(store);
  const runtime = new Runtime(persistence);
  const live = await runtime.get(store.data.id);
  const run = live.data.discovery!.runs[0];
  const candidate = run.candidates[0];
  const params = { search: live.data.id, run: 0, candidate: candidate.id };
  return { persistence, runtime, live, run, candidate, params };
}

test("candidate instructions expose the saved fixed procedures without expanding discovery summaries", async () => {
  const f = await fixture();
  try {
    assert.ok(QUERY_METHODS.has("candidate.instructions"));
    const result = await f.runtime.call("candidate.instructions", f.params);
    assert.deepEqual(result, { red: f.candidate.script, blue: null });
    assert.equal("script" in f.live.summary().discovery!.runs[0].candidates[0], false);
    const original = structuredClone(f.candidate.script);
    result.red[0].push({ kind: "travel", dest: "changed" });
    assert.deepEqual(f.candidate.script, original);
    const after = await f.runtime.call("candidate.instructions", f.params);
    assert.deepEqual(after.red, original);
  } finally { await f.persistence.close(); }
});

test("opponent lookup is exact and returns cloned nested actions while discovery can continue", async () => {
  const f = await fixture();
  try {
    const script: Instruction[][] = [[{ kind: "operation", at: "store0", action: { kind: "pick", objects: [1, 2] }, demand: "[]" }], []];
    f.run.opponents["opponent-a"] = script;
    f.run.opponents["opponent-b"] = [[], [{ kind: "until", at: 1 }]];
    const before = JSON.stringify(f.live.data);
    const result = await f.runtime.call("candidate.instructions", { ...f.params, opponent: "opponent-a" });
    assert.deepEqual(result.blue, script);
    assert.equal(JSON.stringify(f.live.data), before);
    const instruction = result.blue![0][0];
    assert.equal(instruction.kind, "operation");
    if (instruction.kind === "operation") instruction.action.objects!.push(99);
    assert.deepEqual((script[0][0] as Extract<Instruction, { kind: "operation" }>).action.objects, [1, 2]);
    const engine = new DiscoveryEngine(f.live);
    for (let i = 0; i < 10; i++) engine.tick();
    assert.deepEqual((await f.runtime.call("candidate.instructions", { ...f.params, opponent: "opponent-b" })).blue, [[], [{ kind: "until", at: 1 }]]);
    assert.deepEqual((await f.runtime.call("candidate.instructions", f.params)).red, f.candidate.script);
  } finally { await f.persistence.close(); }
});

test("invalid selections and absent legacy scripts are errors, not empty plans", async () => {
  const f = await fixture();
  try {
    for (const run of [-1, 0.5, NaN])
      await assert.rejects(f.runtime.call("candidate.instructions", { ...f.params, run }), /構成番号が不正/);
    await assert.rejects(f.runtime.call("candidate.instructions", { ...f.params, run: 999 }), /構成の候補探索/);
    await assert.rejects(f.runtime.call("candidate.instructions", { ...f.params, candidate: "missing" }), /作戦候補が見つかりません/);
    for (const opponent of ["missing", "toString", "__proto__"])
      await assert.rejects(f.runtime.call("candidate.instructions", { ...f.params, opponent }), /相手の作戦が見つかりません/);
    f.run.opponents["broken"] = null as unknown as Instruction[][];
    await assert.rejects(f.runtime.call("candidate.instructions", { ...f.params, opponent: "broken" }), /相手の固定指示は保存されていません/);
    f.candidate.script = undefined as unknown as Instruction[][];
    await assert.rejects(f.runtime.call("candidate.instructions", f.params), /作戦の固定指示は保存されていません/);
  } finally { await f.persistence.close(); }
});

test("fixed instructions survive checkpoint reload and backup import with exact opponent identity", async () => {
  const f = await fixture();
  try {
    f.run.opponents["saved"] = [[], [{ kind: "until", at: 2 }]];
    await f.persistence.save(f.live);
    const reloaded = new Runtime(f.persistence);
    const expected = await f.runtime.call("candidate.instructions", { ...f.params, opponent: "saved" });
    assert.deepEqual(await reloaded.call("candidate.instructions", { ...f.params, opponent: "saved" }), expected);
    const imported = importSearch(exportSearch(f.live));
    await f.persistence.save(imported);
    assert.deepEqual(await reloaded.call("candidate.instructions", { ...f.params, search: imported.data.id, opponent: "saved" }), expected);
  } finally { await f.persistence.close(); }
});
