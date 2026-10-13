import type { Strategy } from "./types";
import { actionName, robotNames } from "./api";

type Branch = {
  batch: string[];
  children: Map<string, Branch>;
  ids: string[];
  leaves: string[];
};
function eventName(raw: string) {
  const [robot, phase, kind, dest, spot, objects] = JSON.parse(raw);
  return `${robotNames[robot]} ${actionName({ kind, dest: dest ?? undefined, spot: spot ?? undefined, objects: objects ?? undefined })} ${phase === "start" ? "開始" : phase === "finish" ? "完了" : "競合で中断"}`;
}
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
                第{depth}バッチ · {b.ids.length} 作戦 · {b.batch.length}{" "}
                イベント
              </summary>
              <ul>
                {b.batch.map((e) => (
                  <li key={e}>{eventName(e)}</li>
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
      <p>同時刻のイベントを1バッチとして、共通の先頭部分で分かれます。</p>
      {branches(root, 1)}
    </details>
  );
}
