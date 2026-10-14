import { register } from "../../app/commands";
import { fetchQuery } from "../../app/data";
import { ui, useUI } from "../../app/store";
import { saveJSON } from "../../app/coreCommands";
register({
  id: "properties.seekNode",
  title: "選択局面の時刻へ移動",
  category: "移動",
  enabled: () => !!useUI.getState().session.search && useUI.getState().session.node !== null,
  run: async () => {
    const { search, node } = useUI.getState().session;
    if (!search || node === null) return;
    const detail = await fetchQuery("node.get", { search, node });
    const current = useUI.getState().session;
    if (current.search === search && current.node === node)
      ui.patchPlayback({ time: detail.state.t, playing: false });
  },
});

register({ id: "properties.exportDelta", title: "局面の変化をJSON保存", category: "プロパティ", hidden: true,
  run: ({ args }) => saveJSON(args, "state-changes.json") });
