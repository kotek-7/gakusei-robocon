import { IconButton } from "../common/IconButton";
import { useState } from "react";
import type { Candidate, CandidateEvidence, CandidateInstructions, Model, Variant } from "../../engine/types";
import { Help } from "../common/Help";
import { planRows, planTargets, instructionRow, instructionSummary } from "./plan";
import { profileNames, robotNames } from "../common/labels";
import "./plan.css";

export function StrategyPlan({ candidate, onSpot, instructions, blocked, onSeek, view, onInstructions, initialRobot }: { view: "summary" | "completed" | "instructions"; onInstructions: (robot: number) => void; initialRobot?: number; onSeek?: (t: number, robot: number) => void; instructions?: CandidateInstructions; blocked?: CandidateEvidence["blocked"]; candidate: Candidate; variant?: Variant; model?: Model; onSpot?: (spot: number) => void }) {
  // A candidate switch must never retain a filter for another plan.
  const [scope, setScope] = useState<{ candidate: Candidate; target: string }>({ candidate, target: "" });
  const target = scope.candidate === candidate ? scope.target : "";
  const targets = planTargets(candidate.plan), rows = planRows(candidate.plan);
  const selected = targets.find(item => item.key === target);
  const visible = selected ? rows.filter(row => selected.orders.includes(row.order)) : rows;
  const [robotFilter, setRobotFilter] = useState(initialRobot === undefined ? "" : String(initialRobot));
  const scripts = instructions ? [...instructions.red, ...(instructions.blue ?? [])] : [];
  const activeRobotFilter = robotFilter !== "" && Number(robotFilter) < scripts.length ? robotFilter : "";
  return <div className="strategy-plan">
    {view === "summary" && <section aria-label="機体別の固定手順概要">
      <header><h3>機体別の固定手順</h3><Help topic="search" text="固定された指示の種類と件数、移動先・操作地点を集約しています。成功数や完成した塔の数ではありません。" /></header>
      <div className="strategy-plan-table"><table><thead><tr><th scope="col">機体</th><th scope="col">指示の内訳</th><th scope="col">移動先・操作地点</th><th scope="col">詳細</th></tr></thead><tbody>{[0, 1].map(robot => {
        const script = instructions?.red[robot];
        const summary = script ? instructionSummary(script) : null;
        return <tr key={robot}><th scope="row">{robotNames[robot]}</th><td>{summary ? summary.actions.map(item => `${item.action} ${item.count}件`).join("・") || "指示なし" : "読み込み中"}</td><td>{summary ? summary.destinations.join("、") || "地点指定なし" : "読み込み中"}</td><td><IconButton icon="list" label={`${robotNames[robot]}の固定手順へ`} type="button" disabled={!script?.length} onClick={() => onInstructions(robot)} /></td></tr>;
      })}</tbody></table></div>
    </section>}
    {view === "completed" && <section aria-label="相手待機時の完了結果">
      <header><h3>相手待機時の完了結果</h3><Help topic="search" text="基準展開で完了した赤側の建設・反転・ムスティカ設置を順に表示します。同じ対象への連続設置は一行にまとめられ、移動や受け渡しは含みません。全動作は実行記録で確認できます。" /></header>
      <div className="strategy-plan-tools"><label>対象<select value={target} onChange={e => setScope({ candidate, target: e.target.value })}><option value="">すべて</option>{targets.map(item => <option key={item.key} value={item.key}>{item.target}（順序 {item.orders.join(", ")}）</option>)}</select></label><span>{visible.length} / {rows.length}項目</span>{selected && <IconButton icon="reset" label="完了結果の絞り込みを解除" type="button" onClick={() => setScope({ candidate, target: "" })} />}</div>
      {rows.length ? <div className="strategy-plan-table"><table><thead><tr><th scope="col">順序</th><th scope="col">動作</th><th scope="col">対象</th><th scope="col">記録された指定</th></tr></thead><tbody>{visible.map(row => <tr key={row.order}><td>{row.order}</td><td>{row.action}</td><td>{row.goal.spot !== undefined && row.area !== "位置未記録" && onSpot ? <button type="button" className="strategy-spot-link" onClick={() => onSpot(row.goal.spot!)} aria-label={`${row.target}を3Dで選択`}>{row.target}</button> : row.target}{row.area && <small>{row.area}</small>}</td><td>{row.recorded || "指定なし"}</td></tr>)}</tbody></table></div> : <p className="muted">基準展開には建設・反転・ムスティカ設置の完了記録がありません。</p>}
    </section>}
    {view === "instructions" && <section aria-label="固定手順">
      <header><h3>固定手順</h3><Help topic="search" text="各機体は番号順に手順を進め、移動先へはモデルの最短経路を使います。不成立は選択中の展開との照合結果です。機体間の同じ番号は同時刻を意味しません。" /></header>
      <div className="strategy-plan-tools"><label>機体<select value={activeRobotFilter} onChange={e => setRobotFilter(e.target.value)}><option value="">赤TR・赤BR</option>{scripts.map((_, robot) => <option key={robot} value={robot}>{robotNames[robot]}</option>)}</select></label></div>
      {!instructions ? <p className="muted">固定手順を読み込んでいます。</p> : scripts.map((script, robot) => (activeRobotFilter === "" ? robot < 2 : String(robot) === activeRobotFilter) && <div className="strategy-instruction-track" key={robot}>
        <h4>{robotNames[robot]} <span>{script.length}手順</span></h4>
        {script.length ? <ol>{script.map((instruction, index) => {
          const row = instructionRow(instruction, index);
          const failures = blocked?.filter(issue => issue.robot === robot && issue.instruction === index) ?? [];
          return <li key={index} value={row.order}><div><strong>{row.action}</strong><span className="strategy-instruction-location">{row.location}</span>{row.resources.length > 0 && <ul>{row.resources.map((resource, i) => <li key={i}>{resource}</li>)}</ul>}{failures.length > 0 && <p className="strategy-instruction-failure">不成立 {failures.map((issue, failureIndex) => <span key={`${issue.t}/${failureIndex}`}>{failureIndex > 0 && "・"}{onSeek ? <button type="button" className="strategy-spot-link" aria-label={`${robotNames[robot]}の手順${row.order}が不成立になった${issue.t}秒を3Dで確認`} onClick={() => onSeek(issue.t, robot)}>{issue.t}秒を確認</button> : `${issue.t}秒`}</span>)} · {failures[0].reason}</p>}</div></li>;
        })}</ol> : <p className="muted">固定された手順はありません。</p>}
      </div>)}
    </section>}
  </div>;
}

