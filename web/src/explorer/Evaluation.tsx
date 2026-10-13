import {
  structuralEventName,
  profileNames,
  evaluationMeaning,
  guaranteeMeaning,
} from "./labels";
import { useState } from "react";
import { Comparison } from "./Comparison";
import { Classification } from "./Classification";
import type { Search, Model } from "./types";
export function Evaluation({
  search,
  baseline,
  model,
  onNode,
}: {
  search: Search;
  baseline: Search | null;
  model: Model;
  onNode: (run: number, id: number) => void;
}) {
  const [run, setRun] = useState(0);
  const [filter, setFilter] = useState<string[] | null>(null);
  const e = search.evaluation;
  const result = e?.runs.find((r) => r.run === run) || e?.runs[0];
  const comparable =
    baseline &&
    ["scenario", "horizon", "rules", "starts", "layouts", "root"].every(
      (k) =>
        JSON.stringify(search.config[k as keyof typeof search.config]) ===
        JSON.stringify(baseline.config[k as keyof typeof baseline.config]),
    );
  if (!e || !result)
    return (
      <div className="empty">
        <h2>評価はまだ計算されていません</h2>
        <p>
          探索後に「評価を計算」を押してください。途中の探索も、発見済みの範囲として集計できます。
        </p>
      </div>
    );
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  return (
    <section className="evaluation">
      <h2>展開・作戦・構成の評価</h2>
      <p>{evaluationMeaning}</p>
      {baseline && (
        <div className="notice">
          <b>比較対象：{baseline.name}</b>
          <p>
            {comparable
              ? "初期局面・終了時刻・ルール・初期配置は一致しています。構成別の網羅状況も確認してください。"
              : "初期条件またはルールが異なります。スペック差だけによる比較として扱えません。"}
          </p>
          <table>
            <thead>
              <tr>
                <th>探索</th>
                <th>完了構成</th>
                <th>到達局面</th>
                <th>評価</th>
              </tr>
            </thead>
            <tbody>
              {[baseline, search].map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>
                    {s.completeRuns} / {s.totalRuns}
                  </td>
                  <td>{s.nodes}</td>
                  <td>{s.evaluation ? "計算済み" : "未計算"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {baseline.evaluation && (
            <details>
              <summary>比較対象の構成別結果</summary>
              <table>
                <thead>
                  <tr>
                    <th>構成</th>
                    <th>網羅</th>
                    <th>展開グループ</th>
                    <th>勝利確率の保証範囲</th>
                  </tr>
                </thead>
                <tbody>
                  {baseline.evaluation.runs.map((r) => (
                    <tr key={r.run}>
                      <td>C{r.run}</td>
                      <td>{r.statisticsComplete ? "完了" : "途中"}</td>
                      <td>{r.groups}</td>
                      <td>
                        {r.guarantee
                          ? `${pct(r.guarantee.winLower)}–${pct(r.guarantee.winUpper)}`
                          : "未確定"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      )}
      <table>
        <caption>構成別の結果 — 相手構成の出現頻度は仮定しません</caption>
        <thead>
          <tr>
            <th>構成</th>
            <th>探索</th>
            <th>展開グループ</th>
            <th>試合展開数（時刻を区別）</th>
            <th>赤の勝利確率（保証範囲）</th>
          </tr>
        </thead>
        <tbody>
          {e.runs.map((r) => (
            <tr key={r.run}>
              <td>
                <button
                  onClick={() => {
                    setRun(r.run);
                    setFilter(null);
                  }}
                  aria-pressed={r.run === result.run}
                >
                  C{r.run}
                </button>
              </td>
              <td>
                {r.statisticsComplete
                  ? "集計まで完了"
                  : r.historyLimited
                    ? "履歴集計の上限"
                    : "発見済みの範囲"}
              </td>
              <td>{r.groups}</td>
              <td>{r.paths}</td>
              <td>
                {r.guarantee
                  ? `${pct(r.guarantee.winLower)}–${pct(r.guarantee.winUpper)}`
                  : "未確定"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Comparison
        search={search}
        result={result}
        baseline={baseline}
        comparable={comparable}
      />
      <h3>C{result.run} の構成</h3>
      <div className="variant-columns">
        {result.variant.teams.map((t, i) => (
          <details key={i}>
            <summary>{i ? "青" : "赤"}チームのスペック</summary>
            <dl>
              {Object.entries(t.caps).map(([k, v]) => (
                <div key={k}>
                  <dt>{model.caps[k]}</dt>
                  <dd>
                    {typeof v === "boolean" ? (v ? "可能" : "不可") : v + "個"}
                  </dd>
                </div>
              ))}
              {Object.entries(t.speeds).map(([k, v]) => (
                <div key={k}>
                  <dt>{model.profiles[k]}</dt>
                  <dd>
                    {profileNames[v]} / {search.config.profiles[k][v]}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </div>
      {result.windowEnd < 180 && (
        <p className="notice">
          {result.windowEnd}
          秒時点での評価です。試合終了時の勝敗保証ではありません。
        </p>
      )}
      {result.guarantee && (
        <div className="guarantee">
          <h3>相手の最善応答を含む評価</h3>
          <p>
            赤の勝利確率（保証範囲）：{pct(result.guarantee.winLower)}–
            {pct(result.guarantee.winUpper)}　／　得点差の保守的下限：
            {result.guarantee.marginLower.toFixed(2)}
          </p>
          <p>
            {guaranteeMeaning}{" "}
            残る同点が審判判断になるため、勝利確率は下限・上限で表示します。
          </p>
        </div>
      )}
      <h3>
        作戦分類 <small>{e.classification}</small>
      </h3>
      <p>
        取得・受け渡し・建設・反転などの物体操作を同時刻ごとにまとめ、先頭{e.cut}
        組で固定分割。移動・リトライと物体IDの違いは分類に含めません。詳細な移動や時刻は試合展開に残ります。得点や勝敗で分類していません。
      </p>
      <Classification strategies={result.strategies} onSelect={setFilter} />
      {filter && (
        <p>
          選択中の分類：{filter.length} 作戦{" "}
          <button onClick={() => setFilter(null)}>すべて表示</button>
        </p>
      )}
      {result.strategies.length === 0 ? (
        <p className="empty">終了局面に到達する経路がまだありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>作戦ID</th>
              <th>展開グループ</th>
              <th>試合展開数</th>
              <th>赤が勝つ展開の割合（グループ等重み）</th>
              <th>赤が勝つ展開の割合（展開等重み）</th>
              <th>点差分布</th>
            </tr>
          </thead>
          <tbody>
            {result.strategies
              .filter((s) => !filter || filter.includes(s.id))
              .map((s) => (
                <tr key={s.id}>
                  <td>
                    <button onClick={() => onNode(result.run, s.node)}>
                      {s.id}
                    </button>
                    <details>
                      <summary>構造</summary>
                      <ol>
                        {s.prefix.map((group, index) => (
                          <li key={index}>
                            同時刻の動作 {index + 1}組目
                            <ul>
                              {group.map((event) => (
                                <li key={event}>
                                  {structuralEventName(event)}
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ol>
                    </details>
                  </td>
                  <td>{s.groups}</td>
                  <td>{s.paths}</td>
                  <td>
                    {pct(s.groupWinFraction)}
                    <small>未決 {pct(s.unresolvedFraction)}</small>
                  </td>
                  <td>{pct(s.pathWinFraction)}</td>
                  <td>
                    <div className="distribution">
                      {s.distribution.map(([margin, weight]) => (
                        <div key={margin}>
                          <span>
                            {margin > 0 ? "+" : ""}
                            {margin}
                          </span>
                          <meter
                            min={0}
                            max={1}
                            value={weight}
                            aria-label={`点差${margin}の割合`}
                          />
                          <span>{pct(weight)}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
