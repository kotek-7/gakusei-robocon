import { IconButton } from "../common/IconButton";
import { useState } from "react";
import { Help } from "../common/Help";
import { navigateRow } from "./rowSelection";
import { browseResponses, isCommonResponse, isResponse, responseGroups, responseMargin, type ResponseFilter, type ResponseOption, type ResponseOrder } from "./responseBrowsing";
import "./responseBrowsing.css";

const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;
export function ResponseBrowser({ options, selectedKey, commonOpponents, onSelect, onOpen }: {
  options: ResponseOption[]; selectedKey: string; commonOpponents: string[];
  onSelect: (key: string) => void; onOpen: (option: ResponseOption) => void;
}) {
  const [filter, setFilter] = useState<ResponseFilter>("all");
  const [order, setOrder] = useState<ResponseOrder>("original");
  const [opponent, setOpponent] = useState("");
  const groups = responseGroups(options,commonOpponents);
  const visible = browseResponses(options,commonOpponents,filter,opponent,order);
  const selected = options.find(option => option.key === selectedKey);
  const selectedVisible = visible.some(option => option.key === selectedKey);
  const group = groups.find(group => group.opponent === opponent);
  const reset = () => {setFilter("all"); setOpponent("");};
  return <section className="response-browser" aria-label="検査した展開を調べる">
    <div className="response-browser-heading"><strong>検査した展開</strong><span>{options.filter(isResponse).length}対応 · {groups.length}相手</span><Help topic="results" title="検査した展開" text="検査した展開は、候補を相手の手順と組み合わせて計算した試合の流れです。行を選んでEnterを押すと3Dで確認できます。" /></div>
    <div className="response-browser-settings" role="group" aria-label="展開の絞込・順序">
      <label>検査対象<select aria-label="展開の検査対象" value={filter} onChange={event => setFilter(event.target.value as ResponseFilter)}>
        <option value="all">すべて</option><option value="common">共通比較のみ</option><option value="exploratory">共通比較外</option><option value="blocked">実行不可あり</option><option value="negative">赤の点差が負</option>
      </select></label>
      <label>相手手順<select aria-label="展開の相手手順" value={opponent} onChange={event => setOpponent(event.target.value)}><option value="">すべて</option>{groups.map(group => <option key={group.opponent} value={group.opponent}>{group.opponent} · {group.count}対応</option>)}</select></label>
      <label>並び順<select aria-label="展開の並び順" value={order} onChange={event => setOrder(event.target.value as ResponseOrder)}><option value="original">元の順序</option><option value="margin">点差が小さい順</option><option value="blocked">実行不可が多い順</option></select></label>
    </div>
    {(filter !== "all" || opponent) && <div className="response-browser-scope"><span>{visible.length}件表示 · {({all:"すべて", common:"共通比較", exploratory:"共通比較外", blocked:"実行不可あり", negative:"赤の点差が負"})[filter]}{opponent && ` · 相手 ${opponent.slice(0,12)}`}</span><IconButton icon="reset" label="展開の絞り込みを解除" onClick={reset} /></div>}
    {group && <p className="response-browser-range" title={group.opponent}>この相手の記録：{group.count}対応 · 点差 {signed(group.min)}〜{signed(group.max)}{group.commonCount < group.count ? "（共通比較外を含む）" : ""}</p>}
    {selected && !selectedVisible && <div className="response-browser-scope"><span>選択中：{selected.label}（絞込の対象外）</span><IconButton icon="focus" label="選択中の展開を一覧に表示" onClick={reset} /></div>}
    <div className="candidate-evidence-list"><table role="grid" aria-label="検査した展開。上下キーで選択、Enterで3Dに表示"><thead><tr><th>検査対象</th><th>赤 対 青</th><th>点差</th></tr></thead><tbody>{visible.map((option,index) => <tr key={option.key} data-selectable-row aria-selected={selectedKey === option.key} tabIndex={selectedKey === option.key || (!selectedVisible && index === 0) ? 0 : -1}
      onFocus={() => onSelect(option.key)} onClick={event => event.currentTarget.focus()}
      onKeyDown={event => navigateRow(event, () => {if(option.evidence.path.length) onOpen(option);})} onDoubleClick={() => {if(option.evidence.path.length) onOpen(option);}}>
      <td title={option.evidence.opponent}>{option.label}{isResponse(option) && <small>{isCommonResponse(option,commonOpponents) ? "共通比較" : "共通比較外"}{!!option.evidence.blocked?.length && ` · 実行不可 ${option.evidence.blocked.length}件`}</small>}</td>
      <td>{option.evidence.scores[0]} 対 {option.evidence.scores[1]}</td><td>{signed(responseMargin(option))}</td>
    </tr>)}</tbody></table>{!visible.length && <p className="response-browser-empty">条件に合う展開はありません。</p>}</div>
  </section>;
}
