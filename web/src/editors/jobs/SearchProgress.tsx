import { DetailView } from "../common/DetailView";
import { Help } from "../common/Help";
import { useState } from "react";
import { isEnabled } from "../../app/commands";
import { saveJSON, startJob } from "../../app/coreCommands";
import type { Search } from "../../engine/types";

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
  const [reason, setReason] = useState("all");
  const [allHistory, setAllHistory] = useState(false);
  const [improvementsOnly, setImprovementsOnly] = useState(false);
  const report = search.discovery;
  const running = search.status === "running" && search.job === "discovery";
  const pending = report?.metrics.pending || 0;
  const sessions = [...(report?.sessions || [])].reverse();
  const filteredSessions = sessions.map((session, index) => ({ session, index })).filter(({ session }) => (reason === "all" || session.reason === reason) && (!improvementsOnly || session.newCandidates > 0 || session.newStrategies > 0 || session.scoreChanges.length > 0));
  const visibleSessions = allHistory ? filteredSessions : filteredSessions.slice(0, 3);
  return (
    <section className="discovery-progress" aria-label="候補探索の進み具合">
      <div className="progress-heading">
          <span role="status">{running ? "探索中" : report?.scopeComplete
            ? "対象範囲を探索済み" : stopLabels[report?.stopReason || ""] || (report ? "途中保存あり" : "未開始")}</span>
          {report && <span>{report.metrics.candidates}候補 · {report.metrics.strategies}種類 · {duration(report.elapsed)}</span>}
          <Help topic="search" />
      </div>
      {report && <dl className="search-metrics">
        <div><dt>着手構成</dt><dd>{report.runs.length} / {search.totalRuns}</dd></div>
        <div><dt>探索待ち</dt><dd>{report.metrics.frontier.toLocaleString()}件</dd></div>
        <div><dt>相手対応</dt><dd>{report.metrics.responses.toLocaleString()}展開</dd></div>
        <div><dt>比較待ち</dt><dd>{pending.toLocaleString()}件</dd></div>
      </dl>}
      {!!report?.sessions.length && <details className="discovery-history"><summary>計算履歴 <span>{sessions.length}回</span></summary>
        <div className="history-heading">
          <label>終了理由 <select value={reason} onChange={(e) => setReason(e.target.value)}><option value="all">すべて</option>{[...new Set(sessions.map((s) => s.reason))].map((value) => <option key={value} value={value}>{stopLabels[value] || value}</option>)}</select></label>
          <button disabled={!filteredSessions.length} onClick={() => saveJSON({ search: search.id, scope: "保存済みの候補探索履歴", sessions: filteredSessions.map(({session}) => session) }, "discovery-history.json")}>絞った履歴を保存</button>
          <label><input type="checkbox" checked={improvementsOnly} onChange={event => setImprovementsOnly(event.target.checked)} />候補・得点の更新あり</label>
          {filteredSessions.length > 3 && <label><input type="checkbox" checked={allHistory} onChange={event => setAllHistory(event.target.checked)} />全{filteredSessions.length}回を表示</label>}
        </div>
        <p className="muted">条件に一致 {filteredSessions.length} / {sessions.length}回 · 合計 {duration(filteredSessions.reduce((n, {session}) => n + session.seconds, 0))} · 候補増 {filteredSessions.reduce((n, {session}) => n + session.newCandidates, 0)} · 対応検査 {filteredSessions.reduce((n, {session}) => n + session.responses, 0)}件</p>
        <div className="progress-table" tabIndex={0} role="region" aria-label="候補探索の計算履歴">
          <table>
            <thead><tr><th>時間</th><th>候補増</th><th>種類増</th><th>対応検査</th><th>得点更新</th><th>終了</th><th>再開</th></tr></thead>
            <tbody>{visibleSessions.map(({ session: s, index }) => <tr key={index}>
              <td>{index === 0 ? "直近 · " : `${index + 1}回前 · `}{duration(s.seconds)}</td>
              <td>+{s.newCandidates}</td><td>+{s.newStrategies}</td><td>+{s.responses}</td>
              <td>{s.scoreChanges.length ? <DetailView className="score-changes" label={`${s.scoreChanges.length}構成`} title="得点の更新"><ul>{s.scoreChanges.map((v) => <li key={v.run}>C{v.run}: {v.before} → {v.after}点</li>)}</ul></DetailView> : "なし"}</td>
              <td>{({ exhausted: "範囲内完了", time_limit: "時間上限", cancelled: "停止", resource_limit: "保存量上限", error: "エラー" } as Record<string, string>)[s.reason] || s.reason}</td>
              <td><button disabled={!isEnabled("job.discover") || s.budget < 1} onClick={() => startJob("discovery", {seconds: s.budget})} title="保存済みの探索を、この回と同じ制限時間で続けます">{duration(s.budget)}で続ける</button></td>
            </tr>)}</tbody>
          </table>
          {!visibleSessions.length && <p className="muted">条件に一致する計算履歴はありません</p>}
        </div>
      </details>}
      <div className="history-footer">
        <span>全作戦の網羅・最適性は未保証</span>
        <button onClick={onDefinitions}>集計の定義</button>
      </div>
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
