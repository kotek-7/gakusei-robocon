import { useEffect, useId, useState } from "react";
import { Help } from "../common/Help";
import { sameCandidateFilters, type CandidateFilterView, type SavedCandidateView } from "./collection";

/** Saved filters belong to the current search workspace. */
export function SavedCandidateViews({ views, value, onApply, onSave, onDelete, disabled = false }: {
  views: SavedCandidateView[];
  value: CandidateFilterView;
  onApply: (value: CandidateFilterView) => void;
  onSave: (view: SavedCandidateView) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  disabled?: boolean;
}) {
  const popoverId = useId();
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
  return <>
    <button popoverTarget={popoverId}>表示条件の保存・呼出</button>
    <div id={popoverId} popover="auto" className="candidate-views-popover">
    <header><strong>表示条件</strong><button popoverTarget={popoverId} popoverTargetAction="hide" aria-label="表示条件を閉じる">閉じる</button></header>
    <fieldset className="candidate-saved-views" disabled={disabled || busy}>
    <legend>保存した表示条件 <Help topic="results" text="現在の絞り込みと並び順を保存します。" /></legend>
    <label>表示条件<select value={active?.id ?? ""} onChange={event => {
      const view = views.find(view => view.id === event.target.value);
      setSelected(view?.id ?? ""); setName(view?.name ?? "");
      if (view) onApply({...view.filters});
    }}><option value="">未選択</option>{views.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}</select></label>
    {changed && <><span role="status">変更あり</span><button onClick={() => { onApply({...active.filters}); setName(active.name); }}>元に戻す</button></>}
    <label>条件名<input value={name} maxLength={80} onChange={event => setName(event.target.value)} placeholder="表示条件の名前" /></label>
    <button disabled={!name.trim()} onClick={() => perform(async () => {
      const view = {id: crypto.randomUUID(), name:name.trim(), filters:{...value}};
      await onSave(view); setSelected(view.id);
    })}>{active ? "別名で保存" : "保存"}</button>
    {active && <button disabled={!name.trim() || (!changed && name.trim() === active.name)} onClick={() => perform(async () => {
      if (active) await onSave({...active, name:name.trim(), filters:{...value}});
    })}>{renamed ? changed ? "名前と条件を更新" : "名前を変更" : "更新"}</button>}
    {active && changed && renamed && <button disabled={!name.trim()} onClick={() => perform(async () => {
      await onSave({...active, name:name.trim()});
    })}>名前だけ変更</button>}
    {active && <button onClick={() => perform(async () => {
      if (active) { await onDelete(active.id); setDeleted(active); setSelected(""); setName(""); }
    })}>削除</button>}
    {deleted && <span role="status">「{deleted.name}」を削除 <button onClick={() => perform(async () => {
      await onSave(deleted); setDeleted(null);
    })}>削除を取り消す</button></span>}
    {error && <p role="alert">{error}</p>}
  </fieldset>
    </div>
  </>;
}

export function CandidateQueryHelp() {
  return <Help topic="results" text={'空白でAND、-語で除外。手順:・ID:・理由:で検索対象を指定。例：L2 反転 -理由:資材'} />;
}
