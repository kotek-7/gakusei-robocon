import { useState } from "react";
import { profileNames } from "./labels";
import type { CandidateEvidence, Goal, Search, Model, Variant } from "./types";

function goalLabel(g: Goal) {
  if (g.kind === "mustika") return "ムスティカ設置";
  if (g.kind === "deliver") return "受け渡し";
  return `${g.kind === "flip" ? "反転" : "建設"} ${g.spot}${g.height === 2 ? "（アース2段）" : ""}${g.at !== undefined ? `（${g.at}秒開始）` : ""}`;
}
const margin = (x: CandidateEvidence) => x.scores[0] - x.scores[1];
const score = (x: CandidateEvidence) => `${x.scores[0]} 対 ${x.scores[1]}`;

export function Candidates({
  search,
  model,
  onOpen,
}: {
  search: Search;
  model: Model;
  onOpen: (run: number, evidence: CandidateEvidence) => void;
}) {
  const [run, setRun] = useState("all");
  const [kind, setKind] = useState("policy");
  const report = search.discovery;
  const selectedRun = report?.runs.find((r) => String(r.run) === run);
  function configuration(v: Variant) {
    return v.teams
      .flatMap((team, t) => [
        ...Object.entries(team.caps)
          .filter(([k]) => search.config.teams[t].caps[k].length > 1)
          .map(
            ([k, value]) =>
              `${t ? "青" : "赤"} ${model.caps[k]}：${typeof value === "boolean" ? (value ? "可能" : "不可") : value}`,
          ),
        ...Object.entries(team.speeds)
          .filter(([k]) => search.config.teams[t].speeds[k].length > 1)
          .map(
            ([k, value]) =>
              `${t ? "青" : "赤"} ${model.profiles[k]}：${profileNames[value]}`,
          ),
      ])
      .join(" ／ ");
  }
  const rows =
    report?.runs.flatMap((r) =>
      r.candidates.map((c) => ({
        run: r.run,
        common: c.policy
          ? (r.policyCommonOpponents || []).filter((id) =>
              c.comparedOpponents?.includes(id),
            )
          : r.commonOpponents,
        opponents: r.policyOpponents || {},
        candidate: c,
      })),
    ) || [];
  return (
    <section className="evaluation candidates">
      <h2>発見した作戦候補</h2>
      {!report || !rows.length ? (
        <div className="empty">
          <h3>
            {search.status === "running"
              ? "最初の候補を計算しています"
              : "候補はまだありません"}
          </h3>
          <p>
            「候補を探す」で開始します。短い計算時間で候補が出なかった場合は、時間を増やして続けられます。
          </p>
        </div>
      ) : (
        <>
          <div className="candidate-controls">
            <label>
              候補の種類{" "}
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="policy">条件付き作戦</option>
                <option value="procedure">行動探索の手順</option>
                <option value="all">すべて</option>
              </select>
            </label>
            <label>
              表示する構成{" "}
              <select value={run} onChange={(e) => setRun(e.target.value)}>
                <option value="all">すべて</option>
                {report.runs.map((r) => (
                  <option key={r.run} value={r.run}>
                    C{r.run} · {r.candidates.length}候補{" "}
                    {configuration(r.variant)}
                  </option>
                ))}
              </select>
            </label>
            <span>
              {
                rows.filter(
                  (r) =>
                    (run === "all" || String(r.run) === run) &&
                    (kind === "all" ||
                      Boolean(r.candidate.policy) === (kind === "policy")),
                ).length
              }
              候補
            </span>
          </div>
          {selectedRun && <p>{configuration(selectedRun.variant)}</p>}
          <p className="candidate-caveat">
            条件付き作戦は10系統・順序違いを含む13案の仮説です。相手5種類との比較を優先し、行動探索で別の手順や対抗手も探します。最小点差は確認した相手と裁定分岐の範囲での値で、勝率や全対応への保証ではありません。行動探索・対抗手からも最大8案の条件付き作戦を追加し、別途比較します。必要機構は設計上の目安で、実機の通信制約・成功率・製作工数は未評価です。
          </p>
          {report.runs
            .filter((r) => run === "all" || String(r.run) === run)
            .map((r) => (
              <p key={r.run}>
                C{r.run}：共通相手 {r.policyCommonOpponents?.length || 0} /{" "}
                {Object.keys(r.policyOpponents || {}).length} 種類の比較完了
                {r.policyComparisonComplete
                  ? "（13案の比較一巡済み）"
                  : "（未比較あり）"}
              </p>
            ))}
          <details>
            <summary>探索範囲と残りの分岐</summary>
            <p>{report.scope}</p>
          </details>
          <div
            className="candidate-table"
            tabIndex={0}
            role="region"
            aria-label="作戦候補の比較表"
          >
            <table>
              <thead>
                <tr>
                  <th>構成・作戦ID</th>
                  <th>作戦・切替条件・必要機構</th>
                  <th>
                    相手待機
                    <br />赤 対 青
                  </th>
                  <th>相手の対応</th>
                  <th>共通の相手での最小点差</th>
                  <th>計算した展開</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => run === "all" || String(r.run) === run)
                  .filter(
                    (r) =>
                      kind === "all" ||
                      Boolean(r.candidate.policy) === (kind === "policy"),
                  )
                  .map(({ run: r, common, opponents, candidate: c }) => {
                    const comparable = c.responses.filter(
                      (x) =>
                        x.shared && x.opponent && common.includes(x.opponent),
                    );
                    const worst = comparable.length
                      ? Math.min(...comparable.map(margin))
                      : null;
                    return (
                      <tr key={`${r}/${c.id}`}>
                        <td>
                          C{r}
                          <br />
                          <span title={c.baseline.strategy}>
                            {c.baseline.strategy.slice(0, 14)}
                          </span>
                        </td>
                        <td>
                          {c.policy ? (
                            <>
                              <strong>{c.policy.name}</strong>
                              {c.policy.derivedFrom && (
                                <small>
                                  仮説の出所：{c.policy.derivedFrom}
                                </small>
                              )}
                              <details>
                                <summary>成立条件と実行結果</summary>
                                <ul>
                                  {c.policy.conditions.map((x) => (
                                    <li key={x}>{x}</li>
                                  ))}
                                </ul>
                                <p>
                                  必要機構：{c.policy.requirements.join("、")}
                                </p>
                                <p>
                                  相手待機時：
                                  {c.plan.map(goalLabel).join(" → ") ||
                                    "建設・反転なし"}
                                </p>
                              </details>
                            </>
                          ) : (
                            c.plan.map(goalLabel).join(" → ") ||
                            "建設・反転なし"
                          )}
                          <br />
                          <small title={c.id}>展開 {c.id.slice(0, 14)}</small>
                        </td>
                        <td>{score(c.baseline)}</td>
                        <td>
                          {c.responses.length}展開確認
                          <small className="candidate-secondary">
                            共通 {common.length}手順 · 未比較 {c.pending}手順
                          </small>
                        </td>
                        <td>
                          {worst === null
                            ? "共通比較待ち"
                            : `${worst > 0 ? "+" : ""}${worst}点`}
                        </td>
                        <td>
                          <details>
                            <summary>得点と経路</summary>
                            <p>相手待機：{score(c.baseline)}</p>
                            <button onClick={() => onOpen(r, c.baseline)}>
                              相手待機の経路を開く
                            </button>
                            {c.responses.map((response, i) => (
                              <div className="candidate-response" key={i}>
                                <p>
                                  相手{" "}
                                  <span title={response.opponent}>
                                    {opponents[response.opponent || ""] ||
                                      response.opponent?.slice(0, 14)}
                                  </span>
                                  （
                                  {response.shared
                                    ? "共通相手との比較"
                                    : "この候補への対抗手探索"}
                                  ）
                                  <br />
                                  {score(response)}
                                  {!!response.blocked?.length && (
                                    <>
                                      <br />
                                      手順の実行条件が成立しない局面あり（
                                      {response.blocked.length}
                                      件）。経路で確認できます。
                                    </>
                                  )}
                                </p>
                                <button onClick={() => onOpen(r, response)}>
                                  対応{i + 1}の経路を開く
                                </button>
                              </div>
                            ))}
                          </details>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
