import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultWorkspaces, layout, leaves, useLayout } from "./layout";

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
