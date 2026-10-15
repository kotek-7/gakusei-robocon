import test from "node:test";
import assert from "node:assert/strict";
import type { Candidate } from "../../engine/types";
import { opponentAnalysis, instructionFailures } from "./opponentAnalysis";
const base={node:1,path:[1],scores:[100,0],strategy:"s",milestones:[]};
const candidate:Candidate={id:"c",plan:[],pending:1,baseline:base,responses:[
 {...base,kind:"procedure",opponent:"o",shared:true,scores:[80,100],blocked:[{robot:1,instruction:2,t:20,reason:"資材なし"},{robot:1,instruction:2,t:30,reason:"資材なし"},{robot:3,instruction:0,t:10,reason:"青"}]},
 {...base,node:2,path:[2],kind:"procedure",opponent:"o",shared:true,scores:[120,50],blocked:[{robot:1,instruction:2,t:25,reason:"資材なし"}]},
 {...base,node:3,path:[3],kind:"procedure",opponent:"p",scores:[110,0]},
]};
test("opponent summary preserves distinct arbitration outcomes and baseline-relative red loss",()=>{
 const [o,p]=opponentAnalysis(candidate,["o"]);
 assert.deepEqual([o.min,o.max,o.redLoss,o.redBlocked,o.common],[-20,70,20,2,true]);
 assert.equal(o.worst,candidate.responses[0]);assert.equal(o.best,candidate.responses[1]);
 assert.equal(p.redLoss,-10);assert.equal(p.common,false);
});
test("failure groups count affected responses once, exclude blue, preserve time interval",()=>{
 const [f]=instructionFailures(candidate);assert.equal(f.evidence.length,2);
 assert.deepEqual([f.robot,f.instruction,f.first,f.last],[1,2,20,30]);
 assert.equal(instructionFailures(candidate).length,1);
});
test("empty opponent analysis does not imply success or fabricate zero-valued ranges",()=>{
 assert.deepEqual(opponentAnalysis({...candidate,responses:[]},[]),[]);
 assert.deepEqual(instructionFailures({...candidate,responses:[]}),[]);
});
test("red score delta retains gains as positive and mixed outcomes as a signed range",()=>{
 const [o,p]=opponentAnalysis(candidate,[]);
 assert.deepEqual([o.redMinDelta,o.redMaxDelta],[-20,20]);
 assert.deepEqual([p.redMinDelta,p.redMaxDelta],[10,10]);
});
test("legacy outcomes without opponent ids are not asserted to share a procedure",()=>{
 const rows=opponentAnalysis({...candidate,responses:[{...candidate.responses[0],opponent:undefined},{...candidate.responses[1],opponent:undefined}]},[]);
 assert.equal(rows.length,2);assert.notEqual(rows[0].key,rows[1].key);
 assert.ok(rows.every(r=>r.evidence.length===1 && !r.common));
});
test("large groups do not exceed the JavaScript argument limit",()=>{
 const responses=Array.from({length:140_000},(_,i)=>({...candidate.responses[2],opponent:"large",scores:[i,0]}));
 const [row]=opponentAnalysis({...candidate,responses},[]);
 assert.deepEqual([row.redMinDelta,row.redMaxDelta,row.evidence.length],[-100,139899,140000]);
});
