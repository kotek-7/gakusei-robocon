import { Help } from "../common/Help";
import { useRef, useState } from "react";
import type { CandidateEvidence } from "../../engine/types";
import { diagnosticRobotNames } from "./diagnostics";
import { filterMilestones, firstRedDifference, inspectMilestones } from "./milestoneInspection";
import "./milestoneInspection.css";

export function MilestoneInspector({ evidence, baseline }: { evidence: CandidateEvidence; baseline: CandidateEvidence }) {
  return <Milestones key={`${evidence.node}/${evidence.path.join(",")}`} evidence={evidence} baseline={baseline} />;
}
function Milestones({ evidence, baseline }: { evidence: CandidateEvidence; baseline: CandidateEvidence }) {
  const [robot, setRobot] = useState("");
  const [kind, setKind] = useState("");
  const [query, setQuery] = useState("");
  const [contextGroup, setContextGroup] = useState<number | null>(null);
  const region = useRef<HTMLDivElement>(null);
  const rows = inspectMilestones(evidence.milestones);
  const baselineRows = inspectMilestones(baseline.milestones);
  const visible = filterMilestones(rows, robot, kind, query);
  const diff = firstRedDifference(baseline.milestones, evidence.milestones);
  const kinds = [...new Map(rows.map(row => [row.kind, row.action])).entries()];
  const robots = [...new Set(rows.map(row => row.robot))].sort();
  const same = evidence.node === baseline.node && evidence.path.join() === baseline.path.join();
  function reveal(group: number) {
    setRobot(""); setKind(""); setQuery(""); setContextGroup(group);
    requestAnimationFrame(() => {
      const row = region.current?.querySelector<HTMLTableRowElement>(`tr[data-group="${group}"]`);
      row?.focus(); row?.scrollIntoView({ block: "nearest" });
    });
  }
  return <section className="candidate-completions" aria-label="建設と反転の完了記録">
    <header><strong>建設・反転等の完了記録 <Help topic="results" text="同じ組は同時完了。移動・取得・受け渡し・待機は含みません。組番号は秒数ではありません。" /></strong><span>{visible.length} / {rows.length}動作</span></header>
    {!same && <div className="candidate-completion-difference">{!diff ? <span>赤の完了順・同時組は相手待機と同じ</span> : <><span>赤の完了順に相手待機との差あり</span>{diff.currentGroup !== null ? <button onClick={() => reveal(diff.currentGroup!)}>最初の相違：組{diff.currentGroup}</button> : <span>この展開で赤の記録が先に終了（相手待機は組{diff.baselineGroup}以降も継続）</span>}</>}</div>}
    <div className="candidate-completion-filters">
      <label>機体<select aria-label="完了記録の機体" value={robot} onChange={event => { setRobot(event.target.value); setContextGroup(null); }}><option value="">すべて</option>{robots.map(id => <option key={id} value={id}>{diagnosticRobotNames[id]}</option>)}</select></label>
      <label>動作<select aria-label="完了記録の動作" value={kind} onChange={event => { setKind(event.target.value); setContextGroup(null); }}><option value="">すべて</option>{kinds.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <input type="search" aria-label="完了記録を検索" placeholder="場所・物体を検索" value={query} onChange={event => { setQuery(event.target.value); setContextGroup(null); }} />
      {(robot || kind || query) && <button onClick={() => { setRobot(""); setKind(""); setQuery(""); }}>解除</button>}
    </div>
    <div className="candidate-completion-table" ref={region}><table aria-label="完了記録。同じ組は同時刻"><thead><tr><th>組</th><th>機体</th><th>動作</th><th>場所</th><th>物体</th></tr></thead><tbody>{visible.map(row => <tr key={row.key} data-group={row.group} tabIndex={-1} data-context={contextGroup === row.group || undefined}><td><button className="candidate-group-link" title={`組${row.group}の全機体を確認`} onClick={() => setContextGroup(contextGroup === row.group ? null : row.group)}>{row.group}</button></td><td>{row.actor}</td><td>{row.action}</td><td>{row.location}</td><td>{row.objects}</td></tr>)}{!visible.length && <tr><td colSpan={5}>{rows.length ? "条件に一致する完了記録がありません。" : "この展開には建設・反転等の完了記録がありません。"}</td></tr>}</tbody></table></div>
    {diff && contextGroup === diff.currentGroup && <div className="candidate-completion-diff-detail"><strong>最初に異なる赤の同時組</strong><div><span>相手待機{diff.baselineGroup === null ? "（記録終了）" : ` · 組${diff.baselineGroup}`}</span>{baselineRows.filter(row => row.group === diff.baselineGroup && row.robot < 2).map(row => <div key={row.key}>{row.actor} · {row.action} · {row.location} · {row.objects}</div>)}</div><div><span>選択展開 · 組{diff.currentGroup}</span>{rows.filter(row => row.group === diff.currentGroup && row.robot < 2).map(row => <div key={row.key}>{row.actor} · {row.action} · {row.location} · {row.objects}</div>)}</div></div>}
    {contextGroup !== null && <div className="candidate-completion-context"><header><strong>組{contextGroup} · 全機体の同時完了</strong><button aria-label="同時完了の確認を閉じる" onClick={() => setContextGroup(null)}>閉じる</button></header>{rows.filter(row => row.group === contextGroup).map(row => <div key={row.key}>{row.actor} · {row.action} · {row.location} · {row.objects}</div>)}</div>}
  </section>;
}