export function StrategyConfiguration({ variant, model }: { variant: Variant; model: Model }) {
  const red = variant.teams[0];
  const [capScope, setCapScope] = useState("all");
  const caps = Object.entries(red?.caps ?? {}).filter(([, value]) => capScope === "all" || (capScope === "yes" ? value !== false : value === false));
  return <div className="strategy-plan">
    <section aria-label="赤の機体構成">
      <header><h3>赤の機体構成</h3><Help topic="model" text="この候補を探索した赤側の設定です。有効な能力が、この作戦ですべて使われたとは限りません。速度・動作時間は探索時のプロファイルを表示します。" /></header>
      <div className="strategy-plan-tools"><label>能力<select value={capScope} onChange={e => setCapScope(e.target.value)}><option value="all">すべて</option><option value="yes">有効・積載数</option><option value="no">無効</option></select></label></div>
      <div className="strategy-configuration"><dl>{caps.map(([key, value]) => <div key={key}><dt>{model.caps[key] ?? key}</dt><dd>{typeof value === "boolean" ? value ? "有効" : "無効" : value}</dd></div>)}{!caps.length && <p className="muted">該当する能力はありません。</p>}</dl><dl>{Object.entries(red?.speeds ?? {}).map(([key, value]) => <div key={key}><dt>{(model.profiles[key] ?? key).replace(/ m\/s$| 秒$/g, "")}</dt><dd>{profileNames[value] ?? `設定 ${value}`}</dd></div>)}</dl></div>
    </section>
  </div>;
}
