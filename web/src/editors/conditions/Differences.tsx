import { IconButton } from "../common/IconButton";
import { useState } from "react";
import { run } from "../../app/commands";
import type { Config, Model } from "../../engine/types";
import { configDifferences, differenceValue } from "../common/configDifferences";
import "./commands";

export function Differences({ initial, current, model, change }: { initial: Config; current: Config; model: Model; change: (edit: (config: Config) => void) => void }) {
  const differences = configDifferences(initial, current, model);
  const [group, setGroup] = useState("");
  const visible = differences.filter((d) => !group || d.group === group);
  return <section className="condition-differences">
    <h3>編集開始時との差分 {differences.length}項目</h3>
    <div className="row">
      <label>対象 <select value={group} onChange={(e) => setGroup(e.target.value)}><option value="">すべて</option>{["基本条件", "ルール解釈", "共通の数値", "赤の能力", "青の能力", "赤の数値候補", "青の数値候補"].map((g) => <option key={g}>{g}</option>)}</select></label>
      <IconButton icon="download" label="表示差分を書き出す" disabled={!visible.length} onClick={() => run("conditions.exportDifferences", { version: 1, before: initial, after: current, differences: visible.map(({ restore: _restore, ...d }) => d) })} />
      <IconButton icon="undo" label="表示項目を戻す" disabled={!visible.length} onClick={() => run("conditions.restoreDifference", { restore: () => change((c) => visible.forEach((d) => d.restore(c))) })} />
    </div>
    {visible.length ? <table><thead><tr><th>項目</th><th>編集開始時</th><th>現在</th><th>操作</th></tr></thead><tbody>{visible.map((d) => <tr key={d.id}><th scope="row"><small>{d.group}</small><br />{d.label}</th><td>{differenceValue(d.before, d.id)}</td><td>{differenceValue(d.after, d.id)}{d.id === "initial" && <details><summary>局面データを照合</summary><pre>{JSON.stringify({ before: d.before, after: d.after }, null, 2)}</pre></details>}</td><td><IconButton icon="undo" label={`${d.label}を戻す`} onClick={() => run("conditions.restoreDifference", { restore: () => change(d.restore) })} /></td></tr>)}</tbody></table> : <p className="muted">この範囲に変更はありません</p>}
  </section>;
}
