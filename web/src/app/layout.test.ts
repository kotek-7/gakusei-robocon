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

import { useUI } from "./store";

test("revealing an inactive dock tab keeps the workspace and restores tab state", () => {
  layout.resetAll();
  const w = useLayout.getState().workspaces.find(w => w.id === "analysis")!;
  const area = leaves(w.root).find(a => a.tabs?.includes("properties"))!;
  layout.setAreaState(area.id, { query: "robot" });
  const count = useLayout.getState().workspaces.length;
  layout.reveal("score", { mode: "range" });
  assert.equal(useLayout.getState().active, "analysis");
  assert.equal(useLayout.getState().workspaces.length, count);
  assert.equal(useUI.getState().activeEditor, "score");
  layout.reveal("properties");
  const restored = leaves(useLayout.getState().workspaces.find(w => w.id === "analysis")!.root).find(a => a.id === area.id)!;
  assert.deepEqual(restored.state, { query: "robot" });
  layout.reveal("score");
  assert.equal(leaves(useLayout.getState().workspaces.find(w => w.id === "analysis")!.root).find(a => a.id === area.id)!.state?.mode, "range");
});

test("workspace changes and tab switches update keyboard scope to a visible editor", () => {
  layout.resetAll();
  layout.reveal("events");
  layout.activate("conditions");
  assert.equal(useUI.getState().activeEditor, "conditions");
  assert.ok(leaves(useLayout.getState().workspaces.find(w => w.id === "conditions")!.root).some(a => a.id === useUI.getState().activeArea));
  layout.activate("analysis");
  assert.equal(useUI.getState().activeEditor, "events");
});

test("revealing a template's inactive tab selects it when creating its workspace", () => {
  const workspaces = defaultWorkspaces().filter(w => w.id === "conditions");
  useLayout.setState({ workspaces, active: "conditions", mounted: ["conditions"], maximized: null });
  layout.reveal("events", { query: "test" });
  const area = leaves(useLayout.getState().workspaces.find(w => w.id === useLayout.getState().active)!.root).find(a => a.editor === "events")!;
  assert.ok(area);
  assert.equal(area.state?.query, "test");
  assert.equal(useUI.getState().activeArea, area.id);
});

test("reset, close and removal keep keyboard focus in a visible area", () => {
  layout.resetAll();
  layout.reveal("score");
  layout.resetActive();
  let w = useLayout.getState().workspaces.find(w => w.id === useLayout.getState().active)!;
  assert.ok(leaves(w.root).some(a => a.id === useUI.getState().activeArea && a.editor === useUI.getState().activeEditor));
  layout.close(useUI.getState().activeArea!);
  w = useLayout.getState().workspaces.find(w => w.id === useLayout.getState().active)!;
  assert.ok(leaves(w.root).some(a => a.id === useUI.getState().activeArea));
  layout.remove(w.id);
  w = useLayout.getState().workspaces.find(w => w.id === useLayout.getState().active)!;
  assert.ok(leaves(w.root).some(a => a.id === useUI.getState().activeArea));
});

test("a dock tab can be detached for simultaneous inspection without losing its state", () => {
  layout.resetAll();
  layout.reveal("score", { mode: "range" });
  layout.toggleMaximize(useUI.getState().activeArea!);
  layout.detachTab(useUI.getState().activeArea!);
  const areas = leaves(useLayout.getState().workspaces.find(w => w.id === "analysis")!.root);
  const score = areas.find(a => a.editor === "score")!;
  assert.equal(score.state?.mode, "range");
  assert.equal(useLayout.getState().maximized, null);
  assert.equal(useUI.getState().activeArea, score.id);
  assert.ok(areas.some(a => a.editor === "properties"));
  assert.ok(!areas.find(a => a.editor === "properties")!.tabs?.includes("score"));
});
