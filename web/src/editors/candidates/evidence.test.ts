import { test } from "node:test";
import assert from "node:assert/strict";
import type { Candidate } from "../../engine/types";
import { worstCommonResponse } from "./evidence";
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
