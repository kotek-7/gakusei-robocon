import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeReplay, matchesReplay, type ReplayContext } from "./replayContext";
import { ui, useUI } from "./store";

const source: ReplayContext = {search: "context", run: 2, candidate: "c1", evidence: "baseline", label: "相手待機", node: 20, path: [1, 2]};
const open = () => { ui.openSearch(null); ui.openSearch("context"); ui.selectNode(20, [1, 2], 10, source, {run: 2, offset: 0}); };

test("replay source survives object selection and seeking but not a different path or run", () => {
  open();
  ui.select("robot:1"); ui.seek(5);
  assert.deepEqual(useUI.getState().session.replay, source);
  ui.patchSession({path: [1, 3]});
  assert.equal(useUI.getState().session.replay, null);
  open(); ui.patchSession({run: 1});
  assert.equal(useUI.getState().session.replay, null);
  open(); ui.selectNode(20, [1, 2]);
  assert.equal(useUI.getState().session.replay, null);
});

test("history restores the original run and evidence even across a different run", () => {
  open();
  ui.selectNode(30, [3], 30, null, {run: 3, offset: 100});
  ui.back();
  assert.equal(useUI.getState().session.run, 2);
  assert.deepEqual(useUI.getState().session.replay, source);
  assert.equal(useUI.getState().playback.time, 10);
  ui.forward();
  assert.equal(useUI.getState().session.run, 3);
  assert.equal(useUI.getState().session.offset, 100);
  assert.equal(useUI.getState().session.replay, null);
});

test("comparison provenance is copied with its path and invalidated on incompatible edits", () => {
  open(); ui.setComparison("a", source.path, "候補1", source);
  assert.deepEqual(useUI.getState().session.compare.sourceA, source);
  ui.patchSession({compare: {...useUI.getState().session.compare, a: [9]}});
  assert.equal(useUI.getState().session.compare.sourceA, null);
  ui.setComparison("b", [5], "局面5");
  assert.equal(useUI.getState().session.compare.sourceB, null);
});

test("malformed and mismatched URL provenance cannot label a different replay", () => {
  assert.equal(decodeReplay("{"), null);
  assert.equal(decodeReplay(JSON.stringify({...source, path: [1, -2]})), null);
  assert.equal(matchesReplay(source, {...source, run: 4}), false);
  assert.deepEqual(decodeReplay(JSON.stringify(source)), source);
  open(); ui.patchSession({replay: {...source, node: 999}});
  assert.equal(useUI.getState().session.replay, null);
});
