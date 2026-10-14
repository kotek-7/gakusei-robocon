import { useState } from "react";
import { run as command } from "../../app/commands";
import "./commands";
import { profileNames } from "../common/labels";
import type { CandidateEvidence, Goal, Search, Model, Variant } from "../../engine/types";

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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("discovery");
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
  const visibleRows = rows
    .filter(({ run: r, candidate: c }) =>
      (run === "all" || String(r) === run) &&
      `C${r} ${c.id} ${c.baseline.strategy} ${c.plan.map(goalLabel).join(" ")}`
        .toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    )
    .map((row) => {
      const comparable = row.candidate.responses.filter(
        (x) => x.shared && x.opponent && row.common.includes(x.opponent),
      );
      const worst = comparable.reduce<CandidateEvidence | null>(
        (lowest, x) => !lowest || margin(x) < margin(lowest) ? x : lowest, null,
      );
      return { ...row, worst };
    })
    .sort((a, b) => {
      if (sort === "baseline") return margin(b.candidate.baseline) - margin(a.candidate.baseline);
      if (sort === "pending") return b.candidate.pending - a.candidate.pending;
      if (sort === "worst") {
        if (!a.worst) return b.worst ? 1 : 0;
        if (!b.worst) return -1;
        return margin(b.worst) - margin(a.worst);
      }
      return 0;
    });
  const compareButtons = (evidence: CandidateEvidence, label: string) => (
    <span className="row">
      {(["A", "B"] as const).map((side) => (
        <button key={side} disabled={!evidence.path.length} onClick={() => command(`candidate.compare${side}`, { path: evidence.path, node: evidence.node, label })}>
          比較{side}に設定
        </button>
      ))}
    </span>
  );
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
            <label>
              候補を検索{" "}
              <input type="search" value={query} placeholder="手順・作戦ID" onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label>
              並び順{" "}
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="discovery">発見順</option>
                <option value="worst">共通手順での最小点差が大きい順</option>
                <option value="baseline">相手待機での点差が大きい順</option>
                <option value="pending">未比較が多い順</option>
              </select>
            </label>
            {(query || run !== "all" || sort !== "discovery") && <button onClick={() => { setQuery(""); setRun("all"); setSort("discovery"); }}>表示を戻す</button>}
            <button onClick={() => command("compare.open")}>A/B比較を開く</button>
            <span>
              {visibleRows.length} / {rows.length}候補
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
                {!visibleRows.length && <tr><td colSpan={6}>一致する候補がありません。検索語や構成を変更してください。</td></tr>}
                {visibleRows.map(({ run: r, common, candidate: c, worst }) => {
                    return (
                      <tr key={`${r}/${c.id}`}>
                        <td>
                          C{r}
                          <br />
                          <span title={c.baseline.strategy}>{c.baseline.strategy.slice(0, 14)}</span>
                        </td>
                        <td>
                          {c.plan.map(goalLabel).join(" → ") ||
                            "建設・反転なし"}
                          <br />
                          <small title={c.id}>展開 {c.id.slice(0, 14)}</small>
                        </td>
                        <td>{score(c.baseline)}</td>
                        <td>
                          {c.responses.length}展開確認
                          <small className="candidate-secondary">共通 {common.length}手順 · 未比較 {c.pending}手順</small>
                        </td>
                        <td>
                          {worst === null
                            ? "共通比較待ち"
                            : `${margin(worst) > 0 ? "+" : ""}${margin(worst)}点`}
                        </td>
                        <td>
                          {worst && <button disabled={!worst.path.length} onClick={() => onOpen(r, worst)}>最小点差の経路</button>}
                          <details>
                            <summary>得点と経路</summary>
                            <p>相手待機：{score(c.baseline)}</p>
                            <button onClick={() => onOpen(r, c.baseline)}>
                              相手待機の経路を開く
                            </button>
                            {compareButtons(c.baseline, `C${r} · ${c.id.slice(0, 8)} · 相手待機`)}
                            {c.responses.map((response, i) => (
                              <div className="candidate-response" key={i}>
                                <p>
                                  相手手順 <span title={response.opponent}>{response.opponent?.slice(0, 14)}</span>（
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
                                      件）。
                                    </>
                                  )}
                                </p>
                                <button onClick={() => onOpen(r, response)}>
                                  対応{i + 1}の経路を開く
                                </button>
                                {compareButtons(response, `C${r} · ${c.id.slice(0, 8)} · 相手 ${response.opponent?.slice(0, 8) ?? i + 1}`)}
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
    </section>
  );
}
