import { register } from "../../app/commands";
import { findArea, layout, useLayout } from "../../app/layout";
import { useUI } from "../../app/store";
register(...([true, false] as const).map(expanded => ({
  id: expanded ? "outliner.expandAll" : "outliner.collapseAll",
  title: expanded ? "アウトライナーをすべて展開" : "アウトライナーをすべて折りたたむ", category: "アウトライナー", scope: "outliner",
  enabled: ({ args }: import("../../app/commands").CommandContext) => {
    const id = typeof args === "string" ? args : useUI.getState().activeArea;
    const state = useLayout.getState();
    const workspace = state.workspaces.find(w => w.id === state.active);
    return !!id && !!workspace && findArea(workspace.root, id)?.editor === "outliner";
  },
  run: ({ args }: import("../../app/commands").CommandContext) => {
    const id = typeof args === "string" ? args : useUI.getState().activeArea;
    if (id) layout.setAreaState(id, { treeExpansion: expanded, treeExpansionRequest: Date.now() });
  },
})));
