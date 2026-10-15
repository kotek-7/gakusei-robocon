import test from "node:test";
import assert from "node:assert/strict";
import { sessionResponses, sessionGained, sessionWorst } from "./explorationHistory";
import type { Candidate, DiscoverySession } from "../../engine/types";
const evidence = (score:number) => ({node:score,path:[score],scores:[score,0],strategy:"",milestones:[],kind:"procedure"});
const candidate: Candidate = {id:"c",plan:[],pending:0,baseline:evidence(10),responses:[evidence(9),evidence(5),evidence(7)]};
const target = {run:0,candidate:"c",mode:"counter" as const};
const snapshot = (responses:number) => ({responses,opponents:0,checkedOpponents:0,worstMargin:5,counterTicks:1,compareTicks:0});
const session = {target,before:snapshot(1),after:snapshot(3)} as DiscoverySession;
test("session range returns only appended outcomes and original ordinals",()=>{
  const rows = sessionResponses(session,candidate,target)!;
  assert.deepEqual(rows.map(r=>r.ordinal),[2,3]);
  assert.equal(sessionWorst(rows)?.evidence.scores[0],5);
  assert.equal(sessionGained(session),true);
});
test("history rejects foreign target, missing snapshots and invalid ranges",()=>{
  assert.equal(sessionResponses(session,candidate,{run:1,candidate:"c"}),null);
  assert.equal(sessionResponses({...session,before:undefined},candidate,target),null);
  for(const [a,b] of [[-1,2],[2,1],[0,4],[0.5,2]]) assert.equal(sessionResponses({...session,before:snapshot(a),after:snapshot(b)},candidate,target),null);
});
test("interrupted checkpoint keeps only saved interval when later runs append",()=>{
  const recovered = {...session,reason:"interrupted",after:snapshot(2)};
  assert.deepEqual(sessionResponses(recovered,candidate,target)?.map(r=>r.ordinal),[2]);
  assert.equal(sessionResponses({...session,before:snapshot(3)},candidate,target)?.length,0);
});
test("newly checked opponent is a gain even when no new response was appended",()=>{
  assert.equal(sessionGained({...session,before:snapshot(3),after:{...snapshot(3),checkedOpponents:1}}),true);
  assert.equal(sessionGained({...session,before:snapshot(3)}),false);
});

test("historical worst uses red-minus-blue margin rather than red score alone",()=>{
  const c = {...candidate,responses:[{...evidence(80),scores:[80,100]}, {...evidence(50),scores:[50,0]}]};
  const s = {...session,before:snapshot(0),after:snapshot(2)};
  assert.equal(sessionWorst(sessionResponses(s,c,target))?.ordinal,1);
});

test("session response lookup rejects mismatched candidate identity and non-finite bounds",()=>{
  assert.equal(sessionResponses(session,{...candidate,id:"other"},target),null);
  assert.equal(sessionResponses(session,candidate,{...target,candidate:"other"}),null);
  for(const n of [NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) {
    assert.equal(sessionResponses({...session,before:snapshot(n)},candidate,target),null);
    assert.equal(sessionResponses({...session,after:snapshot(n)},candidate,target),null);
  }
  assert.equal(sessionWorst([]),undefined);
});
