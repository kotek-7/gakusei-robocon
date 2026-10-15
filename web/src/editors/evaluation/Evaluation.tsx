import { IconButton } from "../common/IconButton";
import { navigateRow } from "../candidates/rowSelection";
import { Help } from "../common/Help";
import {
  structuralEventName,
  profileNames,
  evaluationMeaning,
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
  const [mode, setMode] = useState("results");
  const [selectedStrategy, setSelectedStrategy] = useState("");
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
  const activeStrategy = strategies.find(strategy => strategy.id === selectedStrategy) ?? strategies[0];
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  return (
    <section className="evaluation">
      <div className="evaluation-modes"><label>集計 <select value={mode} onChange={event => setMode(event.target.value)}><option value="results">構成別の結果</option><option value="comparison">同条件で構成・探索を比較</option></select></label><Help topic="results" title="評価の集計" text="評価の集計は、探索で見つかった試合展開の得点や勝敗をまとめた結果です。展開グループを同じ重みで扱い、各グループ内の展開も同じ重みで集計します。" /></div>
      <div hidden={mode !== "comparison"}>
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
            <details><summary>比較対象の構成別結果</summary>
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
      </div>
      <div hidden={mode !== "results"}>
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
        <IconButton icon="download" label="表示中の構成をJSON保存"
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
        />
        {(runQuery || runFilter !== "all") && (
          <IconButton icon="reset" label="構成の絞り込みを解除"
            onClick={() => {
              setRunQuery("");
              setRunFilter("all");
            }}
          />
        )}
      </div>
      {!visibleRuns.length && (
        <p role="status">
          該当する構成はありません。絞り込みを解除すると全構成を表示できます。
        </p>
      )}
      <table role="grid" aria-label="評価する構成。上下キーで選択">
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
            <tr key={r.run} data-selectable-row aria-selected={r.run === result.run} tabIndex={r.run === result.run || !visibleRuns.some(row => row.run === result.run) && r.run === visibleRuns[0]?.run ? 0 : -1}
              onFocus={() => { if (r.run !== result.run) { setRun(r.run); setFilter(null); setSelectedStrategy(""); } }} onClick={event => event.currentTarget.focus()} onKeyDown={event => navigateRow(event)}>
              <td>C{r.run}</td>
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
      </div>
      <div hidden={mode !== "comparison"}>
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
      </div>
      <div className="evaluation-selection"><strong>構成 C{result.run}</strong></div>
      <details className="evaluation-spec"><summary>この構成の機体スペック</summary>
      <div className="variant-columns">
        {result.variant.teams.map((t, i) => (
          <div key={i}><strong>{i ? "青" : "赤"}チーム</strong>
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
          </div>
        ))}
      </div>
      </details>
      <div>
      {result.windowEnd < 180 && (
        <p className="notice">
          {result.windowEnd}
          秒時点での評価です。試合終了時の勝敗保証ではありません。
        </p>
      )}
      {result.guarantee && (
        <div className="guarantee">
          <h3>相手の最善応答を含む評価 <Help topic="results" title="相手の最善応答を含む評価" text="相手の最善応答を含む評価は、相手が最も有利な行動を選ぶ場合のモデル内の勝利確率です。審判判断で勝敗が変わる同点を含むため、下限・上限で表示します。" /></h3>
          <p>
            赤の勝利確率（保証範囲）：{pct(result.guarantee.winLower)}–
            {pct(result.guarantee.winUpper)}　／　得点差の保守的下限：
            {result.guarantee.marginLower.toFixed(2)}
          </p>
        </div>
      )}
      <Classification key={`${search.id}:${result.run}`} strategies={result.strategies} onSelect={setFilter} />
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
        <IconButton icon="download" label="表示中の作戦をJSON保存"
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
        />
        {(strategyQuery || filter || unresolvedOnly) && (
          <IconButton icon="reset" label="作戦の絞り込みを解除"
            onClick={() => {
              setStrategyQuery("");
              setFilter(null);
              setUnresolvedOnly(false);
            }}
          />
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
          <IconButton icon="reset" label="作戦分類の絞り込みを解除" onClick={() => setFilter(null)} />
        </p>
      )}
      {result.strategies.length === 0 ? (
        <p className="empty">終了局面に到達する経路がまだありません。</p>
      ) : !strategies.length ? (
        <p role="status">
          該当する作戦はありません。検索語や分類を変更してください。
        </p>
      ) : (
        <>
        <div className="strategy-results-scroll"><table role="grid" aria-label="作戦別の結果。上下キーで選択、Enterで代表局面を表示">
          <thead><tr><th>作戦ID・動作数</th><th>展開グループ</th><th>試合展開数</th><th>赤勝利・グループ等重み</th><th>赤勝利・展開等重み</th><th>点差範囲</th></tr></thead>
          <tbody>{strategies.map(strategy => <tr key={strategy.id} data-selectable-row aria-selected={activeStrategy?.id === strategy.id} tabIndex={activeStrategy?.id === strategy.id ? 0 : -1} onFocus={() => setSelectedStrategy(strategy.id)} onClick={event => event.currentTarget.focus()} onKeyDown={event => navigateRow(event, () => onNode(result.run, strategy.node))} onDoubleClick={() => onNode(result.run, strategy.node)}>
            <td><span title={strategy.id}>{strategy.id.slice(0, 14)}</span><small>{strategy.prefix.length}組 · {strategy.prefix.flat().length}動作</small></td>
            <td>{strategy.groups}</td><td>{strategy.paths}</td><td>{pct(strategy.groupWinFraction)}<small>未決 {pct(strategy.unresolvedFraction)}</small></td><td>{pct(strategy.pathWinFraction)}</td><td>{marginRange(strategy.distribution)?.join(" ～ ") ?? "未集計"}</td>
          </tr>)}</tbody>
        </table></div>
        {activeStrategy && <div className="strategy-inspection" aria-label="選択作戦の動作と点差分布">
          <header><span title={activeStrategy.id}>{activeStrategy.id.slice(0, 14)}</span><IconButton icon="ortho" label="代表局面を3Dに表示" onClick={() => onNode(result.run, activeStrategy.node)}>3D</IconButton></header>
          <div className="strategy-inspection-body">
            <ol className="strategy-sequence" aria-label="同時刻ごとの動作順序">{activeStrategy.prefix.map((group, index) => <li key={index}><span className="strategy-batch">{index + 1}</span><ul>{group.map((event, eventIndex) => <li key={eventIndex}>{structuralEventName(event)}</li>)}</ul></li>)}</ol>
            <figure className="strategy-distribution"><figcaption>発見済み展開の点差分布</figcaption><div className="distribution">{activeStrategy.distribution.map(([margin, weight]) => <div key={margin}><span>{margin > 0 ? "+" : ""}{margin}</span><meter min={0} max={1} value={weight} aria-label={`点差${margin}の割合`} /><span>{pct(weight)}</span></div>)}</div>{!activeStrategy.distribution.length && <p className="muted">未集計</p>}</figure>
          </div>
        </div>}
        </>
      )}
      </div>
    </section>
  );
}
