import type { CandidateCollectionRow, QueryField } from "./collection";
import type { CandidateReview } from "./review";
import { recoveryEntries } from "./recovery";
import "./recovery.css";

/** Navigation back to working items. Saving remains beside the full editable decision. */
export function CandidateRecovery({rows, visibleKeys, review, drafts, onReveal}: {
  rows: CandidateCollectionRow[]; visibleKeys: string[]; review: CandidateReview;
  drafts: CandidateReview["decisions"]; onReveal: (key: string, editDecision: boolean) => void;
}) {
  const entries = recoveryEntries(rows, visibleKeys, review, drafts);
  if (!entries.length) return null;
  const dirtyCount = entries.filter(entry => entry.dirty).length;
  const hiddenCount = entries.filter(entry => entry.hidden && entry.compared).length;
  return <details className="candidate-recovery" onKeyDown={event => {
    if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
  }}>
    <summary>{[dirtyCount ? `未保存のメモ ${dirtyCount}件` : "", hiddenCount ? `一覧外の比較 ${hiddenCount}件` : ""].filter(Boolean).join(" · ")}</summary>
    <ul aria-label="作業中の候補">
      {entries.map(entry => <li key={entry.key}>
        <button title={`C${entry.row.run} · ${entry.row.candidate.id}${entry.hidden ? "（表示条件を解除して移動）" : ""}`} onClick={event => {
          event.currentTarget.closest("details")?.removeAttribute("open");
          onReveal(entry.key, entry.dirty);
        }}>
          <span>C{entry.row.run} · {entry.row.candidate.id.slice(0,14)}</span>
          <small>{entry.dirty ? "未保存" : "比較中"}{entry.hidden ? " · 一覧外" : ""}</small>
          <span className="candidate-recovery-note">{entry.row.candidate.plan.map(goal => goal.kind === "mustika" ? "ムスティカ設置" : goal.kind === "deliver" ? "受け渡し" : `${goal.kind === "flip" ? "反転" : "建設"} ${goal.spot}${goal.height === 2 ? "（2段）" : ""}`).join(" → ") || "建設・反転なし"}</span>
          {entry.note && <span className="candidate-recovery-note" title={entry.note}>{entry.note}</span>}
        </button>
      </li>)}
    </ul>
  </details>;
}

const fieldLabels: Record<QueryField,string> = {id:"ID", plan:"手順", note:"保存済みメモ", issue:"実行不可の理由"};
export function CandidateQueryMatch({fields}: {fields: QueryField[]}) {
  if (!fields.length) return null;
  return <small className="candidate-query-match">一致：{fields.map(field => fieldLabels[field]).join("・")}</small>;
}
