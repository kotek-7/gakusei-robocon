import "./commands";
import { useEffect, useState } from "react";
import { visibleRows } from "./tree";
import { run } from "../../app/commands";
import { useSearches } from "../../app/data";
import { useSearch } from "../../app/session";
import { ui, useUI, type MenuItem } from "../../app/store";
import { updateWorkspace, useWorkspaceData } from "../../app/workspace";
import type { CandidateEvidence } from "../../engine/types";
import { Icon } from "../../shell/icons";
import { Empty } from "../common/Empty";
import { defineEditor } from "../registry";

type Row = {
  id: string;
  depth: number;
  label: string;
  hint?: string;
  open?: boolean;
  toggle?: () => void;
  act?: () => void;
  menu?: () => MenuItem[];
  active?: boolean;
  pinned?: boolean;
  tone?: string;
};

function evidenceMenu(label: string, ev: CandidateEvidence): MenuItem[] {
  return [
    { label: "この経路を開く", run: () => run("nav.node", { node: ev.node, path: ev.path }) },
    { label: "比較Aに設定", run: () => ui.patchSession({ compare: { ...useUI.getState().session.compare, a: ev.path, label: [label, useUI.getState().session.compare.label[1]] } }) },
    { label: "比較Bに設定", run: () => ui.patchSession({ compare: { ...useUI.getState().session.compare, b: ev.path, label: [useUI.getState().session.compare.label[0], label] } }) },
    { separator: true },
    { label: "分類IDをコピー", run: () => navigator.clipboard.writeText(ev.strategy) },
  ];
}

