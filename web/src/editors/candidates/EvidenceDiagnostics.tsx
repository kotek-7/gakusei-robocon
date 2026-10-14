import { useEffect, useRef, useState } from "react";
import type { CandidateEvidence } from "../../engine/types";
import { activeDiagnostic, diagnosticRobotNames, diagnosticRows, filterDiagnostics, type ExecutionIssue } from "./diagnostics";
import { navigateRow } from "./rowSelection";
import "./diagnostics.css";

export function EvidenceDiagnostics({ evidence, onOpenAt }: {
  evidence: CandidateEvidence;
  onOpenAt: (issue: ExecutionIssue) => void;
}) {
  // Changing the actual path remounts transient inspection state, including filters.
  return <Diagnostics key={`${evidence.node}/${evidence.path.join(",")}`} evidence={evidence} onOpenAt={onOpenAt} />;
}

function Diagnostics({ evidence, onOpenAt }: {
  evidence: CandidateEvidence;
  onOpenAt: (issue: ExecutionIssue) => void;
}) {
  const [robot, setRobot] = useState("");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const rows = diagnosticRows(evidence);
  const visible = filterDiagnostics(rows, robot, reason);
  const active = activeDiagnostic(visible, selected);
  const index = active ? visible.indexOf(active) : -1;
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLTableRowElement>('tr[aria-selected="true"]');
    if (!list || !row) return;
    const top = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
    if (top < 0) list.scrollTop += top;
    else if (top + row.offsetHeight > list.clientHeight) list.scrollTop += top + row.offsetHeight - list.clientHeight;
  }, [active?.key]);
  const robotNames = [...new Set(rows.map(row => row.robot))].sort();
  const reasons = [...new Set(rows.map(row => row.reason))];
  const name = (id: number) => diagnosticRobotNames[id] ?? `機体${id}`;
  if (!rows.length) return <p className="candidate-diagnostic-empty">この展開には実行不可の記録がありません。</p>;
  return <section className="candidate-diagnostics" aria-label="実行不可の検査">
    <header><strong>実行不可 {rows.length}件</strong><span>初回 {rows[0].t}秒 · {name(rows[0].robot)}</span></header>
    <div className="candidate-diagnostic-filters">
      <label>機体 <select aria-label="実行不可の機体" value={robot} onChange={event => setRobot(event.target.value)}><option value="">すべて</option>{robotNames.map(id => <option key={id} value={id}>{name(id)}</option>)}</select></label>
      <label>理由 <select aria-label="実行不可の理由" value={reason} onChange={event => setReason(event.target.value)}><option value="">すべて</option>{reasons.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      {(robot || reason) && <button onClick={() => { setRobot(""); setReason(""); }}>絞込解除</button>}
    </div>
    <div className="candidate-diagnostic-list" ref={listRef}><table role="grid" aria-label="実行不可の記録。上下キーで選択、Enterで該当時刻を3D表示"><thead><tr><th>時刻</th><th>機体</th><th>手順</th><th>理由</th></tr></thead><tbody>
      {visible.map(row => <tr key={row.key} data-selectable-row aria-selected={active?.key === row.key} tabIndex={active?.key === row.key ? 0 : -1} onFocus={() => setSelected(row.key)} onClick={event => event.currentTarget.focus()} onKeyDown={event => navigateRow(event, () => { if (evidence.path.length) onOpenAt(row); })} onDoubleClick={() => { if (evidence.path.length) onOpenAt(row); }}><td>{row.t}秒</td><td>{name(row.robot)}</td><td>{row.instruction + 1}</td><td>{row.reason}</td></tr>)}
      {!visible.length && <tr><td colSpan={4}>この条件に一致する記録はありません。</td></tr>}
    </tbody></table></div>
    <div className="candidate-diagnostic-actions">
      <button aria-label="前の実行不可を選択" disabled={index <= 0} onClick={() => setSelected(visible[index - 1].key)}>前へ</button>
      <span aria-live="polite">{index + 1} / {visible.length}</span>
      <button aria-label="次の実行不可を選択" disabled={index < 0 || index >= visible.length - 1} onClick={() => setSelected(visible[index + 1].key)}>次へ</button>
      <button disabled={!active || !evidence.path.length} onClick={() => { if (active) onOpenAt(active); }}>{active ? `${active.t}秒を3D表示` : "該当時刻を3D表示"}</button>
    </div>
    <small className="muted">手順ごとに最初に実行できなかった時刻。待機後の成立は動作順で確認。</small>
  </section>;
}
