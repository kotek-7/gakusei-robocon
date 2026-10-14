import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "./store";
import { configAt, defaults, initial, scores, teamChoices } from "./model";
import { successors } from "./transition";
import { key } from "./util";
import { Persistence, exportSearch, importSearch } from "./persistence";
import { Runtime } from "./runtime";
import { analyze } from "./evaluation";
import { matrixValue } from "./linear";
import { DiscoveryEngine } from "./discovery";
import { Planner, choices, fixedChoice } from "./planner";
const shortConfig = () => ({ ...defaults(), horizon: 2 });
const finish = (st: Store) => {
  let count = 0;
  while (st.batch(100)) assert.ok(++count < 1000);
};
test("exact graph agrees with independent recursive traversal; resumed graph is identical", async () => {
  const c = shortConfig(),
    v = configAt(c, 0),
    s = initial(c, v),
    expected = new Set([key(s)]),
    todo = [s];
  let edges = 0;
  while (todo.length) {
    const current = todo.pop()!;
    if (current.t >= c.horizon) continue;
    for (const red of teamChoices(current, 0, c, v))
      for (const blue of teamChoices(current, 1, c, v))
        for (const out of successors(current, red, blue, c, v)) {
          const k = key(out.state);
          if (!expected.has(k)) {
            expected.add(k);
            todo.push(out.state);
          }
          edges++;
        }
  }
  const st = Store.create(c);
  st.batch(3);
  assert.equal(st.summary().complete, false);
  const db = new Persistence(crypto.randomUUID());
  await db.save(st);
  const resumed = await db.load(st.data.id);
  finish(resumed);
  assert.deepEqual(
    new Set(resumed.data.nodes.map((n) => key(n.state))),
    expected,
  );
  assert.equal(resumed.data.edges.length, edges);
  assert.ok(resumed.summary().complete);
  const uninterrupted = Store.create(c);
  finish(uninterrupted);
  assert.deepEqual(resumed.data.nodes, uninterrupted.data.nodes);
  assert.deepEqual(resumed.data.edges, uninterrupted.data.edges);
  await db.close();
});
test("Wasm solves mixed simultaneous games and preserves win constraints", async () => {
  const [value, p] = await matrixValue([
    [1, 0],
    [0, 1],
  ]);
  assert.ok(Math.abs(value - 0.5) < 1e-7);
  assert.ok(Math.abs(p[0] - 0.5) < 1e-7);
  const [margin, policy] = await matrixValue(
    [
      [10, -2],
      [-2, 10],
    ],
    [
      [1, 0],
      [0, 1],
    ],
    0.5,
  );
  assert.ok(Math.abs(margin - 4) < 1e-6);
  assert.ok(policy.every((x) => Math.abs(x - 0.5) < 1e-6));
  const [negative] = await matrixValue([[-10, -20]]);
  assert.equal(negative, -20);
});
test("partial evaluation never claims a guarantee; complete evaluation counts deduplicated traces", async () => {
  const st = Store.create(shortConfig());
  st.batch(2);
  let result = await analyze(st, async () => {});
  assert.equal(result.runs[0].statisticsComplete, false);
  assert.equal(result.runs[0].guarantee, null);
  finish(st);
  result = await analyze(st, async () => {});
  assert.ok(result.runs[0].statisticsComplete);
  assert.equal(result.runs[0].guarantee?.winLower, 0);
  assert.equal(result.runs[0].guarantee?.winUpper, 1);
  assert.equal(result.runs[0].paths, "1");
  const previous = st.data.evaluation;
  await assert.rejects(
    analyze(st, async () => {
      throw new Error("cancelled");
    }),
  );
  assert.equal(st.data.evaluation, previous);
  const last = st.data.edges.at(-1)!,
    path = st.path(last.dst),
    replay = st.replay(path);
  assert.deepEqual(
    replay.frames.at(-1)!.scores,
    scores(st.node(last.dst).state),
  );
  assert.equal(replay.frames.at(-1)!.objects.length, 53);
  assert.throws(() => st.replay([1, 2]), /連続/);
});
test("IndexedDB backup restores continuation, rejects foreign/corrupt files, and recovers interrupted jobs", async () => {
  const db = new Persistence(crypto.randomUUID()),
    st = Store.create(shortConfig());
  st.batch(3);
  st.data.status = "running";
  st.data.job = "exact";
  await db.save(st);
  await db.recover();
  const loaded = await db.load(st.data.id);
  assert.equal(loaded.data.status, "paused");
  assert.equal(loaded.data.job, null);
  assert.deepEqual(loaded.data.nodes, st.data.nodes);
  // Incremental checkpoint: only new edges and touched nodes are written.
  loaded.batch(5);
  await db.save(loaded);
  assert.deepEqual(loaded.dirty.size, 0);
  const again = await db.load(st.data.id);
  assert.deepEqual(again.data.nodes, loaded.data.nodes);
  assert.deepEqual(again.data.edges, loaded.data.edges);
  const ws = await db.putWorkspace({ ...(await db.workspace(st.data.id)), pins: ["n:1"] });
  assert.deepEqual((await db.workspace(st.data.id)).pins, ws.pins);
  const restored = importSearch(JSON.parse(JSON.stringify(exportSearch(st))));
  assert.notEqual(restored.data.id, st.data.id);
  finish(restored);
  assert.ok(restored.summary().complete);
  assert.throws(() => importSearch({ meta: [] }));
  const bad = exportSearch(Store.create(shortConfig()));
  bad.search.nodes[0].state.objects = [];
  assert.throws(() => importSearch(bad));
  await db.remove(st.data.id);
  assert.deepEqual(await db.list(), []);
  await db.close();
});
function scenario(kind: string, enabled = true) {
  const c = defaults();
  c.profiles.move[0] = 10;
  c.teams[0].speeds.move = [0];
  const s = initial(c, configAt(c, 0));
  for (const r of [0, 1])
    Object.assign(s.robots[r], { pos: "transfer0", entered: true });
  if (kind === "direct") {
    s.t = 170;
    Object.assign(s.objects[0], { loc: "tower1", layer: 0 });
    s.objects[1].loc = "robot0";
    c.teams[0].caps.direct = [enabled];
  }
  if (kind === "small") {
    s.t = 170;
    s.objects[0].loc = "buffer0";
    c.teams[0].caps.capacity_tr = [0];
  }
  if (kind === "mixed") {
    s.t = 164;
    Object.assign(s.objects[0], { loc: "tower1", layer: 0 });
    s.objects[1].loc = "buffer0";
    s.objects[40].loc = "buffer0";
    c.teams[0].caps.capacity_tr = [0];
    c.teams[0].caps.mixed = [enabled];
  }
  if (kind === "prefetch") {
    s.t = 172;
    s.robots[0].pos = "store0";
    s.robots[1].pos = "spot6-0";
    [0, 1, 40].forEach((id, layer) =>
      Object.assign(s.objects[id], { loc: "tower6", layer }),
    );
    s.objects[40].face = 1;
  }
  return { ...c, scenario: "custom", root: s };
}
function firstCandidate(kind: string, enabled = true, minimum = 0) {
  const st = Store.create(scenario(kind, enabled)),
    engine = new DiscoveryEngine(st);
  for (let i = 0; i < 5000; i++) {
    engine.tick();
    const found = engine.d.runs[0].candidates.find(
      (a) => a.baseline.scores[0] >= minimum,
    );
    if (found) return { st, found };
  }
  throw new Error(`no candidate: ${kind}`);
}
test("candidate engine retains quantity, direct transfer, mixed loads and prefetch behavior", () => {
  assert.equal(firstCandidate("small").found.baseline.scores[0], 20);
  const off = firstCandidate("direct", false),
    on = firstCandidate("direct");
  assert.ok(on.found.baseline.scores[0] > off.found.baseline.scores[0]);
  assert.ok(on.st.data.edges.some((e) => e.red[0].kind === "give"));
  assert.equal(firstCandidate("mixed", false).found.baseline.scores[0], 30);
  assert.equal(firstCandidate("mixed").found.baseline.scores[0], 70);
  assert.ok(
    firstCandidate("prefetch", true, 145).found.baseline.scores[0] > 140,
  );
});
test("candidate checkpoints retain cursors, robot commitments, witnesses and comparison jobs", async () => {
  const st = Store.create(scenario("direct")),
    engine = new DiscoveryEngine(st);
  for (let i = 0; i < 150; i++) engine.tick();
  const db = new Persistence(crypto.randomUUID());
  await db.save(st);
  const restored = await db.load(st.data.id),
    next = new DiscoveryEngine(restored),
    before = restored.data.discovery!.nodes.map((n) => n.cursor);
  for (let i = 0; i < 100; i++) next.tick();
  assert.ok(before.every((cursor, i) => next.d.nodes[i].cursor >= cursor));
  assert.ok(next.d.links.length);
  assert.ok(next.d.jobs.some((j) => j.mode === "counter"));
  assert.ok(next.d.jobs.some((j) => j.mode === "compare"));
  assert.equal(restored.summary().complete, false);
  await db.close();
});
test("fixed procedures wait when blocked instead of changing the requested action", () => {
  const c = scenario("small"),
    v = configAt(c, 0),
    s = initial(c, v),
    p = new Planner(c, v);
  const [opts, index, blocked] = fixedChoice(
    p,
    s,
    1,
    null,
    [
      {
        kind: "operation",
        at: "spot0-0",
        action: { kind: "place", spot: 0 },
        demand: "[]",
      },
    ],
    0,
  );
  assert.equal(index, 0);
  assert.ok(blocked);
  assert.equal(opts[0][0].kind, "wait");
  s.objects[40].loc = "buffer0";
  assert.ok(
    choices(p, s, 1).some(
      ([a]) => a.kind === "pick" && a.objects?.length === 2,
    ),
  );
});
test("Worker runtime responds during computation, cancellation persists, and exact resume completes", async () => {
  const db = new Persistence(crypto.randomUUID()),
    rt = new Runtime(db);
  await rt.initialize();
  const st = await rt.call("search.create", { config: defaults() });
  await rt.call("job.start", { search: st.id, kind: "discovery", seconds: 60 });
  assert.equal((await rt.list())[0].status, "running");
  await new Promise((r) => setTimeout(r, 100));
  await rt.pause(st.id);
  assert.equal((await db.load(st.id)).data.status, "paused");
  const short = await rt.call("search.create", { config: shortConfig() });
  await rt.call("job.start", { search: short.id, kind: "exact", budget: 1000 });
  await rt.wait(short.id);
  assert.ok((await rt.get(short.id)).summary().complete);
  const finished: string[] = [];
  rt.subscribe((e) => { if (e.type === "job.finished" && e.kind === "evaluation") finished.push(e.reason); });
  await rt.call("job.start", { search: short.id, kind: "evaluation" });
  await rt.wait(short.id);
  assert.deepEqual(finished, ["completed"]);
  assert.equal(
    (await rt.get(short.id)).data.evaluation?.runs[0].guarantee?.winUpper,
    1,
  );
  await db.close();
});

