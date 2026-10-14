import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "./store";
import { DiscoveryEngine, publicDiscovery } from "./discovery";
import { action, defaults, scores } from "./model";
import { Planner, fixedChoice, type Instruction } from "./planner";
import {
  policySeeds,
  policyGoal,
  policyAction,
  policyFromPlan,
} from "./policy";
import { successors, type Event } from "./transition";
import {
  classification,
  structural,
  sortTrace,
  tokens,
} from "./classification";
import { equal } from "./util";
import { Persistence } from "./persistence";
import { Runtime } from "./runtime";

function rollout(red: string, blue?: string, trips = 0) {
  const c = defaults();
  c.teams[0].speeds.move = [0];
  const st = Store.create(c),
    p = new Planner(c, st.run(0).variant);
  const ps = [red, blue].map((id) => policySeeds().find((p) => p.id === id));
  const hints: ReturnType<typeof policyGoal>[] = [null, null];
  const walk: Instruction[] = Array.from({ length: trips }, () => [
    { kind: "travel" as const, dest: "store1" },
    { kind: "travel" as const, dest: "startA1" },
  ]).flat();
  let at = st.run(0).root,
    index = 0,
    intent: import("./planner").Intent | null = null;
  const path: number[] = [];
  while (st.node(at).state.t < c.horizon) {
    const s = st.node(at).state;
    for (let t = 0; t < 2; t++)
      if (ps[t]) hints[t] = policyGoal(p, s, t, ps[t]!, hints[t]);
    const acts = [0, 1, 2, 3].map((r) => {
      if (ps[r >> 1]) return policyAction(p, s, r, hints[r >> 1]);
      if (r === 2 && trips) {
        const [opts, next] = fixedChoice(p, s, r, intent, walk, index);
        index = next;
        intent = opts[0][1];
        return opts[0][0];
      }
      return s.robots[r].job
        ? action("continue")
        : action("wait", { seconds: c.horizon - s.t });
    });
    const outs = successors(s, acts.slice(0, 2), acts.slice(2), c, p.v);
    const ids = st.addOutcomes(0, at, acts.slice(0, 2), acts.slice(2), outs);
    path.push(ids[0]);
    at = st.edge(ids[0]).dst;
  }
  const events = path.flatMap((id) => st.edge(id).events);
  assert.deepEqual(
    st.replay(path).frames.at(-1)!.scores,
    scores(st.node(at).state),
  );
  return {
    events,
    scores: scores(st.node(at).state),
    final: st.node(at).state,
  };
}

test("major strategies execute from the initial field and react to active opponents", () => {
  const safe = rollout("safe"),
    mixed = rollout("hybrid"),
    sky = rollout("sky");
  assert.ok(
    [0, 1].every((i) =>
      safe.final.objects.some((o) => o.loc === `tower${i}` && o.kind === "S"),
    ),
  );
  assert.equal(mixed.final.objects[52].loc, "pillar");
  assert.equal(mixed.scores[0], 420);
  const firstPlace = sky.events.findIndex(
    (e) => e.phase === "finish" && e.action.kind === "place",
  );
  assert.ok(
    sky.events
      .slice(0, firstPlace)
      .filter(
        (e) =>
          e.robot === 0 && e.phase === "finish" && e.action.kind === "drop",
      )
      .flatMap((e) => e.action.objects || [])
      .filter((i) => i >= 40).length >= 3,
  );
  const idle = rollout("thief"),
    active = rollout("thief", "mustika");
  assert.ok(
    !idle.events.some((e) => e.robot === 1 && e.action.kind === "flip"),
  );
  assert.ok(
    active.events.some(
      (e) => e.robot === 1 && e.phase === "finish" && e.action.kind === "flip",
    ),
  );
  assert.ok(active.scores[0] > idle.scores[0]);
});

test("policy actions and their timestamps are invariant under unrelated opponent movement", () => {
  for (const policy of ["mustika", "late", "hybrid"]) {
    const before = rollout(policy),
      after = rollout(policy, undefined, 6);
    assert.deepEqual(
      after.events.filter((e) => e.robot < 2),
      before.events.filter((e) => e.robot < 2),
    );
    assert.deepEqual(after.scores, before.scores);
  }
});

