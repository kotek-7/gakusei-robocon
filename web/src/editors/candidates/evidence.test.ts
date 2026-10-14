import { test } from "node:test";
import assert from "node:assert/strict";
import type { Candidate } from "../../engine/types";
import { responseIdentity, worstCommonResponse } from "./evidence";
const candidate = { responses: [
  {shared:true,opponent:"a",scores:[20,10]},
  {shared:true,opponent:"a",scores:[10,20]},
  {shared:true,opponent:"b",scores:[0,100]},
  {shared:false,opponent:"a",scores:[0,200]},
] } as Candidate;
test("common comparisons exclude unfinished shared opponents and targeted counter-search", () => {
  assert.equal(worstCommonResponse(candidate, ["a"]), candidate.responses[1]);
});
test("an explicit opponent restricts every arbitration branch, and missing evidence stays unknown", () => {
  assert.equal(worstCommonResponse(candidate, ["a","b"], "a"), candidate.responses[1]);
  assert.equal(worstCommonResponse(candidate, ["a"], "b"), null);
  assert.equal(worstCommonResponse(candidate, []), null);
});


test("response selection stays on the same path after filtering and cannot cross candidates", () => {
  const responses: Parameters<typeof responseIdentity>[2][] = [
    { opponent: "a", node: 10, path: [1, 2] },
    { opponent: "b", node: 10, path: [3, 4] },
    { opponent: "b", node: 11, path: [3, 5] },
  ];
  const selected = responseIdentity(0, "candidate-a", responses[1]);
  const filtered = responses.filter(r => r.opponent === "b").reverse();
  assert.equal(filtered.find(r => responseIdentity(0, "candidate-a", r) === selected), responses[1]);
  assert.ok(!filtered.some(r => responseIdentity(0, "candidate-b", r) === selected));
});
