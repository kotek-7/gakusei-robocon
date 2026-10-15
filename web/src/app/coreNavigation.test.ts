import { test } from "node:test";
import assert from "node:assert/strict";
import { goToNode } from "./coreCommands";
import { run, isEnabled } from "./commands";
import "../editors/strategy-detail/commands";
import { useSearches } from "./data";
import type { Search } from "../engine/types";
import { ui, useUI } from "./store";

const responses = new Map<number, () => void>();
class NavigationWorker {
  onmessage?: (event: { data: unknown }) => void;
  postMessage({ id, params }: { id: number; params: { node: number } }) {
    responses.set(params.node, () => this.onmessage?.({ data: { id, result: { run: 0, offset: 0, path: [params.node], state: { t: params.node } } } }));
  }
}
Object.assign(globalThis, { Worker: NavigationWorker });

test("a slow earlier candidate open cannot overwrite the latest opened path", async () => {
  ui.openSearch("navigation");
  const earlier = goToNode(101, [101]);
  const later = goToNode(102, [102]);
  responses.get(102)!();
  assert.equal(await later, true);
  responses.get(101)!();
  assert.equal(await earlier, false);
  assert.equal(useUI.getState().session.node, 102);
});

test("an in-flight open cannot restore a path after the user navigates elsewhere", async () => {
  ui.openSearch("navigation-new");
  const pending = goToNode(103, [103]);
  ui.selectNode(104, [104], 104);
  responses.get(103)!();
  assert.equal(await pending, false);
  assert.equal(useUI.getState().session.node, 104);
});

test("object selection does not cancel an in-flight path open", async () => {
  ui.openSearch("navigation-object");
  const pending = goToNode(106, [106]);
  ui.select("robot:1");
  responses.get(106)!();
  assert.equal(await pending, true);
  assert.equal(useUI.getState().session.node, 106);
});

test("an in-flight comparison assignment stays out of a newly opened search", async () => {
  ui.openSearch("comparison-old");
  ui.selectNode(105, null, 105);
  run("compare.setA");
  ui.openSearch("comparison-new");
  responses.get(105)!();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(useUI.getState().session.compare.a, null);
});


test("revealing the source candidate preserves playback and selection", () => {
  const evidence = {node: 107, path: [107], scores: [30, 0], strategy: "red", milestones: []};
  const search = {id: "reveal", discovery: {runs: [{run: 0, commonOpponents: [], candidates: [{id: "c", plan: [], baseline: evidence, responses: [], pending: 0}]}]}} as unknown as Search;
  useSearches.setState({list: [search]});
  ui.openSearch(search.id);
  ui.selectNode(107, [107], 107);
  ui.patchPlayback({time: 12, playing: true, range: [10, 20]});
  ui.select("robot:1");
  const before = useUI.getState();
  const source = {search: search.id, run: 0, candidate: "c", evidence: "baseline"};
  assert.equal(isEnabled("strategy.reveal", source), true);
  run("strategy.reveal", source);
  assert.equal(useUI.getState().session, before.session);
  assert.equal(useUI.getState().playback, before.playback);
  ui.selectNode(108, [108], 108);
  assert.equal(isEnabled("strategy.reveal", source), false);
});
