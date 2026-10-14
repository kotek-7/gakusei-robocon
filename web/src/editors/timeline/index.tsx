import { useEffect, useMemo, useRef, useState } from "react";
import { register, run } from "../../app/commands";
import { layout } from "../../app/layout";
import { definePrefs, usePref } from "../../app/prefs";
import { useAnalysis, useSearch, useSpan } from "../../app/session";
import { ui, useUI, type MenuItem } from "../../app/store";
import { newId, updateWorkspace, useWorkspaceData } from "../../app/workspace";
import type { JobInterval, Marker } from "../../engine/analysis";
import { Icon } from "../../shell/icons";
import { actionName, robotNames } from "../common/labels";
import { defineEditor, type EditorProps } from "../registry";

export const KIND_SHORT: Record<string, string> = {
  move: "移動",
  pick: "取得",
  take: "持ち直し",
  drop: "床置き",
  give: "受け渡し",
  receive: "受け取り",
  place: "設置",
  flip: "反転",
  takeM: "M取得",
  placeM: "M設置",
  retry: "リトライ",
  wait: "待機",
  delay: "待機",
};
const MARKER_LABEL: Record<string, string> = {
  place: "設置",
  flip: "反転",
  take: "持ち直し",
  transfer: "搬送",
  mustika: "ムスティカ",
  retry: "リトライ",
  blocked: "実行不可",
  mandate: "取得条件",
  branch: "競合分岐",
};

definePrefs([
  { id: "timeline.labels", category: "タイムライン", label: "動作名を帯に表示", type: "boolean", default: true },
  { id: "timeline.follow", category: "タイムライン", label: "再生中は再生位置を追う", type: "boolean", default: true },
  { id: "timeline.showWaits", category: "タイムライン", label: "待機を帯で表示", type: "boolean", default: false },
  { id: "timeline.snap", category: "タイムライン", label: "ドラッグ時に0.25秒へ吸着", type: "boolean", default: true },
]);

const fmt = (t: number) => {
  const m = Math.floor(t / 60),
    s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
};
function parseTime(v: string): number | null {
  const m = v.trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2]);
}

register({
  id: "timeline.fit",
  title: "タイムラインを経路全体に合わせる",
  category: "タイムライン",
  keys: ["Home"],
  scope: "timeline",
  run: () => {
    const a = useUI.getState().activeArea;
    if (a) layout.setAreaState(a, { view: null });
  },
});

