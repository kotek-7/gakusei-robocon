import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { createStudy, activeConfig, readStudy } from "./state";
import { saveResult, loadMatch, loadSummaries } from "./persistence";
import { runKey } from "../execution/identity";
import type { Match } from "./match";
const fixture = () => {
  const study = createStudy();
  return {
    config: activeConfig(study),
    red: study.policies[0],
    blue: study.opponents[0],
    priority: "red" as const,
    conditionName: "標準",
  };
};
test("result identity ignores metadata and unused profiles, but tracks effective input", () => {
  const a = fixture(),
    key = runKey(a),
    b = structuredClone(a);
  b.red.id = "copy";
  b.red.name = "改名";
  b.conditionName = "改名";
  b.config.name = "改名";
  assert.equal(runKey(b), key);
  const used = b.config.teams.map((t) => t.speeds.move[0]);
  const unused = [0, 1, 2].find((i) => !used.includes(i));
  if (unused !== undefined) {
    b.config.profiles.move[unused] += 9;
    assert.equal(runKey(b), key);
  }
  b.config.profiles.move[used[0]] += 1;
  assert.notEqual(runKey(b), key);
  b.config = a.config;
  b.red.targets.reverse();
  assert.notEqual(runKey(b), key);
});
test("summary retrieval does not load frame payload; individual results restore", async () => {
  const input = fixture(),
    key = runKey(input),
    match: Match = {
      red: input.red.id,
      blue: input.blue.id,
      priority: "red",
      scores: [10, 20],
      events: [],
      frames: [],
    };
  await saveResult({ key, input, status: "running" }, match);
  const s = await loadSummaries();
  assert.deepEqual(s[key].scores, [10, 20]);
  assert.equal("frames" in s[key], false);
  assert.deepEqual(await loadMatch(key), match);
});
test("v1 migration preserves strategies and conditions and round trips v2 notes", () => {
  const s = createStudy(),
    old = {
      version: 1,
      config: activeConfig(s),
      policies: s.policies,
      opponents: s.opponents,
    };
  const next = readStudy(old);
  assert.equal(next.version, 2);
  assert.deepEqual(activeConfig(next), old.config);
  next.notes.push({
    id: "note",
    runKey: "test",
    t: 120,
    text: "確認",
    label: "標準",
  });
  assert.deepEqual(readStudy(JSON.parse(JSON.stringify(next))), next);
  assert.equal(old.version, 1);
});
