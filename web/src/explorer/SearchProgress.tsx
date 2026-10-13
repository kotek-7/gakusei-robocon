import { useState } from "react";
import type { Search } from "./types";

function duration(seconds: number) {
  if (seconds < 60) return `${seconds.toFixed(1)}秒`;
  const whole = Math.floor(seconds);
  if (whole < 3600) return `${Math.floor(whole / 60)}分${whole % 60}秒`;
  return `${Math.floor(whole / 3600)}時間${Math.floor((whole % 3600) / 60)}分`;
}

const stopLabels: Record<string, string> = {
  exhausted: "対象範囲を探索済み",
  time_limit: "指定時間で中断",
  cancelled: "操作により停止",
  interrupted: "画面を閉じたため中断",
  resource_limit: "保存量の上限で中断",
  error: "エラーで中断",
};

export function DiscoveryProgress({ search, onDefinitions }: { search: Search; onDefinitions: () => void }) {
  const [allHistory, setAllHistory] = useState(false);
  const report = search.discovery;
  const running = search.status === "running" && search.job === "discovery";
  const pending = report?.metrics.pending || 0;
  const sessions = [...(report?.sessions || [])].reverse();
  const visibleSessions = allHistory ? sessions : sessions.slice(0, 3);
  return (
    <section className="discovery-progress" aria-label="候補探索の進み具合">
      <details className="discovery-details">
        <summary>
          <span role="status">{running ? "探索中" : report?.scopeComplete
            ? "対象範囲を探索済み" : stopLabels[report?.stopReason || ""] || (report ? "途中保存あり" : "未開始")}</span>
          {report && <span>{report.metrics.candidates}候補 · {report.metrics.strategies}種類 · {duration(report.elapsed)}</span>}
          <span className="progress-detail-label">進捗・履歴</span>
        </summary>
      {report && <dl className="search-metrics">
        <div><dt>着手構成</dt><dd>{report.runs.length} / {search.totalRuns}</dd></div>
        <div><dt>探索待ち</dt><dd>{report.metrics.frontier.toLocaleString()}件</dd></div>
        <div><dt>相手対応</dt><dd>{report.metrics.responses.toLocaleString()}展開</dd></div>
        <div><dt>比較待ち</dt><dd>{pending.toLocaleString()}件</dd></div>
      </dl>}
      {!!report?.sessions.length && <div className="discovery-history">
        <div className="history-heading">
          <h3>計算履歴</h3>
          {sessions.length > 3 && <button onClick={() => setAllHistory(!allHistory)}>{allHistory ? "直近3回" : `全${sessions.length}回`}</button>}
        </div>
        <div className="progress-table" tabIndex={0} role="region" aria-label="候補探索の計算履歴">
          <table>
            <thead><tr><th>時間</th><th>候補増</th><th>種類増</th><th>対応検査</th><th>得点更新</th><th>終了</th></tr></thead>
            <tbody>{visibleSessions.map((s, i) => <tr key={i}>
              <td>{i === 0 ? "直近 · " : ""}{duration(s.seconds)}</td>
              <td>+{s.newCandidates}</td><td>+{s.newStrategies}</td><td>+{s.responses}</td>
              <td>{s.scoreChanges.length ? <details className="score-changes"><summary>{s.scoreChanges.length}構成</summary><ul>{s.scoreChanges.map((v) => <li key={v.run}>C{v.run}: {v.before} → {v.after}点</li>)}</ul></details> : "なし"}</td>
              <td>{({ exhausted: "範囲内完了", time_limit: "時間上限", cancelled: "停止", resource_limit: "保存量上限", error: "エラー" } as Record<string, string>)[s.reason] || s.reason}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>}
      <div className="history-footer">
        <span>全作戦の網羅・最適性は未保証</span>
        <button onClick={onDefinitions}>集計の定義</button>
      </div>
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
      {progress && <span>{duration(progress.elapsed)} · 構成 {progress.completedRuns} / {progress.totalRuns}件処理済み</span>}
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
