import { layout } from "../../app/layout";
import { register } from "../../app/commands";
import { fetchQuery } from "../../app/data";
import { ui, useUI } from "../../app/store";

register(...([-1, 1] as const).map(direction => ({
  id: direction < 0 ? "graph.previousPage" : "graph.nextPage",
  title: direction < 0 ? "前の100局面を表示" : "次の100局面を表示",
  category: "状態グラフ", scope: "graph", keys: [direction < 0 ? "PageUp" : "PageDown"],
  enabled: () => !!useUI.getState().session.search,
  run: async () => {
    const { search, run, offset } = useUI.getState().session;
    if (!search) return;
    const graph = await fetchQuery("graph.page", { search, run, offset });
    const current = useUI.getState().session;
    if (current.search !== search || current.run !== run || current.offset !== offset) return;
    ui.patchSession({ offset: Math.max(0, Math.min(Math.floor(Math.max(0, graph.total - 1) / 100) * 100, offset + direction * 100)) });
  },
})), {
  id: "graph.revealSelection", title: "選択局面のページを表示", category: "状態グラフ",
  enabled: () => !!useUI.getState().session.search && useUI.getState().session.node !== null,
  run: async () => {
    const { search, node } = useUI.getState().session;
    if (!search || node === null) return;
    const detail = await fetchQuery("node.get", { search, node });
    if (useUI.getState().session.search === search && useUI.getState().session.node === node)
      ui.patchSession({ run: detail.run, offset: detail.offset });
  },
});

register({ id: "graph.scope", title: "グラフの表示範囲を変更", category: "状態グラフ", hidden: true,
  run: ({ args }) => { const { area, scope } = args as { area: string; scope: string }; layout.setAreaState(area, { graphScope: scope }); },
});