export function Transport({ compact = false }: { compact?: boolean }) {
  const playing = useUI((s) => s.playback.playing);
  const dir = useUI((s) => s.playback.direction);
  const time = useUI((s) => s.playback.time);
  const speed = useUI((s) => s.playback.speed);
  const loop = useUI((s) => s.playback.loop);
  const range = useUI((s) => s.playback.range);
  const [edit, setEdit] = useState<string | null>(null);
  const btn = (icon: Parameters<typeof Icon>[0]["name"], cmd: string, title: string, pressed?: boolean) => (
    <button className="tool icon-only" title={title} aria-pressed={pressed} onClick={() => run(cmd)}>
      <Icon name={icon} />
    </button>
  );
  return (
    <div className="transport">
      {btn("first", "play.start", "先頭へ (Home)")}
      {!compact && btn("prevEvent", "play.prevEvent", "前のイベント (↓)")}
      {btn("stepBack", "play.stepBack", "0.25秒戻る (←)")}
      {btn("reverse", "play.reverse", "逆再生 (Shift+Space)", playing && dir < 0)}
      <button
        className="tool icon-only play"
        title="再生・一時停止 (Space)"
        aria-pressed={playing && dir > 0}
        onClick={() => run("play.toggle")}
      >
        <Icon name={playing ? "pause" : "play"} />
      </button>
      {btn("stepFwd", "play.stepFwd", "0.25秒進む (→)")}
      {!compact && btn("nextEvent", "play.nextEvent", "次のイベント (↑)")}
      {btn("last", "play.end", "末尾へ (End)")}
      <input
        className="time-field tabular"
        aria-label="再生位置（分:秒 または 秒）"
        value={edit ?? fmt(time)}
        onFocus={(e) => {
          setEdit(fmt(time));
          e.target.select();
        }}
        onChange={(e) => setEdit(e.target.value)}
        onBlur={() => setEdit(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const t = parseTime(edit ?? "");
            if (t !== null) ui.patchPlayback({ time: t, playing: false });
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") (e.target as HTMLInputElement).blur();
        }}
      />
      <button
        className="tool"
        title="再生速度"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          useUI.setState({ menu: { x: r.left, y: r.bottom + 2, items: [0.25, 0.5, 1, 2, 4, 8].map((s) => ({ command: `play.speed${s}` })) } });
        }}
      >
        {speed}倍
      </button>
      <button className="tool icon-only" title="ループ (Ctrl+L)" aria-pressed={loop} onClick={() => run("play.loop")}>
        <Icon name="loop" />
      </button>
      {!compact && (
        <button
          className="tool"
          title="再生範囲（I で開始、O で終了、Alt+I で解除）"
          aria-pressed={!!range}
          onClick={() => run(range ? "play.clearRange" : "play.setIn")}
        >
          {range ? `${range[0].toFixed(1)}–${range[1].toFixed(1)}` : "範囲"}
        </button>
      )}
      {!compact && btn("marker", "marker.add", "マーカーを追加 (M)")}
    </div>
  );
}

function Header({ area }: EditorProps) {
  const lanes = (area.state?.lanes as boolean[]) ?? [true, true, true, true];
  return (
    <div className="area-tools">
      <Transport />
      <span className="area-sep" />
      <button
        className="tool"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const items: MenuItem[] = [
            ...robotNames.map((n, i) => ({
              label: n,
              checked: lanes[i],
              run: () => layout.setAreaState(area.id, { lanes: lanes.map((v, j) => (j === i ? !v : v)) }),
            })),
            { separator: true },
            { label: "すべて表示", run: () => layout.setAreaState(area.id, { lanes: [true, true, true, true] }) },
            { label: "赤だけ", run: () => layout.setAreaState(area.id, { lanes: [true, true, false, false] }) },
            { label: "青だけ", run: () => layout.setAreaState(area.id, { lanes: [false, false, true, true] }) },
          ];
          useUI.setState({ menu: { x: r.left, y: r.bottom + 2, items } });
        }}
      >
        機体
        <Icon name="chevron" size={12} />
      </button>
      <button className="tool icon-only" title="全体に合わせる (Home)" onClick={() => layout.setAreaState(area.id, { view: null })}>
        <Icon name="fit" />
      </button>
    </div>
  );
}

const LANE_H = 30,
  RULER_H = 22,
  EVENT_H = 18,
  LEFT = 64;

