import { useState } from "react";
import { Help } from "../common/Help";

import type { Strategy } from "../../engine/types";
import { structuralEventName } from "../common/labels";

type Branch = {
  batch: string[];
  children: Map<string, Branch>;
  ids: string[];
  leaves: string[];
};

export function Classification({
  strategies,
  onSelect,
}: {
  strategies: Strategy[];
  onSelect: (ids: string[] | null) => void;
}) {
  const [path, setPath] = useState<string[]>([]);
  const root: Branch = { batch: [], children: new Map(), ids: [], leaves: [] };
  for (const strategy of strategies) {
    let branch = root;
    branch.ids.push(strategy.id);
    for (const batch of strategy.prefix) {
      const key = JSON.stringify(batch);
      if (!branch.children.has(key))
        branch.children.set(key, {
          batch,
          children: new Map(),
          ids: [],
          leaves: [],
        });
      branch = branch.children.get(key)!;
      branch.ids.push(strategy.id);
    }
    branch.leaves.push(strategy.id);
  }
  const trail: Branch[] = [root];
  const validPath: string[] = [];
  for (const key of path) {
    const next = trail.at(-1)!.children.get(key);
    if (!next) break;
    trail.push(next);
    validPath.push(key);
  }
  const current = trail.at(-1)!;
  return (
    <details className="classification"><summary>共通する動作で絞り込む</summary>
      <div className="classification-navigation" aria-label="分類の階層">
        {trail.map((_, index) => <button key={index} aria-current={index === trail.length - 1 ? "location" : undefined} className="classification-path" onClick={() => { setPath(validPath.slice(0, index)); onSelect(index === 0 ? null : trail[index].ids); }}>{index ? `${index}組目` : "全作戦"}</button>)}
        <Help topic="results" text="動作の開始・完了などを同時刻ごとにまとめ、共通する先頭の動作から分類をたどれます。" />
      </div>
      <p className="muted">この分岐に {current.ids.length} 作戦</p>
      <table>
        <thead><tr><th>次の同時刻の動作</th><th>作戦数</th></tr></thead>
        <tbody>{[...current.children].map(([key, branch]) => <tr key={key}>
          <td><button className="classification-branch" onClick={() => { setPath([...validPath, key]); onSelect(branch.ids); }}><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg><span>{branch.batch.map(structuralEventName).join(" / ")}</span></button></td>
          <td>{branch.ids.length}</td>

        </tr>)}</tbody>
      </table>
      {!!current.leaves.length && <ul className="classification-leaves">{current.leaves.map((id) => <li key={id}><button className="classification-leaf" title={id} onClick={() => onSelect([id])}>{id.slice(0, 14)}</button></li>)}</ul>}
      {!current.ids.length && <p>分類できる作戦はまだありません。</p>}
    </details>
  );
}
