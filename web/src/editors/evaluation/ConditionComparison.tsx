import { useState } from "react";
import type { Config, Model } from "../../engine/types";
import { configDifferences, differenceValue } from "../common/configDifferences";
import { run } from "../../app/commands";
import "./commands";

export function ConditionComparison({ before, after, model }: { before: Config; after: Config; model: Model }) {
  const [contextOnly, setContextOnly] = useState(false);
  const differences = configDifferences(before, after, model);
  const visible = differences.filter((d) => !contextOnly || d.context);
  return <div className="condition-comparison"><p>条件差分 {differences.length}項目</p>
    <div className="row"><label><input type="checkbox" checked={contextOnly} onChange={(e) => setContextOnly(e.target.checked)} />比較の前提が異なる項目だけ</label>
      <button disabled={!visible.length} onClick={() => run("evaluation.exportConditionDifferences", { version: 1, before, after, differences: visible.map(({ restore: _restore, ...d }) => d) })}>表示差分を書き出す</button>
    </div>
    {visible.length ? <table><thead><tr><th>項目</th><th>比較対象</th><th>選択中</th></tr></thead><tbody>{visible.map((d) => <tr key={d.id}><th scope="row">{d.group} · {d.label}{d.context && <small>（比較の前提）</small>}</th><td>{differenceValue(d.before, d.id)}</td><td>{differenceValue(d.after, d.id)}{d.id === "initial" && <details><summary>局面データを照合</summary><pre>{JSON.stringify({ baseline: d.before, current: d.after }, null, 2)}</pre></details>}</td></tr>)}</tbody></table> : <p className="muted">この範囲に差分はありません</p>}
  </div>;
}
