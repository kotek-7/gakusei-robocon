import { useEffect, useState } from "react";
import { register, run } from "../../app/commands";
import { currentPath, goToNode } from "../../app/coreCommands";
import { layout } from "../../app/layout";
import { parseRef, type EntityRef } from "../../app/refs";
import { ui, useUI } from "../../app/store";
import { newId, updateWorkspace, useWorkspaceData } from "../../app/workspace";
import type { ReviewRecord } from "../../engine/protocol";
import { Empty } from "../common/Empty";
import { defineEditor } from "../registry";
import "./review.css";
import { filterRecords, reviewText, reviewStatusNames as statusNames } from "./records";

const hasSelection = () => !!useUI.getState().session.search && useUI.getState().session.node !== null;
register(
  { id: "review.open", title: "検討記録を開く", category: "検討", run: () => layout.reveal("review") },
  { id: "review.capture", title: "現在の経路と時刻を記録", category: "検討", keys: ["Ctrl+Shift+M"], enabled: hasSelection,
    run: async () => {
      const { session, playback } = useUI.getState();
      const path = await currentPath();
      if (!path || useUI.getState().session.search !== session.search) return;
      const record: ReviewRecord = {
        id: newId(), title: `局面 ${session.node}・${playback.time.toFixed(2)}秒`, note: "", status: "open",
        node: session.node!, path: [...path], selection: session.selection,
        time: playback.time, range: playback.range ? [...playback.range] : null, created: Date.now(),
      };
      await updateWorkspace(w => ({ ...w, reviews: [...(w.reviews ?? []), record] }));
      if (useUI.getState().session.search === session.search) layout.reveal("review", { selected: record.id, resetFilters: record.id });
    },
  },
  { id: "review.restore", title: "記録した経路を再生", category: "検討", hidden: true,
    run: async ({ args }) => {
      const r = args as ReviewRecord;
      const search = useUI.getState().session.search;
      await goToNode(r.node, [...r.path]);
      if (search !== useUI.getState().session.search) return;
      ui.patchPlayback({ time: r.time, range: r.range, playing: false });
      if (r.selection && parseRef(r.selection)) ui.select(r.selection as EntityRef);
    },
  },
  { id: "review.update", title: "記録を保存", category: "検討", hidden: true,
    run: ({ args }) => {
      const { id, patch } = args as { id: string; patch: Partial<Pick<ReviewRecord, "title" | "note" | "status">> };
      return updateWorkspace(w => ({ ...w, reviews: (w.reviews ?? []).map(r => r.id === id ? { ...r, ...patch } : r) }));
    },
  },
  { id: "review.delete", title: "記録を削除", category: "検討", hidden: true,
    run: async ({ args }) => {
      const r = args as ReviewRecord;
      const search = useUI.getState().session.search;
      await updateWorkspace(w => ({ ...w, reviews: (w.reviews ?? []).filter(x => x.id !== r.id) }));
      ui.toast("記録を削除しました", "info", { label: "元に戻す", command: "review.undoDelete", args: { search, record: r } });
    },
  },
  { id: "review.undoDelete", title: "記録の削除を取り消す", category: "検討", hidden: true,
    enabled: ({ args }) => (args as { search?: string } | undefined)?.search === useUI.getState().session.search,
    run: ({ args }) => {
      const { record } = args as { record: ReviewRecord };
      return updateWorkspace(w => ({ ...w, reviews: [...(w.reviews ?? []).filter(r => r.id !== record.id), record].sort((a, b) => a.created - b.created) }));
    },
  },
  { id: "review.copy", title: "表示中の検討記録をコピー", category: "検討", hidden: true,
    run: async ({ args }) => { await navigator.clipboard.writeText(reviewText(args as ReviewRecord[])); ui.toast("検討記録をコピーしました"); } },
  ...(["a", "b"] as const).map(side => ({
    id: `review.compare${side.toUpperCase()}`, title: `記録した経路を比較${side.toUpperCase()}に設定`, category: "検討", hidden: true,
    enabled: ({ args }: import("../../app/commands").CommandContext) => !!(args as ReviewRecord | undefined)?.path.length,
    run: ({ args }: import("../../app/commands").CommandContext) => {
      const r = args as ReviewRecord;
      const c = useUI.getState().session.compare;
      const label: [string, string] = [...c.label];
      label[side === "a" ? 0 : 1] = r.title;
      ui.patchSession({ compare: { ...c, [side]: [...r.path], label } });
      ui.toast(`比較${side.toUpperCase()}に設定しました`);
    },
  })),
);

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
  useEffect(() => { setQuery(""); setStatus("all"); }, [area.state?.resetFilters, search]);
  const selected = area.state?.selected as string | undefined;
  const records = ws?.reviews ?? [];
  const filtered = filterRecords(records, query, status);
  const record = filtered.find(r => r.id === selected) ?? filtered.at(-1);
  if (!search) return <Empty title="探索を開くと検討記録を残せます" />;
  return <div className="review-editor">
    <div className="review-tools"><button disabled={node === null} onClick={() => run("review.capture")}>現在の経路と時刻を記録</button><span className="muted">{filtered.length} / {records.length}件</span></div>
    <div className="review-tools">
      <input type="search" aria-label="検討記録を検索" placeholder="見出し・メモ・局面を検索" value={query} onChange={e => setQuery(e.target.value)} />
      <select aria-label="検討記録の判断で絞り込み" value={status} onChange={e => setStatus(e.target.value)}><option value="all">すべての判断</option>{Object.entries(statusNames).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
      {(query || status !== "all") && <button onClick={() => { setQuery(""); setStatus("all"); }}>絞り込みを解除</button>}
      <button disabled={!filtered.length} onClick={() => run("review.copy", filtered)}>表示中をコピー</button>
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
