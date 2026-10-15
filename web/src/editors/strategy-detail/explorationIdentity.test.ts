import test from "node:test";
import assert from "node:assert/strict";
import { matchesExplorationSelection } from "./explorationIdentity";
const target = {run:1,candidate:"c1",mode:"counter" as const};
test("focused exploration follows candidate identity independently of viewed evidence",()=>{
  assert.equal(matchesExplorationSelection({search:"a",run:1,candidate:"c1",evidence:"baseline"},"a",target),true);
  assert.equal(matchesExplorationSelection({search:"a",run:1,candidate:"c1",evidence:"response"},"a",target),true);
});
test("focused exploration rejects stale search, configuration, candidate and absent area selection",()=>{
  for(const selection of [null,{}, {search:"b",run:1,candidate:"c1"},{search:"a",run:2,candidate:"c1"},{search:"a",run:1,candidate:"c2"}]) assert.equal(matchesExplorationSelection(selection,"a",target),false);
});
