import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultWorkspaces, layout, leaves, useLayout } from "./layout";

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

test("revealing a reference section opens its workspace and releases a hidden maximized area", () => {
  const workspaces = defaultWorkspaces();
  const conditions = workspaces.find((w) => w.id === "conditions")!;
  const model = leaves(conditions.root).find((a) => a.editor === "model")!;
  useLayout.setState({ workspaces, active: "analysis", mounted: ["analysis"], maximized: leaves(workspaces[0].root)[0].id });
  layout.reveal("model", { section: "history" });
  assert.equal(useLayout.getState().active, "conditions");
  assert.equal(useLayout.getState().maximized, null);
  const current = useLayout.getState().workspaces.find((w) => w.id === "conditions")!;
  assert.equal(leaves(current.root).find((a) => a.id === model.id)?.state?.section, "history");
  useLayout.setState({ maximized: leaves(current.root).find((a) => a.editor === "conditions")!.id });
  layout.reveal("model", { section: "rules" });
  assert.equal(useLayout.getState().maximized, null);
});
