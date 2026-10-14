import { useState } from "react";
import type { CandidateReview } from "./review";

export function CandidateDecision({ id, value, drafts, setDrafts, onSave }: {
  id: string;
  drafts: CandidateReview["decisions"];
  setDrafts: import("react").Dispatch<import("react").SetStateAction<CandidateReview["decisions"]>>;
  value: CandidateReview["decisions"][string] | undefined;
  onSave: (value: CandidateReview["decisions"][string]) => Promise<void>;
}) {
  const {note, status} = drafts[id] ?? value ?? {note: "", status: "open"};
  const setNote = (note: string) => setDrafts(current => ({...current, [id]: {note, status}}));
  const setStatus = (status: "open" | "keep" | "dismiss") => setDrafts(current => ({...current, [id]: {note, status}}));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [discarded, setDiscarded] = useState<CandidateReview["decisions"]>({});
  const dirty = note !== (value?.note ?? "") || status !== (value?.status ?? "open");
  async function save() {
    if (!dirty || saving) return;
    setSaving(true); setError("");
    try {
      await onSave({status, note});
      setDrafts(current => { const next = {...current}; if (next[id]?.note === note && next[id]?.status === status) delete next[id]; return next; });
      setDiscarded(current => { const next = {...current}; delete next[id]; return next; });
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  }
  return <details className="candidate-decision" onKeyDown={event => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) { event.preventDefault(); void save(); }
    if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
  }}>
    <summary>検討メモ · {{open: "未判定", keep: "残す", dismiss: "見送る"}[value?.status ?? "open"]}{dirty ? "（未保存）" : ""}</summary>
    <label>判断<select aria-label="候補の判断" value={status} onChange={e => setStatus(e.target.value as typeof status)}>
      <option value="open">未判定</option><option value="keep">残す</option><option value="dismiss">見送る</option>
    </select></label>
    <label>判断の理由<textarea aria-label="判断の理由" value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="実装上の懸念・次に確認すること" /></label>
    <div className="candidate-target-tools">
      <button disabled={!dirty || saving} title="Ctrl / ⌘ + Enter" onClick={() => void save()}>{saving ? "保存中…" : "メモを保存"}</button>
      <button disabled={!dirty || saving} onClick={() => {
        setDiscarded(current => ({...current, [id]: {note, status}}));
        setDrafts(current => { const next = {...current}; delete next[id]; return next; });
      }}>編集を戻す</button>
      {discarded[id] && !dirty && <button disabled={saving} onClick={() => {
        setDrafts(current => ({...current, [id]: discarded[id]}));
        setDiscarded(current => { const next = {...current}; delete next[id]; return next; });
      }}>戻した編集を復元</button>}
    </div>
    {error && <p role="alert">{error}</p>}
  </details>;
}
