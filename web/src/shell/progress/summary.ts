import type { Search } from "../../engine/types";

const names = { discovery: "候補探索", exact: "全探索", evaluation: "評価" };
const evaluationPhases = {
  loading: "評価を準備中", histories: "試合展開を集計中", statistics: "作戦を集計中",
  guarantees: "保証値を計算中", saving: "評価を保存中", complete: "評価完了",
};

export function elapsedLabel(seconds: number): string {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return value < 60 ? `${value}秒` : `${Math.floor(value / 60)}分${value % 60}秒`;
}

/** Only the active execution belongs in the global strip; cumulative data stays in Jobs. */
export function jobSummary(search: Search, pendingKind?: string, stopping = false) {
  if (pendingKind) return { label: `${names[pendingKind as keyof typeof names] ?? "計算"}を準備中`, detail: "", active: true };
  const progress = search.jobProgress;
  const kind = search.job ?? progress?.kind;
  const active = Boolean(search.job || (progress && progress.phase !== "finished"));
  const name = kind ? names[kind] : "計算";
  if (stopping) return { label: "停止処理中", detail: "", active: true };
  if (!active) {
    const label = search.error || search.status === "error" ? "計算エラー"
      : progress?.saveState === "error" ? "保存失敗"
      : progress?.stopReason === "cancelled" ? `${name}を停止`
      : progress?.stopReason === "time_limit" ? `${name}の指定時間終了`
      : progress?.stopReason === "budget_limit" ? `${name}の処理上限に到達`
      : progress?.stopReason === "resource_limit" ? `${name}の保存上限に到達`
      : progress?.stopReason === "exhausted" && kind === "discovery" ? "設定範囲の候補探索完了"
      : kind === "evaluation" && search.evaluationProgress?.state === "complete" ? "評価完了"
      : search.complete ? "全探索完了" : "計算と進捗";
    return { label, detail: "", active: false };
  }
  const evaluation = kind === "evaluation" ? search.evaluationProgress : null;
  const label = progress?.phase === "saving" ? `${name}を保存中`
    : progress?.phase === "starting" ? `${name}を準備中`
    : evaluation ? evaluationPhases[evaluation.phase] : `${name}中`;
  const elapsed = progress?.elapsed ?? evaluation?.elapsed;
  const count = evaluation
    ? `${evaluation.completedRuns.toLocaleString()}/${evaluation.totalRuns.toLocaleString()}構成`
    : progress && kind === "exact" ? `${progress.unitsDone.toLocaleString()}組処理` : "";
  const timing = elapsed === undefined ? "" : `経過 ${elapsedLabel(elapsed)}`;
  return { label, detail: [timing, count].filter(Boolean).join(" · "), active };
}
