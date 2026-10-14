/** Commands that are not tied to one editor: files, searches, jobs, playback, layout, navigation. */
import { call } from "./client";
import { register, togglePinned, clearRecent } from "./commands";
import { fetchQuery, onJobFinished, upsertSearch, useSearches } from "./data";
import { layout, useLayout } from "./layout";
import { getPref, setPref } from "./prefs";
import { shareURL } from "./router";
import { act, ui, useUI } from "./store";
import { newId, updateWorkspace } from "./workspace";

const session = () => useUI.getState().session;
const searchId = () => session().search;
const current = () => {
  const id = searchId();
  return useSearches.getState().list.find((s) => s.id === id) ?? null;
};
const running = () => {
  const s = current();
  return s?.status === "running" || s?.status === "evaluating";
};
const hasSearch = () => !!current();

export async function currentPath(): Promise<number[] | null> {
  const s = session();
  if (s.path) return s.path;
  if (!s.search || s.node === null) return null;
  return (await fetchQuery("node.get", { search: s.search, node: s.node })).path;
}
export async function currentAnalysis() {
  const s = session(),
    path = await currentPath();
  if (!s.search || !path?.length) return null;
  return fetchQuery("analysis.match", { search: s.search, edges: path });
}
export async function goToRoot(run = session().run) {
  const search = searchId();
  if (!search) return;
  const g = await fetchQuery("graph.page", { search, run, offset: 0 });
  if (searchId() !== search) return;
  ui.patchSession({ run, offset: 0 });
  ui.selectNode(g.root, [], 0);
}
/** Select a node and move the playhead to its time. */
export async function goToNode(node: number, path: number[] | null = null) {
  const search = searchId();
  if (!search) return;
  const d = await fetchQuery("node.get", { search, node });
  if (searchId() !== search) return;
  ui.patchSession({ run: d.run, offset: d.offset });
  ui.selectNode(node, path, d.state.t);
}
export function saveJSON(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function pickFile(accept = "application/json,.json"): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}
const fileName = (name: string) => name.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 60) || "search";

export function startJob(kind: "discovery" | "exact" | "evaluation", extra: { seconds?: number; budget?: number; node?: number } = {}) {
  const search = searchId();
  if (!search) return;
  return act(`job.${kind}`, async () => {
    const seconds = extra.seconds ?? Number(getPref("job.discoverySeconds"));
    const s = await call("job.start", {
      search,
      kind,
      seconds,
      budget: extra.budget ?? Number(getPref("job.exactBudget")),
      node: extra.node,
    });
    useUI.setState((st) => ({
      jobRun: { ...st.jobRun, [search]: { kind, startedAt: Date.now(), seconds, elapsedBase: s.discovery?.elapsed ?? 0 } },
    }));
    upsertSearch(s);
  });
}

const STEP = 0.25;
function clampTime(t: number) {
  const horizon = current()?.config.horizon ?? 180;
  return Math.max(0, Math.min(horizon, t));
}
async function jumpEvent(dir: 1 | -1, kinds?: string[]) {
  const a = await currentAnalysis();
  if (!a) return;
  const t = useUI.getState().playback.time;
  const times = [...new Set(a.markers.filter((m) => !kinds || kinds.includes(m.kind)).map((m) => m.t))].sort((x, y) => x - y);
  const next = dir > 0 ? times.find((x) => x > t + 1e-6) : times.reverse().find((x) => x < t - 1e-6);
  if (next !== undefined) ui.patchPlayback({ time: next, playing: false });
}

const REASONS: Record<string, string> = {
  completed: "計算完了",
  time_limit: "指定時間で停止",
  exhausted: "対象範囲を探索済み",
  cancelled: "停止しました",
  resource_limit: "保存量の上限で中断",
  error: "エラーで中断",
};
onJobFinished((e) => {
  useUI.setState((s) => {
    const jobRun = { ...s.jobRun };
    delete jobRun[e.search];
    return { jobRun };
  });
  const s = useSearches.getState().list.find((x) => x.id === e.search);
  const name = { discovery: "候補探索", exact: "全探索", evaluation: "評価" }[e.kind];
  const reason = REASONS[e.reason] ?? e.reason;
  if (e.kind === "discovery" && s?.discovery?.metrics.candidates)
    ui.toast(`${name}: ${reason}。候補 ${s.discovery.metrics.candidates}`, e.reason === "error" ? "error" : "info", {
      label: "最高点の候補を開く",
      command: "candidate.openBest",
    });
  else ui.toast(`${name}: ${reason}`, e.reason === "error" ? "error" : "info");
});

