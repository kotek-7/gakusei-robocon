import { useEffect, useMemo, useRef, useState } from "react";
import { graphNodes, type GraphScope } from "./view";
import type { Graph as Data, Edge } from "../../engine/types";
export function Graph({
  data,
  selected,
  path,
  select,
  chooseEdge,
  onPage,
  onReveal,
}: {
  data: Data;
  selected: number | null;
  path: number[];
  select: (n: number) => void;
  chooseEdge: (e: Edge) => void;
  onPage: (o: number) => void;
  onReveal: () => void;
}) {
  const [scope, setScope] = useState<GraphScope>("page");
  const nodes = useMemo(() => graphNodes(data, selected, path, scope), [data, selected, path, scope]);
  const frontier = nodes.filter((n) => !n.expanded);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const layout = useMemo(() => {
    const times = [...new Set(nodes.map((n) => n.state.t))].sort(
      (a, b) => a - b,
    );
    const counts = new Map<number, number>();
    const positions = new Map<number, { x: number; y: number }>();
    for (const n of nodes) {
      const row = counts.get(n.state.t) || 0;
      positions.set(n.id, {
        x: 40 + times.indexOf(n.state.t) * 185,
        y: 65 + row * 90,
      });
      counts.set(n.state.t, row + 1);
    }
    return {
      times,
      positions,
      width: Math.max(600, times.length * 185 + 60),
      height: Math.max(175, ...[...counts.values()].map((n) => n * 90 + 90)),
    };
  }, [nodes]);
  function revealSelection() {
    const p = selected === null ? undefined : layout.positions.get(selected);
    const el = viewport.current;
    if (!p) {
      onReveal();
      return;
    }
    if (!el) return;
    if (
      p.x * zoom < el.scrollLeft ||
      (p.x + 140) * zoom > el.scrollLeft + el.clientWidth
    )
      el.scrollLeft = Math.max(0, (p.x + 70) * zoom - el.clientWidth / 2);
    if (
      p.y * zoom < el.scrollTop ||
      (p.y + 65) * zoom > el.scrollTop + el.clientHeight
    )
      el.scrollTop = Math.max(0, p.y * zoom - el.clientHeight / 3);
  }
  useEffect(() => {
    if (selected !== null && layout.positions.has(selected)) revealSelection();
  }, [selected, data.offset, data.root, zoom]);
  useEffect(() => {
    if (!fit || !viewport.current) return;
    const element = viewport.current;
    const resize = () => setZoom(Math.min(1, Math.max(1, element.clientWidth - 1) / layout.width));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fit, layout.width]);
  const omitted = data.edges.filter((e) => layout.positions.has(e.src) && !layout.positions.has(e.dst)).length;
  function nextFrontier() {
    const index = frontier.findIndex((n) => n.id === selected);
    const next = frontier[(index + 1) % frontier.length];
    if (next) select(next.id);
  }
  return (
    <section className="graph-panel" aria-label="状態遷移グラフ">
      <div className="graph-tools">
        <span>
          局面 {data.total ? data.offset + 1 : 0}–
          {data.offset + data.nodes.length} / {data.total}
        </span>
        <div>
          <button
            onClick={() => onPage(Math.max(0, data.offset - 100))}
            disabled={!data.offset}
          >
            前の100局面
          </button>
          <button
            onClick={() => onPage(data.offset + 100)}
            disabled={data.offset + data.nodes.length >= data.total}
          >
            次の100局面
          </button>
        </div>
        <label>表示 <select value={scope} onChange={(e) => setScope(e.target.value as GraphScope)}>
          <option value="page">ページ全体</option><option value="neighbors">選択局面と前後</option><option value="path">選択経路</option>
        </select></label>
        <span>表示 {nodes.length}局面 · 未展開 {frontier.length}</span>
        <button disabled={!frontier.length} onClick={nextFrontier}>次の未展開局面</button>
        <button onClick={revealSelection} disabled={selected === null}>
          選択局面を表示
        </button>
        <button aria-pressed={fit} onClick={() => setFit(!fit)}>幅に合わせる</button>
        <label>
          倍率
          <select
            value={zoom}
            onChange={(e) => { setFit(false); setZoom(Number(e.target.value)); }}
          >
            {[...new Set([0.25, 0.5, 0.75, 1, 1.25, 1.5, zoom])].sort((a, b) => a - b).map((z) => (
              <option key={z} value={z}>
                {Math.round(z * 100)}%
              </option>
            ))}
          </select>
        </label>
      </div>
      {scope !== "page" && <p className="muted">読み込み済みの{data.nodes.length}局面から絞り込み中。非表示の局面・ページ外の分岐も探索対象に残ります。</p>}
      {!nodes.length && <p className="muted">このページには対象の局面がありません。「ページ全体」に戻すか、選択局面を表示してください。</p>}
      <div
        className="graph-scroll"
        ref={viewport}
        style={{ height: `min(${layout.height * zoom}px, 65vh, 650px)` }}
      >
        <svg
          width={layout.width * zoom}
          height={layout.height * zoom}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          aria-label="時刻順の局面と行動のグラフ"
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          {layout.times.map((t, i) => (
            <g key={t}>
              <text x={40 + i * 185} y={28} className="time-label">
                {t} 秒
              </text>
              <line
                x1={32 + i * 185}
                y1={40}
                x2={32 + i * 185}
                y2={layout.height}
                className="time-rule"
              />
            </g>
          ))}
          {data.edges.map((e) => {
            const a = layout.positions.get(e.src),
              b = layout.positions.get(e.dst);
            if (!a || !b) return null;
            const d = `M${a.x + 128},${a.y + 28} C${a.x + 155},${a.y + 28} ${b.x - 28},${b.y + 28} ${b.x},${b.y + 28}`;
            return (
              <g
                key={e.id}
                className={path.includes(e.id) ? "selected-edge" : "edge"}
              >
                <path d={d} markerEnd="url(#arrow)" />
                <path
                  d={d}
                  className="edge-target"
                  tabIndex={0}
                  role="button"
                  aria-label={`遷移 ${e.id}: 局面${e.src}から${e.dst}`}
                  onClick={() => chooseEdge(e)}
                  onKeyDown={(k) => {
                    if (k.key === "Enter" || k.key === " ") { k.preventDefault(); chooseEdge(e); }
                  }}
                >
                  <title>{`E${e.id}: N${e.src} → N${e.dst}`}</title>
                </path>
              </g>
            );
          })}
          {nodes.map((n) => {
            const p = layout.positions.get(n.id)!;
            return (
              <g
                key={n.id}
                transform={`translate(${p.x},${p.y})`}
                className={`graph-node ${n.expanded ? "expanded" : "frontier"} ${selected === n.id ? "selected" : ""}`}
                tabIndex={0}
                role="button"
                aria-label={`局面 ${n.id}、${n.state.t}秒、赤${n.scores[0]} 青${n.scores[1]}、${n.expanded ? "展開済み" : "未展開あり"}`}
                onClick={() => select(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    select(n.id);
                  }
                }}
              >
                <rect width="128" height="56" rx="4" />
                {n.state.t === 180 && (
                  <rect
                    x="4"
                    y="4"
                    width="120"
                    height="48"
                    rx="2"
                    className="terminal-ring"
                  />
                )}
                <text x="12" y="20">
                  N{n.id}
                  {selected === n.id ? " · 選択" : ""}
                </text>
                <text x="12" y="42" className="red-text">
                  {n.scores[0]}
                </text>
                <text x="55" y="42" className="score-divider">
                  /
                </text>
                <text x="75" y="42" className="blue-text">
                  {n.scores[1]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="graph-legend">
        <span>破線：未展開あり</span>
        <span>実線：展開済み</span>
        <span>二重枠：180秒</span>
        <span>表示外への遷移：{omitted}本（局面詳細から移動可）</span>
      </div>
    </section>
  );
}
