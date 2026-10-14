import { DetailView } from "../common/DetailView";
import { Help } from "../common/Help";
import {
  structuralEventName,
  profileNames,
  evaluationMeaning,
  guaranteeMeaning,
} from "../common/labels";
import { useState } from "react";
import { saveJSON } from "../../app/coreCommands";
import {
  marginRange,
  selectRuns,
  selectStrategies,
  type RunFilter,
  type RunSort,
  type StrategySort,
} from "./selectors";
import "./evaluation.css";
import { ConditionComparison } from "./ConditionComparison";
import { configDifferences } from "../common/configDifferences";
import { Comparison } from "./Comparison";
import { Classification } from "./Classification";
import type { Search, Model } from "../../engine/types";
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
  const [runQuery, setRunQuery] = useState("");
  const [runFilter, setRunFilter] = useState<RunFilter>("all");
  const [runSort, setRunSort] = useState<RunSort>("id");
  const [strategyQuery, setStrategyQuery] = useState("");
  const [strategySort, setStrategySort] = useState<StrategySort>("id");
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);
  const e = search.evaluation;
  const result = e?.runs.find((r) => r.run === run) || e?.runs[0];
  const comparable = baseline && !configDifferences(baseline.config, search.config, model).some((d) => d.context);
  if (!e || !result)
    return (
      <div className="empty">
        <h2>評価はまだ計算されていません</h2>
        <p>
          探索後に「評価を計算」を押してください。途中の探索も、発見済みの範囲として集計できます。
        </p>
      </div>
    );
  const visibleRuns = selectRuns(e.runs, runQuery, runFilter, runSort);
  const strategies = selectStrategies(
    result.strategies,
    strategyQuery,
    filter,
    strategySort,
    unresolvedOnly,
  );
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  return (
    <section className="evaluation">
      <h2>展開・作戦・構成の評価 <Help topic="results" text={evaluationMeaning} /></h2>
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
          <ConditionComparison before={baseline.config} after={search.config} model={model} />
          {baseline.evaluation && (
            <DetailView label="比較対象の構成別結果" title={`${baseline.name} の構成別結果`}>
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
            </DetailView>
          )}
        </div>
      )}
      <div className="evaluation-tools" aria-label="構成の絞り込み">
        <input
          type="search"
          aria-label="構成IDを検索"
          placeholder="構成IDを検索"
          value={runQuery}
          onChange={(event) => setRunQuery(event.target.value)}
        />
        <label>
          対象{" "}
          <select
            value={runFilter}
            onChange={(event) => setRunFilter(event.target.value as RunFilter)}
          >
            <option value="all">すべて</option>
            <option value="pending">集計未完了</option>
            <option value="limited">履歴集計の上限</option>
            <option value="guaranteed">保証範囲あり</option>
          </select>
        </label>
        <label>
          並び順{" "}
          <select
            value={runSort}
            onChange={(event) => setRunSort(event.target.value as RunSort)}
          >
            <option value="id">構成ID</option>
            <option value="groups">展開グループが多い順</option>
            <option value="guarantee">勝利確率の保証下限が高い順</option>
          </select>
        </label>
        <span role="status">
          {visibleRuns.length} / {e.runs.length} 構成
        </span>
        <button
          disabled={!visibleRuns.length}
          onClick={() =>
            saveJSON(
              {
                search: search.name,
                config: search.config,
                classification: e.classification,
                meaning: e.meaning,
                cut: e.cut,
                filters: { query: runQuery, filter: runFilter, sort: runSort },
                runs: visibleRuns,
              },
              "evaluation-runs.json",
            )
          }
        >
          表示構成を書き出す
        </button>
        {(runQuery || runFilter !== "all") && (
          <button
            onClick={() => {
              setRunQuery("");
              setRunFilter("all");
            }}
          >
            絞り込みを解除
          </button>
        )}
      </div>
      {!visibleRuns.length && (
        <p role="status">
          該当する構成はありません。絞り込みを解除すると全構成を表示できます。
        </p>
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
          {visibleRuns.map((r) => (
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
        onSelect={(run) => {
          setRun(run);
          setFilter(null);
        }}
      />
      <h3>C{result.run} の構成</h3>
      <div className="variant-columns">
        {result.variant.teams.map((t, i) => (
          <DetailView key={i} label={`${i ? "青" : "赤"}チームのスペック`} title={`C${result.run} · ${i ? "青" : "赤"}チームのスペック`}>
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
          </DetailView>
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
          <h3>相手の最善応答を含む評価 <Help topic="results" text={`${guaranteeMeaning} 残る同点が審判判断になるため、勝利確率は下限・上限で表示します。`} /></h3>
          <p>
            赤の勝利確率（保証範囲）：{pct(result.guarantee.winLower)}–
            {pct(result.guarantee.winUpper)}　／　得点差の保守的下限：
            {result.guarantee.marginLower.toFixed(2)}
          </p>
        </div>
      )}
      <h3>
        作戦分類 <small>{e.classification}</small>
        <Help topic="results" text="試合全体の設置・反転・持ち直しの完了順序で分類します。移動・リトライと物体IDの違いは分類に含めません。詳細な移動や時刻は試合展開に残ります。得点や勝敗で分類していません。" />
      </h3>
      <Classification strategies={result.strategies} onSelect={setFilter} />
      <div className="evaluation-tools" aria-label="作戦の絞り込み">
        <input
          type="search"
          aria-label="作戦ID・動作を検索"
          placeholder="作戦ID・動作を検索"
          value={strategyQuery}
          onChange={(event) => setStrategyQuery(event.target.value)}
        />
        <label>
          並び順{" "}
          <select
            value={strategySort}
            onChange={(event) =>
              setStrategySort(event.target.value as StrategySort)
            }
          >
            <option value="id">作戦ID</option>
            <option value="groups">展開グループが多い順</option>
            <option value="paths">試合展開数が多い順</option>
            <option value="minimum">発見済みの最小点差が高い順</option>
            <option value="unresolved">未決割合が高い順</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={unresolvedOnly}
            onChange={(event) => setUnresolvedOnly(event.target.checked)}
          />
          未決の展開あり
        </label>
        <span role="status">
          {strategies.length} / {result.strategies.length} 作戦
        </span>
        <button
          disabled={!strategies.length}
          onClick={() =>
            saveJSON(
              {
                search: search.name,
                config: search.config,
                classification: e.classification,
                run: result.run,
                windowEnd: result.windowEnd,
                statisticsComplete: result.statisticsComplete,
                historyLimited: result.historyLimited,
                meaning: evaluationMeaning,
                filters: {
                  query: strategyQuery,
                  classificationIds: filter,
                  sort: strategySort,
                  unresolvedOnly,
                },
                strategies,
              },
              `evaluation-C${result.run}-strategies.json`,
            )
          }
        >
          表示作戦を書き出す
        </button>
        {(strategyQuery || filter || unresolvedOnly) && (
          <button
            onClick={() => {
              setStrategyQuery("");
              setFilter(null);
              setUnresolvedOnly(false);
            }}
          >
            作戦の絞り込みを解除
          </button>
        )}
      </div>
      {strategySort === "minimum" && (
        <p>
          点差は発見済みの展開内の範囲です。相手の最善応答に対する保証値ではありません。
        </p>
      )}
      {filter && (
        <p>
          選択中の分類：{filter.length} 作戦{" "}
          <button onClick={() => setFilter(null)}>すべて表示</button>
        </p>
      )}
      {result.strategies.length === 0 ? (
        <p className="empty">終了局面に到達する経路がまだありません。</p>
      ) : !strategies.length ? (
        <p role="status">
          該当する作戦はありません。検索語や分類を変更してください。
        </p>
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
            {strategies.map((s) => (
              <tr key={s.id}>
                <td>
                  <button
                    title={s.id}
                    aria-label={`${s.id}の代表局面を開く`}
                    onClick={() => onNode(result.run, s.node)}
                  >
                    {s.id.slice(0, 14)}
                  </button>
                  <DetailView label={`構造 · ${s.prefix.length}組 / ${s.prefix.flat().length}動作`} title={`${s.id.slice(0, 14)} の動作構造`}>
                    <ol>
                      {s.prefix.map((group, index) => (
                        <li key={index}>
                          同時刻の動作 {index + 1}組目
                          <ul>
                            {group.map((event) => (
                              <li key={event}>{structuralEventName(event)}</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ol>
                  </DetailView>
                </td>
                <td>{s.groups}</td>
                <td>{s.paths}</td>
                <td>
                  {pct(s.groupWinFraction)}
                  <small>未決 {pct(s.unresolvedFraction)}</small>
                </td>
                <td>{pct(s.pathWinFraction)}</td>
                <td>
                  <small>
                    {marginRange(s.distribution)?.join(" ～ ") ?? "未集計"}
                  </small>
                  <DetailView label="点差ごとの割合" title={`${s.id.slice(0, 14)} の点差分布`}>
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
                  </DetailView>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
