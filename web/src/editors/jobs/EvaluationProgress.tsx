import type { Search } from "../../engine/types";
import { duration } from "./SearchProgress";
import "./live-progress.css";

const phases = {
  loading: "局面・遷移の読込",
  histories: "試合展開の集計",
  statistics: "作戦別の集計",
  guarantees: "保証値の計算",
  saving: "評価結果の保存",
  complete: "完了",
};
const units = { loading: "件", histories: "局面", statistics: "作戦", guarantees: "局面", saving: "件", complete: "件" };

export function EvaluationProgress({ search, embedded = false }: { search: Search; embedded?: boolean }) {
  const progress = search.evaluationProgress;
  const saving = search.jobProgress?.kind === "evaluation" && search.jobProgress.phase === "saving";
  const active = search.status === "evaluating" || saving;
  if ((!progress || (progress.state === "complete" && !search.evaluation)) && !active) return null;
  const state = active ? "running" : progress?.state;
  const phase = saving ? "saving" : progress?.phase || "loading";
  const determinate = progress?.total != null && progress.total > 0;
  return <section className="live-evaluation" aria-label="評価計算の進捗" aria-busy={active}>
    <div className="live-evaluation-scope">
      {!embedded && <strong>前回の評価</strong>}
      <span>構成 <strong>{progress?.completedRuns ?? 0}</strong> / {progress?.totalRuns ?? search.runs} 件処理済み</span>
      {!embedded && <span>{duration(progress?.elapsed ?? 0)}</span>}
      {!active && <span data-error={state === "error"}>{state === "complete" ? "集計済み" : state === "error" ? "計算失敗・未確定" : "中断・未確定"}</span>}
    </div>
    {active && <div className="live-evaluation-stage">
      <div className="live-job-scale">
        <span role="status">{!saving && progress?.run != null && <b className="live-evaluation-run">C{progress.run}</b>}{phases[phase]}</span>
        {!saving && determinate && <span>{progress!.done.toLocaleString()} / {progress!.total!.toLocaleString()} {units[phase]}</span>}
      </div>
      <progress aria-label={saving ? "評価結果を保存中" : `${phases[phase]}の進捗`} max={!saving && determinate ? progress!.total! : undefined} value={!saving && determinate ? Math.min(progress!.done, progress!.total!) : undefined} />
    </div>}
  </section>;
}
