import { useState } from "react";
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

function Outliner() {
  const search = useSearch();
  const list = useSearches((s) => s.list);
  const ws = useWorkspaceData();
  const node = useUI((s) => s.session.node);
  const [open, setOpen] = useState<Record<string, boolean>>({ searches: false, cands: true, markers: true });
  const [q, setQ] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  if (!search) return <Empty title="探索がありません" />;
  const pins = new Set(ws?.pins ?? []);
  const toggle = (k: string) => () => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const pinMenu = (id: string): MenuItem => ({
    label: pins.has(id) ? "ピン留めを外す" : "ピン留め",
    run: () => updateWorkspace((w) => ({ ...w, pins: w.pins.includes(id) ? w.pins.filter((p) => p !== id) : [...w.pins, id] })),
  });
  const rows: Row[] = [];
  rows.push({ id: "searches", depth: 0, label: `保存済みの探索 ${list.length}`, open: open.searches, toggle: toggle("searches") });
  if (open.searches)
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
  if (open.cands)
    for (const r of runs) {
      const rk = `run:${r.run}`;
      rows.push({ id: rk, depth: 1, label: `構成 C${r.run}`, hint: `${r.candidates.length}候補`, open: open[rk] ?? true, toggle: toggle(rk) });
      if (!(open[rk] ?? true)) continue;
      r.candidates.forEach((c, ci) => {
        const ck = `cand:${c.id}`;
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
        if (open[ck])
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
  if (open.markers)
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
  if (open.views) for (const b of ws?.bookmarks ?? []) rows.push({ id: `bm:${b.id}`, depth: 1, label: b.name });
  const filtered = rows.filter(
    (r) => (!q || r.depth === 0 || r.label.includes(q) || r.hint?.includes(q)) && (!pinnedOnly || r.depth < 2 || r.pinned || r.depth > 2),
  );
  return (
    <div className="outliner">
      <div className="outliner-tools">
        <input className="filter" placeholder="絞り込み" value={q} onChange={(e) => setQ(e.target.value)} aria-label="アウトライナーを絞り込み" />
        <button className="tool icon-only" aria-pressed={pinnedOnly} title="ピン留めのみ" onClick={() => setPinnedOnly(!pinnedOnly)}>
          <Icon name="pin" />
        </button>
      </div>
      <ul className="tree" role="tree">
        {filtered.map((r) => (
          <li
            key={r.id}
            role="treeitem"
            aria-expanded={r.toggle ? !!r.open : undefined}
            aria-selected={!!r.active}
            className={`tree-row depth${r.depth}${r.active ? " active" : ""} ${r.tone ?? ""}`}
            style={{ paddingLeft: 6 + r.depth * 14 }}
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
              {r.toggle ? <Icon name={r.open ? "chevron" : "chevronRight"} size={12} /> : null}
            </span>
            {r.pinned && <Icon name="pin" size={12} />}
            <span className="tree-label">{r.label}</span>
            {r.hint && <span className="tree-hint tabular">{r.hint}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
defineEditor({ type: "outliner", title: "アウトライナー", group: "データ", Component: Outliner });
