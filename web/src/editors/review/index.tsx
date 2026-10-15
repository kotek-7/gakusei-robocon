import { IconButton } from "../common/IconButton";
import { Icon } from "../../shell/icons";
import "./commands";
import { useEffect, useId, useState } from "react";
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
  const decisionId = useId();
  const [title, setTitle] = useState(record.title);
  const [note, setNote] = useState(record.note);
  const save = (patch: Partial<ReviewRecord>) => run("review.update", { id: record.id, patch });
  return <div className="review-detail">
    <label className="review-title-field">記録名<input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => { const next = title.trim() || record.title; setTitle(next); save({ title: next }); }} /></label>
    <fieldset className="review-decision"><legend>判断</legend>{Object.entries(statusNames).map(([value, text]) => <label key={value} data-status={value}><input type="radio" name={decisionId} checked={record.status === value} onChange={() => save({ status: value as ReviewRecord["status"] })} />{text}</label>)}</fieldset>
    <dl className="review-location"><div><dt>試合時刻</dt><dd>{record.time.toFixed(2)} 秒</dd></div><div><dt>経路</dt><dd>{record.path.length} 遷移</dd></div><div><dt>局面</dt><dd>{record.node}</dd></div>{record.range && <div><dt>再生区間</dt><dd>{record.range[0]}–{record.range[1]} 秒</dd></div>}</dl>
    <div className="review-restore-tools"><button className="action-button primary" onClick={() => run("review.restore", record)}><Icon name="eye" />この記録を表示</button>
      <div className="review-compare-group" role="group" aria-label="記録を比較対象に設定"><span>比較に使用</span><button className="tool" disabled={!record.path.length} onClick={() => run("review.compareA", record)}>A</button><button className="tool" disabled={!record.path.length} onClick={() => run("review.compareB", record)}>B</button></div>
    </div>
    <label>検討メモ<textarea rows={6} value={note} placeholder="確認したこと、残る疑問、判断の理由" onChange={e => setNote(e.target.value)} onBlur={() => save({ note })} /></label>
    <footer className="review-record-actions"><IconButton icon="copy" label="選択した記録を複製" onClick={() => run("review.duplicate", record)} /><IconButton icon="trash" label="選択した記録を削除" className="review-delete" onClick={() => run("review.delete", record)} /></footer>
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
    <div className="review-tools review-capture"><button className="action-button" disabled={node === null} onClick={() => run("review.capture")}><Icon name="plus" />現在の局面を記録</button><span className="muted">{filtered.length} / {records.length}件</span></div>
    <div className="review-tools">
      <input type="search" aria-label="検討記録を検索" placeholder="見出し・メモ・局面を検索" value={query} onChange={e => setQuery(e.target.value)} />
      <select aria-label="検討記録の判断で絞り込み" value={status} onChange={e => setStatus(e.target.value)}><option value="all">すべての判断</option>{Object.entries(statusNames).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
      {(query || status !== "all") && <IconButton icon="reset" label="検討記録の絞り込みを解除" onClick={() => { setQuery(""); setStatus("all"); }} />}
      <select aria-label="検討記録の並び順" value={sort} onChange={e => run("review.view", { area: area.id, patch: { sort: e.target.value } })}><option value="created">新しい順</option><option value="time">試合時刻順</option><option value="status">未確認を先に</option></select>
      <label className="review-filter-check"><input type="checkbox" checked={currentOnly} onChange={event => run("review.view", { area: area.id, patch: { currentOnly: event.target.checked } })} />選択局面のみ</label>
      <div className="review-export" role="group" aria-label="表示中の記録を書き出し"><IconButton icon="copy" label="表示中の記録をコピー" disabled={!filtered.length} onClick={() => run("review.copy", filtered)} /><IconButton icon="download" label="表示中の記録をJSON保存" disabled={!filtered.length} onClick={() => run("review.export", filtered)} /></div>
    </div>
    {!records.length ? <Empty title="残したい局面で記録を追加してください">経路・再生時刻・再生範囲を保存します。</Empty> : <>
      {!filtered.length && <p className="muted">該当する記録はありません</p>}
      <div className="review-workbench">
      <div className="review-list" aria-label="検討記録の一覧">{filtered.map(r => <button key={r.id} aria-pressed={record?.id === r.id} onClick={() => layout.setAreaState(area.id, { selected: r.id })}>
        <time className="review-record-time">{r.time.toFixed(1)}秒</time><span className="review-record-title">{r.title}</span><span className="review-status" data-status={r.status}>{statusNames[r.status]}</span>
      </button>)}</div>
      {record && <RecordEditor key={`${search}:${record.id}`} record={record} />}
      </div>
    </>}
  </div>;
}
defineEditor({ type: "review", title: "検討記録", group: "データ", Component: Review });
