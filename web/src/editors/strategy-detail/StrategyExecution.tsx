import { Icon } from "../../shell/icons";
import { IconButton } from "../common/IconButton";
import { useId, useMemo, useState } from "react";
import type { MatchAnalysis } from "../../engine/analysis";
import { actionName, locationName, robotNames } from "../common/labels";
import { Help } from "../common/Help";
import { executionCategory, executionRows, executionTotals, overlappingExecution } from "./execution";
import "./execution.css";

const seconds = (value: number) => `${Number(value.toFixed(2))}秒`;
export function StrategyExecution({ analysis, onSeek }: { analysis: MatchAnalysis; onSeek: (time: number, robot?: number) => void }) {
  return <Execution key={`${analysis.start}:${analysis.end}:${analysis.intervals.map(iv => `${iv.edge}/${iv.robot}`).join(",")}`} analysis={analysis} onSeek={onSeek} />;
}
function Execution({ analysis, onSeek }: { analysis: MatchAnalysis; onSeek: (time: number, robot?: number) => void }) {
  const radioName = useId();
  const [robot, setRobot] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [start, setStart] = useState(String(analysis.start));
  const [end, setEnd] = useState(String(analysis.end));
  const [selected, setSelected] = useState("");
  const [sort, setSort] = useState("time");
  const range: [number, number] = [Math.max(analysis.start, Number(start)), Math.min(analysis.end, Number(end))];
  const valid = start.trim() !== "" && end.trim() !== "" && range.every(Number.isFinite) && range[1] > range[0];
  const all = useMemo(() => executionRows(analysis, valid ? range : [0, 0]), [analysis, range[0], range[1], valid]);
  const visible = all.filter(row => (robot === "" || row.interval.robot === Number(robot)) && (!category || executionCategory(row.interval) === category) && (!query.trim() || `${actionName(row.interval.action)} ${locationName(row.interval.from)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))
    .sort((a, b) => sort === "duration" ? b.seconds - a.seconds || a.start - b.start : a.start - b.start || a.interval.robot - b.interval.robot);
  const active = visible.find(row => row.key === selected) ?? visible[0];
  const overlaps = active ? overlappingExecution(all, active) : [];
  return <section className="strategy-execution" aria-label="動作と時間配分">
    <header><h3>動作と時間配分</h3><Help topic="timeline" text="選択した展開の記録を集計します。作業は移動・待機以外の動作です。未記録を待機と見なさず、同時動作から協調や因果は判定しません。" /></header>
    <div className="execution-controls">
      <label>開始 <input aria-label="解析開始秒" type="number" min={analysis.start} max={analysis.end} step="any" value={start} onChange={e => setStart(e.target.value)} /></label>
      <label>終了 <input aria-label="解析終了秒" type="number" min={analysis.start} max={analysis.end} step="any" value={end} onChange={e => setEnd(e.target.value)} /></label>
      <IconButton icon="fit" label="全区間" type="button" onClick={() => { setStart(String(analysis.start)); setEnd(String(analysis.end)); }} />
    </div>
    {!valid && <p role="status">終了を開始より後に指定してください。</p>}
    <div className="execution-scroll"><table aria-label="機体別の時間配分"><thead><tr><th>機体</th><th>作業</th><th>移動</th><th>待機</th><th>未記録</th></tr></thead><tbody>{robotNames.map((name, id) => {
      const totals = executionTotals(all, valid ? range : [0, 0], id);
      return <tr key={id}><th><button type="button" className="link" aria-pressed={robot === String(id)} onClick={() => setRobot(robot === String(id) ? "" : String(id))}>{name}</button></th>{(["work", "move", "wait", "unrecorded"] as const).map(key => <td key={key}>{valid ? seconds(totals[key]) : "未集計"}</td>)}</tr>;
    })}</tbody></table></div>
    <div className="execution-controls">
      <label>機体 <select value={robot} onChange={e => setRobot(e.target.value)}><option value="">すべて</option>{robotNames.map((name, id) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>動作 <select value={category} onChange={e => setCategory(e.target.value)}><option value="">すべて</option><option value="work">作業</option><option value="move">移動</option><option value="wait">待機</option></select></label>
      <label title="動作・開始場所を検索"><Icon name="search" /><input aria-label="動作・開始場所を検索" type="search" placeholder="動作・開始場所" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label title="動作の並び順"><Icon name="sort" /><select aria-label="動作の並び順" value={sort} onChange={e => setSort(e.target.value)}><option value="time">開始順</option><option value="duration">長い順</option></select></label>
      {(robot || category || query) && <IconButton icon="reset" label="絞込解除" type="button" onClick={() => { setRobot(""); setCategory(""); setQuery(""); }} />}
      <span>{visible.length}動作</span>
    </div>
    <div className="execution-scroll execution-ledger"><table aria-label="実行した動作"><thead><tr><th>選択</th><th>開始 / 終了</th><th>長さ</th><th>機体・動作</th><th>動作開始場所</th></tr></thead><tbody>
      {visible.map(row => <tr key={row.key} data-active={active?.key === row.key}><td><input type="radio" name={radioName} aria-label={`${robotNames[row.interval.robot]} ${seconds(row.start)} ${actionName(row.interval.action)}を選択`} checked={active?.key === row.key} onChange={() => setSelected(row.key)} /></td><td>{seconds(row.start)} / {seconds(row.end)}</td><td>{seconds(row.seconds)}</td><td>{robotNames[row.interval.robot]} · {actionName(row.interval.action)}</td><td>{locationName(row.interval.from)}</td></tr>)}
      {!visible.length && <tr><td colSpan={5}>{valid ? "一致する動作がありません。" : "区間を指定してください。"}</td></tr>}
    </tbody></table></div>
    {active && <div className="execution-selection">
      <div className="execution-controls"><strong>{robotNames[active.interval.robot]} · {actionName(active.interval.action)}</strong><IconButton icon="first" label={`${seconds(active.start)}の動作開始を3D表示`} onClick={() => onSeek(active.start, active.interval.robot)}>{seconds(active.start)}</IconButton><IconButton icon="last" label={`${seconds(active.end)}の動作終了を3D表示`} onClick={() => onSeek(active.end, active.interval.robot)}>{seconds(active.end)}</IconButton></div>
      <p>記録 {seconds(active.interval.start)}〜{seconds(active.interval.end)} · 予定終了 {seconds(active.interval.planned)}</p>
      <h4>同じ時間帯の他機体 <Help topic="timeline" text="選択動作と時間が重なる記録です。絞込で隠れた機体も表示します。秒数は解析区間内で重なる長さです。" /></h4>
      {overlaps.length ? <div className="execution-scroll"><table aria-label="時間が重なる動作"><thead><tr><th>機体・動作</th><th>重なる時間</th><th>局面</th></tr></thead><tbody>{overlaps.map(row => <tr key={row.key}><td>{robotNames[row.interval.robot]} · {actionName(row.interval.action)}</td><td>{seconds(row.overlap)}</td><td><button type="button" className="link" onClick={() => onSeek(Math.max(active.start, row.start), row.interval.robot)}>{seconds(Math.max(active.start, row.start))}を表示</button></td></tr>)}</tbody></table></div> : <p>他機体の重なる記録はありません。</p>}
    </div>}
  </section>;
}
