import { call } from "../../app/client";
import { currentPath, goToNode } from "../../app/coreCommands";
import { fetchQuery, upsertSearch } from "../../app/data";
import { act, ui, useUI } from "../../app/store";
import type { Action, Edge } from "../../engine/types";

/** Follow an edge: extend the current path when it starts at the selected node. */
export async function followEdge(e: Edge) {
  const s = useUI.getState().session;
  if (!s.search) return;
  let path: number[];
  if (e.src === s.node) path = [...((await currentPath()) ?? []), e.id];
  else if (e.dst === s.node) {
    const p = (await currentPath()) ?? [];
    const i = p.indexOf(e.id);
    path = i >= 0 ? p.slice(0, i + 1) : [...(await fetchQuery("path.toNode", { search: s.search, node: e.src })), e.id];
    await goToNode(e.src, path.slice(0, -1));
    return;
  } else path = [...(await fetchQuery("path.toNode", { search: s.search, node: e.src })), e.id];
  await goToNode(e.dst, path);
}

export function stepActions(actions: Action[]) {
  const s = useUI.getState().session;
  if (!s.search || s.node === null) return;
  return act("step", async () => {
    const node = s.node!;
    const result = await call("node.step", {
      search: s.search!,
      node,
      red: actions.slice(0, 2),
      blue: actions.slice(2),
    });
    upsertSearch(await call("search.get", { search: s.search! }));
    const path = [...((await currentPath()) ?? []), result.edges[0]];
    const d = await call("node.get", { search: s.search!, node });
    const e = d.edges.find((x) => x.id === result.edges[0])!;
    await goToNode(e.dst, path);
    if (result.edges.length > 1)
      ui.toast(`競合の結果が${result.edges.length}通りあります。出発局面の出る遷移で各ケースを確認できます。`);
  });
}
