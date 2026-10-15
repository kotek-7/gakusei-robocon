import { run } from "../app/commands";
import { useDetail, useSearch, useSpan } from "../app/session";
import { useUI } from "../app/store";
import { usePref } from "../app/prefs";
import { Icon } from "./icons";
import { selectionLabel } from "./selectionLabel";

import { jobSummary } from "./progress/summary";

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
  const busy = useUI((s) => s.busy);
  const [, end] = useSpan();
  const jobRun = useUI((s) => (search ? s.jobRun[search.id] : undefined));
  const unread = useUI((s) => s.notices.filter((n) => !n.read).length);
  const zen = useUI((s) => s.zen);
  if (!show || zen) return null;
  const pending = Boolean(search && busy[`job.start:${search.id}`]);
  const stopping = Boolean(search && busy[`pause:${search.id}`]);
  const summary = search ? jobSummary(search, pending ? jobRun?.kind : undefined, stopping) : null;
  return (
    <footer className="statusbar">
      <div className="status-left status-progress">
        {search && summary ? (
          <>
            <button
              className={`status-item status-job ${summary.active ? "status-running" : ""} ${search.error || search.jobProgress?.saveState === "error" ? "status-error" : ""}`}
              title={`${search.name} · ${summary.label}${summary.detail ? ` · ${summary.detail}` : ""} · 計算と進捗を表示`}
              onClick={() => run("view.revealJobs")}
            >
              <span aria-live="polite">{summary.label}</span>
              {summary.detail && <span className="status-job-detail tabular">{summary.detail}</span>}
            </button>
            {search.job && (
              <button className="status-item status-stop" title="計算を停止 (Ctrl+.)" disabled={stopping || search.jobProgress?.phase === "saving"} onClick={() => run("job.pause")}>
                <Icon name="stop" size={10} />
                {stopping ? "停止中" : "停止"}
              </button>
            )}
          </>
        ) : (
          <span className="status-item">探索がありません</span>
        )}
      </div>
      <div className="status-right">
        {selection && !selection.startsWith("node:") && <span className="status-item">選択 {selectionLabel(selection)}</span>}
        {detail && (
          <span className="status-item">
            局面 N{detail.id} · {detail.state.t}秒 ·{" "}
            <span className="red-text">{detail.scores[0]}</span> 対{" "}
            <span className="blue-text">{detail.scores[1]}</span>
          </span>
        )}
        <span className="status-item status-playhead tabular" title="全ワークスペース共通の再生位置 / 経路の末尾">
          {playing && <Icon name={dir > 0 ? "play" : "reverse"} size={10} />} {fmt(time)} / {fmt(end)}
          {speed !== 1 ? ` · ${speed}倍` : ""}
          {range ? ` · 範囲 ${range[0].toFixed(1)}–${range[1].toFixed(1)}` : ""}
        </span>
        <button className="status-item status-shortcuts" onClick={() => run("app.shortcuts")} title="ショートカット一覧 (F1)">
          キー
        </button>
        <button className="status-item" onClick={() => run("view.notifications")} title="通知の一覧">
          通知{unread ? ` ${unread}` : ""}
        </button>
      </div>
    </footer>
  );
}
