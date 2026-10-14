import { test } from "node:test";
import assert from "node:assert/strict";
import type { Graph } from "../../engine/types";
import { graphNodes } from "./view";
const data = { nodes: [1,2,3,4].map((id) => ({id})), edges: [{id:10,src:1,dst:2},{id:11,src:2,dst:3},{id:12,src:2,dst:99}] } as Graph;
test("neighbors include incoming and outgoing loaded nodes without inventing page-external nodes", () => {
  assert.deepEqual(graphNodes(data, 2, [], "neighbors").map((n) => n.id), [1,2,3]);
});
test("path filtering retains selected node and only endpoints of path edges", () => {
  assert.deepEqual(graphNodes(data, 4, [10], "path").map((n) => n.id), [1,2,4]);
  assert.deepEqual(graphNodes(data, null, [], "path"), []);
  assert.equal(graphNodes(data, null, [], "page"), data.nodes);
});