function Timeline({ area }: EditorProps) {
  const analysis = useAnalysis().data;
  const search = useSearch();
  const [start, end] = useSpan();
  const horizon = search?.config.horizon ?? 180;
  const time = useUI((s) => s.playback.time);
  const playing = useUI((s) => s.playback.playing);
  const range = useUI((s) => s.playback.range);
  const selection = useUI((s) => s.session.selection);
  const ws = useWorkspaceData();
  const showLabels = usePref<boolean>("timeline.labels");
  const follow = usePref<boolean>("timeline.follow");
  const showWaits = usePref<boolean>("timeline.showWaits");
  const snap = usePref<boolean>("timeline.snap");
  const lanes = (area.state?.lanes as boolean[]) ?? [true, true, true, true];
  const view = (area.state?.view as [number, number] | null) ?? [0, horizon];
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<{ x: number; t: number; text: string } | null>(null);
  const hasSearch = !!search;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasSearch]);
  const [v0, v1] = view;
  const plotW = Math.max(50, width - LEFT - 8);
  const x = (t: number) => LEFT + ((t - v0) / (v1 - v0)) * plotW;
  const tOf = (px: number) => v0 + ((px - LEFT) / plotW) * (v1 - v0);
  const setView = (a: number, b: number) => {
    const span = Math.max(2, Math.min(horizon, b - a));
    let lo = Math.max(0, a),
      hi = lo + span;
    if (hi > horizon) {
      hi = horizon;
      lo = hi - span;
    }
    layout.setAreaState(area.id, { view: [lo, hi] });
  };
  // Keep the playhead in view while playing.
  useEffect(() => {
    if (!follow || !playing) return;
    if (time > v1 || time < v0) setView(time - (v1 - v0) * 0.1, time - (v1 - v0) * 0.1 + (v1 - v0));
  }, [time, playing, follow]);

  const visibleRobots = [0, 1, 2, 3].filter((r) => lanes[r]);
  const laneY = (r: number) => RULER_H + EVENT_H + visibleRobots.indexOf(r) * LANE_H;
  const height = RULER_H + EVENT_H + visibleRobots.length * LANE_H + 8;
  const step = useMemo(() => {
    const span = v1 - v0,
      target = span / (plotW / 70);
    return [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60].find((s) => s >= target) ?? 60;
  }, [v0, v1, plotW]);
  const ticks: number[] = [];
  for (let t = Math.ceil(v0 / step) * step; t <= v1 + 1e-6; t += step) ticks.push(t);

  const seekAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    let t = tOf(clientX - r.left);
    if (snap) t = Math.round(t * 4) / 4;
    ui.patchPlayback({ time: Math.max(0, Math.min(horizon, t)), playing: false });
  };
  const intervalMenu = (iv: JobInterval): MenuItem[] => [
    { label: "動作の開始へ", run: () => ui.patchPlayback({ time: iv.start, playing: false }) },
    { label: "動作の終了へ", run: () => ui.patchPlayback({ time: iv.end, playing: false }) },
    { label: "再生範囲をこの動作に", run: () => ui.patchPlayback({ range: [iv.start, iv.end], time: iv.start }) },
    { label: `${robotNames[iv.robot]}を選択`, run: () => ui.select(`robot:${iv.robot}`) },
    { separator: true },
    { label: `遷移 E${iv.edge} を選択`, run: () => ui.select(`edge:${iv.edge}`) },
  ];
  const markerMenu = (m: { id: string; t: number; name: string }): MenuItem[] => [
    { label: "ここへ移動", run: () => ui.patchPlayback({ time: m.t, playing: false }) },
    {
      label: "名前を変更…",
      run: async () => {
        const name = await ui.prompt("マーカーの名前", m.name);
        if (name) await updateWorkspace((w) => ({ ...w, markers: w.markers.map((x) => (x.id === m.id ? { ...x, name } : x)) }));
      },
    },
    { label: "再生位置へ移す", run: () => updateWorkspace((w) => ({ ...w, markers: w.markers.map((x) => (x.id === m.id ? { ...x, t: useUI.getState().playback.time } : x)) })) },
    { separator: true },
    { label: "削除", run: () => updateWorkspace((w) => ({ ...w, markers: w.markers.filter((x) => x.id !== m.id) })) },
  ];
  const emptyMenu = (t: number): MenuItem[] => [
    { label: `${t.toFixed(2)}秒へ移動`, run: () => ui.patchPlayback({ time: t, playing: false }) },
    { label: "ここにマーカーを追加", run: () => updateWorkspace((w) => ({ ...w, markers: [...w.markers, { id: newId(), t, name: `M${w.markers.length + 1}` }].sort((a, b) => a.t - b.t) })) },
    { label: "再生範囲の開始をここに", run: () => ui.patchPlayback({ range: [t, Math.max(t, range?.[1] ?? end)] }) },
    { label: "再生範囲の終了をここに", run: () => ui.patchPlayback({ range: [Math.min(t, range?.[0] ?? start), t] }) },
    { separator: true },
    { command: "timeline.fit" },
    { label: "すべてのマーカーを削除", disabled: !ws?.markers.length, run: () => updateWorkspace((w) => ({ ...w, markers: [] })) },
  ];
  const markerGroups = useMemo(() => {
    const byT = new Map<number, Marker[]>();
    for (const m of analysis?.markers ?? []) byT.set(m.t, [...(byT.get(m.t) ?? []), m]);
    return [...byT];
  }, [analysis]);

  if (!search) return null;
  return (
    <div
      className="timeline-editor"
      ref={ref}
      onWheel={(e) => {
        const r = ref.current!.getBoundingClientRect();
        const t = tOf(e.clientX - r.left);
        if (e.ctrlKey || e.metaKey || !e.shiftKey) {
          const f = Math.exp(e.deltaY * 0.0015);
          setView(t - (t - v0) * f, t + (v1 - t) * f);
        } else {
          const d = ((e.deltaY + e.deltaX) / plotW) * (v1 - v0);
          setView(v0 + d, v1 + d);
        }
      }}
    >
      <svg
        width={width}
        height={height}
        className="timeline-svg"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const target = e.target as Element;
          if (target.closest("[data-interval]") || target.closest("[data-marker]")) return;
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          seekAt(e.clientX);
        }}
        onPointerMove={(e) => {
          const r = ref.current!.getBoundingClientRect();
          const t = tOf(e.clientX - r.left);
          if (e.buttons === 1 && !(e.target as Element).closest("[data-interval]")) seekAt(e.clientX);
          const iv = (e.target as Element).closest("[data-interval]")?.getAttribute("data-interval");
          const ivx = iv !== undefined && iv !== null ? analysis?.intervals[Number(iv)] : null;
          setHover({
            x: e.clientX - r.left,
            t,
            text: ivx ? `${robotNames[ivx.robot]} ${actionName(ivx.action)} ${ivx.start}–${ivx.end}秒` : `${t.toFixed(2)}秒`,
          });
        }}
        onPointerLeave={() => setHover(null)}
        onContextMenu={(e) => {
          if ((e.target as Element).closest("[data-interval]") || (e.target as Element).closest("[data-marker]")) return;
          const r = ref.current!.getBoundingClientRect();
          const t = Math.round(tOf(e.clientX - r.left) * 4) / 4;
          ui.contextMenu(e, emptyMenu(t), `${t.toFixed(2)}秒`);
        }}
      >
        <rect x={LEFT} y={0} width={plotW} height={height} className="tl-bg" />
        {analysis && <rect x={x(analysis.start)} y={RULER_H} width={Math.max(0, x(analysis.end) - x(analysis.start))} height={height - RULER_H} className="tl-span" />}
        {range && <rect x={x(range[0])} y={0} width={Math.max(1, x(range[1]) - x(range[0]))} height={height} className="tl-range" />}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={RULER_H - 6} y2={height} className="tl-tick" />
            <text x={x(t) + 3} y={13} className="tl-tick-label">
              {step < 1 ? t.toFixed(2) : t}
            </text>
          </g>
        ))}
        <text x={6} y={13} className="tl-lane-label">秒</text>
        <text x={6} y={RULER_H + 13} className="tl-lane-label">イベント</text>
        {markerGroups.map(([t, ms]) => (
          <g key={t} transform={`translate(${x(t)},${RULER_H + 2})`} className="tl-event" onClick={() => ui.patchPlayback({ time: t, playing: false })}>
            <title>{`${t}秒: ${ms.map((m) => `${m.robot !== null ? robotNames[m.robot] + " " : m.team === 0 ? "赤 " : "青 "}${MARKER_LABEL[m.kind]}${m.spot !== undefined ? ` S${m.spot}` : ""}`).join(" / ")}`}</title>
            {ms.slice(0, 3).map((m, i) => (
              <rect key={i} x={-3} y={i * 5} width={6} height={4} className={`tl-ev ${m.kind} team${m.team}`} />
            ))}
          </g>
        ))}
        {analysis?.mandate.map((t, team) =>
          t === null ? null : <line key={team} x1={x(t)} x2={x(t)} y1={RULER_H} y2={height} className={`tl-mandate team${team}`}><title>{`${team ? "青" : "赤"} ムスティカ取得条件 ${t}秒`}</title></line>,
        )}
        {visibleRobots.map((r) => (
          <g key={r}>
            <rect
              x={0}
              y={laneY(r)}
              width={LEFT - 4}
              height={LANE_H - 4}
              className={`tl-lane-head${selection === `robot:${r}` ? " selected" : ""}`}
              onClick={() => ui.select(`robot:${r}`)}
            />
            <text x={8} y={laneY(r) + 17} className={`tl-lane-label ${r >> 1 ? "blue-text" : "red-text"}`} onClick={() => ui.select(`robot:${r}`)}>
              {robotNames[r]}
            </text>
          </g>
        ))}
        {analysis?.intervals.map((iv, i) => {
          if (!lanes[iv.robot]) return null;
          const wait = iv.action.kind === "wait" || iv.action.kind === "delay";
          if (wait && !showWaits) return null;
          if (iv.end < v0 || iv.start > v1) return null;
          const x0 = Math.max(LEFT, x(iv.start)),
            x1 = Math.min(LEFT + plotW, x(iv.end));
          const w = Math.max(1, x1 - x0);
          const label = KIND_SHORT[iv.action.kind] ?? iv.action.kind;
          return (
            <g
              key={i}
              data-interval={i}
              className={`tl-bar k-${iv.action.kind}${selection === `robot:${iv.robot}` ? " sel" : ""}`}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                ui.select(`robot:${iv.robot}`);
                ui.patchPlayback({ time: iv.start, playing: false });
              }}
              onDoubleClick={() => ui.patchPlayback({ range: [iv.start, iv.end], time: iv.start, playing: true, direction: 1 })}
              onContextMenu={(e) => ui.contextMenu(e, intervalMenu(iv), `${robotNames[iv.robot]} ${actionName(iv.action)}`)}
            >
              <rect x={x0} y={laneY(iv.robot) + 2} width={w} height={LANE_H - 8} rx={2} />
              {showLabels && w > 30 && (
                <text x={x0 + 4} y={laneY(iv.robot) + 17}>
                  {w > 70 && iv.action.spot !== undefined ? `${label} S${iv.action.spot}` : label}
                </text>
              )}
            </g>
          );
        })}
        {(ws?.markers ?? []).map((m) => (
          <g
            key={m.id}
            data-marker={m.id}
            className="tl-user-marker"
            transform={`translate(${x(m.t)},0)`}
            onPointerDown={(e) => {
              e.stopPropagation();
              ui.patchPlayback({ time: m.t, playing: false });
            }}
            onContextMenu={(e) => ui.contextMenu(e, markerMenu(m), m.name)}
          >
            <path d="M-5 0h10v8l-5 5-5-5z" />
            <text x={7} y={10}>{m.name}</text>
            <line y1={13} y2={height} />
          </g>
        ))}
        <g className="tl-playhead" transform={`translate(${x(time)},0)`}>
          <path d="M-5 0h10v6l-5 5-5-5z" />
          <line y1={11} y2={height} />
        </g>
      </svg>
      {hover && (
        <div className="tl-tooltip" style={{ left: Math.min(hover.x + 10, width - 220) }}>
          {hover.text}
        </div>
      )}
      {!analysis && <div className="timeline-empty">局面を選択すると、その局面までの経路の動作を表示します</div>}
    </div>
  );
}

defineEditor({ type: "timeline", title: "タイムライン", group: "解析", Component: Timeline, Header });
