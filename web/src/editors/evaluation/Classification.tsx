import { useState } from "react";
import { Help } from "../common/Help";
import { DetailView } from "../common/DetailView";
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
    <DetailView label="分類をたどる" className="classification">
      <div className="classification-navigation" aria-label="分類の階層">
        {trail.map((_, index) => <button key={index} aria-current={index === trail.length - 1 ? "location" : undefined} onClick={() => setPath(validPath.slice(0, index))}>{index ? `${index}組目` : "全作戦"}</button>)}
        <Help topic="results" text="動作の開始・完了などを同時刻ごとにまとめ、共通する先頭の動作から分類をたどれます。" />
      </div>
      <p>{current.ids.length} 作戦 <button onClick={(event) => { onSelect(current.ids); event.currentTarget.closest("dialog")?.close(); }}>この分類の作戦を表示</button></p>
      <table>
        <thead><tr><th>次の同時刻の動作</th><th>作戦数</th><th>操作</th></tr></thead>
        <tbody>{[...current.children].map(([key, branch]) => <tr key={key}>
          <td><ul>{branch.batch.map((event) => <li key={event}>{structuralEventName(event)}</li>)}</ul></td>
          <td>{branch.ids.length}</td>
          <td><button onClick={() => setPath([...validPath, key])}>分類へ進む</button> <button onClick={(event) => { onSelect(branch.ids); event.currentTarget.closest("dialog")?.close(); }}>作戦を表示</button></td>
        </tr>)}</tbody>
      </table>
      {!!current.leaves.length && <ul className="classification-leaves">{current.leaves.map((id) => <li key={id}><button title={id} onClick={(event) => { onSelect([id]); event.currentTarget.closest("dialog")?.close(); }}>{id.slice(0, 14)}</button></li>)}</ul>}
      {!current.ids.length && <p>分類できる作戦はまだありません。</p>}
    </DetailView>
  );
}
