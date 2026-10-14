import { register } from "../../app/commands";
import { layout, leaves, useLayout } from "../../app/layout";
import { fetchQuery, useSearches } from "../../app/data";
import { ui, useUI } from "../../app/store";
import { isStrategySelection, sameStrategySelection, resolveStrategy, type StrategySelection } from "./selection";

register({
  id: "strategy.inspect", title: "作戦を詳しく見る", category: "候補", hidden: true,
  enabled: ({args}) => isStrategySelection(args),
  run: async ({args}) => {
    if (!isStrategySelection(args)) return;
    const selection = args;
    if (useUI.getState().session.search !== selection.search) return;
    const search = useSearches.getState().list.find(s => s.id === selection.search);
    const resolved = search && resolveStrategy(search, selection);
    if (!resolved?.chosen) { ui.toast("作戦の展開が見つかりません"); return; }
    const source = useLayout.getState().active;
    layout.reveal("strategy-detail", {strategySelection: selection, sourceWorkspace: source});
    await inspectStrategyTime(selection);
  },
}, {
  id: "strategy.open", title: "作戦詳細を開く", category: "候補",
  run: () => layout.reveal("strategy-detail"),
});

/** A later selection, navigation or workspace switch invalidates an in-flight read. */
let requestVersion = 0;
export async function inspectStrategyTime(selection: StrategySelection, time?: number, robot?: number, target?: Parameters<typeof ui.select>[0]) {
  const version = ++requestVersion;
  if (!isStrategySelection(selection)) return;
  const session = useUI.getState().session;
  const workspace = useLayout.getState().active;
  const selectedHere = () => {
    const state = useLayout.getState();
    const active = state.workspaces.find(w => w.id === workspace);
    return state.active === workspace && !!active && leaves(active.root).some(a => a.editor === "strategy-detail" && sameStrategySelection(a.state?.strategySelection, selection));
  };
  const search = useSearches.getState().list.find(s => s.id === selection.search);
  const resolved = search && resolveStrategy(search, selection);
  if (!resolved?.chosen || session.search !== selection.search || !selectedHere()) return;
  const evidence = resolved.chosen.evidence;
  const node = await fetchQuery("node.get", {search: selection.search, node: evidence.node});
  if (version !== requestVersion || useUI.getState().session !== session || !selectedHere()) return;
  // A semantic choice such as "worst" may change while discovery keeps running.
  const latestSearch = useSearches.getState().list.find(s => s.id === selection.search);
  const latest = latestSearch && resolveStrategy(latestSearch, selection)?.chosen?.evidence;
  if (!latest || latest.node !== evidence.node || latest.path.join() !== evidence.path.join()) return;
  ui.patchSession({run: node.run, offset: node.offset});
  ui.selectNode(evidence.node, evidence.path, node.state.t);
  ui.patchPlayback({playing: false, range: null});
  if (time !== undefined && Number.isFinite(time)) ui.seek(Math.max(0, Math.min(node.state.t, time)));
  if (target !== undefined) ui.select(target);
  else if (robot !== undefined) ui.select(`robot:${robot}`);
}
