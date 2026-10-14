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
test("frontier and score views keep the current selection without hiding unknown boundaries", () => {
  const graph = { ...data, nodes: [
    { id: 1, expanded: true, scores: [0, 0] },
    { id: 2, expanded: false, scores: [0, 0] },
    { id: 3, expanded: true, scores: [0, 8] },
  ] } as Graph;
  assert.deepEqual(graphNodes(graph, 1, [], "frontier").map(n => n.id), [1, 2]);
  assert.deepEqual(graphNodes(graph, 1, [], "scored").map(n => n.id), [1, 3]);
});
