import { test } from "node:test";
import assert from "node:assert/strict";
import type { Candidate, Search } from "../../engine/types";
import { evidenceKey, isStrategySelection, sameStrategySelection, resolveStrategy, strategyEvidenceOptions } from "./selection";

const baseline = {node: 10, path: [1, 2], scores:[30, 0], strategy:"red", milestones:[]};
const candidate: Candidate = {id:"candidate", plan:[], baseline, pending:0, responses:[
  {...baseline, opponent:"a", shared:true, kind:"common", scores:[30, 10]},
  {...baseline, path:[3, 2], opponent:"a", shared:true, kind:"common", scores:[30, 40]},
]};
const search = {id:"search", discovery:{runs:[{run:0, candidates:[candidate], commonOpponents:["a"]}]}} as Search;
const selected = {search:"search",run:0,candidate:"candidate",evidence:"baseline"};

test("baseline identity does not consume a response reaching the same terminal path", () => {
  assert.equal(evidenceKey(0,candidate,{...baseline}),"baseline");
  const key = evidenceKey(0,candidate,candidate.responses[0]);
  assert.notEqual(key,"baseline");
  assert.notEqual(evidenceKey(0,candidate,{...baseline,kind:"targeted"} as Candidate["responses"][number]),"baseline");
  assert.equal(resolveStrategy(search,{...selected,evidence:key})?.chosen?.evidence,candidate.responses[0]);
});
test("same terminal node with a different arbitration path remains independently selectable", () => {
  const keys = candidate.responses.map(e => evidenceKey(0,candidate,e));
  assert.notEqual(keys[0],keys[1]);
  assert.equal(resolveStrategy(search,{...selected,evidence:keys[1]})?.chosen?.evidence,candidate.responses[1]);
});
test("restored missing evidence never silently switches to the baseline", () => {
  assert.equal(resolveStrategy(search,{...selected,evidence:"missing"})?.chosen,undefined);
  assert.equal(resolveStrategy(search,{...selected,search:"other"}),null);
  assert.equal(resolveStrategy(search,{...selected,run:1}),null);
  assert.equal(resolveStrategy(search,{...selected,candidate:"other"}),null);
});
test("semantic worst choice only exists for completed common opponents", () => {
  assert.equal(strategyEvidenceOptions(0,candidate,["a"]).find(o=>o.key==="worst")?.evidence,candidate.responses[1]);
  assert.equal(strategyEvidenceOptions(0,candidate,[]).find(o=>o.key==="worst"),undefined);
});
test("selection equality is independent of object property order but includes every scope field", () => {
  assert.ok(sameStrategySelection({evidence:"baseline",candidate:"candidate",run:0,search:"search"},selected));
  for (const patch of [{search:"other"},{run:1},{candidate:"other"},{evidence:"worst"}]) assert.equal(sameStrategySelection({...selected,...patch},selected),false);
});
test("malformed restored selection is rejected before accessing candidate records", () => {
  for (const value of [null,undefined,"candidate",{}, {...selected,run:NaN},{...selected,evidence:2}]) {
    assert.equal(isStrategySelection(value),false);
    assert.equal(sameStrategySelection(value,selected),false);
  }
});
