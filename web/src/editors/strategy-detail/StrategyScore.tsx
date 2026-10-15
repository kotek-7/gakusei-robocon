import { IconButton } from "../common/IconButton";
import { useMemo, useState } from "react";
import type { MatchAnalysis } from "../../engine/analysis";
import { actionName, robotNames } from "../common/labels";
import { Help } from "../common/Help";
import { scoreChanges, scoreSummary, type ScoreItem } from "./score";
import "./score.css";
const signed = (n: number) => n > 0 ? `+${n}` : String(n);
const seconds = (n: number) => `${Number(n.toFixed(2))}秒`;
export function StrategyScore(props: { analysis: MatchAnalysis; onSeek: (time: number, robot?: number) => void }) {
  return <Score key={props.analysis.samples.map(s => `${s.edge}/${s.t}`).join(",")} {...props} />;
}
function Score({ analysis, onSeek }: { analysis: MatchAnalysis; onSeek: (time: number, robot?: number) => void }) {
  const [team, setTeam] = useState(0);
  const [item, setItem] = useState<ScoreItem | "">("");
  const [direction, setDirection] = useState("");
  const [selected, setSelected] = useState("");
  const changes = useMemo(() => scoreChanges(analysis), [analysis]);
  const summary = useMemo(() => scoreSummary(analysis, team), [analysis, team]);
  const visible = changes.filter(row => {
    const delta = row.changes[team][item || "total"];
    return (item ? delta !== 0 : summary.some(part => row.changes[team][part.key] !== 0)) && (!direction || (direction === "gain" ? delta > 0 : delta < 0));
  });
  const active = visible.find(row => row.key === selected) ?? visible[0];
  const name = team === 0 ? "赤" : "青";
  return <section className="strategy-score" aria-label="得点の組み立て">
    <header><h3>得点の組み立て</h3><Help topic="score" text="開始時の点数と、この展開での増減を分けています。同時刻の動作は得点変化の確認用で、機体別の寄与を示すものではありません。" /></header>
    {!analysis.samples.length ? <p>得点の記録がありません。</p> : <>
      <div className="strategy-score-controls"><label>チーム <select value={team} onChange={e => { setTeam(Number(e.target.value)); setSelected(""); }}><option value={0}>赤</option><option value={1}>青</option></select></label><span>{seconds(analysis.start)} → {seconds(analysis.end)}</span></div>
      <div className="strategy-score-scroll"><table aria-label={`${name}の得点内訳`}><thead><tr><th>項目</th><th>開始</th><th>増加</th><th>減少</th><th>差引</th><th>終了</th></tr></thead><tbody>{summary.map(part => <tr key={part.key}><th><button type="button" className="link" aria-pressed={item === part.key} onClick={() => setItem(item === part.key ? "" : part.key)}>{part.label}</button></th><td>{part.start}</td><td>{signed(part.gained)}</td><td>{part.lost}</td><td>{signed(part.end - part.start)}</td><td>{part.end}</td></tr>)}</tbody><tfoot><tr><th>合計</th><td>{analysis.samples[0].parts[team].total}</td><td>{signed(summary.reduce((n, p) => n + p.gained, 0))}</td><td>{summary.reduce((n, p) => n + p.lost, 0)}</td><td>{signed(analysis.samples.at(-1)!.parts[team].total - analysis.samples[0].parts[team].total)}</td><td>{analysis.samples.at(-1)!.parts[team].total}</td></tr></tfoot></table></div>
      <div className="strategy-score-controls"><label>項目 <select value={item} onChange={e => setItem(e.target.value as ScoreItem | "")}><option value="">合計</option>{summary.map(p => <option value={p.key} key={p.key}>{p.label}</option>)}</select></label><label>増減 <select value={direction} onChange={e => setDirection(e.target.value)}><option value="">すべて</option><option value="gain">増加</option><option value="loss">減少</option></select></label><span>{visible.length}件</span>{(item || direction) && <IconButton icon="reset" label="得点の絞り込みを解除" onClick={() => { setItem(""); setDirection(""); }} />}</div>
      <div className="strategy-score-scroll strategy-score-events"><table aria-label="得点が変わった時刻"><thead><tr><th>時刻</th><th>{name}の変化</th><th>赤合計</th><th>青合計</th><th>点差（赤−青）</th></tr></thead><tbody>{visible.map(row => <tr key={row.key} data-selected={row.key === active?.key || undefined}><td><button type="button" aria-pressed={row.key === active?.key} onClick={() => { setSelected(row.key); onSeek(row.time); }}>{seconds(row.time)}</button></td><td>{signed(row.changes[team][item || "total"])}</td><td>{row.after[0].total}</td><td>{row.after[1].total}</td><td>{signed(row.after[0].total - row.after[1].total)}</td></tr>)}</tbody></table></div>
      {!visible.length && <p role="status">{changes.length ? "条件に合う得点変化がありません。" : "この展開では得点が変化していません。"}</p>}
      {active && <div className="strategy-score-context"><strong>{seconds(active.time)}の得点変化</strong><p>{summary.filter(p => active.changes[team][p.key] !== 0).map(p => `${p.label} ${signed(active.changes[team][p.key])}`).join("・") || `${name}の内訳に変化なし`}</p><strong>同時刻に記録された動作</strong>{active.actions.length ? <ul>{active.actions.map((marker, i) => <li key={i}><button type="button" className="link" onClick={() => onSeek(marker.t, marker.robot ?? undefined)}>{marker.robot === null ? "機体未記録" : robotNames[marker.robot]} · {actionName(marker.action!)}</button></li>)}</ul> : <p>完了動作の記録がありません。</p>}</div>}
    </>}
  </section>;
}
