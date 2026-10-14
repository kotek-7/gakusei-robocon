import type { Study } from "./state";
import type { Match } from "./match";
import { matchKey } from "./persistence";
const names: Record<string, string> = {
  safe: "自陣確保",
  earth: "アース先行",
  mustika: "ムスティカ",
  thief: "反転主体",
  sky: "スカイ先行",
};
export function Comparison({
  study,
  results,
  selected,
  opponent,
  priority,
  onPriority,
  onSelect,
}: {
  study: Study;
  results: Record<string, Match>;
  selected: string;
  opponent: string;
  priority: "red" | "blue";
  onPriority: (p: "red" | "blue") => void;
  onSelect: (p: string, o: string) => void;
}) {
  return (
    <section className="comparison" aria-label="作戦の得点差">
      <div className="comparison-tools">
        <p>
          得点差 <span className="muted">自分 − 相手</span>
        </p>
        <label>
          競合時の優先側{" "}
          <select
            value={priority}
            onChange={(e) => onPriority(e.target.value as "red" | "blue")}
          >
            <option value="red">自分（赤）</option>
            <option value="blue">相手（青）</option>
          </select>
        </label>
      </div>
      <p className="mobile-hint">横にスクロールして他の相手を見る</p>
      <div
        className="table-scroll"
        tabIndex={0}
        aria-label="作戦比較表。横にスクロールできます"
      >
        <table className="comparison-table">
          <caption>
            相手の作戦ごとの得点差。数値を選ぶと試合を表示します。
          </caption>
          <thead>
            <tr>
              <th scope="col">自分の作戦</th>
              {study.opponents.map((o) => (
                <th scope="col" key={o.id} title={o.name}>
                  {names[o.id] || o.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {study.policies.map((p) => (
              <tr
                key={p.id}
                className={selected === p.id ? "selected-row" : ""}
              >
                <th scope="row">
                  <button onClick={() => onSelect(p.id, opponent)}>
                    {p.name}
                  </button>
                </th>
                {study.opponents.map((o) => {
                  const m = results[matchKey(p.id, o.id, priority)],
                    delta = m ? m.scores[0] - m.scores[1] : null;
                  return (
                    <td key={o.id}>
                      {m ? (
                        <button
                          className="score-cell"
                          aria-pressed={selected === p.id && opponent === o.id}
                          aria-label={`${p.name} 対 ${o.name}・得点差 ${delta}`}
                          onClick={() => onSelect(p.id, o.id)}
                        >
                          {delta! > 0 ? "+" : ""}
                          {delta}
                        </button>
                      ) : (
                        <span className="uncomputed" aria-label="未計算">
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-note">
        正の値は自分がリード。未計算は「—」。優先側を切り替えて競合の影響を確認できます。
      </p>
      <details className="comparison-notes">
        <summary>比較条件について</summary>
        <p>
          全作戦を同じ機体条件・同じ相手と対戦させます。相手は建設目標を自陣側に置き換えて実行します。赤優先・青優先の2試合は、全展開の上下限や実大会の勝率を保証しません。
        </p>
      </details>
    </section>
  );
}
