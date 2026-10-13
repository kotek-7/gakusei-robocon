import type { Search } from "./types";

const stopLabels: Record<string, string> = {
  exhausted: "対象範囲を探索済み",
  time_limit: "指定時間で中断",
  cancelled: "操作により停止",
};

export function DiscoveryProgress({ search }: { search: Search }) {
  const report = search.discovery;
  const running = search.status === "running" && search.job === "discovery";
  const recent = report?.sessions.slice(-3) || [];
  const quiet = recent.length === 3 && recent.every(
    (s) => s.reason === "time_limit" && s.newStrategies === 0 && s.scoreChanges.length === 0,
  );
  const pending = report?.metrics.pending || 0;
  const latest = report?.sessions.at(-1);
  const advice = report?.scopeComplete
    ? "この生成ルールで探せる候補と相手対応を確認しました。同じ条件で追加計算しても候補は増えません。候補の経路を確認するか、探索条件を変更してください。"
    : !report || report.metrics.candidates === 0
      ? "まず30〜60秒を目安に探索してください。構成数が多い場合は、比較したい能力・スペックに絞ると各構成の探索を進めやすくなります。"
      : pending > 0
        ? "未検証の相手対応があります。追加で探索を進め、同じ対応を検査した候補どうしで比較してください。"
        : quiet
          ? "直近3回は新しい作戦の種類も最高得点の更新もありません。いったん止めて候補の経路を確認する目安です。未探索の候補が有望でないことの証明ではありません。"
          : "追加計算で作戦の種類や得点が変わるか、下の履歴で確認してください。変化が続くなら探索を継続し、落ち着いたら候補の経路を確認するのが目安です。";
  return (
    <section className="discovery-progress" aria-label="候補探索の進み具合">
      <div className="progress-heading" role="status">
        <strong>候補探索：{running ? "探索中" : report?.scopeComplete
          ? "対象範囲を探索済み" : stopLabels[report?.stopReason || ""] || (report ? "途中保存あり" : "未開始")}</strong>
        {report && <span>累計 {report.elapsed.toFixed(1)}秒</span>}
      </div>
      <p>{advice}</p>
      {report && <div className="discovery-counts">
        <span>候補 {report.metrics.candidates.toLocaleString()}件 / 作戦の種類 {report.metrics.strategies.toLocaleString()}種類</span>
        <span>構成の着手 {report.runs.length} / {search.totalRuns}</span>
        <span>発見済みの探索待ち {report.metrics.frontier.toLocaleString()}件</span>
        <span>相手対応 {report.metrics.responses.toLocaleString()}件確認 / {pending.toLocaleString()}件待ち</span>
      </div>}
      <p className="progress-note">1回の計算時間は指定できます。候補の総数と完了までの時間は事前には分かりません。探索中にも枝が増えるため、探索待ち件数は残り総数ではありません。対象範囲を探索済みでも、全作戦の網羅・最適性の保証にはなりません。</p>
      {latest && <p>直近の計算：{latest.seconds.toFixed(1)}秒で候補 +{latest.newCandidates}件、作戦の種類 +{latest.newStrategies}種類、相手対応を{latest.responses}件検査。最高得点を更新した構成は{latest.scoreChanges.length}件。</p>}
      {!!report?.sessions.length && <details className="discovery-history">
        <summary>追加計算の効果を確認 <span>直近 {report.sessions.length}回</span></summary>
        <div className="progress-table" tabIndex={0} role="region" aria-label="候補探索の計算履歴">
          <table>
            <thead><tr><th>計算時間</th><th>新しい候補</th><th>新しい作戦の種類</th><th>相手対応の検査</th><th>最高得点の更新（相手待機）</th><th>停止理由</th></tr></thead>
            <tbody>{[...report.sessions].reverse().map((s, i) => <tr key={i}>
              <td>{i === 0 ? "直近 · " : ""}{s.seconds.toFixed(1)}秒</td>
              <td>+{s.newCandidates}</td><td>+{s.newStrategies}</td><td>+{s.responses}</td>
              <td>{s.scoreChanges.length ? s.scoreChanges.map((v) => `C${v.run}: ${v.before} → ${v.after}点`).join(" / ") : "なし"}</td>
              <td>{stopLabels[s.reason] || s.reason}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="progress-note">得点更新は同じ構成の過去の最高得点との比較です。初めて候補が出た構成は更新に含みません。作戦の種類は設置・反転などの完了順序でまとめています。履歴はこの機能での実行から記録します。</p>
      </details>}
    </section>
  );
}

const phases = {
  loading: "保存済みの局面・遷移を読み込み中",
  histories: "試合展開を集計中",
  statistics: "作戦ごとの評価を集計中",
  guarantees: "相手の最善応答を考慮した保証値を計算中",
  saving: "評価結果を保存中",
  complete: "評価の計算完了",
};

export function EvaluationProgress({ search }: { search: Search }) {
  const progress = search.evaluationProgress;
  const active = search.status === "evaluating";
  if ((!progress || (progress.state === "complete" && !search.evaluation)) && !active) return null;
  const state = active ? "running" : progress?.state;
  const title = state === "running" ? phases[progress?.phase || "loading"]
    : state === "complete" ? "評価の計算完了"
      : state === "error" ? "評価の計算に失敗しました"
        : "評価の計算を中断しました";
  const total = progress?.total;
  const determinate = total != null && total > 0;
  return <section className="evaluation-progress" aria-label="評価計算の進捗" aria-busy={active}>
    <div className="progress-heading" role="status">
      <strong>{title}</strong>
      {progress && <span>{progress.elapsed.toFixed(1)}秒 · 構成 {progress.completedRuns} / {progress.totalRuns}件処理済み</span>}
    </div>
    {active && <>
      <progress aria-label="現在の処理段階の進捗" max={determinate ? total : undefined} value={determinate ? progress?.done : undefined} />
      <p>{progress?.run != null && `C${progress.run} · `}{determinate
        ? `${progress?.done.toLocaleString()} / ${total.toLocaleString()}件（この処理段階）`
        : "処理中"}。処理内容ごとに所要時間が異なるため、全体の残り時間は未算出です。</p>
    </>}
    {!active && state !== "complete" && <p>途中の集計は確定していません。「評価を計算」で最初から再計算できます。</p>}
    {!active && state === "complete" && <p>保存済みの範囲の評価です。探索や履歴の集計が未完了かどうかは、評価表で確認できます。</p>}
  </section>;
}
