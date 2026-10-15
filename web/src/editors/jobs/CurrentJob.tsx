import { isEnabled, run } from "../../app/commands";
import { useUI } from "../../app/store";
import { layout } from "../../app/layout";
import type { Search } from "../../engine/types";
import { Icon } from "../../shell/icons";
import { duration, EvaluationProgress, stopLabels } from "./SearchProgress";

const names = { discovery: "候補探索", exact: "全探索", evaluation: "評価" };

export function CurrentJob({ search }: { search: Search }) {
  const progress = search.jobProgress;
  const starting = useUI(s => !!s.busy[`job.start:${search.id}`]);
  const stopping = useUI(s => !!s.busy[`pause:${search.id}`]);
  const active = search.status === "running" || search.status === "evaluating" || (progress != null && progress.phase !== "finished");
  const kind = progress?.kind ?? search.job;
  if (starting && !active) return <section className="current-job" aria-label="今回の計算"><p role="status">計算を開始しています</p></section>;
  if (!kind || (!active && !progress)) return null;
  const phase = progress?.phase;
  const title = active
    ? stopping ? "停止処理中" : phase === "starting" ? "開始準備中" : phase === "saving" ? "結果を保存中" : "計算中"
    : stopLabels[progress?.stopReason || ""] || "今回の計算を終了";
  const discovery = kind === "discovery";
  const limit = discovery ? progress?.secondsLimit : progress?.unitsLimit;
  const done = discovery ? progress?.elapsed : progress?.unitsDone;
  const showBar = kind !== "evaluation" && active;
  const savedTime = progress?.savedAt ? new Date(progress.savedAt).toLocaleTimeString("ja-JP", { hour12: false }) : null;
  const savedLabel = progress?.saveState === "error" ? "保存できませんでした"
    : phase === "saving" ? "結果を保存中"
    : active ? savedTime ? `前回保存 ${savedTime}` : "初回の保存待ち"
    : progress?.saveState === "saved" ? `保存済み${savedTime ? ` ${savedTime}` : ""}` : "未保存";
  const result = discovery ? "candidates" : kind === "evaluation" ? "evaluation" : "graph";
  const hasResult = discovery ? !!search.discovery?.metrics.candidates : kind === "evaluation" ? !!search.evaluation : search.nodes > 0;
  return <section className="current-job" aria-label="今回の計算">
    <div className="current-job-heading">
      <strong>{names[kind]}</strong><span role="status">{title}</span>
      {active && <button className="tool" disabled={!isEnabled("job.pause") || phase === "saving" || stopping} onClick={() => run("job.pause")}><Icon name="stop" />{stopping ? "停止処理中" : "停止"}</button>}
    </div>
    <div className="current-job-facts">
      <span>今回 {duration(progress?.elapsed ?? 0)}</span>
      {discovery && limit != null && <span>制限 {duration(limit)}</span>}
      {kind === "exact" && progress && <span>{progress.unitsDone.toLocaleString()} / {progress.unitsLimit?.toLocaleString() ?? "未設定"}行動組</span>}
      <span>{savedLabel}</span>
    </div>
    {showBar && <>
      <progress aria-label={discovery ? "今回の制限時間の経過" : "今回の行動組数の進捗"} max={limit && limit > 0 ? limit : undefined} value={limit && limit > 0 ? Math.min(done ?? 0, limit) : undefined} />
      {discovery && <p className="progress-note">時間の経過を表示。探索全体の完了率ではありません。</p>}
    </>}
    {kind === "evaluation" && <EvaluationProgress search={search} />}
    <div className="current-job-result">
      <button className="job-result-link" disabled={!hasResult} onClick={() => layout.reveal(result)}>{discovery ? "候補を見る" : kind === "evaluation" ? "評価結果を見る" : "局面を見る"}</button>
    </div>
  </section>;
}
