import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "./plans.js";
import { rankedPlans, defaultEstimates } from "./effort.js";
import { familyOf, technicalGroups, predecessors } from "./structure.js";
const plans = catalog();
const rows = rankedPlans(plans, new Map(), defaultEstimates());
const groups = technicalGroups(rows);
test("441 plans partition into 21 capability groups without missing or duplicate members", () => {
  assert.equal(groups.length, 21);
  const ids = groups.flatMap(g => g.rows.map(r => r.plan.id));
  assert.equal(ids.length, 441);
  assert.equal(new Set(ids).size, 441);
  for (const g of groups) {
    assert.ok(g.rows.every(r => r.days === g.days && familyOf(r.plan) === g.family));
    assert.equal(g.best, undefined);
  }
});
test("endgame reflection belongs to reflection family even under build mode", () => {
  assert.equal(familyOf({ ...plans[0], mode: "build", mission: false, end: "late" }), "flip");
  assert.equal(familyOf({ ...plans[0], mode: "flip", mission: true, end: "expand" }), "combined");
});
test("capability relations retain branching direct parents and exclude transitive ancestors", () => {
  const group = groups.find(g => g.key === "base-shared-upper-mission");
  assert.deepEqual(predecessors(group, groups).map(g => g.key).sort(), ["base-shared-mission", "base-shared-upper", "base-upper-mission"]);
  assert.deepEqual(predecessors(groups.find(g => g.key === "base"), groups), []);
  for (const g of groups) for (const parent of predecessors(g, groups)) {
    assert.ok(parent.skills.length < g.skills.length);
    assert.ok(parent.skills.every(c => g.skills.includes(c)));
  }
});
test("group score range and representative use only calculated members", () => {
  const scores = new Map([[1,[10,9]], [4,[20,8]], [7,[20,3]]]);
  const g = technicalGroups(rankedPlans(plans, scores, defaultEstimates())).find(g => g.rows.some(r => r.plan.id === 1));
  assert.equal(g.minScore, 10);
  assert.equal(g.maxScore, 20);
  assert.equal(g.best.plan.id, 7);
  assert.equal(g.scored, 3);
});
