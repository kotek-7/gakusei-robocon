import "./commands";
import { useEffect, useState } from "react";
import { run } from "../../app/commands";
import { layout } from "../../app/layout";
import { useUI } from "../../app/store";
import { useWorkspaceData } from "../../app/workspace";
import type { ReviewRecord } from "../../engine/protocol";
import { Empty } from "../common/Empty";
import { defineEditor } from "../registry";
import "./review.css";
import { filterRecords, sortRecords, reviewStatusNames as statusNames } from "./records";

function RecordEditor({ record }: { record: ReviewRecord }) {
  const [title, setTitle] = useState(record.title);
  const [note, setNote] = useState(record.note);
  const save = (patch: Partial<ReviewRecord>) => run("review.update", { id: record.id, patch });
  return <div className="review-detail">
    <label>見出し<input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => { const next = title.trim() || record.title; setTitle(next); save({ title: next }); }} /></label>
    <label>判断<select aria-label="記録の判断" value={record.status} onChange={e => save({ status: e.target.value as ReviewRecord["status"] })}>
      {Object.entries(statusNames).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
    </select></label>
    <p className="muted tabular">局面 {record.node} · {record.time.toFixed(2)}秒 · {record.path.length}遷移{record.range ? ` · 範囲 ${record.range[0]}–${record.range[1]}秒` : ""}</p>
    <label>検討メモ<textarea rows={6} value={note} placeholder="確認したこと、残る疑問、判断の理由" onChange={e => setNote(e.target.value)} onBlur={() => save({ note })} /></label>
    <div className="review-tools">
      <button onClick={() => run("review.restore", record)}>経路・時刻を復元</button>
      <button disabled={!record.path.length} onClick={() => run("review.compareA", record)}>比較Aに設定</button>
      <button disabled={!record.path.length} onClick={() => run("review.compareB", record)}>比較Bに設定</button>
      <button onClick={() => run("review.duplicate", record)}>複製</button>
      <button onClick={() => run("review.delete", record)}>削除</button>
    </div>
  </div>;
}

function Review({ area }: import("../registry").EditorProps) {
  const ws = useWorkspaceData();
  const search = useUI(s => s.session.search);
  const node = useUI(s => s.session.node);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const sort = (area.state?.sort as string) ?? "created";
  const currentOnly = area.state?.currentOnly === true;
  useEffect(() => { setQuery(""); setStatus("all"); }, [area.state?.resetFilters, search]);
  const selected = area.state?.selected as string | undefined;
  const records = ws?.reviews ?? [];
  const filtered = sortRecords(filterRecords(records, query, status).filter(r => !currentOnly || r.node === node), sort);
  const record = filtered.find(r => r.id === selected) ?? filtered[0];
  if (!search) return <Empty title="探索を開くと検討記録を残せます" />;
  return <div className="review-editor">
    <div className="review-tools"><button disabled={node === null} onClick={() => run("review.capture")}>現在の経路と時刻を記録</button><span className="muted">{filtered.length} / {records.length}件</span></div>
    <div className="review-tools">
      <input type="search" aria-label="検討記録を検索" placeholder="見出し・メモ・局面を検索" value={query} onChange={e => setQuery(e.target.value)} />
      <select aria-label="検討記録の判断で絞り込み" value={status} onChange={e => setStatus(e.target.value)}><option value="all">すべての判断</option>{Object.entries(statusNames).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
      {(query || status !== "all") && <button onClick={() => { setQuery(""); setStatus("all"); }}>絞り込みを解除</button>}
      <select aria-label="検討記録の並び順" value={sort} onChange={e => run("review.view", { area: area.id, patch: { sort: e.target.value } })}><option value="created">新しい順</option><option value="time">試合時刻順</option><option value="status">未確認を先に</option></select>
      <button aria-pressed={currentOnly} onClick={() => run("review.view", { area: area.id, patch: { currentOnly: !currentOnly } })}>選択局面のみ</button>
      <button disabled={!filtered.length} onClick={() => run("review.copy", filtered)}>表示中をコピー</button>
      <button disabled={!filtered.length} onClick={() => run("review.export", filtered)}>JSON保存</button>
    </div>
    {!records.length ? <Empty title="残したい局面で記録を追加してください">経路・再生時刻・再生範囲を保存します。</Empty> : <>
      {!filtered.length && <p className="muted">該当する記録はありません</p>}
      <div className="review-list" aria-label="検討記録の一覧">{filtered.map(r => <button key={r.id} aria-pressed={record?.id === r.id} onClick={() => layout.setAreaState(area.id, { selected: r.id })}>
        <span>{r.title}</span><span className="muted">{statusNames[r.status]}</span>
      </button>)}</div>
      {record && <RecordEditor key={`${search}:${record.id}`} record={record} />}
    </>}
  </div>;
}
defineEditor({ type: "review", title: "検討記録", group: "データ", Component: Review });
