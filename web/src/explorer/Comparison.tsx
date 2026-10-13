import type { Config, Evaluation as Report, Search, Variant } from "./types";
type Result = Report["runs"][number];
function opponent(config: Config, v: Variant) {
  return JSON.stringify({
    team: v.teams[1].caps,
    values: Object.fromEntries(
      Object.entries(v.teams[1].speeds).map(([k, i]) => [
        k,
        config.profiles[k][i],
      ]),
    ),
    start: v.start,
    layout: v.layout,
  });
}
const pct = (n: number | null | undefined) =>
  n == null ? "未集計" : `${(n * 100).toFixed(1)}%`;
export function Comparison({
  search,
  result,
  baseline,
  comparable,
}: {
  search: Search;
  result: Result;
  baseline: Search | null;
  comparable: boolean | null;
}) {
  const peers = search.evaluation!.runs.filter(
    (r) =>
      JSON.stringify(r.variant.teams[0]) ===
        JSON.stringify(result.variant.teams[0]) &&
      r.variant.start === result.variant.start &&
      r.variant.layout === result.variant.layout,
  );
  const fractions = peers.flatMap((r) =>
    r.groupWinFraction == null ? [] : [r.groupWinFraction],
  );
  const matches =
    comparable && baseline?.evaluation
      ? baseline.evaluation.runs.filter(
          (r) =>
            opponent(baseline.config, r.variant) ===
            opponent(search.config, result.variant),
        )
      : [];
  return (
    <section className="comparison">
      <h3>赤の同じ構成で、相手構成を比較</h3>
      <p>
        {peers.length} 構成を集計済み。赤勝ち割合の範囲{" "}
        {fractions.length
          ? `${pct(Math.min(...fractions))}–${pct(Math.max(...fractions))}`
          : "未確定"}
        。相手の頻度で平均していません。探索途中の行を含む場合、この範囲も暫定です。
      </p>
      <table>
        <thead>
          <tr>
            <th>対戦構成</th>
            <th>網羅</th>
            <th>群等重みの赤勝ち割合</th>
            <th>未決割合</th>
            <th>点差の範囲</th>
          </tr>
        </thead>
        <tbody>
          {peers.map((r) => (
            <tr key={r.run}>
              <td>C{r.run}</td>
              <td>{r.statisticsComplete ? "完了" : "途中"}</td>
              <td>{pct(r.groupWinFraction)}</td>
              <td>{pct(r.unresolvedFraction)}</td>
              <td>
                {r.distribution?.length
                  ? `${r.distribution[0][0]}–${r.distribution.at(-1)![0]}`
                  : "未集計"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {matches.length > 0 && (
        <>
          <h3>比較対象と同じ相手スペックで比較</h3>
          <p>
            選択中の C{result.run}{" "}
            と、初期条件・相手の能力・数値スペックが一致する結果です。赤の条件差は各探索の条件表で確認できます。
          </p>
          <table>
            <thead>
              <tr>
                <th>探索・構成</th>
                <th>網羅</th>
                <th>群等重みの赤勝ち割合</th>
                <th>選択中との差</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((r) => (
                <tr key={r.run}>
                  <td>
                    {baseline!.name} C{r.run}
                  </td>
                  <td>{r.statisticsComplete ? "完了" : "途中"}</td>
                  <td>{pct(r.groupWinFraction)}</td>
                  <td>
                    {r.groupWinFraction == null ||
                    result.groupWinFraction == null
                      ? "未集計"
                      : `${((result.groupWinFraction - r.groupWinFraction) * 100).toFixed(1)} ポイント`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