test("evaluation completion save failure emits an error instead of success", async () => {
  class FailureAtCompletion extends Persistence {
    override async save(st: Store) {
      if (st.data.evaluation && st.data.job === null) throw new Error("completion save failed");
      await super.save(st);
    }
  }
  const db = new FailureAtCompletion(crypto.randomUUID());
  const rt = new Runtime(db);
  const reasons: string[] = [];
  rt.subscribe((e) => { if (e.type === "job.finished") reasons.push(e.reason); });
  const summary = await rt.call("search.create", { config: shortConfig() });
  await rt.call("job.start", { search: summary.id, kind: "evaluation" });
  await rt.wait(summary.id);
  assert.equal((await rt.get(summary.id)).data.status, "error");
  assert.deepEqual(reasons, ["error"]);
  await db.close();
});

test("storage failure does not leave a phantom running job or discard the exportable graph", async () => {
  class FailingPersistence extends Persistence {
    fail = false;
    override async save(st: Store) {
      if (this.fail) throw new Error("保存容量が不足しています");
      await super.save(st);
    }
  }
  const db = new FailingPersistence(crypto.randomUUID()),
    rt = new Runtime(db);
  const summary = await rt.call("search.create", { config: shortConfig() });
  db.fail = true;
  await assert.rejects(
    rt.call("job.start", { search: summary.id, kind: "exact", budget: 100 }),
    /保存容量/,
  );
  const st = await rt.get(summary.id);
  assert.equal(st.data.status, "error");
  assert.equal(st.data.job, null);
  assert.equal(exportSearch(st).search.nodes.length, 1);
  db.fail = false;
  await rt.call("job.start", { search: summary.id, kind: "exact", budget: 100 });
  await rt.wait(summary.id);
  assert.ok(st.summary().complete);
  await db.close();
});

test("snapshot contains all continued candidate jobs and can resume after JSON export/import", () => {
  const st = Store.create(scenario("direct")),
    engine = new DiscoveryEngine(st);
  for (let i = 0; i < 200; i++) engine.tick();
  const restored = importSearch(JSON.parse(JSON.stringify(exportSearch(st))));
  const resumed = new DiscoveryEngine(restored);
  for (let i = 0; i < 100; i++) {
    engine.tick();
    resumed.tick();
  }
  assert.deepEqual(restored.data.nodes, st.data.nodes);
  assert.deepEqual(restored.data.edges, st.data.edges);
  assert.deepEqual(restored.data.discovery, st.data.discovery);
});
