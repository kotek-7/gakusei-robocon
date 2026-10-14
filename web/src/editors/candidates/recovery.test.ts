import {test} from "node:test";
import assert from "node:assert/strict";
import type {Candidate} from "../../engine/types";
import {recoveryEntries} from "./recovery";
import type {CandidateCollectionRow} from "./collection";
const row=(id:string,run=0): CandidateCollectionRow => ({run,common:[],candidate:{id} as Candidate});
test("recovery exposes only hidden comparison candidates that still exist",()=>{
  const result=recoveryEntries([row("a"),row("b"),row("a",1)], ["0/a"], ["0/a","0/b","deleted"]);
  assert.deepEqual(result.map(r=>r.key), ["0/b"]);
});
test("comparison recovery keeps configuration identity and candidate order",()=>{
  const result=recoveryEntries([row("a"),row("a",1)], [], ["1/a","0/a"]);
  assert.deepEqual(result.map(r=>r.key), ["0/a","1/a"]);
  assert.deepEqual(recoveryEntries([row("a")], [], []), []);
});
