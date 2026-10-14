import { useEffect, useMemo, useRef, useState } from "react";
import { layout } from "../../app/layout";
import { useAnalysis, useSearch } from "../../app/session";
import { ui, useUI } from "../../app/store";
import type { MatchAnalysis, ScoreParts } from "../../engine/analysis";
import { Empty } from "../common/Empty";
import { defineEditor, type EditorProps } from "../registry";

const PARTS: [keyof ScoreParts, string][] = [
  ["transfer", "搬送"],
  ["earthL1", "アース L1"],
  ["earthL2", "アース L2"],
  ["skyL1", "スカイ L1"],
  ["skyL2", "スカイ L2"],
  ["mustika", "ムスティカ"],
];
export function sampleAt(a: MatchAnalysis, t: number) {
  let s = a.samples[0];
  for (const x of a.samples) if (x.t <= t + 1e-9) s = x;
  return s;
}

function Header({ area }: EditorProps) {
  const mode = (area.state?.mode as string) ?? "both";
  return (
    <div className="area-tools segmented" role="group" aria-label="グラフの種類">
      {[
        ["both", "両チーム"],
        ["margin", "点差"],
        ["stack", "内訳"],
      ].map(([v, l]) => (
        <button key={v} className="tool" aria-pressed={mode === v} onClick={() => layout.setAreaState(area.id, { mode: v })}>
          {l}
        </button>
      ))}
      <button
        className="tool"
        title="得点推移をCSVでコピー"
        onClick={() => {
          const el = document.querySelector<HTMLElement>(`[data-score-csv="${area.id}"]`);
          if (el?.dataset.csv) navigator.clipboard.writeText(el.dataset.csv).then(() => ui.toast("CSVをコピーしました"));
        }}
      >
        CSV
      </button>
    </div>
  );
}

function Chart({ a, mode, horizon }: { a: MatchAnalysis; mode: string; horizon: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(400);
  const time = useUI((s) => s.playback.time);
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const h = 150,
    L = 36,
    R = 8,
    T = 8,
    B = 18;
  const pw = Math.max(50, w - L - R),
    ph = h - T - B;
  const x = (t: number) => L + (t / horizon) * pw;
  const series = useMemo(() => {
    const totals = a.samples.map((s) => [s.t, s.parts[0].total, s.parts[1].total] as const);
    return totals;
  }, [a]);
  const max = Math.max(10, ...series.flatMap((s) => [s[1], s[2]]));
  const maxM = Math.max(10, ...series.map((s) => Math.abs(s[1] - s[2])));
  const lo = mode === "margin" ? -maxM : 0,
    hi = mode === "margin" ? maxM : max;
  const y = (v: number) => T + ph - ((v - lo) / (hi - lo)) * ph;
  const step = (vals: number[]) => {
    let d = "";
    series.forEach((s, i) => {
      const yy = y(vals[i]);
      d += i ? `H${x(s[0])}V${yy}` : `M${x(s[0])},${yy}`;
    });
    return d + `H${x(a.end)}`;
  };
  const stack = mode === "stack";
  const stepPoints = (vals: number[]) => {
    const pts: [number, number][] = [];
    series.forEach((smp, i) => {
      if (i) pts.push([x(smp[0]), y(vals[i - 1])]);
      pts.push([x(smp[0]), y(vals[i])]);
    });
    pts.push([x(a.end), y(vals.at(-1) ?? 0)]);
    return pts;
  };
  return (
    <div ref={ref} className="score-chart">
      <svg
        width={w}
        height={h}
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          ui.patchPlayback({ time: Math.max(0, Math.min(horizon, ((e.clientX - r.left - L) / pw) * horizon)), playing: false });
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          const r = e.currentTarget.getBoundingClientRect();
          ui.patchPlayback({ time: Math.max(0, Math.min(horizon, ((e.clientX - r.left - L) / pw) * horizon)) });
        }}
      >
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <g key={v}>
            <line x1={L} x2={L + pw} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={L - 4} y={y(v) + 4} className="chart-axis" textAnchor="end">
              {Math.round(v)}
            </text>
          </g>
        ))}
        {[0, 60, 120, 180].filter((t) => t <= horizon).map((t) => (
          <text key={t} x={x(t)} y={h - 4} className="chart-axis" textAnchor="middle">
            {t}
          </text>
        ))}
        {stack ? (
          [0, 1].map((team) => {
            let base = series.map(() => 0);
            return PARTS.map(([k], pi) => {
              const top = a.samples.map((smp, i) => base[i] + smp.parts[team][k]);
              const lower = base;
              base = top;
              if (top.every((v, i) => v === lower[i])) return null;
              const pts = [...stepPoints(top), ...stepPoints(lower).reverse()];
              return (
                <polygon
                  key={`${team}${k}`}
                  points={pts.map((p) => p.join(",")).join(" ")}
                  className={`chart-part p${pi} team${team}`}
                />
              );
            });
          })
        ) : mode === "margin" ? (
          <>
            <line x1={L} x2={L + pw} y1={y(0)} y2={y(0)} className="chart-zero" />
            <path d={step(series.map((s) => s[1] - s[2]))} className="chart-line margin" />
          </>
        ) : (
          <>
            <path d={step(series.map((s) => s[1]))} className="chart-line red" />
            <path d={step(series.map((s) => s[2]))} className="chart-line blue" />
          </>
        )}
        {a.mandate.map((t, team) => (t === null ? null : <line key={team} x1={x(t)} x2={x(t)} y1={T} y2={T + ph} className={`chart-mandate team${team}`} />))}
        <line x1={x(time)} x2={x(time)} y1={T} y2={T + ph} className="chart-playhead" />
      </svg>
    </div>
  );
}

