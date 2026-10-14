import test from "node:test";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { createStudy, readStudy, alternatives, activeConfig } from "./state";
import { simulate } from "./match";
import { scores } from "../engine/model";

test("130 matches preserve scores and event timing across the architecture change", () => {
  const s = createStudy();
  const snapshots: unknown[] = [];
  for (const p of s.policies)
    for (const o of s.opponents)
      for (const priority of ["red", "blue"] as const) {
        const m = simulate(activeConfig(s), p, o, priority);
        snapshots.push([p.id, o.id, priority, m.scores, m.events]);
        assert.equal(m.frames.length, 181);
        assert.equal(m.frames.at(-1)!.t, 180);
        assert.deepEqual(m.frames.at(-1)!.scores, m.scores);
        assert.ok(m.scores.every(Number.isFinite));
        assert.ok(m.events.every((e) => e.t >= 0 && e.t <= 180));
      }
  assert.equal(
    createHash("sha256").update(JSON.stringify(snapshots)).digest("hex"),
    "4ce90eaed92c1f25e62d2cca383dea32e5b11c9f790066dfdda0768fd5022a3a",
  );
});
test("editable policies change tower construction and repeat deterministically", () => {
  const s = createStudy();
  activeConfig(s).teams[0].speeds.move = [0];
  const idle = { ...s.policies[0], id: "idle", targets: [], mustika: false };
  activeConfig(s).teams[1].caps.capacity_tr = [0];
  activeConfig(s).teams[1].caps.capacity_br = [0];
  const safe = s.policies.find((p) => p.id === "safe")!;
  const m = simulate(activeConfig(s), safe, idle, "red");
  assert.ok(
    [0, 1].every((i) =>
      m.frames
        .at(-1)!
        .objects.some((o) => o.loc === `tower${i}` && o.kind === "S"),
    ),
  );
  const earth = simulate(activeConfig(s), { ...safe, height: 2 }, idle, "red");
  assert.ok(
    !earth.frames
      .at(-1)!
      .objects.some((o) => o.loc.startsWith("tower") && o.kind === "S"),
  );
  assert.deepEqual(simulate(activeConfig(s), safe, idle, "red"), m);
});
test("imports reject ambiguous machine conditions and malformed policies", () => {
  const s = createStudy();
  assert.deepEqual(readStudy(JSON.parse(JSON.stringify(s))), s);
  const unnamed = structuredClone(s);
  unnamed.policies[0].name = "";
  assert.equal(readStudy(unnamed).policies[0].name, "名前のない作戦");
  const bad = structuredClone(s);
  activeConfig(bad).teams[0].speeds.move = [0, 1];
  assert.throws(() => readStudy(bad));
  const invalid = structuredClone(s);
  invalid.policies[0].targets = [2];
  assert.throws(() => readStudy(invalid));
  const duplicate = structuredClone(s);
  duplicate.policies.push(duplicate.policies[0]);
  assert.throws(() => readStudy(duplicate));
});
test("alternative generation changes strategic decisions and removes equivalent policies", () => {
  const s = createStudy(),
    next = alternatives(s.policies[0], s.policies);
  assert.ok(next.length > 0);
  assert.ok(next.every((p) => p.id !== s.policies[0].id));
  assert.equal(alternatives(s.policies[0], [...s.policies, ...next]).length, 0);
});

test("unrelated opponent travel does not change construction timing", async () => {
  const { Planner } = await import("../engine/planner");
  const { policyGoal, policyAction } = await import("../engine/policy");
  const { initial, configAt, action } = await import("../engine/model");
  const { successors } = await import("../engine/transition");
  const walk = (trips: number) => {
    const study = createStudy(),
      c = activeConfig(study),
      v = configAt(c, 0),
      p = new Planner(c, v);
    let s = initial(c, v),
      goal: import("../engine/types").Goal | null = null,
      index = 0;
    const events: import("../engine/transition").Event[] = [];
    const destinations = Array.from({ length: trips }, () => [
      "store1",
      "startA1",
    ]).flat();
    while (s.t < c.horizon) {
      goal = policyGoal(p, s, 0, study.policies[0], goal);
      if (!s.robots[2].job && s.robots[2].pos === destinations[index]) index++;
      const blue = s.robots[2].job
        ? action("continue")
        : index < destinations.length
          ? p.route(s.robots[2].pos, destinations[index], 2)![1][0]
          : action("wait", { seconds: c.horizon - s.t });
      const out = successors(
        s,
        [0, 1].map((r) => policyAction(p, s, r, goal)),
        [
          blue,
          s.robots[3].job
            ? action("continue")
            : action("wait", { seconds: c.horizon - s.t }),
        ],
        c,
        v,
      )[0];
      events.push(...out.events.filter((e) => e.robot < 2));
      s = out.state;
    }
    return { events, scores: scores(s)[0] };
  };
  assert.deepEqual(walk(6), walk(0));
});
