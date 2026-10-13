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
      r.candidates.map((c) => ({ run: r.run, candidate: c })),
    ) || [];
  return (
    <section className="evaluation candidates">
      <h2>発見した作戦候補</h2>
      <p>
        候補の行から、相手の対応ごとの得点と、グラフ・3Dでの再生を開けます。
      </p>
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
          <details>
            <summary>候補探索の範囲</summary>
            <p>{report.scope}</p>
          </details>
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
              計算時間 {report.elapsed.toFixed(1)}秒 · {rows.length}候補
            </span>
          </div>
          {selectedRun && <p>{configuration(selectedRun.variant)}</p>}
          <p>
            点差は確認済みの対応内の値で、保証ではありません。未検証件数も併せて比較してください。相手待機は対照条件です。
          </p>
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
                  <th>目標の順序（未達を含む）</th>
                  <th>
                    相手待機
                    <br />赤 対 青
                  </th>
                  <th>相手の対応</th>
                  <th>確認済みの最小点差</th>
                  <th>計算した展開</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => run === "all" || String(r.run) === run)
                  .map(({ run: r, candidate: c }) => {
                    const worst = c.responses.length
                      ? Math.min(...c.responses.map(margin))
                      : null;
                    return (
                      <tr key={`${r}/${c.id}`}>
                        <td>
                          C{r}
                          <br />
                          {c.baseline.strategy}
                        </td>
                        <td>{c.plan.map(goalLabel).join(" → ")}</td>
                        <td>{score(c.baseline)}</td>
                        <td>
                          {c.responses.length}件確認 / {c.pending}件待ち
                        </td>
                        <td>
                          {worst === null
                            ? "未検証"
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
                                  {response.kind === "flip"
                                    ? `相手が反転：${response.targets?.join(" → ")}`
                                    : "相手も建設を進める"}
                                  <br />
                                  {score(response)}
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
