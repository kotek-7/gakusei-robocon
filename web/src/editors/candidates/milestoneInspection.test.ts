import test from "node:test";
import assert from "node:assert/strict";
import { inspectMilestones, filterMilestones, firstRedDifference } from "./milestoneInspection";
const event = (robot: number, kind = "place", spot = 0) => JSON.stringify([robot,"finish",kind,null,spot,["E0"]]);
test("red comparison ignores blue-only groups but preserves simultaneous grouping and original indices", () => {
  const baseline = [[event(0), event(1)], [event(1,"flip",2)]];
  assert.equal(firstRedDifference(baseline, [[event(2)], [event(1),event(0),event(3)], [event(1,"flip",2)]]), null);
  assert.deepEqual(firstRedDifference(baseline, [[event(2)], [event(0)], [event(1)]]), { baselineGroup: 1, currentGroup: 2 });
  assert.deepEqual(firstRedDifference(baseline, [[event(0),event(1)]]), { baselineGroup: 2, currentGroup: null });
});
test("search retains original simultaneous group index, including robot zero and spot zero", () => {
  const rows = inspectMilestones([[event(2)], [event(0),event(1,"flip")]]);
  const visible = filterMilestones(rows,"0","place","スポット 0");
  assert.equal(visible.length,1);
  assert.equal(visible[0].group,2);
  assert.equal(filterMilestones(rows,"1","place","").length,0);
});
