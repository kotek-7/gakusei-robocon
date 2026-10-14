import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultWorkspaces, layout, leaves, separateDocumentation, useLayout } from "./layout";

test("revealing a new editor adds its full workspace without discarding saved layouts", () => {
  const workspaces = defaultWorkspaces().filter(w => w.id !== "review");
  useLayout.setState({ workspaces, active: "analysis", mounted: ["analysis"], maximized: null });
  layout.reveal("review", { selected: "note-1" });
  const state = useLayout.getState();
  assert.equal(state.workspaces.length, workspaces.length + 1);
  const added = state.workspaces.find(w => w.id === state.active)!;
  assert.equal(added.name, "検討記録");
  assert.deepEqual(leaves(added.root).map(a => a.editor), ["review", "viewport", "timeline"]);
  assert.equal(leaves(added.root)[0].state?.selected, "note-1");
  layout.reveal("review");
  assert.equal(useLayout.getState().workspaces.length, state.workspaces.length);
});

test("saved conditions keep input state while documentation moves out", () => {
  const condition = { kind: "area" as const, id: "kept", editor: "conditions", state: { view: "diff" } };
  const result = separateDocumentation([{ id: "conditions", name: "条件", root: { kind: "split", id: "split", dir: "row", sizes: [70, 30], children: [condition, { kind: "area", id: "doc", editor: "model" }] } }]);
  assert.deepEqual(result[0].root, condition);
  assert.equal(result.length, 1);
  assert.deepEqual(separateDocumentation(result), result);
});

test("saved documentation workspace is removed without changing other workspaces", () => {
  const workspaces = defaultWorkspaces();
  const result = separateDocumentation([...workspaces, { id: "documentation", name: "ドキュメント", root: { kind: "area", id: "doc", editor: "model" } }]);
  assert.deepEqual(result, workspaces);
  assert.ok(separateDocumentation([{ id: "documentation", name: "ドキュメント", root: { kind: "area", id: "doc", editor: "model" } }]).length);
});
