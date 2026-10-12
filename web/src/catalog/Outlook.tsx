import { effort, type Estimates } from "./effort";
import { scoreRange, type CanonicalPlan } from "./navigation";
import type { CalculationState } from "./calculation";
import type { Plan } from "../simulation/types";
import { title } from "./plans";
import { span } from "./labels";
export function Outlook({
  rows,
  estimates,
  calculation,
  enemy,
  onCalculate,
}: {
  rows: CanonicalPlan[];
  estimates: Estimates;
  calculation: CalculationState;
  enemy: Plan;
  onCalculate(): void;
}) {
  const { results, status, count, total } = calculation,
    days = rows.map((p) => effort(p, estimates)),
    scored = rows.filter((p) => results.has(p.id)).length;
  const values = rows.flatMap((p) => results.get(p.id)?.values ?? []),
    bins = Array<number>(12).fill(0),
    max = Math.max(600, Math.ceil(Math.max(...values) / 100) * 100);
  for (const value of values)
    bins[Math.min(11, Math.floor((value / max) * 12))]++;
  const peak = Math.max(...bins, 1);
  return (
    <aside id="outlook" aria-label="現在の条件での得点と工数">
      <h2>表示中の作戦の得点</h2>
      <dl className="outlook-facts">
        <div>
          <dt>必要工数</dt>
          <dd>
            {days.length
              ? span([Math.min(...days), Math.max(...days)])
              : "該当なし"}
            <small> 人日</small>
          </dd>
        </div>
        <div>
          <dt>得点範囲</dt>
          <dd>
            {span(scoreRange(rows, results))}
            <small> 点</small>
          </dd>
        </div>
      </dl>
      {!values.length ? (
        <p className="graph-empty">
          得点を計算しています。計算を止めた場合は再計算できます。
        </p>
      ) : (
        <svg
          viewBox="0 0 300 180"
          role="img"
          aria-label={`残る作戦の得点分布。${values.length}試行、${Math.min(...values)}から${Math.max(...values)}点。`}
        >
          <path d="M24 18V145H285" className="axis" />
          {bins.map((n, i) => (
            <rect
              key={i}
              x={27 + i * 21}
              y={145 - (n / peak) * 105}
              width="16"
              height={(n / peak) * 105}
              className="distribution"
            >
              <title>
                {Math.round((i * max) / 12)}〜{Math.round(((i + 1) * max) / 12)}
                点：{n}試行
              </title>
            </rect>
          ))}
          <text x="24" y="165">
            0
          </text>
          <text x="285" y="165" textAnchor="end">
            {max}点
          </text>
          <text x="24" y="12">
            試行数
          </text>
          <text x="282" y="28" textAnchor="end">
            最大 {peak}試行 / 区間
          </text>
        </svg>
      )}
      <p className="chart-context">
        相手：{title(enemy)}
        <br />
        {enemy.mission ? "奉納あり" : "奉納なし"} / 競合優先順2通り
        <br />
        表示中 {scored} / {rows.length}作戦を計算済み
      </p>
      <p role="status" className="calculation-status">
        {status === "running"
          ? `全体を計算中 ${count} / ${total}`
          : status === "complete"
            ? "計算完了"
            : status === "error"
              ? "計算できませんでした"
              : "計算を中止しました"}
      </p>
      <button id="calculate" onClick={onCalculate}>
        {status === "running" ? "計算を中止" : "再計算"}
      </button>
      <details>
        <summary>分類と計算の基準</summary>
        <p>
          441設定を行動条件の同値性で297作戦に整理。奉納・反転・土台利用の条件から、建設場所・搬送方針へ分類しています。
        </p>
        <p>
          得点分布は作戦ごとの試行数で、勝率ではありません。相手と性能は再生画面で変更できます。衝突・転倒・機構別の速度低下は未計算です。
        </p>
      </details>
    </aside>
  );
}
