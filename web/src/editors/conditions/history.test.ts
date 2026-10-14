import { test } from "node:test";
import assert from "node:assert/strict";
import { defaults } from "../../engine/model";
import {
  conditionHistory,
  selectProfile,
  type ConditionHistory,
} from "./history";

test("bulk profile changes are one undo step and preserve opponent and shared values", () => {
  const initial = defaults();
  const state: ConditionHistory = { past: [], present: initial, future: [] };
  const edited = conditionHistory(state, {
    type: "change",
    edit: (c) => selectProfile(c, 0, "all"),
  });
  assert.ok(
    Object.values(edited.present.teams[0].speeds).every(
      (v) => v.join() === "0,1,2",
    ),
  );
  assert.deepEqual(edited.present.teams[1], initial.teams[1]);
  assert.deepEqual(edited.present.profiles, initial.profiles);
  const undone = conditionHistory(edited, { type: "undo" });
  assert.deepEqual(undone.present, initial);
  assert.deepEqual(
    conditionHistory(undone, { type: "redo" }).present,
    edited.present,
  );
  assert.deepEqual(state.present, initial);
});

test("replacement is reversible; new edits clear redo; no-op preserves history", () => {
  const initial = defaults();
  const state: ConditionHistory = { past: [], present: initial, future: [] };
  assert.equal(
    conditionHistory(state, { type: "change", edit: () => {} }),
    state,
  );
  const imported = structuredClone(initial);
  imported.name = "import";
  const changed = conditionHistory(state, {
    type: "replace",
    config: imported,
  });
  imported.name = "mutated";
  assert.equal(changed.present.name, "import");
  const undone = conditionHistory(changed, { type: "undo" });
  const next = conditionHistory(undone, {
    type: "change",
    edit: (c) => {
      c.horizon = 90;
    },
  });
  assert.equal(next.future.length, 0);
  assert.equal(next.present.horizon, 90);
});

test("history retains at most 50 edits and does not mutate retained snapshots", () => {
  const initial = defaults();
  let state: ConditionHistory = { past: [], present: initial, future: [] };
  for (let i = 0; i < 60; i++) {
    state = conditionHistory(state, {
      type: "change",
      edit: (c) => {
        c.name = `run ${i}`;
      },
    });
  }
  assert.equal(state.past.length, 50);
  assert.equal(state.past[0].name, "run 9");
  for (let i = 0; i < 50; i++)
    state = conditionHistory(state, { type: "undo" });
  assert.equal(state.present.name, "run 9");
  assert.equal(conditionHistory(state, { type: "undo" }), state);
});

test("scoped profile batch edits only displayed keys and undo together", () => {
  const initial = defaults();
  const keys = Object.keys(initial.teams[0].speeds).slice(0, 1);
  const edited = conditionHistory(
    { past: [], present: initial, future: [] },
    {
      type: "change",
      edit: (c) => selectProfile(c, 0, "all", keys),
    },
  );
  for (const key of Object.keys(initial.teams[0].speeds)) {
    assert.deepEqual(
      edited.present.teams[0].speeds[key],
      keys.includes(key) ? [0, 1, 2] : initial.teams[0].speeds[key],
    );
  }
  assert.deepEqual(edited.present.teams[1], initial.teams[1]);
  assert.deepEqual(conditionHistory(edited, { type: "undo" }).present, initial);
  assert.equal(
    conditionHistory(edited, {
      type: "change",
      edit: (c) => selectProfile(c, 0, 0, []),
    }),
    edited,
  );
});
