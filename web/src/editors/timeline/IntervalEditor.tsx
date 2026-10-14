import { register, run } from "../../app/commands";
import { currentAnalysis } from "../../app/coreCommands";
import type { MatchAnalysis } from "../../engine/analysis";
import { useAnalysis } from "../../app/session";
import { ui, useUI } from "../../app/store";
import { layout, useLayout, type AreaNode } from "../../app/layout";
import { defineEditor, type EditorProps } from "../registry";
import { Empty } from "../common/Empty";
import { actionName, robotNames } from "../common/labels";
import { actionBreakdown, intervalDetails, intervalSummary } from "./intervalSummary";

function setView(analysis: MatchAnalysis, start: number, end: number) {
    const state = useLayout.getState();
    const workspace = state.workspaces.find((w) => w.id === state.active);
    const span = Math.min(Math.max(2, end - start), Math.max(2, analysis.end - analysis.start));
    const lo = Math.max(analysis.start, Math.min(start, analysis.end - span));
    const view: [number, number] = [lo, lo + span];
    let found = false;
    const visit = (node: AreaNode) => {
      if (node.kind === "split") node.children.forEach(visit);
      else if (node.editor === "timeline") { found = true; layout.setAreaState(node.id, { view }); }
    };
    if (workspace) visit(workspace.root);
    if (!found) ui.toast("このワークスペースにタイムラインを表示してください");
}

const hasPath = () => !!useUI.getState().session.search && useUI.getState().session.node !== null;
register(
  { id: "interval.filter", title: "区間内訳を絞り込む", category: "区間解析", hidden: true,
    run: ({ args }) => { const { area, ...filters } = args as { area: string; detailRobot?: number | null; detailKind?: string }; layout.setAreaState(area, filters); } },
  {
    id: "interval.inspectAction", title: "動作区間を解析", category: "区間解析", hidden: true,
    run: ({ args }) => {
      const row = args as { start: number; end: number; robot: number; range?: boolean };
      if (![row.start, row.end].every(Number.isFinite) || row.end <= row.start) return;
      ui.select(`robot:${row.robot}`);
      ui.patchPlayback({ time: row.start, playing: false, ...(row.range ? { range: [row.start, row.end] as [number, number] } : {}) });
      if (row.range) run("interval.fit");
    },
  },
  {
    id: "interval.fit", title: "解析区間にタイムラインを拡大", category: "区間解析", enabled: hasPath,
    run: async () => {
      const session = useUI.getState().session;
      const analysis = await currentAnalysis();
      if (!analysis || session !== useUI.getState().session) return;
      const range = useUI.getState().playback.range ?? [analysis.start, analysis.end];
      setView(analysis, range[0], range[1]);
    },
  },
  ...robotNames.map((name, robot) => ({
    id: `interval.longestWait${robot}`, title: `${name}の区間内の最長待機へ`, category: "区間解析", enabled: hasPath,
    run: async () => {
      const session = useUI.getState().session;
      const analysis = await currentAnalysis();
      if (!analysis || session !== useUI.getState().session) return;
      const range = useUI.getState().playback.range ?? [analysis.start, analysis.end];
      const iv = intervalSummary(analysis.intervals, range, robot).longestWait;
      if (!iv) { ui.toast(`${name}の区間内に待機はありません`); return; }
      ui.select(`robot:${robot}`);
      ui.patchPlayback({ time: Math.max(iv.start, range[0]), playing: false });
      setView(analysis, iv.start - 2, iv.end + 2);
    },
  })),
);

