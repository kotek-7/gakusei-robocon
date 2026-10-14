import test from "node:test";
import assert from "node:assert/strict";
import { createStudy, activeConfig } from "../study/state";
import { simulate } from "../study/match";
import { sweepCases, valueAt, type Parameter } from "./values";
import { runKey } from "../execution/identity";
test("three swept values produce 24 matches identical to individually configured runs", () => {
  const study = createStudy(),
    source = activeConfig(study),
    parameter: Parameter = {
      kind: "profiles",
      key: "move",
      label: "走行速度",
      unit: "m/s",
    };
  const cases = sweepCases(source, parameter, 0, "1,1.5,2"),
    seen = new Set<string>();
  for (const c of cases)
    for (const red of study.policies.slice(0, 2))
      for (const blue of study.opponents.filter((p) =>
        ["safe", "thief"].includes(p.id),
      ))
        for (const priority of ["red", "blue"] as const) {
          const manual = structuredClone(source);
          manual.profiles.move = [
            Number(valueAt(c.config, parameter, 0)),
            Number(valueAt(source, parameter, 1)),
            99,
          ];
          manual.teams[0].speeds.move = [0];
          manual.teams[1].speeds.move = [1];
          const batch = simulate(c.config, red, blue, priority),
            single = simulate(manual, red, blue, priority);
          assert.deepEqual(batch.scores, single.scores);
          assert.deepEqual(batch.events, single.events);
          seen.add(
            runKey({
              config: c.config,
              red,
              blue,
              priority,
              conditionName: c.name,
            }),
          );
        }
  assert.equal(seen.size, 24);
});
