import { test } from "node:test";
import assert from "node:assert/strict";
import type { MatchAnalysis, ScoreParts } from "../../engine/analysis";
import { scoreRangeDelta } from "./range";
const parts = (total: number): ScoreParts => ({ total, skyL1: total, skyL2: 0, earthL1: 0, earthL2: 0, mustika: 0, transfer: 0 });
const analysis = { start: 0, end: 20, samples: [
  { t: 0, parts: [parts(0), parts(0)] }, { t: 10, parts: [parts(40), parts(0)] }, { t: 20, parts: [parts(0), parts(40)] },
] } as MatchAnalysis;
test("開始時点の加点を差分から除き、終了時点の減点を含める", () => {
  assert.equal(scoreRangeDelta(analysis, [10, 20])?.[0].total, -40);
  assert.equal(scoreRangeDelta(analysis, [10, 20])?.[1].skyL1, 40);
  assert.equal(scoreRangeDelta(analysis, [10, 10])?.[0].total, 0);
});
test("経路外、不正な範囲を外挿しない", () => {
  for (const range of [[-1, 20], [0, 21], [10, 5], [NaN, 10]] as [number, number][]) assert.equal(scoreRangeDelta(analysis, range), null);
});
