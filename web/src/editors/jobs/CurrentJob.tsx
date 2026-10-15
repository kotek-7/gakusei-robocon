import { isEnabled, run } from "../../app/commands";
import { useUI } from "../../app/store";
import { layout } from "../../app/layout";
import type { Search } from "../../engine/types";
import { Icon } from "../../shell/icons";
import { duration, stopLabels } from "./SearchProgress";
import { EvaluationProgress } from "./EvaluationProgress";
import "./live-progress.css";

const names = { discovery: "候補探索", exact: "全探索", evaluation: "評価" };

export function CurrentJob({ search }: { search: Search }) {
  const progress = search.jobProgress;
  const starting = useUI(s => !!s.busy[`job.start:${search.id}`]);
  const stopping = useUI(s => !!s.busy[`pause:${search.id}`]);
  const active = search.status === "running" || search.status === "evaluating" || (progress != null && progress.phase !== "finished");
  const kind = progress?.kind ?? search.job;
  if (starting && !active) return <section className="live-job" aria-label="今回の計算" aria-busy="true"><div className="live-job-header"><strong>計算を開始しています</strong><progress aria-label="計算の開始準備" /></div></section>;
  if (!kind || (!active && !progress)) return null;
  const phase = progress?.phase;
  const title = active
    ? stopping ? "停止処理中" : phase === "starting" ? "開始準備" : phase === "saving" ? "保存中" : "実行中"
    : stopLabels[progress?.stopReason || ""] || "終了";
  const discovery = kind === "discovery";
  const limit = discovery ? progress?.secondsLimit : progress?.unitsLimit;
  const done = discovery ? progress?.elapsed : progress?.unitsDone;
  const savedTime = progress?.savedAt ? new Date(progress.savedAt).toLocaleTimeString("ja-JP", { hour12: false }) : null;
  const savedLabel = progress?.saveState === "error" ? "保存失敗"
    : progress?.saveState === "saving" ? "保存中"
    : active ? savedTime ? "前回保存" : "保存待ち"
    : progress?.saveState === "saved" ? "保存済み" : "未保存";
  const result = discovery ? "candidates" : kind === "evaluation" ? "evaluation" : "graph";
  const hasResult = discovery ? !!search.discovery?.metrics.candidates : kind === "evaluation" ? !!search.evaluation : search.nodes > 0;
  return <section className="live-job" aria-label="今回の計算" aria-busy={active} data-active={active}>
    <header className="live-job-header">
      <strong>{names[kind]}</strong>
      <span className="live-job-state" role="status" data-error={progress?.stopReason === "error"}>{title}</span>
      {!discovery && <span className="live-job-elapsed" title="今回の計算時間">{duration(progress?.elapsed ?? 0)}</span>}
      {active && <button className="tool" disabled={!isEnabled("job.pause") || phase === "saving" || stopping} onClick={() => run("job.pause")}><Icon name="stop" />{stopping ? "停止処理中" : "停止"}</button>}
    </header>
    {kind !== "evaluation" && (active || (limit != null && limit > 0)) && <div className="live-job-measure">
      <div className="live-job-scale">
        <span title={discovery ? "今回の制限時間の経過。探索範囲の網羅率ではありません。" : "今回の行動組数の上限。探索範囲の網羅率ではありません。"}>{discovery ? "時間枠" : "今回の行動組"}</span>
        <span>{discovery ? `${duration(done ?? 0)} / ${limit != null ? duration(limit) : "制限なし"}` : `${(done ?? 0).toLocaleString()} / ${limit?.toLocaleString() ?? "上限なし"}`}</span>
      </div>
      <progress aria-label={discovery ? "今回の制限時間の経過（探索の網羅率ではありません）" : "今回の行動組数の上限に対する進捗（探索の網羅率ではありません）"} max={limit && limit > 0 ? limit : undefined} value={limit && limit > 0 ? Math.min(done ?? 0, limit) : undefined} />
    </div>}
    {kind === "evaluation" && <EvaluationProgress search={search} embedded />}
    <footer className="live-job-footer">
      <span className="live-job-save" data-error={progress?.saveState === "error"}>
        {progress?.saveState === "saved" && <Icon name="check" size={14} />}
        {savedLabel}{savedTime && progress?.saveState !== "saving" && <time>{progress?.saveState === "error" && "前回保存 "}{savedTime}</time>}
      </span>
      <button className="job-result-link" disabled={!hasResult} onClick={() => layout.reveal(result)}>{discovery ? "候補を見る" : kind === "evaluation" ? active || search.evaluationProgress?.state !== "complete" ? "保存済みの評価を見る" : "評価結果を見る" : "局面を見る"}<Icon name="forward" size={14} /></button>
    </footer>
  </section>;
}
