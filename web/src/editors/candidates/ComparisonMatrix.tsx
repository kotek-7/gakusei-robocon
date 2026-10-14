import { useState } from "react";
import { Help } from "../common/Help";
import type { CandidateEvidence } from "../../engine/types";
import { run as command } from "../../app/commands";
import { comparisonEvidence, comparisonGroups, comparisonKey, comparisonBranches, arbitrationSummary, visibleOpponents, type CandidateComparisonRow } from "./comparison";
import "./comparison.css";
import { candidateComparisonLabel } from "./comparisonLabel";
import { candidatePlanLabel } from "./collection";
import { responseIdentity } from "./evidence";


export function ComparisonMatrix({ rows, onOpen, onInspect, onRemove, onClear }: {
  rows: CandidateComparisonRow[];
  onOpen: (run: number, evidence: CandidateEvidence) => void;
  onInspect: (run: number, id: string, evidence: CandidateEvidence) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
}) {
  const [selection, setSelection] = useState<{ key: string; opponent: string | null } | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("id");
  const [branchKey, setBranchKey] = useState("");
  const groups = comparisonGroups(rows);
  const selectedRow = rows.find(row => comparisonKey(row) === selection?.key);
  // Re-resolve against live results. Removed or no-longer-common cells cannot act on stale evidence.
  const selectedGroup = groups.find(group => group.run === selectedRow?.run);
  const defaultEvidence = selectedRow && selection && (selection.opponent === null || selectedGroup?.opponents.includes(selection.opponent))
    ? comparisonEvidence(selectedRow, selection.opponent) : null;
  const branches = selectedRow && selection && defaultEvidence ? comparisonBranches(selectedRow, selection.opponent) : [];
  const branchIdentity = (evidence: CandidateEvidence) => selectedRow ? responseIdentity(selectedRow.run, selectedRow.candidate.id, { ...evidence, opponent: selection?.opponent ?? undefined }) : "";
  const selectedVisible = selection?.opponent === null || !!(selectedGroup && visibleOpponents(selectedGroup.candidates, selectedGroup.opponents, {query,filter,sort}).some(entry => entry.opponent === selection?.opponent));
  const selectedEvidence = branches.find(evidence => branchIdentity(evidence) === branchKey) ?? defaultEvidence;
  const selectedLabel = selectedRow && selection ? `C${selectedRow.run} · ${selectedRow.candidate.id.slice(0,14)} · ${selection.opponent?.slice(0,14) ?? "相手待機"}` : "";
  const points = (evidence: CandidateEvidence) => { const value = evidence.scores[0] - evidence.scores[1]; return `${value > 0 ? "+" : ""}${value}点`; };
  if (!rows.length) return null;
  return <section className="candidate-matrix" aria-label="取り置いた候補の同条件比較">
    <header><strong>候補を並べて比較 · {rows.length}件 <Help topic="results" title="候補の横比較" text="候補の横比較は、同じ機体構成・相手手順で候補ごとの点差を見る表です。点差には確認済みの裁定の最小値を表示し、選ぶと試合展開を確認できます。" /></strong><button onClick={onClear}>比較を解除</button></header>
    <div className="candidate-matrix-filters">
      <label>相手手順を検索 <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="手順ID" /></label>
      <label>表示 <select aria-label="比較表の表示対象" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">全共通手順</option><option value="different">候補間で点差が異なる手順</option><option value="blocked">実行不可を含む手順</option><option value="red-blocked">赤に実行不可がある手順</option><option value="blue-blocked">青に実行不可がある手順</option><option value="arbitration">裁定で点差が変わる手順</option></select></label>
      <label>順序 <select aria-label="比較表の順序" value={sort} onChange={e => setSort(e.target.value)}><option value="id">手順ID順</option><option value="spread">候補間の点差の開きが大きい順</option></select></label>
      {(query || filter !== "all" || sort !== "id") && <button onClick={() => { setQuery(""); setFilter("all"); setSort("id"); }}>表示を戻す</button>}
    </div>
    {groups.length > 1 && <p className="candidate-matrix-note">構成別に表示</p>}
    {groups.map(group => { const visible = visibleOpponents(group.candidates, group.opponents, { query, filter, sort }); return <div key={group.run} className="candidate-matrix-group">
      <div className="candidate-matrix-scroll" tabIndex={0} role="region" aria-label={`構成 C${group.run} の候補比較表`}>
        <table>
          <caption>C{group.run} · 共通 {visible.length} / {group.opponents.length}手順 · 最小点差{group.candidates.length === 1 ? " · 同じ構成の候補を追加" : ""}</caption>
          <thead><tr><th scope="col">相手の手順</th>{group.candidates.map(row => <th scope="col" key={comparisonKey(row)}><span title={candidatePlanLabel(row.candidate.plan)}>{candidatePlanLabel(row.candidate.plan)}</span><small className="candidate-matrix-id" title={row.candidate.id}>{row.candidate.id.slice(0, 14)}</small><button aria-label={`C${row.run} ${row.candidate.id} を比較から外す`} onClick={() => onRemove(comparisonKey(row))}>外す</button></th>)}</tr></thead>
          <tbody>{[...visible.map(entry => entry.opponent), null].map(opponent => <tr key={opponent ?? "baseline"} className={opponent === null ? "candidate-matrix-baseline" : ""}>
            <th scope="row"><span title={opponent ?? undefined}>{opponent ?? "相手待機（参考）"}</span>{opponent && visible.find(entry => entry.opponent === opponent)?.spread !== null && <small className="candidate-matrix-spread">候補間の開き {visible.find(entry => entry.opponent === opponent)?.spread}点</small>}</th>
            {group.candidates.map(row => {
              const evidence = comparisonEvidence(row, opponent);
              const cellBranches = comparisonBranches(row, opponent);
              const arbitration = opponent ? arbitrationSummary(row, opponent) : null;
              const active = selection?.key === comparisonKey(row) && selection.opponent === opponent;
              return <td key={comparisonKey(row)}>{evidence ? <button className="candidate-matrix-cell" aria-pressed={active} aria-label={`C${row.run} ${row.candidate.id}、${opponent ?? "相手待機"}、${points(evidence)}、展開を選択`} onClick={() => { setSelection({ key: comparisonKey(row), opponent }); setBranchKey(""); }}>
                <strong>{points(evidence)}</strong>{cellBranches.length > 1 && <small>〜{points(cellBranches[cellBranches.length - 1])} · {cellBranches.length}展開</small>}<small>{evidence.scores[0]} 対 {evidence.scores[1]}</small>
                {arbitration && (arbitration.redBlocked || arbitration.blueBlocked) && <small>{arbitration.redBlocked ? "赤" : ""}{arbitration.redBlocked && arbitration.blueBlocked ? "・" : ""}{arbitration.blueBlocked ? "青" : ""}に実行不可の展開</small>}
              </button> : <span className="candidate-matrix-missing">未比較</span>}</td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>
      {!!group.opponents.length && !visible.length && <p className="candidate-matrix-note">表示条件に一致する共通手順がありません。</p>}
      {!group.opponents.length && <p className="candidate-matrix-note">共通手順の比較待ち</p>}
    </div>; })}
    <div className="candidate-matrix-tools" aria-label="比較表で選んだ展開の操作">
      {selectedRow && selectedEvidence ? <>
        {!selectedVisible && <span role="status">選択中の相手手順は絞込の対象外です。<button onClick={() => {setQuery("");setFilter("all");}}>選択を表に戻す</button></span>}
        <span title={selectedLabel}>{selectedLabel}</span>
        {branches.length > 1 && <label>裁定の展開 <select aria-label="比較表の裁定展開" value={branchIdentity(selectedEvidence)} onChange={event => setBranchKey(event.target.value)}>{branches.map((evidence, index) => <option key={branchIdentity(evidence)} value={branchIdentity(evidence)}>{index === 0 ? "最小点差" : `展開${index + 1}`} · {points(evidence)} · {evidence.scores[0]} 対 {evidence.scores[1]}{evidence.blocked?.length ? ` · 実行不可${evidence.blocked.length}件` : ""}</option>)}</select></label>}
        <button onClick={() => onInspect(selectedRow.run, selectedRow.candidate.id, selectedEvidence)}>この展開を検査{selectedEvidence.blocked?.length ? ` · 実行不可 ${selectedEvidence.blocked.length}件` : ""}</button>
        <button disabled={!selectedEvidence.path.length} onClick={() => onOpen(selectedRow.run, selectedEvidence)}>3Dに表示</button>
        {(["A", "B"] as const).map(side => <button key={side} disabled={!selectedEvidence.path.length} onClick={() => command(`candidate.compare${side}`, { path: selectedEvidence.path, node: selectedEvidence.node, label: candidateComparisonLabel(selectedLabel, selectedEvidence, branches.indexOf(selectedEvidence)) })}>比較 {side} に割当</button>)}
        <button onClick={() => command("compare.open")}>A/B比較へ</button>
      </> : <span>点差を選択</span>}
    </div>
  </section>;
}