function Outliner({ area }: import("../registry").EditorProps) {
  const search = useSearch();
  const list = useSearches((s) => s.list);
  const ws = useWorkspaceData();
  const node = useUI((s) => s.session.node);
  const [open, setOpen] = useState<Record<string, boolean>>({ searches: false, cands: true, markers: true });
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  useEffect(() => {
    if (typeof area.state?.treeExpansion !== "boolean") return;
    const expanded = area.state.treeExpansion;
    const keys = ["searches", "cands", "markers", "views", "reviews", ...(search?.discovery?.runs ?? []).flatMap(r => [`run:${r.run}`, ...r.candidates.map(c => `cand:${r.run}:${c.id}`)])];
    setOpen(Object.fromEntries(keys.map(key => [key, expanded])));
  }, [area.state?.treeExpansionRequest]);
  if (!search) return <Empty title="探索がありません" />;
  const pins = new Set(ws?.pins ?? []);
  const toggle = (k: string) => () => setOpen((o) => ({ ...o, [k]: !(o[k] ?? k.startsWith("run:")) }));
  const pinMenu = (id: string): MenuItem => ({
    label: pins.has(id) ? "ピン留めを外す" : "ピン留め",
    run: () => updateWorkspace((w) => ({ ...w, pins: w.pins.includes(id) ? w.pins.filter((p) => p !== id) : [...w.pins, id] })),
  });
  const rows: Row[] = [];
  rows.push({ id: "searches", depth: 0, label: `保存済みの探索 ${list.length}`, open: open.searches, toggle: toggle("searches") });
  for (const s of list)
      rows.push({
        id: `s:${s.id}`,
        depth: 1,
        label: s.name,
        hint: `${s.discovery?.metrics.candidates ?? 0}候補`,
        active: s.id === search.id,
        act: () => run("search.open", s.id),
        menu: () => [{ label: "開く", run: () => run("search.open", s.id) }],
      });
  const runs = search.discovery?.runs ?? [];
  rows.push({ id: "cands", depth: 0, label: `作戦候補 ${search.discovery?.metrics.candidates ?? 0}`, open: open.cands, toggle: toggle("cands") });
  for (const r of runs) {
      const rk = `run:${r.run}`;
      rows.push({ id: rk, depth: 1, label: `構成 C${r.run}`, hint: `${r.candidates.length}候補`, open: open[rk] ?? true, toggle: toggle(rk) });
      r.candidates.forEach((c, ci) => {
        const ck = `cand:${r.run}:${c.id}`;
        const label = `C${r.run}-${ci + 1} ${c.baseline.strategy.slice(0, 10)}`;
        rows.push({
          id: ck,
          depth: 2,
          label,
          hint: `${c.baseline.scores[0]}:${c.baseline.scores[1]}`,
          open: open[ck],
          toggle: toggle(ck),
          pinned: pins.has(ck),
          active: c.baseline.node === node,
          act: () => run("nav.node", { node: c.baseline.node, path: c.baseline.path }),
          menu: () => [...evidenceMenu(label, c.baseline), pinMenu(ck)],
        });
        c.responses.forEach((resp, i) =>
            rows.push({
              id: `${ck}:r${i}`,
              depth: 3,
              label: `対応${i + 1}${resp.shared ? "（共通）" : ""}`,
              hint: `${resp.scores[0]}:${resp.scores[1]}`,
              tone: resp.scores[0] - resp.scores[1] < 0 ? "loss" : "",
              active: resp.node === node,
              act: () => run("nav.node", { node: resp.node, path: resp.path }),
              menu: () => evidenceMenu(`${label} 対応${i + 1}`, resp),
            }),
          );
      });
    }
  rows.push({ id: "markers", depth: 0, label: `マーカー ${ws?.markers.length ?? 0}`, open: open.markers, toggle: toggle("markers") });
  for (const m of ws?.markers ?? [])
      rows.push({
        id: `marker:${m.id}`,
        depth: 1,
        label: m.name,
        hint: `${m.t}秒`,
        act: () => ui.patchPlayback({ time: m.t, playing: false }),
        menu: () => [
          { label: "削除", run: () => updateWorkspace((w) => ({ ...w, markers: w.markers.filter((x) => x.id !== m.id) })) },
        ],
      });
  rows.push({ id: "views", depth: 0, label: `保存した視点 ${ws?.bookmarks.length ?? 0}`, open: open.views, toggle: toggle("views") });
  for (const b of ws?.bookmarks ?? []) rows.push({ id: `bm:${b.id}`, depth: 1, label: b.name });
  rows.push({ id: "reviews", depth: 0, label: `検討記録 ${ws?.reviews?.length ?? 0}`, open: open.reviews, toggle: toggle("reviews") });
  for (const record of ws?.reviews ?? []) rows.push({ id: `review:${record.id}`, depth: 1, label: record.title, hint: `${record.time.toFixed(1)}秒`, active: record.node === node, act: () => run("review.restore", record), menu: () => [
    { label: "経路・時刻を復元", run: () => run("review.restore", record) },
    { label: "比較Aに設定", run: () => run("review.compareA", record) },
    { label: "比較Bに設定", run: () => run("review.compareB", record) },
  ] });
  const filtered = visibleRows(rows, q, pinnedOnly);
  const filtering = !!q.trim() || pinnedOnly;
  const focusId = filtered.find((row) => row.id === focused)?.id ?? filtered.find((row) => row.active)?.id ?? filtered[0]?.id;
  return (
    <div className="outliner">
      <div className="outliner-tools">
        <input className="filter" placeholder="絞り込み" value={q} onChange={(e) => setQ(e.target.value)} aria-label="アウトライナーを絞り込み" />
        <button className="tool icon-only" aria-pressed={pinnedOnly} title="ピン留めのみ" onClick={() => setPinnedOnly(!pinnedOnly)}>
          <Icon name="pin" />
        </button>
      </div>
      <div className="outliner-tools">
        <button onClick={() => run("outliner.expandAll", area.id)}>すべて展開</button>
        <button onClick={() => run("outliner.collapseAll", area.id)}>すべて折りたたむ</button>
      </div>
      <ul className="tree" role="tree">
        {filtered.map((r) => (
          <li
            key={r.id}
            role="treeitem"
            aria-expanded={r.toggle ? filtering || !!r.open : undefined}
            aria-level={r.depth + 1}
            tabIndex={r.id === focusId ? 0 : -1}
            onFocus={() => setFocused(r.id)}
            aria-selected={!!r.active}
            className={`tree-row depth${r.depth}${r.active ? " active" : ""} ${r.tone ?? ""}`}
            style={{ paddingLeft: 6 + r.depth * 14 }}
            onKeyDown={(event) => {
              const items = Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLElement>('[role="treeitem"]'));
              const index = items.indexOf(event.currentTarget);
              let target: HTMLElement | undefined;
              if (event.key === "ArrowDown") target = items[Math.min(items.length - 1, index + 1)];
              else if (event.key === "ArrowUp") target = items[Math.max(0, index - 1)];
              else if (event.key === "Home") target = items[0];
              else if (event.key === "End") target = items.at(-1);
              else if (event.key === "ArrowRight") {
                if (r.toggle && !r.open && !filtering) r.toggle();
                else if (filtered[index + 1]?.depth > r.depth) target = items[index + 1];
              } else if (event.key === "ArrowLeft") {
                if (r.toggle && r.open && !filtering) r.toggle();
                else {
                  const parent = filtered.slice(0, index).findLastIndex((row) => row.depth < r.depth);
                  target = items[parent];
                }
              } else if (event.key === "Enter" || event.key === " ") {
                if (r.act) r.act(); else r.toggle?.();
              } else return;
              event.preventDefault();
              event.stopPropagation();
              target?.focus();
            }}
            onClick={() => (r.act ? r.act() : r.toggle?.())}
            onContextMenu={(e) => r.menu && ui.contextMenu(e, r.menu(), r.label)}
          >
            <span
              className="tree-twisty"
              onClick={(e) => {
                e.stopPropagation();
                r.toggle?.();
              }}
            >
              {r.toggle ? <Icon name={filtering || r.open ? "chevron" : "chevronRight"} size={12} /> : null}
            </span>
            {r.pinned && <Icon name="pin" size={12} />}
            <span className="tree-label">{r.label}</span>
            {r.hint && <span className="tree-hint tabular">{r.hint}</span>}
          </li>
        ))}
      </ul>
      {!filtered.length && <p className="muted">該当する項目はありません</p>}
    </div>
  );
}
defineEditor({ type: "outliner", title: "アウトライナー", group: "データ", Component: Outliner });
