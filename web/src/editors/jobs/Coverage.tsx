import { IconButton } from "../common/IconButton";
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
  const unstarted = BigInt(search.totalRuns) > BigInt(search.discovery.runs.length) ? BigInt(search.totalRuns) - BigInt(search.discovery.runs.length) : 0n;
  return <section className="job-coverage" aria-label="構成ごとの探索状況">
    <header className="job-result-heading"><strong>構成別の探索結果</strong><span>着手 {search.discovery.runs.length.toLocaleString()} / {BigInt(search.totalRuns).toLocaleString()}</span></header>
    <div className="job-coverage-controls"><label>対象 <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">着手済みすべて</option><option value="empty">候補なし</option><option value="pending">比較待ちあり</option><option value="incomplete">対象範囲に未探索あり</option></select></label>
      <label>並び順 <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="id">構成ID</option><option value="pending">比較待ちが多い順</option><option value="frontier">探索待ちが多い順</option></select></label>
      <IconButton icon="download" label="表示構成を書き出す" disabled={!rows.length} onClick={() => run("job.exportCoverage", { version: 1, search: search.id, config: search.config, totalRuns: search.totalRuns, scope: search.discovery!.scope, complete: false, filter, sort, runs: rows })} />
    </div>
    <div className="progress-table" role="region" aria-label="構成ごとの探索状況" tabIndex={0}><table><thead><tr><th>構成</th><th>候補</th><th>共通手順</th><th>比較待ち</th><th>探索待ち局面</th><th>未計算組合せ</th><th>対象範囲</th></tr></thead><tbody>{rows.map((r) => <tr key={r.run}><td><button className="job-result-link" onClick={() => run("job.inspectRun", { run: r.run, searchId: search.id })}>C{r.run}</button></td><td>{r.candidates.length}</td><td>{r.commonOpponents.length}</td><td>{r.pending.toLocaleString()}</td><td>{r.frontier.toLocaleString()}</td><td>{r.remainingChoices.toLocaleString()}</td><td className="coverage-scope">{r.scopeComplete ? "探索済み" : "未探索あり"}</td></tr>)}{!rows.length && <tr><td colSpan={7}>条件に一致する着手済み構成はありません</td></tr>}</tbody>{unstarted > 0n && <tfoot><tr className="coverage-unstarted"><th>未着手 {unstarted.toLocaleString()}構成</th><td colSpan={6}>候補・検査結果なし</td></tr></tfoot>}</table></div>
  </section>;
}
