import { run } from "../app/commands";
import { useDetail, useSearch, useSpan } from "../app/session";
import { useUI } from "../app/store";
import { usePref } from "../app/prefs";
import { Icon } from "./icons";
import { robotNames } from "../editors/common/labels";

const STATUS: Record<string, string> = {
  running: "計算中",
  evaluating: "評価中",
  paused: "停止中",
  complete: "全探索完了",
  error: "エラー",
};
const JOB: Record<string, string> = {
  discovery: "候補探索",
  exact: "全探索",
  evaluation: "評価",
};
const refLabel = (r: string) => {
  const [k, id] = r.split(":");
  if (k === "robot") return robotNames[Number(id)];
  if (k === "spot") return `建設スポット S${id}`;
  if (k === "obj") return `物体 ${id}`;
  if (k === "edge") return `遷移 E${id}`;
  return r;
};
const fmt = (t: number) => {
  const m = Math.floor(t / 60),
    s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
};

export function StatusBar() {
  const show = usePref<boolean>("ui.statusBar");
  const search = useSearch();
  const detail = useDetail().data;
  const time = useUI((s) => s.playback.time);
  const playing = useUI((s) => s.playback.playing);
  const speed = useUI((s) => s.playback.speed);
  const dir = useUI((s) => s.playback.direction);
  const range = useUI((s) => s.playback.range);
  const selection = useUI((s) => s.session.selection);
  const busy = useUI((s) => Object.values(s.busy).some(Boolean));
  const [, end] = useSpan();
  if (!show) return null;
  const d = search?.discovery;
  const job = search?.job;
  const progress = search?.evaluationProgress;
  return (
    <footer className="statusbar">
      <div className="status-left">
        {search ? (
          <>
            <button
              className={`status-item status-${search.status}`}
              title="進捗を表示"
              onClick={() => run("nav.goto")}
            >
              {job ? `${JOB[job]}中` : STATUS[search.status] ?? search.status}
            </button>
            {job === "evaluation" && progress && (
              <span className="status-item">
                {progress.completedRuns}/{progress.totalRuns}構成
              </span>
            )}
            {d && (
              <span className="status-item" title="候補探索の累計">
                候補 {d.metrics.candidates} · 分類 {d.metrics.strategies} · {Math.round(d.elapsed)}秒
              </span>
            )}
            <span className="status-item" title="詳細な全探索のグラフ">
              局面 {search.nodes.toLocaleString()} · 遷移 {search.edges.toLocaleString()} · 構成 {search.completeRuns}/{search.totalRuns}完了
            </span>
            {!search.complete && (
              <span className="status-item muted" title="全構成の全分岐を処理するまで、勝率の保証値は出しません">
                未完了の探索
              </span>
            )}
          </>
        ) : (
          <span className="status-item">探索がありません</span>
        )}
        {busy && <span className="status-item">処理中</span>}
      </div>
      <div className="status-right">
        {selection && !selection.startsWith("node:") && <span className="status-item">選択 {refLabel(selection)}</span>}
        {detail && (
          <span className="status-item">
            局面 N{detail.id} · {detail.state.t}秒 ·{" "}
            <span className="red-text">{detail.scores[0]}</span> 対{" "}
            <span className="blue-text">{detail.scores[1]}</span>
          </span>
        )}
        <span className="status-item tabular" title="再生位置 / 経路の末尾">
          {playing && <Icon name={dir > 0 ? "play" : "reverse"} size={10} />} {fmt(time)} / {fmt(end)}
          {speed !== 1 ? ` · ${speed}倍` : ""}
          {range ? ` · 範囲 ${range[0].toFixed(1)}–${range[1].toFixed(1)}` : ""}
        </span>
        <button className="status-item" onClick={() => run("app.shortcuts")} title="ショートカット一覧 (F1)">
          ショートカット
        </button>
      </div>
    </footer>
  );
}
