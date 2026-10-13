import type { Strategy } from "./types";
import { structuralEventName } from "./labels";

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
  function branches(parent: Branch, depth: number): React.ReactNode {
    return (
      <ul className="classification-tree">
        {parent.leaves.map((id) => (
          <li key={id}>
            <button onClick={() => onSelect([id])}>{id}</button>
          </li>
        ))}
        {[...parent.children].map(([key, b]) => (
          <li key={key}>
            <details>
              <summary>
                同時刻の動作 {depth}組目 · {b.ids.length} 作戦 ·{" "}
                {b.batch.length} 動作の記録
              </summary>
              <ul>
                {b.batch.map((e) => (
                  <li key={e}>{structuralEventName(e)}</li>
                ))}
              </ul>
              <button onClick={() => onSelect(b.ids)}>
                この分類の作戦を表示
              </button>
              {branches(b, depth + 1)}
            </details>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <details className="classification">
      <summary>分類階層をたどる</summary>
      <p>
        動作の開始・完了などを同時刻ごとにまとめ、共通の先頭部分で分かれます。
      </p>
      {branches(root, 1)}
    </details>
  );
}
