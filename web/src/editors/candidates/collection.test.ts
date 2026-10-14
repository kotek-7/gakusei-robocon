import {test} from "node:test";
import assert from "node:assert/strict";
import type {Candidate} from "../../engine/types";
import {candidatePlanLabel, buildCandidateIndex, matchCandidateQuery, parseCandidateQuery, sortCandidateRows, mergeShortlistScope, sameCandidateFilters, type CandidateCollectionRow} from "./collection";
const row = (id = "candidate-a", run = 0): CandidateCollectionRow => ({run, common:["opp"], candidate:{id, plan:[{kind:"flip",spot:6}], baseline:{node:1,path:[1],scores:[80,0],strategy:"strategy-1",milestones:[]},responses:[],pending:0} as Candidate});
test("query combines normalized domain tokens and exclusions, with scoped quoted phrases", () => {
  const index = buildCandidateIndex(row(), {status:"open",note:"保留 資材不足を確認"});
  assert.equal(matchCandidateQuery(index,parseCandidateQuery("Ｌ２　共有 反転")).matches,true);
  assert.equal(matchCandidateQuery(index,parseCandidateQuery('メモ:"資材不足を確認" -手順:建設')).matches,true);
  assert.equal(matchCandidateQuery(index,parseCandidateQuery("L2 -メモ:保留")).matches,false);
  assert.deepEqual(matchCandidateQuery(index,parseCandidateQuery("メモ:資材")).fields,["note"]);
});
test("location meanings come from the field model and do not claim opponent plans", () => {
  const r=row(); r.candidate.plan=[{kind:"build",spot:0}];
  r.candidate.responses.push({...r.candidate.baseline,kind:"counter",blocked:[{t:10,robot:2,instruction:0,reason:"L2の資材不足"}]});
  const index=buildCandidateIndex(r);
  assert.equal(matchCandidateQuery(index,parseCandidateQuery("手順:L1 手順:赤専用")).matches,true);
  assert.equal(matchCandidateQuery(index,parseCandidateQuery("手順:L2")).matches,false);
  assert.equal(matchCandidateQuery(index,parseCandidateQuery("理由:L2")).matches,true);
});
test("unfinished quotes remain useful while typing; unknown prefixes stay literal", () => {
  assert.deepEqual(parseCandidateQuery('メモ:"確認 する'),[{field:"note",text:"確認 する",exclude:false}]);
  assert.deepEqual(parseCandidateQuery('unknown:foo - "" メモ:'),[{field:null,text:"unknown:foo",exclude:false},{field:null,text:"-",exclude:false}]);
});
test("sort keeps configuration boundaries, puts unknown comparisons last and keeps ties stable", () => {
  const a=row("a",0), b=row("b",0), c=row("c",1), d=row("d",0);
  for(const r of [a,b,c])r.candidate.responses=[{...r.candidate.baseline,kind:"shared",shared:true,opponent:"opp",scores:[r===c?200:40,0]}];
  const input=[c,d,b,a];
  assert.deepEqual(sortCandidateRows(input,"worst").map(r=>r.candidate.id),["b","a","d","c"]);
  assert.deepEqual(input.map(r=>r.candidate.id),["c","d","b","a"]);
  assert.deepEqual(sortCandidateRows(input,"worst","not-common").map(r=>r.candidate.id),["d","b","a","c"]);
});
test("bulk scope changes visible candidates only and never duplicates existing picks", () => {
  assert.deepEqual(mergeShortlistScope(["hidden","a"],["a","b"],"add"),["hidden","a","b"]);
  assert.deepEqual(mergeShortlistScope(["hidden","a"],["a","b"],"remove"),["hidden"]);
});
test("saved view equality is independent of property insertion order", () => {
  const a={run:"0",query:"L2",sort:"worst",status:"all",opponent:"opp",decision:"all",shortlistOnly:false};
  assert.equal(sameCandidateFilters(a,{...a}),true);
  assert.equal(sameCandidateFilters(a,{...a,opponent:"other"}),false);
});

test("literal visible plan labels can be pasted as phrases, including no construction", () => {
  const r = row();
  for (const plan of [[], [{kind:"build" as const,spot:6,height:2,at:120}], [{kind:"deliver" as const},{kind:"mustika" as const}]]) {
    r.candidate.plan=plan;
    const label=candidatePlanLabel(plan);
    assert.equal(matchCandidateQuery(buildCandidateIndex(r),parseCandidateQuery(`手順:"${label}"`)).matches,true,label);
  }
});
test("non-response sorting does not inspect every candidate response", () => {
  const r=row();
  Object.defineProperty(r.candidate,"responses",{get(){throw new Error("Unexpected response scan");}});
  for(const mode of ["discovery","pending","baseline"]) assert.deepEqual(sortCandidateRows([r],mode),[r]);
});
test("many-row collections keep exact scoped queries and hidden selections intact", () => {
  // Synthetic stress fixture, not a discovery result or model validation.
  const rows=Array.from({length:500},(_,i)=>row(`candidate-${i}`,Math.floor(i/50)));
  const terms=parseCandidateQuery('手順:共有 -メモ:見送り');
  const found=rows.filter((r,i)=>matchCandidateQuery(buildCandidateIndex(r,{status:"open",note:i%2 ? "見送り" : "確認"}),terms).matches);
  assert.equal(found.length,250);
  const selected=found.map(r=>`${r.run}/${r.candidate.id}`);
  assert.equal(mergeShortlistScope(["hidden"],selected,"add").length,251);
  assert.deepEqual(mergeShortlistScope(["hidden",...selected],selected,"remove"),["hidden"]);
});