function IntervalEditor({ area }: EditorProps) {
  const analysis = useAnalysis().data;
  const range = useUI((s) => s.playback.range);
  const robot = (area.state?.detailRobot as number | null) ?? null;
  const kind = (area.state?.detailKind as string) ?? "";
  const setRobot = (detailRobot: number | null) => run("interval.filter", { area: area.id, detailRobot });
  const setKind = (detailKind: string) => run("interval.filter", { area: area.id, detailKind });
  const visibleRobots = [0, 1, 2, 3];
  if (!analysis) return <Empty title="経路を選択すると区間を解析できます" />;
  const activeRange: [number, number] = range ?? [analysis.start, analysis.end];
  const breakdown = actionBreakdown(analysis.intervals, activeRange, robot);
  const details = intervalDetails(analysis.intervals, activeRange, robot).filter((row) => !kind || row.interval.action.kind === kind);
  return (
      <div className="editor-scroll timeline-inspector" onContextMenu={(e) => ui.contextMenu(e, [
        { command: "interval.fit" }, { command: "play.clearRange" }, { separator: true },
        ...robotNames.map((_, robot) => ({ command: `interval.longestWait${robot}` })),
      ], "区間解析")}>
        <p>解析区間 <span className="tabular">{(range?.[0] ?? analysis.start).toFixed(1)}〜{(range?.[1] ?? analysis.end).toFixed(1)}秒</span></p>
        <div className="interval-controls">
          {([0, 1] as const).map((i) => <label key={i}>{i === 0 ? "開始" : "終了"}
            <input type="number" step="0.25" min={analysis.start} max={analysis.end} aria-label={`解析区間の${i === 0 ? "開始" : "終了"}秒`}
              value={(range ?? [analysis.start, analysis.end])[i]}
              onChange={(e) => {
                if (e.target.value === "") return;
                const next: [number, number] = [...(range ?? [analysis.start, analysis.end])];
                next[i] = Math.max(analysis.start, Math.min(analysis.end, Number(e.target.value)));
                if (next[0] <= next[1]) ui.patchPlayback({ range: next, playing: false });
              }} />
          </label>)}
          <button className="tool" onClick={() => run("interval.fit")}>区間に拡大</button>
          <button className="tool" disabled={!range} onClick={() => run("play.clearRange")}>解除</button>
        </div>
        <table className="interval-table"><thead><tr><th>機体</th><th>動作数</th><th>動作中</th><th>待機</th><th>調べる</th></tr></thead><tbody>
          {visibleRobots.map((robot) => {
            const summary = intervalSummary(analysis.intervals, range ?? [analysis.start, analysis.end], robot);
            return <tr key={robot}><th>{robotNames[robot]}</th><td>{summary.count}</td><td>{summary.active.toFixed(1)}秒</td><td>{summary.waiting.toFixed(1)}秒</td><td><button className="tool" disabled={!summary.longestWait} onClick={() => run(`interval.longestWait${robot}`)}>最長待機へ</button></td></tr>;
          })}
        </tbody></table>
        <h3>動作別の内訳</h3>
        <div className="interval-controls">
          <label>機体 <select aria-label="内訳の機体" value={robot ?? "all"} onChange={(e) => setRobot(e.target.value === "all" ? null : Number(e.target.value))}>
            <option value="all">全機体</option>{robotNames.map((name, i) => <option key={i} value={i}>{name}</option>)}
          </select></label>
          <button className="tool" disabled={!kind} onClick={() => setKind("")}>全動作を表示</button>
        </div>
        <table className="interval-table"><thead><tr><th>動作</th><th>件数</th><th>合計秒</th></tr></thead><tbody>
          {breakdown.map((item) => <tr key={item.kind}><th><button className="link" aria-pressed={kind === item.kind} onClick={() => setKind(kind === item.kind ? "" : item.kind)}>{actionName({ kind: item.kind })}</button></th><td>{item.count}</td><td>{item.seconds.toFixed(1)}</td></tr>)}
        </tbody></table>
        <details open={!!kind}><summary>{kind ? actionName({ kind }) : "動作"}の区間 {details.length}件</summary>
          <table className="interval-detail-table"><thead><tr><th>機体 / 動作</th><th>開始〜終了</th><th>秒</th><th>解析</th></tr></thead><tbody>
            {details.map((row, i) => <tr key={i}><td>{robotNames[row.interval.robot]} / {actionName(row.interval.action)}</td><td><button className="link tabular" onClick={() => run("interval.inspectAction", { ...row, robot: row.interval.robot })}>{row.start.toFixed(1)}〜{row.end.toFixed(1)}</button></td><td className="tabular">{row.seconds.toFixed(1)}</td><td><button className="tool" onClick={() => run("interval.inspectAction", { ...row, robot: row.interval.robot, range: true })}>区間に設定</button></td></tr>)}
          </tbody></table>
          {!details.length && <p className="muted">該当する動作はありません</p>}
        </details>
        <p className="muted small">複数機体の合計秒は重複時間を含みます。選択経路に記録された動作を集計。経路外の時間は含みません。</p>
      </div>
  );
}
defineEditor({ type: "interval-analysis", title: "区間解析", group: "解析", Component: IntervalEditor });
