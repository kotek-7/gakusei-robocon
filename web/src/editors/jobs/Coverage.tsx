import { useState } from "react";
import { run } from "../../app/commands";
import type { Search } from "../../engine/types";
import { coverageRows } from "./coverage";
import "./commands";
export function Coverage({ search }: { search: Search }) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("id");
  if (!search.discovery) return null;
  const rows = coverageRows(search.discovery, filter, sort);
  return <details><summary>構成ごとの探索状況 · 着手 {search.discovery.runs.length} / {search.totalRuns}</summary>
    <div className="row"><label>対象 <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">着手済みすべて</option><option value="empty">候補なし</option><option value="pending">比較待ちあり</option><option value="incomplete">対象範囲に未探索あり</option></select></label>
      <label>並び順 <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="id">構成ID</option><option value="pending">比較待ちが多い順</option><option value="frontier">探索待ちが多い順</option></select></label>
      <button disabled={!rows.length} onClick={() => run("job.exportCoverage", { version: 1, search: search.id, config: search.config, totalRuns: search.totalRuns, scope: search.discovery!.scope, complete: false, filter, sort, runs: rows })}>表示構成を書き出す</button>
    </div>
    <div className="progress-table" role="region" aria-label="構成ごとの探索状況" tabIndex={0}><table><thead><tr><th>構成</th><th>候補</th><th>共通手順</th><th>比較待ち</th><th>探索待ち局面</th><th>未計算組合せ</th><th>対象範囲</th></tr></thead><tbody>{rows.map((r) => <tr key={r.run}><td><button onClick={() => run("job.inspectRun", { run: r.run, searchId: search.id })}>C{r.run}を調べる</button></td><td>{r.candidates.length}</td><td>{r.commonOpponents.length}</td><td>{r.pending.toLocaleString()}</td><td>{r.frontier.toLocaleString()}</td><td>{r.remainingChoices.toLocaleString()}</td><td>{r.scopeComplete ? "探索済み" : "未探索あり"}</td></tr>)}</tbody></table>{!rows.length && <p className="muted">一致する構成はありません</p>}</div>
    <p className="muted">未着手 {(BigInt(search.totalRuns) > BigInt(search.discovery.runs.length) ? BigInt(search.totalRuns) - BigInt(search.discovery.runs.length) : 0n).toLocaleString()}構成 · 全作戦の網羅・最適性は未保証</p>
  </details>;
}
