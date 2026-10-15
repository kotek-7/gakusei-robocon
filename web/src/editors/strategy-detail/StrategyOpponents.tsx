import { useEffect, useId, useRef, useState } from "react";
import type { Candidate, CandidateEvidence } from "../../engine/types";
import { Help } from "../common/Help";
import { robotNames } from "../common/labels";
import { opponentAnalysis, instructionFailures, margin, type Response } from "./opponentAnalysis";
import "./opponents.css";
const signed = (n: number) => n > 0 ? `+${n}` : String(n);
const range = (a: number, b: number) => a === b ? signed(a) : `${signed(a)}〜${signed(b)}`;
const failureKey = (r: {robot:number; instruction:number; reason:string}) => JSON.stringify([r.robot,r.instruction,r.reason]);
function useDrilldown() {
  const [selection,setSelection]=useState<string|null>(null);
  const prefix=useId();
  const back=useRef<HTMLButtonElement>(null);
  const origin=useRef<HTMLButtonElement|null>(null);
  useEffect(()=>{ if(selection!==null) back.current?.focus(); else if(origin.current) document.getElementById(origin.current.id)?.focus(); },[selection]);
  return {selection,back,id:(key:string)=>`${prefix}-${encodeURIComponent(key)}`,close:()=>setSelection(null),open:(key:string,button:HTMLButtonElement)=>{origin.current=button;setSelection(key);}};
}
function usePage(count:number,scope="") {
  const [requested,changePage]=useState({scope,page:0});
  const setPage=(page:number)=>changePage({scope,page});
  const page=Math.min(requested.scope===scope?requested.page:0,Math.max(0,Math.ceil(count/50)-1));
  const navigation=count>50 ? <nav className="opponent-controls" aria-label="表のページ"><button disabled={page===0} onClick={()=>setPage(page-1)}>前の50件</button><span>{page*50+1}〜{Math.min(count,(page+1)*50)} / {count}件</span><button disabled={(page+1)*50>=count} onClick={()=>setPage(page+1)}>次の50件</button></nav> : null;
  return {page,navigation};
}
function Outcomes({candidate, evidence, onEvidence}: {candidate:Candidate; evidence:Response[]; onEvidence:(e:CandidateEvidence,view?:"score"|"diagnostics")=>void}) {
  const [filter,setFilter]=useState("all");
  const visible=evidence.filter(e=>filter==="all" || filter==="negative" && margin(e)<0 || filter==="blocked" && e.blocked?.some(b=>b.robot<2));
  const pagination=usePage(visible.length,filter);
  const ordinals=new Map(candidate.responses.map((e,index)=>[e,index+1]));
  return <><div className="opponent-controls"><label>展開<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">すべて</option><option value="negative">赤の点差が負</option><option value="blocked">赤に実行不可</option></select></label><span>{visible.length} / {evidence.length}展開</span></div><div className="opponent-table"><table><thead><tr><th>記録</th><th>赤 : 青</th><th>点差</th><th>赤の増減</th><th>赤の実行不可</th><th>確認</th></tr></thead><tbody>{[...visible].sort((a,b)=>margin(a)-margin(b)).slice(pagination.page*50,(pagination.page+1)*50).map(e=><tr key={JSON.stringify([e.opponent,e.node,e.path,e.kind])}><td>展開 {ordinals.get(e)}<small title={e.path.join(" → ")}>局面 {e.node}</small></td><td>{e.scores[0]} : {e.scores[1]}</td><td>{signed(margin(e))}</td><td>{signed(e.scores[0]-candidate.baseline.scores[0])}</td><td>{e.blocked?.filter(b=>b.robot<2).map(b=>`${robotNames[b.robot]} 手順${b.instruction+1} · ${b.t}秒`).join(" / ") || "記録なし"}</td><td><button onClick={()=>onEvidence(e,"score")}>得点を見る</button>{e.blocked?.some(b=>b.robot<2) && <button onClick={()=>onEvidence(e,"diagnostics")}>実行不可を見る</button>}</td></tr>)}</tbody></table>{!visible.length&&<p>条件に合う展開がありません。</p>}</div>{pagination.navigation}</>;
}
export function StrategyOpponents({candidate,common,onEvidence,onExplore}: {candidate:Candidate;common:string[];onEvidence:(e:CandidateEvidence,view?:"score"|"diagnostics")=>void;onExplore:()=>void}) {
  const [filter,setFilter]=useState("all"), [query,setQuery]=useState(""), [sort,setSort]=useState("margin");
  const drill=useDrilldown();
  const groups=opponentAnalysis(candidate,common);
  // Parent keys this view by search, run and candidate; polling may replace every data object.
  const selected=groups.find(r=>r.key===drill.selection);
  const rows=groups.filter(r=>(!query || r.opponent.toLowerCase().includes(query.toLowerCase())) && (filter==="all" || filter==="negative" && r.min<0 || filter==="blocked" && r.redBlocked>0 || filter==="split" && r.min!==r.max || filter==="common" && r.common));
  const pagination=usePage(rows.length,JSON.stringify([filter,query,sort]));
  rows.sort((a,b)=>sort==="loss"?b.redLoss-a.redLoss:sort==="spread"?(b.max-b.min)-(a.max-a.min):a.min-b.min);
  return <section className="strategy-opponents" aria-label="相手展開の解析">
    <header><h3>相手展開の解析</h3><Help topic="results" title="相手展開の解析" text="同じ相手手順の記録をまとめています。点差は赤−青、赤の増減は相手待機時との差です。範囲は確認済みの経路だけを対象にし、勝率を表しません。" /></header>
    {selected ? <><div className="opponent-controls"><button ref={drill.back} onClick={drill.close}>相手一覧へ戻る</button><strong>相手手順</strong><code className="opponent-id">{selected.opponent || "ID未記録"}</code></div><Outcomes key={selected.key} candidate={candidate} evidence={selected.evidence} onEvidence={onEvidence}/></> : <>
    <div className="opponent-controls"><label>対象<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">すべて</option><option value="negative">赤の点差が負</option><option value="blocked">赤に実行不可</option><option value="split">経路で点差が変わる</option><option value="common">共通比較</option></select></label><label>相手ID<input type="search" value={query} onChange={e=>setQuery(e.target.value)} /></label><label>順序<select value={sort} onChange={e=>setSort(e.target.value)}><option value="margin">最小点差順</option><option value="loss">赤の減少が大きい順</option><option value="spread">点差幅順</option></select></label><span>{rows.length}相手</span><button onClick={onExplore}>追加探索へ</button></div>
    {candidate.responses.length ? <div className="opponent-table"><table><thead><tr><th>相手手順</th><th>記録数</th><th>点差の範囲</th><th>赤の増減</th><th>赤の実行不可</th><th>調べる展開</th></tr></thead><tbody>{rows.slice(pagination.page*50,(pagination.page+1)*50).map(r=><tr key={r.key}><td><span title={r.opponent}>{r.opponent.slice(0,12)||"ID未記録"}</span><small>{r.common?"共通比較":"共通比較外"}</small></td><td><button id={drill.id(r.key)} onClick={e=>drill.open(r.key,e.currentTarget)}>{r.evidence.length}展開を見る</button></td><td>{range(r.min,r.max)}</td><td>{range(r.redMinDelta,r.redMaxDelta)}</td><td>{r.redBlocked}展開</td><td><button onClick={()=>onEvidence(r.worst,"score")}>最小点差</button>{r.min!==r.max && <button onClick={()=>onEvidence(r.best,"score")}>最大点差</button>}</td></tr>)}</tbody></table>{!rows.length && <p>条件に合う相手手順がありません。</p>}{pagination.navigation}</div>:<p>相手展開の記録がありません。追加探索でこの候補への対抗手を探せます。</p>}</>}
  </section>;
}
export function StrategyFailures({candidate,onEvidence,onExplore}: {candidate:Candidate;onEvidence:(e:CandidateEvidence)=>void;onExplore:()=>void}) {
  const rows=instructionFailures(candidate),[robot,setRobot]=useState("");
  const drill=useDrilldown();
  const selected=rows.find(r=>failureKey(r)===drill.selection);
  const ordinals=new Map(candidate.responses.map((e,index)=>[e,index+1]));
  const pagination=usePage(selected?.evidence.length??0,drill.selection??"");
  const visible=rows.filter(r=>robot===""||r.robot===Number(robot));
  return <section className="strategy-opponents" aria-label="固定手順の弱点"><header><h3>固定手順の弱点</h3><Help topic="results" title="固定手順の弱点" text="赤の同じ指示・同じ不成立理由を、記録済みの相手展開から集計します。件数は失敗確率ではありません。記録がない指示の成功も保証しません。" /></header>{selected ? <><div className="opponent-controls"><button ref={drill.back} onClick={drill.close}>弱点一覧へ戻る</button><strong>{robotNames[selected.robot]} · 手順{selected.instruction+1}</strong><span>{selected.reason}</span></div><div className="opponent-table"><table><thead><tr><th>記録</th><th>相手手順</th><th>不成立時刻</th><th>点差</th><th>確認</th></tr></thead><tbody>{[...selected.evidence].sort((a,b)=>margin(a)-margin(b)).slice(pagination.page*50,(pagination.page+1)*50).map(e=><tr key={JSON.stringify([e.opponent,e.node,e.path,e.kind])}><td>展開 {ordinals.get(e)}</td><td title={e.opponent}>{e.opponent?.slice(0,12)||"ID未記録"}</td><td>{e.blocked?.filter(b=>failureKey(b)===failureKey(selected)).map(b=>`${b.t}秒`).join(" / ")}</td><td>{signed(margin(e))}</td><td><button onClick={()=>onEvidence(e)}>実行不可を見る</button></td></tr>)}</tbody></table></div>{pagination.navigation}</> : <><div className="opponent-controls"><label>機体<select value={robot} onChange={e=>setRobot(e.target.value)}><option value="">赤TR・赤BR</option><option value="0">赤TR</option><option value="1">赤BR</option></select></label><span>{visible.length}項目</span><button onClick={onExplore}>追加探索へ</button></div><div className="opponent-table"><table><thead><tr><th>機体・手順</th><th>不成立の理由</th><th>時刻</th><th>記録数</th><th>確認</th></tr></thead><tbody>{visible.map(r=><tr key={failureKey(r)}><td>{robotNames[r.robot]} · {r.instruction+1}</td><td>{r.reason}</td><td>{r.first===r.last?`${r.first}秒`:`${r.first}〜${r.last}秒`}</td><td>{r.evidence.length}展開</td><td><button id={drill.id(failureKey(r))} onClick={e=>drill.open(failureKey(r),e.currentTarget)}>該当展開を見る</button></td></tr>)}</tbody></table></div>{!visible.length&&<p>{candidate.responses.length?"該当する実行不可の記録はありません。":"相手展開がまだ検査されていません。"}</p>}</>}</section>;
}
