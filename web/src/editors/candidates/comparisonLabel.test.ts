import { test } from "node:test";
import assert from "node:assert/strict";
import { candidateComparisonLabel } from "./comparisonLabel";

test("A/B provenance distinguishes arbitration branches even at the same score and terminal node", () => {
  const evidence = {scores: [80, 40], node: 120, path: [1, 5, 8]};
  const context = "C0 · candidate · opponent";
  const a = candidateComparisonLabel(context, evidence);
  const b = candidateComparisonLabel(context, {...evidence, path: [1, 6, 8]});
  assert.notEqual(a, b);
  assert.equal(a, candidateComparisonLabel(context, {...evidence, path:[...evidence.path]}));
  assert.match(a, /\+40点 \(80 対 40\) · 局面120 \/ 経路[0-9a-z]{7}$/);
  assert.match(candidateComparisonLabel(context, evidence, 1), / · 展開2 · /);
});