function ScoreEditor({ area }: EditorProps) {
  const analysis = useAnalysis().data;
  const search = useSearch();
  const time = useUI((s) => s.playback.time);
  const mode = (area.state?.mode as string) ?? "both";
  if (!search) return <Empty title="探索がありません" />;
  if (!analysis) return <Empty title="局面を選択すると得点の推移を表示します" />;
  const now = sampleAt(analysis, time),
    last = analysis.samples.at(-1)!;
  const csv = ["秒,赤,青,点差", ...analysis.samples.map((s) => `${s.t},${s.parts[0].total},${s.parts[1].total},${s.parts[0].total - s.parts[1].total}`)].join("\n");
  return (
    <div className="editor-scroll score-editor" data-score-csv={area.id} data-csv={csv}>
      <Chart a={analysis} mode={mode} horizon={search.config.horizon} />
      <table className="score-table">
        <thead>
          <tr>
            <th>{time.toFixed(1)}秒時点</th>
            <th className="red-text">赤</th>
            <th className="blue-text">青</th>
            <th>経路末尾 {analysis.end}秒（赤 / 青）</th>
          </tr>
        </thead>
        <tbody>
          {PARTS.map(([k, label]) => (
            <tr key={k}>
              <th>{label}</th>
              <td className="tabular">{now.parts[0][k] || ""}</td>
              <td className="tabular">{now.parts[1][k] || ""}</td>
              <td className="tabular muted">
                {last.parts[0][k] || last.parts[1][k] ? `${last.parts[0][k]} / ${last.parts[1][k]}` : ""}
              </td>
            </tr>
          ))}
          <tr className="total">
            <th>合計</th>
            <td className="tabular red-text">{now.parts[0].total}</td>
            <td className="tabular blue-text">{now.parts[1].total}</td>
            <td className="tabular">
              {last.parts[0].total} / {last.parts[1].total}
            </td>
          </tr>
          <tr>
            <th>点差（赤−青）</th>
            <td className="tabular" colSpan={2}>
              {now.parts[0].total - now.parts[1].total}
            </td>
            <td className="tabular muted">{last.parts[0].total - last.parts[1].total}</td>
          </tr>
          <tr>
            <th>ムスティカ取得条件</th>
            <td className="tabular">{analysis.mandate[0] !== null && analysis.mandate[0] <= time ? `${analysis.mandate[0]}秒に成立` : "未成立"}</td>
            <td className="tabular">{analysis.mandate[1] !== null && analysis.mandate[1] <= time ? `${analysis.mandate[1]}秒に成立` : "未成立"}</td>
            <td>{analysis.mandate.map((t) => t === null ? "未成立" : `${t}秒`).join(" / ")}</td>
          </tr>
        </tbody>
      </table>
      <details className="muted small"><summary>集計条件</summary>持ち上げた物体は、その時点で塔から外れた扱いになります。</details>
    </div>
  );
}

defineEditor({ type: "score", title: "得点", group: "解析", Component: ScoreEditor, Header });