// Exercise the actual discovery witness serializer, rather than hand-authoring a repaired script.
test("560 point direct-transfer witness replays unchanged with 0, 1, 3 and 6 empty opponent trips", () => {
  const c = defaults();
  c.teams[0].speeds.move = [0];
  const st = Store.create(c),
    engine = new DiscoveryEngine(st),
    internal = engine as any;
  internal.newJob(0, "baseline");
  const job = engine.d.jobs[0],
    p = new Planner(c, st.run(0).variant);
  let found: any;
  for (let i = 0; i < 3000 && !found; i++) found = internal.expand(p, job);
  assert.ok(found);
  assert.deepEqual(found[0].scores, [560, 0]);
  assert.ok(
    found[0].path.some((id: number) => st.edge(id).red[0].kind === "give"),
  );
  const traces: Event[][] = [];
  for (const count of [0, 1, 3, 6]) {
    const saved = Store.create(c),
      e = new DiscoveryEngine(saved),
      raw = e as any;
    const blue = Array.from({ length: count }, () => [
      { kind: "travel", dest: "store1" },
      { kind: "travel", dest: "startA1" },
    ]).flat();
    raw.newJob(0, "compare", "test", "move", {
      0: found[1].slice(0, 2),
      1: [blue, []],
    });
    const j = e.d.jobs[0],
      planner = new Planner(c, saved.run(0).variant);
    const ends: any[] = [];
    for (let i = 0; i < 10000 && !j.done; i++) {
      const end = raw.expand(planner, j);
      if (end) ends.push(end[0]);
    }
    assert.ok(j.done);
    assert.equal(ends.length, 1);
    assert.deepEqual(ends[0].scores, [560, 0]);
    assert.deepEqual(ends[0].blocked, []);
    for (const id of ends[0].path) {
      const edge = saved.edge(id);
      assert.ok(
        successors(
          saved.node(edge.src).state,
          edge.red,
          edge.blue,
          c,
          planner.v,
        ).some((o) => equal(o.state, saved.node(edge.dst).state)),
      );
    }
    traces.push(
      ends[0].path
        .flatMap((id: number) => saved.edge(id).events)
        .filter((e: Event) => e.robot < 2),
    );
  }
  traces.slice(1).forEach((trace) => assert.deepEqual(trace, traces[0]));
});

test("bounded policy comparison completes without claiming full strategy coverage", () => {
  const c = defaults();
  c.horizon = 8;
  const st = Store.create(c),
    e = new DiscoveryEngine(st);
  for (
    let i = 0;
    i < 10000 && !publicDiscovery(st)?.runs[0]?.policyComparisonComplete;
    i++
  )
    e.tick();
  const report = publicDiscovery(st)!;
  assert.ok(report.runs[0].policyComparisonComplete);
  assert.equal(report.runs[0].policyCommonOpponents!.length, 5);
  assert.equal(
    report.runs[0].candidates.filter((c) => c.policy && !c.policy.derivedFrom)
      .length,
    13,
  );
  assert.equal(report.complete, false);
});

test("learned opponent goals become team-relative conditional hypotheses", () => {
  const p = policyFromPlan(
    [
      { kind: "build", spot: 2 },
      { kind: "build", spot: 8 },
      { kind: "flip", spot: 7 },
      { kind: "mustika" },
    ],
    "test",
    1,
  )!;
  assert.deepEqual(p.targets, [0, 6]);
  assert.ok(p.opportunistic);
  assert.ok(p.mustika);
  assert.ok(p.derivedFrom);
});

test("logistics have a distinct classification and old discovery cannot silently resume", async () => {
  const transport = rollout("transport");
  const classify = (events: Event[]) =>
    classification(structural(sortTrace(tokens(events))))[0];
  assert.notEqual(classify(transport.events), classify([]));
  const st = Store.create(defaults()),
    engine = new DiscoveryEngine(st);
  delete engine.d.version;
  assert.throws(() => new DiscoveryEngine(st), /旧方式/);
  const db = new Persistence(crypto.randomUUID()),
    rt = new Runtime(db);
  await assert.rejects(rt.start(st, "discovery"), /旧方式/);
  assert.notEqual(st.data.status, "running");
  assert.ok(publicDiscovery(st)!.scope.includes("旧方式"));
  await db.close();
});
