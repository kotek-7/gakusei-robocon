import { useEffect, useState } from "react";
import { run } from "../app/commands";
import { useDetail, useSearch, useSpan } from "../app/session";
import { useUI } from "../app/store";
import { usePref } from "../app/prefs";
import { IconButton } from "../editors/common/IconButton";
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

/** Elapsed share of the requested discovery time; the job may stop earlier. */
function JobMeter({ startedAt, seconds }: { startedAt: number; seconds: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const elapsed = Math.min(seconds, (now - startedAt) / 1000);
  return (
    <span className="status-item" title="指定時間に対する経過。探索範囲を終えると早く止まる">
      <span className="meter">
        <span style={{ width: `${(elapsed / seconds) * 100}%` }} />
      </span>
      {Math.floor(elapsed)}/{seconds}秒
    </span>
  );
}

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
  const jobRun = useUI((s) => (search ? s.jobRun[search.id] : undefined));
  const unread = useUI((s) => s.notices.filter((n) => !n.read).length);
  const zen = useUI((s) => s.zen);
  if (!show || zen) return null;
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
              title="計算と進捗を表示"
              onClick={() => run("view.revealJobs")}
            >
              {job ? `${JOB[job]}中` : STATUS[search.status] ?? search.status}
            </button>
            {job === "discovery" && jobRun?.kind === "discovery" && (
              <JobMeter startedAt={jobRun.startedAt} seconds={jobRun.seconds} />
            )}
            {job && (
              <button className="status-item" title="計算を停止 (Ctrl+.)" onClick={() => run("job.pause")}>
                <Icon name="stop" size={10} />
                停止
              </button>
            )}
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
        <IconButton className="status-item" icon="keyboard" label="ショートカット一覧 (F1)" onClick={() => run("app.shortcuts")} />
        <IconButton className="status-item" icon="bell" label={`通知の一覧（未読${unread}件）`} onClick={() => run("view.notifications")}>{unread || null}</IconButton>
      </div>
    </footer>
  );
}
