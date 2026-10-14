import { test } from "node:test";
import assert from "node:assert/strict";
import type { Candidate } from "../../engine/types";
import { comparisonEvidence, comparisonGroups, type CandidateComparisonRow } from "./comparison";
const response = (opponent: string, red: number, shared = true) => ({ opponent, scores: [red, 10], shared, node: red, path: [red], strategy: "x", milestones: [], kind: "shared" });
function row(run = 0, id = "a", common = ["one"]): CandidateComparisonRow {
  const candidate: Candidate = { id, plan: [], baseline: response("", 100), pending: 2,
    responses: [response("one", 20), response("one", 5), response("two", -100), response("one", -200, false)] };
  return { run, common, candidate };
}
test("matrix compares minimum margin only among completed shared opponent evidence", () => {
  const r = row();
  assert.equal(comparisonEvidence(r, "one"), r.candidate.responses[1]);
  assert.equal(comparisonEvidence(r, "two"), null);
  assert.equal(comparisonEvidence(r, "unknown"), null);
  assert.equal(comparisonEvidence(r, null), r.candidate.baseline);
});
test("different configurations stay separate even when candidate and opponent IDs coincide", () => {
  const groups = comparisonGroups([row(0), row(1)]);
  assert.deepEqual(groups.map(group => [group.run, group.candidates.length]), [[0, 1], [1, 1]]);
});
test("live common-set differences use intersection and duplicate shortlist items do not duplicate columns", () => {
  const a = row(0, "a", ["one", "two", "one"]);
  const groups = comparisonGroups([a, row(0, "b", ["one"]), a]);
  assert.deepEqual(groups[0].opponents, ["one"]);
  assert.equal(groups[0].candidates.length, 2);
});
test("a common opponent without evidence remains missing, not zero or baseline", () => {
  const r = row(); r.candidate.responses = [];
  assert.equal(comparisonEvidence(r, "one"), null);
  assert.deepEqual(comparisonGroups([]), []);
});

test("difference filters require complete same-run evidence, never treat missing as zero", async () => {
  const { opponentComparison, visibleOpponents } = await import("./comparison");
  const a = row(), b = row(0, "b");
  b.candidate.responses = [response("one", 30)];
  assert.equal(opponentComparison([a, b], "one").spread, 25);
  assert.equal(opponentComparison([a, row(1)], "one").spread, null);
  assert.equal(opponentComparison([a, b], "two").spread, null);
  assert.deepEqual(visibleOpponents([a, b], ["one", "two"], {query:"", filter:"different", sort:"spread"}).map(e => e.opponent), ["one"]);
  assert.deepEqual(visibleOpponents([a, b], ["one"], {query:"missing", filter:"all", sort:"id"}), []);
});
test("arbitration drill retains all completed shared witnesses and finds blocked nonminimum branches", async () => {
  const { comparisonBranches, opponentComparison } = await import("./comparison");
  const a = row(); a.candidate.responses[0].blocked = [{ t: 180, robot: 2, instruction: 1, reason: "occupied" }];
  const original = [...a.candidate.responses];
  assert.deepEqual(comparisonBranches(a, "one").map(e => e.scores[0]), [5, 20]);
  assert.deepEqual(a.candidate.responses, original);
  assert.equal(opponentComparison([a], "one").blocked, true);
  assert.deepEqual(comparisonBranches(a, "two"), []);
});


test("arbitration sensitivity is visible even when candidates have identical minima", async () => {
  const { arbitrationSummary, visibleOpponents } = await import("./comparison");
  const a = row(), b = row(0, "b");
  b.candidate.responses = [response("one", 5)];
  assert.equal(arbitrationSummary(a, "one").varies, true);
  assert.equal(arbitrationSummary(b, "one").varies, false);
  assert.deepEqual(visibleOpponents([a, b], ["one"], {query:"", filter:"arbitration", sort:"id"}).map(e => e.opponent), ["one"]);
  assert.deepEqual(visibleOpponents([a, b], ["one"], {query:"", filter:"different", sort:"id"}), []);
  assert.equal(arbitrationSummary(a, "missing").min, null);
});
test("same point margin does not imply same scores or execution issues", async () => {
  const { arbitrationSummary } = await import("./comparison");
  const a = row();
  a.candidate.responses = [response("one", 20), {...response("one", 30), scores: [30,20], blocked: [{robot:2, t:80, instruction:0, reason:"occupied"}]}];
  assert.deepEqual(arbitrationSummary(a, "one"), {count:2,min:10,max:10,varies:false,scoreVaries:true,redBlocked:false,blueBlocked:true});
});
test("team filters do not mistake an opponent blockage for our own", async () => {
  const { visibleOpponents } = await import("./comparison");
  const a = row();
  a.candidate.responses[0].blocked = [{robot:2, t:80, instruction:0, reason:"occupied"}];
  assert.equal(visibleOpponents([a], ["one"], {query:"", filter:"red-blocked", sort:"id"}).length, 0);
  assert.equal(visibleOpponents([a], ["one"], {query:"", filter:"blue-blocked", sort:"id"}).length, 1);
});
test("baseline margin loss separates our score change from opponent score gain", async () => {
  const { evidenceScoreDelta } = await import("./EvidenceScoreDelta");
  assert.deepEqual(evidenceScoreDelta(response("one", 20), {...response("",20),scores:[20,0]}), {red:0, blue:10, margin:-10});
  assert.deepEqual(evidenceScoreDelta({...response("one",15),scores:[15,20]}, {...response("",20),scores:[20,0]}), {red:-5,blue:20,margin:-25});
});
