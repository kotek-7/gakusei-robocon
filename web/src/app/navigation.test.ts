import { test } from "node:test";
import assert from "node:assert/strict";
import { goToNode } from "./coreCommands";
import { ui, useUI } from "./store";

class DelayedWorker {
  onmessage?: (event: { data: unknown }) => void;
  postMessage({ id, params }: { id: number; params: { node: number } }) {
    setTimeout(() => this.onmessage?.({ data: { id, result: { id: params.node, run: 8, offset: 100, state: { t: 40 }, path: [2, 3] } } }), 10);
  }
}
Object.assign(globalThis, { Worker: DelayedWorker });
test("a delayed path restore cannot put an old node into a different search", async () => {
  ui.openSearch("old");
  const pending = goToNode(123, [2, 3]);
  ui.openSearch("new");
  await pending;
  assert.equal(useUI.getState().session.search, "new");
  assert.equal(useUI.getState().session.node, null);
  assert.equal(useUI.getState().session.run, 0);
  await goToNode(124, [2, 3]);
  assert.equal(useUI.getState().session.node, 124);
  assert.equal(useUI.getState().session.run, 8);
});