register(
  { id: "docs.open", title: "アプリ内ドキュメントを開く", category: "ヘルプ",
    run: ({ args }) => ui.open({ kind: "documentation", topic: typeof args === "string" ? args : "model" }) },
  { id: "command.pin", title: "操作の固定を切り替える", category: "表示", hidden: true,
    run: ({ args }) => { if (typeof args === "string") togglePinned(args); } },
  { id: "command.clearRecent", title: "コマンドの使用履歴を消去", category: "編集", run: clearRecent },
  {
    id: "candidate.openBest",
    title: "相手待機で最高点の候補を開く",
    category: "探索",
    enabled: () => !!current()?.discovery?.metrics.candidates,
    run: async () => {
      const runs = current()?.discovery?.runs ?? [];
      const all = runs.flatMap((r) => r.candidates);
      if (!all.length) return;
      const best = all.reduce((a, b) =>
        b.baseline.scores[0] - b.baseline.scores[1] > a.baseline.scores[0] - a.baseline.scores[1] ? b : a,
      );
      await goToNode(best.baseline.node, best.baseline.path);
      layout.reveal("viewport");
    },
  },
  // File
  {
    id: "search.new",
    title: "新しい探索…",
    category: "ファイル",
    keys: ["Ctrl+Alt+N"],
    run: () => layout.activate("conditions"),
    detail: "条件ワークスペースを開き、条件を編集して探索を作成する。",
  },
  {
    id: "search.import",
    title: "バックアップを読み込む…",
    category: "ファイル",
    keys: ["Ctrl+O"],
    run: () =>
      act("import", async () => {
        const f = await pickFile();
        if (!f) return;
        const s = await call("search.import", { backup: JSON.parse(await f.text()) });
        upsertSearch(s);
        ui.openSearch(s.id);
        await goToRoot(0);
        ui.toast(`「${s.name}」を読み込みました`);
      }),
  },
  {
    id: "search.export",
    title: "バックアップを書き出す",
    category: "ファイル",
    keys: ["Ctrl+S"],
    enabled: hasSearch,
    run: () =>
      act("export", async () => {
        const s = current()!;
        saveJSON(await call("search.export", { search: s.id }), `${fileName(s.name)}.robocon.json`);
      }),
  },
  {
    id: "search.exportConfig",
    title: "条件JSONを書き出す",
    category: "ファイル",
    enabled: hasSearch,
    run: () => {
      const s = current()!;
      saveJSON(s.config, `${fileName(s.name)}.config.json`);
    },
  },
  {
    id: "search.rename",
    title: "探索の名前を変更…",
    category: "ファイル",
    keys: ["F2"],
    enabled: hasSearch,
    run: async () => {
      const s = current()!;
      const name = await ui.prompt("探索の名前", s.name);
      if (name?.trim())
        await act("rename", async () => upsertSearch(await call("search.rename", { search: s.id, name })));
    },
  },
  {
    id: "search.duplicate",
    title: "探索を複製",
    category: "ファイル",
    enabled: () => hasSearch() && !running(),
    run: () =>
      act("duplicate", async () => {
        const s = await call("search.duplicate", { search: searchId()! });
        upsertSearch(s);
        ui.openSearch(s.id);
        await goToRoot(0);
      }),
  },
  {
    id: "search.delete",
    title: "探索を削除…",
    category: "ファイル",
    enabled: () => hasSearch() && !running(),
    run: async () => {
      const s = current()!;
      if (
        getPref<boolean>("ui.confirmDelete") &&
        !(await ui.confirm(`「${s.name}」を削除しますか`, "この探索の局面・遷移・候補・評価と注釈を削除します。元に戻せません。", true))
      )
        return;
      await act("delete", async () => {
        await call("search.delete", { search: s.id });
        const next = useSearches.getState().list.find((x) => x.id !== s.id);
        ui.openSearch(next?.id ?? null);
        if (next) await goToRoot(0);
      });
    },
  },
  {
    id: "search.open",
    title: "探索を開く…",
    category: "ファイル",
    hidden: true,
    run: async ({ args }) => {
      const id = args as string;
      ui.openSearch(id);
      await goToRoot(0);
    },
  },
  {
    id: "app.copyLink",
    title: "この表示へのリンクをコピー",
    category: "ファイル",
    keys: ["Ctrl+Shift+L"],
    run: async () => {
      await navigator.clipboard.writeText(shareURL());
      ui.toast("リンクをコピーしました。同じブラウザで開くと選択と時刻を復元します。");
    },
  },
  // Jobs
  {
    id: "job.discover",
    title: "候補探索を開始・再開",
    category: "探索",
    keys: ["F5"],
    enabled: () => hasSearch() && !running(),
    run: () => startJob("discovery"),
  },
  {
    id: "job.exact",
    title: "詳細な全探索を続ける",
    category: "探索",
    keys: ["Shift+F5"],
    enabled: () => hasSearch() && !running() && !current()!.complete,
    run: () => startJob("exact"),
  },
  {
    id: "job.exactHere",
    title: "選択局面を展開",
    category: "探索",
    enabled: () => hasSearch() && !running() && session().node !== null,
    run: () => startJob("exact", { node: session().node! }),
  },
  {
    id: "job.evaluate",
    title: "評価を計算",
    category: "探索",
    keys: ["F6"],
    enabled: () => hasSearch() && !running(),
    run: () => startJob("evaluation"),
  },
  {
    id: "job.pause",
    title: "計算を停止",
    category: "探索",
    keys: ["Ctrl+."],
    enabled: running,
    run: () =>
      act("pause", async () => upsertSearch(await call("job.pause", { search: searchId()! }))),
  },
  {
    id: "run.next",
    title: "次の構成を生成",
    category: "探索",
    enabled: () => hasSearch() && !running() && BigInt(current()!.runs) < BigInt(current()!.totalRuns),
    run: () =>
      act("run", async () => {
        const s = current()!;
        upsertSearch(await call("run.ensure", { search: s.id, index: s.runs }));
        await goToRoot(s.runs);
      }),
  },
  // Navigation
  {
    id: "nav.back",
    title: "前の選択に戻る",
    category: "移動",
    keys: ["Alt+ArrowLeft"],
    run: ui.back,
  },
  {
    id: "nav.forward",
    title: "次の選択に進む",
    category: "移動",
    keys: ["Alt+ArrowRight"],
    run: ui.forward,
  },
  {
    id: "nav.root",
    title: "初期局面へ",
    category: "移動",
    keys: ["Alt+Home"],
    enabled: hasSearch,
    run: () => goToRoot(),
  },
  {
    id: "nav.goto",
    title: "移動…（局面・時刻・候補）",
    category: "移動",
    keys: ["Ctrl+P", "Ctrl+G"],
    run: () => ui.open({ kind: "palette", mode: "goto" }),
  },
  {
    id: "nav.node",
    title: "局面を選択",
    category: "移動",
    hidden: true,
    run: ({ args }) => {
      const a = args as { node: number; path?: number[] | null };
      return goToNode(a.node, a.path ?? null);
    },
  },
  // Playback
  {
    id: "play.toggle",
    title: "再生・一時停止",
    category: "再生",
    keys: ["Space"],
    checked: () => useUI.getState().playback.playing,
    run: () => {
      const p = useUI.getState().playback;
      ui.patchPlayback({ playing: !p.playing, direction: p.playing ? p.direction : 1 });
    },
  },
  {
    id: "play.reverse",
    title: "逆再生",
    category: "再生",
    keys: ["Shift+Space"],
    run: () => ui.patchPlayback({ playing: true, direction: -1 }),
  },
  {
    id: "play.shuttleBack",
    title: "逆方向に再生（押すたび加速）",
    category: "再生",
    keys: ["J"],
    run: () => {
      const p = useUI.getState().playback;
      const speed = p.playing && p.direction < 0 ? Math.min(8, p.speed * 2) : 1;
      ui.patchPlayback({ playing: true, direction: -1, speed });
    },
  },
  {
    id: "play.shuttleStop",
    title: "停止（シャトル）",
    category: "再生",
    keys: ["K"],
    run: () => ui.patchPlayback({ playing: false }),
  },
  {
    id: "play.shuttleFwd",
    title: "順方向に再生（押すたび加速）",
    category: "再生",
    keys: ["L"],
    run: () => {
      const p = useUI.getState().playback;
      const speed = p.playing && p.direction > 0 ? Math.min(8, p.speed * 2) : 1;
      ui.patchPlayback({ playing: true, direction: 1, speed });
    },
  },
  {
    id: "play.stepBack",
    title: "0.25秒戻る",
    category: "再生",
    keys: ["ArrowLeft"],
    run: () => {
      const t = useUI.getState().playback.time;
      ui.patchPlayback({ playing: false, time: clampTime(Math.ceil(t / STEP - 1e-6) * STEP - STEP) });
    },
  },
  {
    id: "play.stepFwd",
    title: "0.25秒進む",
    category: "再生",
    keys: ["ArrowRight"],
    run: () => {
      const t = useUI.getState().playback.time;
      ui.patchPlayback({ playing: false, time: clampTime(Math.floor(t / STEP + 1e-6) * STEP + STEP) });
    },
  },
  {
    id: "play.back1",
    title: "1秒戻る",
    category: "再生",
    keys: ["Shift+ArrowLeft"],
    run: () => ui.patchPlayback({ playing: false, time: clampTime(Math.ceil(useUI.getState().playback.time) - 1) }),
  },
  {
    id: "play.fwd1",
    title: "1秒進む",
    category: "再生",
    keys: ["Shift+ArrowRight"],
    run: () => ui.patchPlayback({ playing: false, time: clampTime(Math.floor(useUI.getState().playback.time) + 1) }),
  },
  {
    id: "play.back10",
    title: "10秒戻る",
    category: "再生",
    keys: ["Ctrl+ArrowLeft"],
    run: () => ui.patchPlayback({ time: clampTime(useUI.getState().playback.time - 10) }),
  },
  {
    id: "play.fwd10",
    title: "10秒進む",
    category: "再生",
    keys: ["Ctrl+ArrowRight"],
    run: () => ui.patchPlayback({ time: clampTime(useUI.getState().playback.time + 10) }),
  },
  {
    id: "play.prevEvent",
    title: "前のイベントへ",
    category: "再生",
    keys: ["ArrowDown"],
    run: () => jumpEvent(-1),
  },
  {
    id: "play.nextEvent",
    title: "次のイベントへ",
    category: "再生",
    keys: ["ArrowUp"],
    run: () => jumpEvent(1),
  },
  {
    id: "play.prevScore",
    title: "前の得点変化へ",
    category: "再生",
    keys: ["Shift+ArrowDown"],
    run: () => jumpEvent(-1, ["place", "flip", "mustika", "transfer"]),
  },
  {
    id: "play.nextScore",
    title: "次の得点変化へ",
    category: "再生",
    keys: ["Shift+ArrowUp"],
    run: () => jumpEvent(1, ["place", "flip", "mustika", "transfer"]),
  },
  {
    id: "play.start",
    title: "経路の先頭へ",
    category: "再生",
    keys: ["Home"],
    run: async () => {
      const a = await currentAnalysis();
      ui.patchPlayback({ playing: false, time: useUI.getState().playback.range?.[0] ?? a?.start ?? 0 });
    },
  },
  {
    id: "play.end",
    title: "経路の末尾へ",
    category: "再生",
    keys: ["End"],
    run: async () => {
      const a = await currentAnalysis();
      ui.patchPlayback({ playing: false, time: useUI.getState().playback.range?.[1] ?? a?.end ?? 0 });
    },
  },
  {
    id: "play.loop",
    title: "ループ再生",
    category: "再生",
    keys: ["Ctrl+L"],
    checked: () => useUI.getState().playback.loop,
    run: () => ui.patchPlayback({ loop: !useUI.getState().playback.loop }),
  },
  {
    id: "play.setIn",
    title: "再生範囲の開始をここに",
    category: "再生",
    keys: ["I"],
    run: async () => {
      const p = useUI.getState().playback,
        a = await currentAnalysis();
      ui.patchPlayback({ range: [p.time, Math.max(p.time, p.range?.[1] ?? a?.end ?? p.time)] });
    },
  },
  {
    id: "play.setOut",
    title: "再生範囲の終了をここに",
    category: "再生",
    keys: ["O"],
    run: async () => {
      const p = useUI.getState().playback,
        a = await currentAnalysis();
      ui.patchPlayback({ range: [Math.min(p.time, p.range?.[0] ?? a?.start ?? 0), p.time] });
    },
  },
  {
    id: "play.clearRange",
    title: "再生範囲を解除",
    category: "再生",
    keys: ["Alt+I"],
    enabled: () => !!useUI.getState().playback.range,
    run: () => ui.patchPlayback({ range: null }),
  },
  ...[0.25, 0.5, 1, 2, 4, 8].map((speed) => ({
    id: `play.speed${speed}`,
    title: `再生速度 ${speed}倍`,
    category: "再生",
    checked: () => useUI.getState().playback.speed === speed,
    run: () => ui.patchPlayback({ speed }),
  })),
  // Markers
  {
    id: "marker.add",
    title: "再生位置にマーカーを追加",
    category: "再生",
    keys: ["M"],
    enabled: hasSearch,
    run: () => {
      const t = Math.round(useUI.getState().playback.time * 4) / 4;
      return updateWorkspace((w) => ({
        ...w,
        markers: [...w.markers, { id: newId(), t, name: `M${w.markers.length + 1}` }].sort((a, b) => a.t - b.t),
      }));
    },
  },
  {
    id: "marker.next",
    title: "次のマーカーへ",
    category: "再生",
    keys: ["Shift+M"],
    enabled: hasSearch,
    run: async () => {
      const s = searchId()!;
      const w = await fetchQuery("workspace.get", { search: s });
      const t = useUI.getState().playback.time;
      const m = w.markers.find((x) => x.t > t + 1e-6) ?? w.markers[0];
      if (m) ui.patchPlayback({ time: m.t, playing: false });
    },
  },
  {
    id: "marker.prev",
    title: "前のマーカーへ",
    category: "再生",
    keys: ["Ctrl+M"],
    enabled: hasSearch,
    run: async () => {
      const s = searchId()!;
      const w = await fetchQuery("workspace.get", { search: s });
      const t = useUI.getState().playback.time;
      const m = [...w.markers].reverse().find((x) => x.t < t - 1e-6) ?? w.markers.at(-1);
      if (m) ui.patchPlayback({ time: m.t, playing: false });
    },
  },
  // Compare
  {
    id: "compare.setA",
    title: "現在の経路をAに設定",
    category: "比較",
    enabled: () => session().node !== null,
    run: async () => {
      const path = await currentPath();
      ui.patchSession({ compare: { ...session().compare, a: path, label: [`局面 ${session().node}`, session().compare.label[1]] } });
    },
  },
  {
    id: "compare.setB",
    title: "現在の経路をBに設定",
    category: "比較",
    enabled: () => session().node !== null,
    run: async () => {
      const path = await currentPath();
      ui.patchSession({ compare: { ...session().compare, b: path, label: [session().compare.label[0], `局面 ${session().node}`] } });
    },
  },
  {
    id: "compare.swap",
    title: "AとBを入れ替え",
    category: "比較",
    enabled: () => !!(session().compare.a || session().compare.b),
    run: () => {
      const c = session().compare;
      ui.patchSession({ compare: { a: c.b, b: c.a, label: [c.label[1], c.label[0]] } });
    },
  },
  {
    id: "compare.open",
    title: "比較ワークスペースを開く",
    category: "比較",
    run: () => layout.activate("compare"),
  },
  // Layout / view
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `workspace.${i + 1}`,
    title: `ワークスペース ${i + 1} に切り替え`,
    category: "ウィンドウ",
    keys: [`Ctrl+${i + 1}`],
    hidden: true,
    run: () => {
      const w = useLayout.getState().workspaces[i];
      if (w) layout.activate(w.id);
    },
  })),
  {
    id: "workspace.next",
    title: "次のワークスペース",
    category: "ウィンドウ",
    keys: ["Ctrl+PageDown"],
    run: () => {
      const { workspaces, active } = useLayout.getState();
      const i = workspaces.findIndex((w) => w.id === active);
      layout.activate(workspaces[(i + 1) % workspaces.length].id);
    },
  },
  {
    id: "workspace.prev",
    title: "前のワークスペース",
    category: "ウィンドウ",
    keys: ["Ctrl+PageUp"],
    run: () => {
      const { workspaces, active } = useLayout.getState();
      const i = workspaces.findIndex((w) => w.id === active);
      layout.activate(workspaces[(i - 1 + workspaces.length) % workspaces.length].id);
    },
  },
  {
    id: "workspace.duplicate",
    title: "ワークスペースを複製",
    category: "ウィンドウ",
    run: layout.duplicate,
  },
  {
    id: "workspace.rename",
    title: "ワークスペースの名前を変更…",
    category: "ウィンドウ",
    run: async () => {
      const { workspaces, active } = useLayout.getState();
      const name = await ui.prompt("ワークスペースの名前", workspaces.find((w) => w.id === active)?.name);
      if (name?.trim()) layout.rename(active, name.trim());
    },
  },
  {
    id: "workspace.remove",
    title: "ワークスペースを削除",
    category: "ウィンドウ",
    enabled: () => useLayout.getState().workspaces.length > 1,
    run: () => layout.remove(useLayout.getState().active),
  },
  {
    id: "workspace.reset",
    title: "このワークスペースの配置を初期化",
    category: "ウィンドウ",
    run: layout.resetActive,
  },
  {
    id: "workspace.resetAll",
    title: "すべてのワークスペースを初期化",
    category: "ウィンドウ",
    run: async () => {
      if (await ui.confirm("すべてのワークスペースを初期の配置に戻しますか", "追加・複製したワークスペースは削除されます。"))
        layout.resetAll();
    },
  },
  {
    id: "area.activate",
    title: "領域を表示",
    category: "ウィンドウ",
    hidden: true,
    run: ({ args }) => {
      const area = args as { id: string; editor: string };
      useLayout.setState({ maximized: null });
      useUI.setState({ activeArea: area.id, activeEditor: area.editor });
    },
  },
  {
    id: "area.maximize",
    title: "領域を最大化・元に戻す",
    category: "ウィンドウ",
    keys: ["Ctrl+Space"],
    run: ({ args }) => layout.toggleMaximize((args as string) ?? useUI.getState().activeArea),
  },
  {
    id: "area.splitRow",
    title: "領域を左右に分割",
    category: "ウィンドウ",
    enabled: ({ args }) => !!((args as string) ?? useUI.getState().activeArea),
    run: ({ args }) => layout.split((args as string) ?? useUI.getState().activeArea!, "row"),
  },
  {
    id: "area.splitCol",
    title: "領域を上下に分割",
    category: "ウィンドウ",
    enabled: ({ args }) => !!((args as string) ?? useUI.getState().activeArea),
    run: ({ args }) => layout.split((args as string) ?? useUI.getState().activeArea!, "col"),
  },
  {
    id: "area.close",
    title: "領域を閉じる",
    category: "ウィンドウ",
    enabled: ({ args }) => !!((args as string) ?? useUI.getState().activeArea),
    run: ({ args }) => layout.close((args as string) ?? useUI.getState().activeArea!),
  },
  {
    id: "view.statusBar",
    title: "ステータスバー",
    category: "表示",
    checked: () => getPref<boolean>("ui.statusBar"),
    run: () => setPref("ui.statusBar", !getPref<boolean>("ui.statusBar")),
  },
  {
    id: "view.theme",
    title: "ライト・ダークを切り替え",
    category: "表示",
    keys: ["Ctrl+Alt+T"],
    run: () => {
      const t = getPref<string>("ui.theme");
      const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      setPref("ui.theme", dark ? "light" : "dark");
    },
  },
  {
    id: "view.zoomIn",
    title: "文字を大きく",
    category: "表示",
    keys: ["Ctrl+="],
    run: () => setPref("ui.fontScale", Math.min(130, getPref<number>("ui.fontScale") + 5)),
  },
  {
    id: "view.zoomOut",
    title: "文字を小さく",
    category: "表示",
    keys: ["Ctrl+-"],
    run: () => setPref("ui.fontScale", Math.max(85, getPref<number>("ui.fontScale") - 5)),
  },
  {
    id: "view.zoomReset",
    title: "文字の大きさを戻す",
    category: "表示",
    keys: ["Ctrl+0"],
    run: () => setPref("ui.fontScale", 100),
  },
  // Help / app
  {
    id: "app.palette",
    title: "コマンドを検索…",
    category: "ヘルプ",
    keys: ["Ctrl+Shift+P", "F3"],
    run: () => ui.open({ kind: "palette", mode: "commands" }),
  },
  {
    id: "app.prefs",
    title: "設定…",
    category: "編集",
    keys: ["Ctrl+,"],
    run: () => ui.open({ kind: "prefs" }),
  },
  {
    id: "app.keymap",
    title: "キーボードショートカットの設定…",
    category: "編集",
    run: () => ui.open({ kind: "prefs", tab: "keymap" }),
  },
  {
    id: "app.shortcuts",
    title: "ショートカット一覧",
    category: "ヘルプ",
    keys: ["Shift+?", "F1"],
    run: () => ui.open({ kind: "shortcuts" }),
  },
  {
    id: "app.about",
    title: "このアプリについて",
    category: "ヘルプ",
    run: () => ui.open({ kind: "about" }),
  },
  {
    id: "view.zen",
    title: "集中表示（メニューとステータスバーを隠す）",
    category: "表示",
    keys: ["F11"],
    checked: () => useUI.getState().zen,
    run: () => useUI.setState((s) => ({ zen: !s.zen })),
  },
  {
    id: "view.notifications",
    title: "通知の一覧",
    category: "表示",
    run: () => ui.open({ kind: "notices" }),
  },
  {
    id: "view.revealJobs",
    title: "計算と進捗を表示",
    category: "表示",
    run: () => layout.reveal("jobs"),
  },
  {
    id: "view.intervalAnalysis",
    title: "区間解析を開く",
    category: "解析",
    run: () => layout.reveal("interval-analysis"),
  },
  {
    id: "layout.export",
    title: "ワークスペース配置を書き出す",
    category: "ウィンドウ",
    run: () => saveJSON({ format: "robocon-layout", version: 2, workspaces: useLayout.getState().workspaces }, "workspaces.json"),
  },
  {
    id: "layout.import",
    title: "ワークスペース配置を読み込む…",
    category: "ウィンドウ",
    run: async () => {
      const f = await pickFile();
      if (!f) return;
      const data = JSON.parse(await f.text());
      if (data?.format !== "robocon-layout" || !Array.isArray(data.workspaces) || !data.workspaces.length)
        throw new Error("ワークスペース配置のファイルではありません");
      useLayout.setState({ workspaces: data.workspaces, active: data.workspaces[0].id, mounted: [data.workspaces[0].id], maximized: null });
      ui.toast(`${data.workspaces.length}個のワークスペースを読み込みました`);
    },
  },
  {
    id: "workspace.new",
    title: "新しいワークスペース",
    category: "ウィンドウ",
    run: async () => {
      const name = await ui.prompt("ワークスペースの名前", "新しいワークスペース");
      if (name?.trim()) layout.create(name.trim());
    },
  },
  {
    id: "select.clear",
    title: "選択を解除",
    category: "編集",
    keys: ["Escape"],
    enabled: () => !!session().selection && session().selection !== `node:${session().node}`,
    run: () => ui.select(session().node !== null ? `node:${session().node}` : null),
  },
);
