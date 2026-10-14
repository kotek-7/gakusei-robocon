import test from "node:test";
import assert from "node:assert/strict";
import type { MatchAnalysis, ScoreParts } from "../../engine/analysis";
import { scoreChanges, scoreSummary } from "./score";
const parts = (sky: number, earth = 0): ScoreParts => ({ transfer: 0, earthL1: earth, earthL2: 0, skyL1: sky, skyL2: 0, mustika: 0, total: sky + earth });
function fixture(): MatchAnalysis {
  return { start: 100, end: 120, intervals: [], spots: [], stock: [], mandate: [null, null],
    samples: [
      { t: 100, edge: null, parts: [parts(40, 10), parts(0)] },
      { t: 110, edge: 1, parts: [parts(0, 10), parts(40)] },
      { t: 115, edge: 2, parts: [parts(40, 10), parts(0)] },
      { t: 120, edge: 3, parts: [parts(40, 10), parts(0)] },
    ], markers: [
      { t: 110, edge: 1, team: 1, robot: 3, kind: "flip", action: { kind: "flip", spot: 0 } },
      { t: 110, edge: 99, team: 0, robot: 1, kind: "place", action: { kind: "place", spot: 1 } },
      { t: 110, edge: 1, team: 0, robot: 0, kind: "blocked", action: { kind: "place", spot: 1 } },
    ],
  };
}
test("score detail separates initial points from later gains and losses", () => {
  const row = scoreSummary(fixture(), 0).find(p => p.key === "skyL1")!;
  assert.deepEqual(row, { key: "skyL1", label: "スカイ L1", start: 40, end: 40, gained: 40, lost: -40 });
  assert.equal(scoreSummary(fixture(), 0).find(p => p.key === "earthL1")!.gained, 0);
});
test("score detail keeps opponent gains and own losses in the same event", () => {
  const rows = scoreChanges(fixture());
  assert.equal(rows.length, 2);
  assert.equal(rows[0].changes[0].total, -40);
  assert.equal(rows[0].changes[1].total, 40);
  assert.equal(rows[0].actions.length, 1);
  assert.equal(rows[0].actions[0].robot, 3);
});
test("score detail retains changes between categories even if the total is unchanged", () => {
  const a = fixture(); a.samples = [a.samples[0], { t: 110, edge: 1, parts: [parts(0, 50), parts(0)] }];
  const rows = scoreChanges(a);
  assert.equal(rows.length, 1); assert.equal(rows[0].changes[0].total, 0);
  assert.equal(rows[0].changes[0].earthL1, 40);
});
test("score detail supports empty and single-sample analyses", () => {
  const a = fixture(); a.samples = [];
  assert.deepEqual(scoreChanges(a), []);
  assert.ok(scoreSummary(a, 0).every(p => p.start === 0 && p.end === 0));
  a.samples = fixture().samples.slice(0, 1);
  assert.deepEqual(scoreChanges(a), []);
  assert.equal(scoreSummary(a, 0).find(p => p.key === "skyL1")!.start, 40);
});

test("score changes reconcile every category with a real discovered replay", async () => {
  const { Store } = await import("../../engine/store");
  const { defaults } = await import("../../engine/model");
  const { DiscoveryEngine } = await import("../../engine/discovery");
  const store = Store.create(defaults()), engine = new DiscoveryEngine(store);
  for (let i = 0; i < 4000 && !store.summary().discovery?.runs[0]?.candidates.length; i++) engine.tick();
  const candidate = store.summary().discovery!.runs[0].candidates[0];
  assert.ok(candidate);
  const analysis = store.analysis(candidate.baseline.path);
  const rows = scoreChanges(analysis);
  assert.ok(rows.length > 0);
  for (const team of [0, 1]) {
    for (const part of scoreSummary(analysis, team)) assert.equal(part.start + part.gained + part.lost, part.end);
    assert.equal(scoreSummary(analysis, team).reduce((n, p) => n + p.end, 0), candidate.baseline.scores[team]);
  }
  assert.ok(rows.every(row => row.actions.every(action => action.t === row.time && action.edge === row.edge)));
});
