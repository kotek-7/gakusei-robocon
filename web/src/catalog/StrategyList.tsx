import { useState } from "react";
import type { Plan } from "../simulation/types";
import { flipCondition } from "./decisions";
import { title, supplies } from "./plans";
import { label } from "./labels";
export function StrategyList({ plans, current, onSelect }: { plans: Plan[]; current: Plan; onSelect(plan: Plan): void }) {
  const [query, setQuery] = useState(""), [mission, setMission] = useState(""), [flip, setFlip] = useState(""), [page, setPage] = useState(0);
  const matches = plans.filter(p => (!mission || p.mission === (mission === "yes")) && (!flip || flipCondition(p) === flip) && `${p.id} ${title(p)} ${label("mission", p.mission ? "yes" : "no")} ${label("flip", flipCondition(p))} ${supplies[p.supply]}`.toLowerCase().includes(query.trim().toLowerCase()));
  const last = Math.max(0, Math.ceil(matches.length / 20) - 1), index = Math.min(page, last);
  function clear() { setQuery(""); setMission(""); setFlip(""); setPage(0); }
  return <section className="strategy-list" aria-label="作戦一覧">
    <div className="list-filters">
      <p>選ぶと、その場で最初から再生します。</p>
      <input type="search" aria-label="作戦を検索" placeholder="番号・場所・方針で検索" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} />
      <div className="list-filter-row">
        <select aria-label="得点の狙い" value={mission} onChange={e => { setMission(e.target.value); setPage(0); }}><option value="">すべての狙い</option><option value="no">ブロックに集中</option><option value="yes">ムスティカも狙う</option></select>
        <select aria-label="反転の方針" value={flip} onChange={e => { setFlip(e.target.value); setPage(0); }}><option value="">すべての反転方針</option><option value="never">反転しない</option><option value="late">終盤に反転</option><option value="always">常に反転を優先</option></select>
      </div>
      {(query || mission || flip) && <button onClick={clear}>絞り込みを解除</button>}
    </div>
    <div className="list-current">表示中：#{current.id} {title(current)}</div>
    <div className="strategy-items" key={`${index}:${query}:${mission}:${flip}`}>
      {matches.slice(index * 20, (index + 1) * 20).map(p => <button key={p.id} className="strategy-item" aria-pressed={p.id === current.id} onClick={() => onSelect(p)}>
        <span><small>#{p.id}</small> <strong>{p.mission ? "ムスティカも狙う" : "ブロックに集中"}・{label("flip", flipCondition(p))}</strong></span>
        <span>{title(p)}</span>
        <small>{p.mode === "reuse" ? "既存の土台を優先" : "場所を優先"} / {supplies[p.supply]}</small>
        <span className="play-label">{p.id === current.id ? "表示中・最初から再生" : "この作戦を再生"}</span>
      </button>)}
      {!matches.length && <div className="empty"><p>条件に合う作戦がありません。</p><button onClick={clear}>絞り込みを解除</button></div>}
    </div>
    <div className="list-pagination"><button disabled={index === 0} onClick={() => setPage(index - 1)}>前へ</button><span role="status">{matches.length ? `${index * 20 + 1}–${Math.min((index + 1) * 20, matches.length)}` : 0} / {matches.length}案</span><button disabled={index === last} onClick={() => setPage(index + 1)}>次へ</button></div>
  </section>;
}
