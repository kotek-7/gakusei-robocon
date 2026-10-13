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
  const notice = report?.scopeComplete
    ? "同じ条件での追加候補なし"
    : quiet ? "直近3回：新しい種類・得点更新なし" : null;
  return (
    <section className="discovery-progress" aria-label="候補探索の進み具合">
      <details className="discovery-details">
        <summary>
          <span role="status">{running ? "探索中" : report?.scopeComplete
            ? "対象範囲を探索済み" : stopLabels[report?.stopReason || ""] || (report ? "途中保存あり" : "未開始")}</span>
          {report && <span>{report.metrics.candidates}候補 · {report.metrics.strategies}種類 · {report.elapsed.toFixed(1)}秒</span>}
          <span className="progress-detail-label">進捗・履歴</span>
        </summary>
      {notice && <p className="progress-note">{notice}</p>}
      {report && <dl className="search-metrics">
        <div><dt>着手した構成</dt><dd>{report.runs.length} / {search.totalRuns}</dd></div>
        <div><dt>発見済みの探索待ち</dt><dd>{report.metrics.frontier.toLocaleString()}件</dd></div>
        <div><dt>相手対応の結果</dt><dd>{report.metrics.responses.toLocaleString()}展開</dd></div>
        <div><dt>共有手順の比較待ち</dt><dd>{pending.toLocaleString()}件</dd></div>
      </dl>}
      {!!report?.sessions.length && <div className="discovery-history">
        <h3>計算履歴</h3>
        <div className="progress-table" tabIndex={0} role="region" aria-label="候補探索の計算履歴">
          <table>
            <thead><tr><th>計算時間</th><th>新しい候補</th><th>新しい種類</th><th>相手対応の検査</th><th>得点更新（相手待機）</th><th>停止理由</th></tr></thead>
            <tbody>{[...report.sessions].reverse().map((s, i) => <tr key={i}>
              <td>{i === 0 ? "直近 · " : ""}{s.seconds.toFixed(1)}秒</td>
              <td>+{s.newCandidates}</td><td>+{s.newStrategies}</td><td>+{s.responses}</td>
              <td>{s.scoreChanges.length ? s.scoreChanges.map((v) => `C${v.run}: ${v.before} → ${v.after}点`).join(" / ") : "なし"}</td>
              <td>{stopLabels[s.reason] || s.reason}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>}
      <details className="search-help">
        <summary>探索範囲・集計の定義</summary>
        <dl>
          <div><dt>候補探索</dt><dd>限定した経路・待機時刻で探索。全作戦の網羅・最適性は未保証。</dd></div>
          <div><dt>終了目安</dt><dd>総候補数・残り時間は未確定。探索待ちは計算中にも増えます。</dd></div>
          <div><dt>作戦の種類</dt><dd>設置・反転などの完了順序で分類。</dd></div>
          <div><dt>得点更新</dt><dd>同じ構成の過去最高点との差。初回発見は除外。</dd></div>
          <div><dt>履歴</dt><dd>直近12回分。履歴機能の導入前の実行は含みません。</dd></div>
        </dl>
      </details>
      </details>
    </section>
  );
}

const phases = {
  loading: "局面・遷移を読み込み中",
  histories: "試合展開を集計中",
  statistics: "作戦ごとの評価を集計中",
  guarantees: "保証値を計算中",
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
      <div className="progress-heading progress-note">
        <span>{progress?.run != null && `C${progress.run} · `}{determinate
          ? `${progress?.done.toLocaleString()} / ${total.toLocaleString()}件（現在の処理）`
          : "処理件数を確認中"}</span>
        <span>残り時間：未算出</span>
      </div>
    </>}
    {!active && state !== "complete" && <p className="progress-note">集計は未確定。「評価を計算」で再実行できます。</p>}
    {!active && state === "complete" && <span className="progress-note">保存済みの探索範囲を集計</span>}
  </section>;
}
