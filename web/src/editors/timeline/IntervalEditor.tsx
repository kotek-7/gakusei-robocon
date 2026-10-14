import { register, run } from "../../app/commands";
import { currentAnalysis } from "../../app/coreCommands";
import type { MatchAnalysis } from "../../engine/analysis";
import { useAnalysis } from "../../app/session";
import { ui, useUI } from "../../app/store";
import { layout, useLayout, type AreaNode } from "../../app/layout";
import { defineEditor } from "../registry";
import { Empty } from "../common/Empty";
import { robotNames } from "../common/labels";
import { intervalSummary } from "./intervalSummary";

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

function IntervalEditor() {
  const analysis = useAnalysis().data;
  const range = useUI((s) => s.playback.range);
  const visibleRobots = [0, 1, 2, 3];
  if (!analysis) return <Empty title="経路を選択すると区間を解析できます" />;
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
        <p className="muted small">選択経路に記録された動作を集計。経路外の時間は含みません。</p>
      </div>
  );
}
defineEditor({ type: "interval-analysis", title: "区間解析", group: "解析", Component: IntervalEditor });
