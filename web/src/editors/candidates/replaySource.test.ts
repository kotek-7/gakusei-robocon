import { test } from "node:test";
import assert from "node:assert/strict";
import type { Candidate } from "../../engine/types";
import { candidateReplaySource } from "./replaySource";
import { resolveStrategy } from "../strategy-detail/selection";
import type { Search } from "../../engine/types";

test("opened candidate keeps its exact result when the worst response changes", () => {
  const baseline = { node: 10, path: [1, 2], scores: [30, 0], strategy: "red", milestones: [] };
  const candidate: Candidate = { id: "candidate", plan: [], baseline, pending: 0, responses: [
    { ...baseline, opponent: "opponent", shared: true, kind: "common", scores: [30, 40], path: [3, 4] },
  ] };
  const source = candidateReplaySource("search", 2, candidate, candidate.responses[0]);
  candidate.responses.push({ ...candidate.responses[0], scores: [30, 50], path: [5, 6] });
  const search = { id: "search", discovery: { runs: [{ run: 2, candidates: [candidate], commonOpponents: ["opponent"] }] } } as Search;
  assert.equal(resolveStrategy(search, source)?.chosen?.evidence, candidate.responses[0]);
  assert.equal(source.opponent, "opponent");
  assert.notEqual(source.path, candidate.responses[0].path);
  assert.deepEqual(source.path, [3, 4]);
  assert.notEqual(source.evidence, "worst");
  assert.equal(candidateReplaySource("search", 2, candidate, baseline).evidence, "baseline");
});
