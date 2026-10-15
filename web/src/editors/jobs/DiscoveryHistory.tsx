import { useState } from "react";
import { isEnabled } from "../../app/commands";
import { saveJSON, startJob } from "../../app/coreCommands";
import type { Search } from "../../engine/types";
import { duration, stopLabels } from "./SearchProgress";
import "./discovery-history.css";

const endLabels: Record<string, string> = {
  exhausted: "範囲内完了", time_limit: "時間上限", cancelled: "停止", interrupted: "画面終了",
  budget_limit: "行動組数上限", completed: "完了", resource_limit: "保存量上限", error: "エラー",
};

export function DiscoveryProgress({ search, onDefinitions }: { search: Search; onDefinitions: () => void }) {
  const [reason, setReason] = useState("all");
  const [allHistory, setAllHistory] = useState(false);
  const [improvementsOnly, setImprovementsOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const report = search.discovery;
  if (!report) return null;
  const sessions = report.sessions.map((session, index) => ({ session, index, key: JSON.stringify(session), label: index === report.sessions.length - 1 ? "最新" : `${report.sessions.length - 1 - index}回前` })).reverse();
  const filtered = sessions.filter(({ session }) => (reason === "all" || session.reason === reason) && (!improvementsOnly || session.newCandidates > 0 || session.newStrategies > 0 || session.scoreChanges.length > 0));
  const visible = allHistory ? filtered : filtered.slice(0, 3);
  const current = visible.find(item => item.key === selected) || visible[0];
  const totals = filtered.reduce((sum, { session }) => ({ seconds: sum.seconds + session.seconds, candidates: sum.candidates + session.newCandidates, strategies: sum.strategies + session.newStrategies, responses: sum.responses + session.responses }), { seconds: 0, candidates: 0, strategies: 0, responses: 0 });
  return <section className="discovery-progress" aria-label="候補探索の累計と履歴">
    <div className="discovery-ledger-heading"><strong>探索の累計</strong><span>{duration(report.elapsed)}</span><button onClick={onDefinitions}>集計の定義</button></div>
    <dl className="discovery-ledger">
      <div><dt>候補</dt><dd>{report.metrics.candidates.toLocaleString()}<small>{report.metrics.strategies.toLocaleString()}種類</small></dd></div>
      <div><dt>対抗手の検査</dt><dd>{report.metrics.responses.toLocaleString()}<small>比較待ち {report.metrics.pending.toLocaleString()}</small></dd></div>
      <div><dt>探索待ち</dt><dd>{report.metrics.frontier.toLocaleString()}<small>{report.scopeComplete ? "対象範囲を探索済み" : "未探索の分岐"}</small></dd></div>
    </dl>
    {sessions.length > 0 && <section className="discovery-history-ledger" aria-label="候補探索の計算履歴">
      <header className="discovery-history-toolbar"><strong>計算履歴 <span>{filtered.length} / {sessions.length}</span></strong>
        <label><select aria-label="履歴の終了理由" value={reason} onChange={event => setReason(event.target.value)}><option value="all">すべての終了理由</option>{[...new Set(sessions.map(({ session }) => session.reason))].map(value => <option key={value} value={value}>{endLabels[value] || stopLabels[value] || value}</option>)}</select></label>
        <label className="discovery-update-filter"><input type="checkbox" checked={improvementsOnly} onChange={event => setImprovementsOnly(event.target.checked)} />更新あり</label>
        <button disabled={!filtered.length} onClick={() => saveJSON({ search: search.id, scope: "保存済みの候補探索履歴", sessions: filtered.map(({ session }) => session) }, "discovery-history.json")}>書き出す</button>
      </header>
      <div className="discovery-history-scroll" tabIndex={0} role="region" aria-label="履歴の一覧">
        <table className="discovery-history-table"><thead><tr><th>回</th><th>終了</th><th>実行時間</th><th>候補増</th><th>種類増</th><th>対抗手検査</th><th>得点更新</th></tr></thead>
          <tbody>{visible.map(({ session, index, key, label }) => <tr key={index} data-selected={current?.index === index}>
            <th scope="row"><button aria-pressed={current?.index === index} aria-label={`${label}の計算結果`} onClick={() => setSelected(key)}>{label}</button></th>
            <td><span className="discovery-end-state" data-reason={session.reason}>{endLabels[session.reason] || stopLabels[session.reason] || session.reason}</span></td>
            <td>{duration(session.seconds)}</td><td>+{session.newCandidates}</td><td>+{session.newStrategies}</td><td>{session.responses.toLocaleString()}</td>
            <td>{session.scoreChanges.length ? <button className="discovery-score-select" aria-label={`${label}の得点更新 ${session.scoreChanges.length}構成`} aria-pressed={current?.index === index} onClick={() => setSelected(key)}>{session.scoreChanges.length}構成</button> : "なし"}</td>
          </tr>)}</tbody>
          {filtered.length > 1 && <tfoot><tr><th>絞込計</th><td>{filtered.length}回</td><td>{duration(totals.seconds)}</td><td>+{totals.candidates}</td><td>+{totals.strategies}</td><td>{totals.responses.toLocaleString()}</td><td /></tr></tfoot>}
        </table>
        {!visible.length && <p className="discovery-history-empty">条件に一致する履歴はありません</p>}
      </div>
      {filtered.length > 3 && <button className="discovery-history-range" aria-expanded={allHistory} onClick={() => setAllHistory(!allHistory)}>{allHistory ? "直近3回を表示" : `全${filtered.length}回を表示`}</button>}
      {current && <div className="discovery-session-result" aria-label={`${current.label}の計算結果`}>
        <div className="discovery-session-actions"><strong>{current.label}</strong><span>制限 {duration(current.session.budget)}</span><button disabled={!isEnabled("job.discover") || current.session.budget < 1} onClick={() => startJob("discovery", { seconds: current.session.budget })}>同じ制限時間で続ける</button></div>
        {current.session.scoreChanges.length ? <div className="discovery-score-scroll"><table className="discovery-score-table"><caption>最高得点の更新</caption><thead><tr><th>構成</th><th>開始前</th><th>終了時</th><th>差</th></tr></thead><tbody>{current.session.scoreChanges.map(value => <tr key={value.run}><th scope="row">C{value.run}</th><td>{value.before}</td><td>{value.after}</td><td>{value.after - value.before > 0 ? "+" : ""}{value.after - value.before}</td></tr>)}</tbody></table></div> : null}
      </div>}
    </section>}
    <div className="discovery-scope-note">全作戦の網羅・最適性は未保証</div>
  </section>;
}
