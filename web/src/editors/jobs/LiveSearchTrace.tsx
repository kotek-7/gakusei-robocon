import { useEffect, useId, useRef, useState } from "react";
import { useJobActivity } from "../../app/jobActivity";
import type { JobActivity } from "../../engine/types";
import { Help } from "../common/Help";
import { Icon } from "../../shell/icons";
import { TRACE_HEIGHT, TRACE_WIDTH, tracePoint, traceTime } from "./liveTraceLayout";
import "./live-search-trace.css";

const modes = { baseline: "候補の生成", counter: "相手展開の探索", compare: "共通相手との照合" };
const stages = [
  { id: "loading", label: "読込" },
  { id: "histories", label: "展開集計" },
  { id: "statistics", label: "作戦集計" },
  { id: "guarantees", label: "保証値" },
  { id: "saving", label: "保存" },
];

function EvaluationTrace({ activity }: { activity: JobActivity }) {
  const evaluation = activity.evaluation;
  const current = activity.phase === "saving" ? "saving" : evaluation?.phase;
  return <div className="search-trace-pipeline" aria-label="評価の処理工程">
    {stages.map(stage => <span key={stage.id} data-current={current === stage.id} aria-current={current === stage.id ? "step" : undefined}>
      <i aria-hidden="true" />{stage.label}
    </span>)}
  </div>;
}

export function LiveSearchTrace({ searchId, horizon, startTime = 0 }: { searchId: string; horizon: number; startTime?: number }) {
  const activity = useJobActivity(searchId);
  const descriptionId = useId();
  const container = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(TRACE_WIDTH);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(entries => {
      const next = Math.max(160, Math.round(entries[0].contentRect.width));
      setWidth(previous => previous === next ? previous : next);
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [!!activity]);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    setWaiting(false);
    if (!activity || activity.phase === "finished") return;
    const timer = setTimeout(() => setWaiting(true), 1500);
    return () => clearTimeout(timer);
  }, [searchId, activity?.sequence, activity?.phase]);
  if (!activity) return null;
  const evaluation = activity.kind === "evaluation";
  const current = activity.nodes.find(node => node.id === activity.current);
  const points = new Map(activity.nodes.map(node => [node.id, tracePoint(node, startTime, horizon, width)]));
  const stage = activity.phase === "starting" ? "準備中" : activity.phase === "saving" ? "保存中" : activity.phase === "finished" ? evaluation && activity.evaluation?.state === "complete" ? "評価完了" : "最終記録" : evaluation ? "評価中" : activity.mode ? modes[activity.mode] : "行動組の展開";
  const unit = activity.kind === "discovery" ? "展開" : "組";
  const graphDescription = `${activity.nodes.length}局面と${activity.edges.length}遷移の直近の記録。横軸は試合時刻。${current ? `処理局面は C${current.run}、局面 ${current.node}、${traceTime(current.time)}秒。` : ""}`;
  return <section ref={container} className="search-trace" data-phase={activity.phase} aria-label="計算の動き">
    <header className="search-trace-header">
      <span><Icon name={evaluation ? "chart" : "branch"} size={14} />{evaluation ? "処理工程" : "直近の探索"}</span>
      <Help topic="search" title="計算の動き" text={evaluation
        ? "実際に処理している工程を示します。構成ごとに集計を繰り返します。中断時は最後の工程を残します。"
        : "実際に処理した直近の局面と遷移を表示します。全体の探索グラフではありません。横軸は試合時刻、上下位置は局面の区別用です。枠付きの点が処理局面です。停止すると最後の記録を残します。"} />
      <span className="search-trace-stage">{activity.run != null && <b>C{activity.run}</b>}{stage}{waiting && <span className="search-trace-wait" title="1.5秒以上、新しい処理記録を受信していません">更新待ち</span>}</span>
    </header>
    {evaluation ? <EvaluationTrace activity={activity} /> : <>
      <svg className="search-trace-graph" viewBox={`0 0 ${width} ${TRACE_HEIGHT}`} role="img" aria-labelledby={descriptionId}>
        <title id={descriptionId}>{graphDescription}</title>
        {(width < 360 ? [0, .5, 1] : [0, .25, .5, .75, 1]).map(fraction => {
          const x = 20 + fraction * (width - 40);
          return <g key={fraction} className="search-trace-grid"><line x1={x} x2={x} y1={8} y2={136} /><text x={x} y={155} textAnchor={fraction === 0 ? "start" : fraction === 1 ? "end" : "middle"}>{traceTime(startTime + fraction * (horizon - startTime))}s</text></g>;
        })}
        {activity.edges.map(edge => {
          const src = points.get(edge.src), dst = points.get(edge.dst);
          if (!src || !dst) return null;
          return <path key={`${edge.src}:${edge.dst}`} className="search-trace-edge" data-current={edge.src === activity.current} d={`M ${src.x} ${src.y} C ${(src.x + dst.x) / 2} ${src.y}, ${(src.x + dst.x) / 2} ${dst.y}, ${dst.x} ${dst.y}`} />;
        })}
        {activity.nodes.map(node => {
          const point = points.get(node.id)!;
          return <g key={node.id} className="search-trace-node" data-current={node.id === activity.current}>
            <title>{`C${node.run} · 局面 ${node.node} · ${traceTime(node.time)}秒`}</title>
            {node.id === activity.current && <rect x={point.x - 7} y={point.y - 7} width={14} height={14} rx={2} />}
            <circle cx={point.x} cy={point.y} r={node.id === activity.current ? 4 : 3} />
          </g>;
        })}
        {!activity.nodes.length && <text className="search-trace-empty" x={width / 2} y={74} textAnchor="middle">{activity.phase === "starting" ? "探索の開始待ち" : "局面の記録待ち"}</text>}
      </svg>
      <div className="search-trace-readout">
        <span className="search-trace-current">{current ? <>局面 <b>{current.node}</b><span>{traceTime(current.time)}秒</span></> : "処理局面なし"}</span>
        {activity.phase === "computing" && !waiting && <span title="直近の処理区間で測定した速度"><b>{Math.round(activity.unitsPerSecond).toLocaleString()}</b> {unit}/秒</span>}
        <span title="今回処理した総数"><b>{activity.unitsDone.toLocaleString()}</b> {unit}</span>
      </div>
    </>}
  </section>;
}
