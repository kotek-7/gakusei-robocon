import { useEffect, useState } from "react";
import { sameCandidateFilters, type CandidateFilterView, type SavedCandidateView } from "./collection";

/** Storage belongs to the per-search workspace; restoring a view never changes the selected evidence or notes. */
export function SavedCandidateViews({ views, value, onApply, onSave, onDelete, disabled = false }: {
  views: SavedCandidateView[];
  value: CandidateFilterView;
  onApply: (value: CandidateFilterView) => void;
  onSave: (view: SavedCandidateView) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState<SavedCandidateView | null>(null);
  const active = views.find(view => view.id === selected);
  const changed = active && !sameCandidateFilters(active.filters, value);
  const renamed = active && name.trim() !== active.name;
  useEffect(() => {
    if (selected !== null || !views.length) return;
    const matching = views.find(view => sameCandidateFilters(view.filters, value));
    setSelected(matching?.id ?? ""); setName(matching?.name ?? "");
  }, [selected, views, value]);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch(error) { setError(String(error)); } finally { setBusy(false); }
  }
  return <fieldset className="candidate-saved-views" disabled={disabled || busy}>
    <legend>表示条件の保存</legend>
    <label>保存した条件<select value={active?.id ?? ""} onChange={event => {
      const view = views.find(view => view.id === event.target.value);
      setSelected(view?.id ?? ""); setName(view?.name ?? "");
      if (view) onApply({...view.filters});
    }}><option value="">条件を選択</option>{views.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}</select></label>
    {changed && <><span role="status">保存後に条件を変更</span><button onClick={() => { onApply({...active.filters}); setName(active.name); }}>保存した条件に戻す</button></>}
    <label>条件名<input value={name} maxLength={80} onChange={event => setName(event.target.value)} placeholder="共有域の反転候補" /></label>
    <button disabled={!name.trim()} onClick={() => perform(async () => {
      const view = {id: crypto.randomUUID(), name:name.trim(), filters:{...value}};
      await onSave(view); setSelected(view.id);
    })}>新しく保存</button>
    <button disabled={!active || !name.trim() || (!changed && name.trim() === active.name)} onClick={() => perform(async () => {
      if (active) await onSave({...active, name:name.trim(), filters:{...value}});
    })}>{renamed ? changed ? "名前と条件を更新" : "名前を変更" : "選んだ条件を更新"}</button>
    {active && changed && renamed && <button disabled={!name.trim()} onClick={() => perform(async () => {
      await onSave({...active, name:name.trim()});
    })}>名前だけ変更</button>}
    <button disabled={!active} onClick={() => perform(async () => {
      if (active) { await onDelete(active.id); setDeleted(active); setSelected(""); setName(""); }
    })}>保存を削除</button>
    {deleted && <span role="status">「{deleted.name}」を削除 <button onClick={() => perform(async () => {
      await onSave(deleted); setDeleted(null);
    })}>削除を取り消す</button></span>}
    {error && <p role="alert">{error}</p>}
  </fieldset>;
}

export function CandidateQueryHelp() {
  return <details className="candidate-query-help" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}><summary>検索の書き方</summary><p>空白で両方を含む候補、-語で除外。L1・L2・共有・反転などの手順、ID、保存したメモ、実行不可理由を検索します。</p><p><code>L2 反転 -メモ:保留</code> · <code>理由:資材</code> · <code>手順:"アース2段"</code></p></details>;
}
