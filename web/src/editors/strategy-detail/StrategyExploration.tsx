import { Icon } from "../../shell/icons";
import { IconButton } from "../common/IconButton";
import { useEffect, useState } from "react";
import type { CandidateEvidence, Search } from "../../engine/types";
import { saveJSON } from "../../app/coreCommands";
import { useQuery } from "../../app/data";
import { isEnabled, run } from "../../app/commands";
import { useUI } from "../../app/store";
import { layout } from "../../app/layout";
import { Help } from "../common/Help";
import { resolveStrategy, type StrategySelection } from "./selection";
import { sessionGained, sessionResponses, sessionWorst } from "./explorationHistory";
import "./explorationCommands";
import "./exploration.css";

const reasons: Record<string,string> = {time:"時間到達", timeout:"時間到達", budget:"時間到達", paused:"停止", pause:"停止", complete:"対象範囲を探索済み", exhausted:"対象範囲を探索済み", interrupted:"中断", error:"エラー", time_limit:"時間到達", cancelled:"停止", resource_limit:"保存容量の上限", completed:"対象範囲を探索済み"};
const duration = (n: number) => n < 60 ? `${Math.round(n)}秒` : `${Math.floor(n / 60)}分${Math.round(n % 60)}秒`;
const margin = (n: number | null | undefined) => n == null ? "未検査" : `${n > 0 ? "+" : ""}${n}`;
export type ExplorationSettings = {mode: "counter"|"compare"; seconds: number};
export function StrategyExploration({search, selection, onEvidence, settings, onSettings}: {search:Search; selection:StrategySelection; onEvidence:(e:CandidateEvidence)=>void; settings?:ExplorationSettings; onSettings?:(settings:ExplorationSettings)=>void}) {
  const [localMode,setLocalMode] = useState<"counter"|"compare">("counter");
  const mode = settings?.mode ?? localMode;
  const setMode = (value: "counter"|"compare") => { setLocalMode(value); onSettings?.({mode:value,seconds}); };
  const [localSeconds,setLocalSeconds] = useState(60);
  const seconds = settings?.seconds ?? localSeconds;
  const setSeconds = (value:number) => { setLocalSeconds(value); onSettings?.({mode,seconds:value}); };
  const query = useQuery("candidate.analysis", {search:search.id,run:selection.run,candidate:selection.candidate});
  useUI(s => s.busy);
  useUI(s => s.activeArea);
  const jobRun = useUI(s => s.jobRun[search.id]);
  const [now,setNow] = useState(Date.now());
  useEffect(() => {
    if (search.status !== "running") return;
    const timer = setInterval(()=>setNow(Date.now()),1000);
    return () => clearInterval(timer);
  },[search.status]);
  const {data} = query;
  const resolved = resolveStrategy(search,selection);
  if (!resolved) return <p>作戦候補が見つかりません。</p>;
  const active = search.discovery?.activeTarget;
  const running = search.status === "running" || search.status === "evaluating";
  const same = active?.run === selection.run && active.candidate === selection.candidate;
  const target = {run:selection.run,candidate:selection.candidate,mode};
  const args = {search:search.id,target,seconds};
  const work = data?.[mode];
  const worst = resolved.candidate.responses.reduce<CandidateEvidence | undefined>((a,b) => !a || b.scores[0]-b.scores[1] < a.scores[0]-a.scores[1] ? b : a, undefined);
  const ordinal = resolved.run.candidates.indexOf(resolved.candidate)+1;
  const activeRun = active && search.discovery?.runs.find(r=>r.run===active.run);
  const activeOrdinal = activeRun && activeRun.candidates.findIndex(c=>c.id===active?.candidate);
  return <div className="strategy-exploration">
    <div className="exploration-title"><h3>候補 {ordinal} の追加探索</h3><Help topic="search" title="追加探索" text="相手探索は赤の指示を固定し、青に有利な展開を探します。既知の相手で検査は、見つかっている青の手順をこの候補へ当てます。途中経過を保存し、次回は続きから計算します。" /></div>
    <div className="exploration-controls">
      <label>計算<select value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="counter">相手の展開を探索</option><option value="compare">既知の相手で検査</option></select></label>
      <label title="追加探索の制限時間"><Icon name="clock" /><select aria-label="追加探索の制限時間" value={seconds} onChange={e=>setSeconds(Number(e.target.value))}>{[[10,"10秒"],[60,"1分"],[300,"5分"],[1800,"30分"],[3600,"1時間"],[21600,"6時間"],[86400,"24時間"]].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
      <IconButton icon={work?.complete ? "check" : "play"} label={work?.complete ? "対象範囲を探索済み" : work?.ticks ? "続きから実行" : "実行"} className="primary" disabled={!data || work?.complete || !isEnabled("strategy.explore.start",args)} onClick={()=>run("strategy.explore.start",args)}>{work?.complete ? "探索済み" : work?.ticks ? "続行" : "実行"}</IconButton>
      {running && same && active && <IconButton icon="pause" label="保存して停止" disabled={!isEnabled("strategy.explore.pause",{...args,target:active})} onClick={()=>run("strategy.explore.pause",{...args,target:active})} />}
    </div>
    <p className="exploration-status" role="status">{running ? same ? `${active?.mode === "counter" ? "相手の展開を探索中" : "既知の相手で検査中"} · 構成 C${selection.run} / 候補 ${ordinal}` : active ? `構成 C${active.run} / 候補 ${activeOrdinal == null || activeOrdinal < 0 ? active.candidate : activeOrdinal+1} を計算中` : "別の計算を実行中" : work?.complete ? "この計算の対象範囲を探索済み" : "停止中 · 途中経過から再開できます"}{running && !same && <IconButton icon="forward" label="計算と進捗へ" onClick={()=>layout.reveal("jobs")} />}</p>
    {running && same && jobRun && <p className="muted">今回の経過 {duration(Math.max(0,(now-jobRun.startedAt)/1000))} / 制限 {duration(jobRun.seconds)}</p>}
    {search.error && <p role="alert">{search.error}</p>}
    {query.error && <p role="alert">追加探索の状態を取得できません：{query.error}</p>}
    {query.loading && !data && <p>計算状況を読み込み中…</p>}
    {data && <>
      <dl className="exploration-metrics"><div><dt>検査した展開</dt><dd>{data.responses.toLocaleString()}</dd></div><div><dt>検査済み相手手順</dt><dd>{data.checkedOpponents} / {data.opponents}</dd></div><div><dt>検査内の最小点差</dt><dd>{margin(data.worstMargin)}{worst && <IconButton icon="eye" label="展開を見る" onClick={()=>onEvidence(worst)} />}</dd></div></dl>
      <div className="exploration-work"><span>計算回数 {work?.ticks.toLocaleString()}</span><span>未完了の計算 {work?.pendingJobs} / {work?.jobs}</span><span>未展開の局面 {work?.frontier.toLocaleString()}</span><span>未試行の選択肢 {work?.remainingChoices.toLocaleString()}</span><Help topic="search" title="計算の進捗" text="計算回数は探索処理の実行回数です。探索中に分岐が増えるため、残り件数から終了時刻や進捗率は算出できません。最小点差は検査済みの展開内の値で、全ての相手への保証ではありません。" /></div>
    </>}
  </div>;
}


export function StrategyExplorationHistory({search, selection, onEvidence, onResumeSettings}: {search:Search; selection:StrategySelection; onEvidence:(e:CandidateEvidence)=>void; onResumeSettings?:(settings:ExplorationSettings)=>void}) {
  const query = useQuery("candidate.analysis", {search:search.id,run:selection.run,candidate:selection.candidate});
  const [selected,setSelected] = useState("");
  const [gainsOnly,setGainsOnly] = useState(false);
  const [limit,setLimit] = useState(20);
  useUI(s => s.busy);
  useUI(s => s.activeArea);
  useEffect(()=>{setSelected("");setLimit(20);},[search.id,selection.run,selection.candidate]);
  const resolved = resolveStrategy(search,selection);
  if (!resolved) return <p>作戦候補が見つかりません。</p>;
  const sessions = (query.data?.sessions ?? []).map((session,index)=>({session,key:`${session.started}-${index}`})).reverse().filter(({session})=>!gainsOnly || sessionGained(session));
  const chosen = sessions.find(s=>s.key===selected) ?? sessions[0];
  const session = chosen?.session;
  const rows = session ? sessionResponses(session,resolved.candidate,selection) : null;
  const worst = sessionWorst(rows);
  const args = session?.target ? {search:search.id,target:session.target,seconds:session.budget} : undefined;
  const complete = session?.target && query.data?.[session.target.mode].complete;
  const exportRun = () => {
    if (!session) return;
    const payload = {format:"robocon-candidate-analysis-record",version:1,search:search.id,candidate:selection.candidate,run:selection.run,scope:search.discovery?.scope,config:search.config,variant:resolved.run.variant,session,addedResponses:rows,note:"追加展開は保存された件数範囲に対応します。sharedは出力時点の値です。この記録だけでは探索を復元できません。"};
    saveJSON(payload, `candidate-analysis-${session.started ?? "record"}.json`);
  };
  return <div className="strategy-exploration">
    <div className="exploration-title"><h3>追加探索の実行履歴</h3><Help topic="search" title="探索履歴" text="選んだ実行で追加された展開を表示します。続きから実行は、その実行と同じ種類・制限時間を使います。初めからの再計算ではありません。保存時点より後の未保存の計算は含まれません。" /></div>
    {query.error && <p role="alert">履歴を取得できません：{query.error}</p>}
    {query.loading && !query.data && <p>履歴を読み込み中…</p>}
    <div className="exploration-controls"><label>実行<select aria-label="調べる実行" value={chosen?.key ?? ""} disabled={!sessions.length} onChange={e=>{setSelected(e.target.value);setLimit(20);}}>{sessions.map(({session:s,key})=><option key={key} value={key}>{s.started ? new Date(s.started).toLocaleString("ja-JP") : "日時不明"} · {s.target?.mode === "compare" ? "既知の相手" : "相手探索"} · {reasons[s.reason] ?? s.reason}</option>)}</select></label><label><input type="checkbox" checked={gainsOnly} onChange={e=>setGainsOnly(e.target.checked)} />結果が増えた実行のみ</label></div>
    {!session && query.data && <p className="muted">{gainsOnly ? "結果が増えた実行はありません。" : "この候補を指定した実行履歴はありません。"}</p>}
    {session && <>
      <dl className="exploration-metrics"><div><dt>実行時間 / 制限</dt><dd>{duration(session.seconds)} / {duration(session.budget)}</dd></div><div><dt>追加展開</dt><dd>{rows ? rows.length : "照合できません"}</dd></div><div><dt>最小点差の変化</dt><dd>{margin(session.before?.worstMargin)} → {margin(session.after?.worstMargin)}</dd></div><div><dt>追加の検査済み相手手順</dt><dd>{session.before && session.after ? session.after.checkedOpponents-session.before.checkedOpponents : "—"}</dd></div></dl>
      <div className="exploration-controls"><IconButton icon="play" label="同じ条件で続きから実行" disabled={!args || complete || !isEnabled("strategy.explore.start",args)} onClick={()=>{if (!args || !isEnabled("strategy.explore.start",args)) return; run("strategy.explore.start",args);onResumeSettings?.({mode:args.target.mode,seconds:args.seconds});}}>同条件で続行</IconButton><IconButton icon="download" label="実行記録をJSON保存" onClick={exportRun} />{worst && <IconButton icon="chart" label="追加展開の最小点差を見る" onClick={()=>onEvidence(worst.evidence)}>最小点差</IconButton>}</div>
      {!rows ? <p className="muted">保存された件数と現在の展開が一致しないため、追加展開を特定できません。</p> : rows.length === 0 ? <p className="muted">この実行で追加された展開はありません。</p> : <div className="exploration-table-wrap" tabIndex={0} aria-label="この実行で追加された展開"><table><thead><tr><th>展開</th><th>相手手順</th><th>赤 対 青</th><th>点差</th><th>実行不可</th></tr></thead><tbody>{rows.slice(0,limit).map(({evidence:e,ordinal})=><tr key={ordinal}><td><IconButton icon="eye" label={`対応${ordinal}を見る`} onClick={()=>onEvidence(e)}>対応{ordinal}</IconButton></td><td title={e.opponent}>{e.opponent?.slice(0,10) ?? "—"}</td><td>{e.scores[0]} 対 {e.scores[1]}</td><td>{margin(e.scores[0]-e.scores[1])}</td><td>{e.blocked?.length ?? 0}</td></tr>)}</tbody></table></div>}
      {rows && rows.length>limit && <button onClick={()=>setLimit(n=>n+20)}>次の20件を表示（残り {rows.length-limit} 件）</button>}
    </>}
  </div>;
}
