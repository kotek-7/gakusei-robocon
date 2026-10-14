import {test} from "node:test";
import assert from "node:assert/strict";
import type {Candidate} from "../../engine/types";
import {decisionDirty, recoveryEntries} from "./recovery";
import type {CandidateCollectionRow} from "./collection";
const row=(id:string,run=0): CandidateCollectionRow => ({run,common:[],candidate:{id} as Candidate});
test("recovery keeps filtered-out work reachable without offering deleted candidates",()=>{
  const result=recoveryEntries([row("a"),row("b"),row("a",1)], ["0/a"], {shortlist:["0/a","0/b","deleted"],decisions:{}}, {"1/a":{note:"確認",status:"open"},deleted:{note:"old",status:"open"}});
  assert.deepEqual(result.map(r=>[r.key,r.dirty,r.hidden]), [["1/a",true,true],["0/b",false,true]]);
});
test("saved or reverted drafts do not produce false unsaved warnings",()=>{
  assert.equal(decisionDirty({note:"",status:"open"},undefined),false);
  assert.equal(decisionDirty({note:"同じ",status:"keep"},{note:"同じ",status:"keep"}),false);
  assert.equal(decisionDirty({note:"",status:"dismiss"},undefined),true);
  assert.equal(decisionDirty({note:"",status:"open"},{note:"前",status:"open"}),true);
});
