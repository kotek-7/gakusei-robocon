import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePath, encodePath, parseHash } from "./router";

test("edge paths round-trip through the compact link form", () => {
  const p = [1, 2, 3, 4, 7, 9, 10, 11, 40];
  assert.equal(encodePath(p), "1-4.7.9-11.40");
  assert.deepEqual(decodePath(encodePath(p)), p);
  assert.deepEqual(decodePath("1,2,3"), [1, 2, 3]);
  assert.deepEqual(decodePath(""), []);
});

test("deep link carries search, workspace, node, time and selection", () => {
  const r = parseHash("#/s/abc/analysis?node=12&path=1-3&t=42.5&sel=robot:1");
  assert.equal(r.search, "abc");
  assert.equal(r.workspace, "analysis");
  assert.equal(r.node, 12);
  assert.deepEqual(r.path, [1, 2, 3]);
  assert.equal(r.time, 42.5);
  assert.equal(r.selection, "robot:1");
  assert.equal(parseHash("#/conditions").workspace, "conditions");
});
