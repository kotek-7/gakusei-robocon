import { test } from "node:test";
import assert from "node:assert/strict";
import type { Frame } from "../../engine/types";
import { sceneRows } from "./sceneTree";
import { visibleRows } from "./tree";

test("scene tree follows containment when objects move from robot to tower", () => {
  const frame = { robots: [{ team: 0, action: null }, { team: 1, action: null }], objects: [{ id: 7, kind: "S", loc: "robot0", face: 0, layer: 0 }, { id: 8, kind: "E", loc: "supply0", layer: 0 }] } as Frame;
  const initial = sceneRows(frame);
  assert.equal(initial.find(r => r.id === "obj:7")?.depth, 2);
  assert.ok(initial.find(r => r.id === "robot:0")?.branch);
  frame.objects[0].loc = "tower3";
  const next = sceneRows(frame);
  const spotIndex = next.findIndex(r => r.id === "spot:3");
  assert.equal(next[spotIndex + 1].id, "obj:7");
  assert.equal(next.filter(r => r.id === "obj:7").length, 1);
  assert.ok(!next.find(r => r.id === "robot:0")?.branch);
  const found = visibleRows(next, "スカイ", false);
  assert.ok(found.some(r => r.id === "spot:3"));
  assert.ok(found.some(r => r.id === "obj:7"));
});
