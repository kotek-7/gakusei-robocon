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
        common: r.commonOpponents,
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
              {rows.filter((r) => run === "all" || String(r.run) === run).length}候補
            </span>
          </div>
          {selectedRun && <p>{configuration(selectedRun.variant)}</p>}
          <p className="candidate-caveat">点差は確認済みの相手手順での結果です。全対応への保証ではありません。</p>
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
                  <th>完了した建設・反転の順序</th>
                  <th>
                    相手待機
                    <br />赤 対 青
                  </th>
                  <th>相手の対応</th>
                  <th>共通の相手手順での最小点差</th>
                  <th>計算した展開</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => run === "all" || String(r.run) === run)
                  .map(({ run: r, common, candidate: c }) => {
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
                          {c.baseline.strategy}
                        </td>
                        <td>
                          {c.plan.map(goalLabel).join(" → ") ||
                            "建設・反転なし"}
                          <br />
                          <small>展開 {c.id}</small>
                        </td>
                        <td>{score(c.baseline)}</td>
                        <td>
                          {c.responses.length}展開確認
                          <small className="candidate-secondary">共通 {common.length}手順 · 未比較 {c.pending}手順</small>
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
                                  相手手順 {response.opponent}（
                                  {response.shared
                                    ? "共有手順での検査"
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
                                      <details className="candidate-scope">
            <summary>探索範囲・未計算の分岐</summary>
            <p>{report.scope}</p>
          <p>
            未探索の局面{" "}
            {report.runs
              .filter((r) => run === "all" || String(r.run) === run)
              .reduce((n, r) => n + r.frontier, 0)
              .toLocaleString()}
            件。 生成済みの選択肢のうち未計算{" "}
            {report.runs
              .filter((r) => run === "all" || String(r.run) === run)
              .reduce((n, r) => n + r.remainingChoices, 0)
              .toLocaleString()}
            組。 局面の展開で選択肢は増えます。
          </p>
          </details>
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
