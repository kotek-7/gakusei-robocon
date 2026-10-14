import test from "node:test";
import assert from "node:assert/strict";
import { activeDiagnostic, diagnosticRows, filterDiagnostics } from "./diagnostics";
import type { CandidateEvidence } from "../../engine/types";
const evidence: CandidateEvidence = { node: 7, path: [4, 8], scores: [0, 0], strategy: "s", milestones: [["not a timestamp"]], blocked: [
  { t: 40, robot: 0, instruction: 3, reason: "在庫不足" },
  { t: 12, robot: 1, instruction: 1, reason: "塔が使用中" },
  { t: 12, robot: 0, instruction: 1, reason: "在庫不足" },
] };
test("diagnostics use actual failure times and stable robot order without mutating evidence", () => {
  const rows = diagnosticRows(evidence);
  assert.deepEqual(rows.map(row => [row.t, row.robot]), [[12, 0], [12, 1], [40, 0]]);
  assert.equal(evidence.blocked![0].t, 40);
  assert.equal(diagnosticRows({ ...evidence, blocked: undefined }).length, 0);
});
test("robot zero and exact reason filters intersect, hidden selection falls back within visible records", () => {
  const rows = diagnosticRows(evidence);
  const visible = filterDiagnostics(rows, "0", "在庫不足");
  assert.equal(visible.length, 2);
  assert.equal(activeDiagnostic(visible, rows[1].key)?.key, visible[0].key);
  assert.equal(activeDiagnostic(visible, visible[1].key)?.t, 40);
  assert.equal(activeDiagnostic(filterDiagnostics(rows, "1", "在庫不足"), rows[0].key), undefined);
});
