import "./commands";
import "./properties.css";
import { Help } from "../common/Help";
import { stateDelta, objectStateLabel } from "./delta";
import { objectNames } from "../common/labels";
import { useEffect, useState } from "react";
import { run } from "../../app/commands";
import { useQuery } from "../../app/data";
import { ui, useUI } from "../../app/store";

import type { Action, Detail, Edge } from "../../engine/types";
import { saveJSON } from "../../app/coreCommands";
import { actionName, robotNames, locationName } from "../common/labels";

export function Inspector({
  detail,
  busy,
  onStep,
  onEdge,
  onExpand,
}: {
  detail: Detail;
  busy: boolean;
  onStep: (a: Action[]) => void;
  onEdge: (e: Edge) => void;
  onExpand: () => void;
}) {
  const [tab, setTab] = useState("state");
  const showChanges = tab === "changes";
  const [predecessor, setPredecessor] = useState<number | null>(null);
  const search = useUI(s => s.session.search);
  const incomingNodes = [...new Set(detail.edges.filter(edge => edge.dst === detail.id).map(edge => edge.src))];
  const previousNode = predecessor !== null && incomingNodes.includes(predecessor) ? predecessor : incomingNodes[0];
  const previousQuery = useQuery("node.get", showChanges && search && previousNode !== undefined ? { search, node: previousNode } : null);
  const changes = previousQuery.data ? stateDelta(previousQuery.data, detail) : null;
  const time = useUI((s) => s.playback.time);
  const [edgeQuery, setEdgeQuery] = useState("");
  const [objectQuery, setObjectQuery] = useState("");
  const [objectKind, setObjectKind] = useState("all");
  const objects = detail.state.objects.filter((o) => (objectKind === "all" || o.kind === objectKind) && `${o.id} ${objectNames[o.kind] || o.kind} ${locationName(o.loc)}`.toLocaleLowerCase().includes(objectQuery.trim().toLocaleLowerCase()));
  const [indices, setIndices] = useState([0, 0, 0, 0]);
  useEffect(() => setIndices([0, 0, 0, 0]), [detail.id]);
  const outgoing = detail.edges.filter((e) => e.src === detail.id),
    incoming = detail.edges.filter((e) => e.dst === detail.id);
  const filteredOutgoing = outgoing.filter((edge) => {
    const text = `E${edge.id} N${edge.dst} ` + [...(edge.red || []), ...(edge.blue || [])].map(actionName).join(" ");
    return edgeQuery.trim().toLocaleLowerCase().split(/\s+/).every((term) => text.toLocaleLowerCase().includes(term));
  });
  return (
    <section className="inspector">
      <div className="section-title">
        <h2>選択局面 N{detail.id}</h2>
        <span>{detail.state.t}秒</span><button className="tool" title="局面JSONを保存" onClick={() => saveJSON(detail.state, `state-${detail.id}.json`)}>保存</button>
      </div>
      {Math.abs(time - detail.state.t) > 0.001 && (
        <div className="section-title">
          <span className="muted">再生位置 {time.toFixed(1)}秒</span>
          <button onClick={() => run("properties.seekNode")}>局面の時刻へ移動</button>
        </div>
      )}
      <div className="scoreline">
        <span className="red-text">
          赤 <b>{detail.scores[0]}</b>
        </span>
        <span>
          点差 <b>{detail.scores[0] - detail.scores[1]}</b>
        </span>
        <span className="blue-text">
          青 <b>{detail.scores[1]}</b>
        </span>
      </div>
      <label className="inspector-view">表示<select aria-label="局面の表示内容" value={tab} onChange={e => setTab(e.currentTarget.value)}>
        <option value="state">機体の状態</option><option value="changes">直前からの変化</option><option value="actions">行動と遷移</option><option value="objects">物体の所在</option>
      </select></label>
      {tab === "state" && <div>
      <table>
        <thead>
          <tr>
            <th>機体</th>
            <th>位置・動作</th>
          </tr>
        </thead>
        <tbody>
          {detail.state.robots.map((r, i) => (
            <tr key={i}>
              <th><button className="entity-reference" onClick={() => ui.select(`robot:${i}`)}>{robotNames[i]}</button></th>
              <td>
                {locationName(r.pos)}
                <small>
                  {r.job
                    ? `${actionName(r.job.action)} / ${r.job.end}秒完了`
                    : detail.actions.every((a) => a.length === 0)
                      ? "探索終了"
                      : "行動選択可"}
                </small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="qualification">
        ムスティカ取得条件：赤 {detail.state.mandate[0] ? "成立" : "未成立"} ／
        青 {detail.state.mandate[1] ? "成立" : "未成立"}
      </p>
      </div>}
      {tab === "changes" && <section>
        <h3>直前の局面からの変化 <Help topic="graph" title="直前の局面からの変化" text="直前の局面からの変化は、時刻・得点・物体・機体の差分です。直前の局面が複数ある場合は、比較元を選べます。" /></h3>
        {!incomingNodes.length ? <p className="muted">開始局面です</p> : <>
          <label>比較元<select value={previousNode} onChange={e => setPredecessor(Number(e.target.value))}>{incomingNodes.map(id => <option value={id} key={id}>N{id}</option>)}</select></label>
          {previousQuery.loading && !changes && <p className="muted">比較元を読み込み中</p>}
          {previousQuery.error && <p role="alert">{previousQuery.error}</p>}
          {changes && <>
            <p className="tabular">経過 {changes.seconds}秒 · 得点変化 赤 {changes.scores[0] >= 0 ? "+" : ""}{changes.scores[0]} / 青 {changes.scores[1] >= 0 ? "+" : ""}{changes.scores[1]}</p>
            <table><thead><tr><th>物体</th><th>変更前</th><th>変更後</th></tr></thead><tbody>
              {changes.objects.map(({ before, after }) => <tr key={after.id}><th>{objectNames[after.kind]} {after.id}</th><td>{objectStateLabel(before, after)}</td><td>{objectStateLabel(after, before)}</td></tr>)}
              {!changes.objects.length && <tr><td colSpan={3}>物体の変化なし</td></tr>}
            </tbody></table>
            {changes.robots.map(change => <p key={change.robot}>{robotNames[change.robot]}: {locationName(change.before.pos)} → {locationName(change.after.pos)} · {change.after.job ? actionName(change.after.job.action) : "動作終了"}</p>)}
            <button className="entity-reference" onClick={() => run("nav.node", { node: previousNode })}>比較元の局面へ移動</button>
            <button onClick={() => run("properties.exportDelta", changes)}>変化をJSON保存</button>
          </>}
        </>}
      </section>}
      {tab === "actions" && <section>
        <h3>次の局面を計算 <Help topic="graph" title="次の局面" text="次の局面は、選んだ行動の結果として進む試合の状態です。赤・青それぞれの行動を指定して計算できます。" /></h3>
        {detail.actions.every((a) => a.length > 0) ? (
          <>

            {detail.actions.map((actions, r) => (
              <label key={r}>
                {robotNames[r]}
                <select
                  value={indices[r]}
                  onChange={(e) =>
                    setIndices((old) =>
                      old.map((v, i) => (i === r ? Number(e.target.value) : v)),
                    )
                  }
                >
                  {actions.map((a, i) => (
                    <option key={i} value={i}>
                      {actionName(a)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                onStep(detail.actions.map((a, r) => a[indices[r]] || a[0]))
              }
            >
              選んだ行動を計算
            </button>
          </>
        ) : (
          <p>探索終了時刻に到達しています。</p>
        )}
      <div className="section-title">
        <h3>出る遷移 {outgoing.length}</h3>
        <button className="action-button" disabled={busy || detail.expanded} onClick={onExpand}>
          {detail.expanded ? "展開済み" : "この局面を展開"}
        </button>
      </div>
      {(outgoing.length > 3 || edgeQuery) && <input className="filter" aria-label="出る遷移を絞り込み" placeholder="行動・局面IDで絞り込み" value={edgeQuery} onChange={(event) => setEdgeQuery(event.target.value)} />}
      <div className="edge-list">
        {filteredOutgoing.map((e) => (
          <button key={e.id} onClick={() => onEdge(e)}>
            <span>
              E{e.id} → N{e.dst}
            </span>
            <small>
              {[...(e.red || []), ...(e.blue || [])]
                .map((a, i) => robotNames[i] + " " + actionName(a))
                .join(" / ")}
            </small>
          </button>
        ))}
      </div>
      {!!outgoing.length && !filteredOutgoing.length && <p className="muted">該当する遷移はありません</p>}
      <details className="incoming-transitions"><summary>入る遷移 {incoming.length}件</summary>
        <div className="edge-list">
          {incoming.map((e) => (
            <button key={e.id} onClick={() => onEdge(e)}>
              E{e.id} : N{e.src} → N{e.dst}
            </button>
          ))}
        </div>
      </details>
      </section>}
      {tab === "objects" && <section>
        <h3>物体の所在・加点状況 <Help topic="model" title="物体の所在・加点状況" text="物体の所在・加点状況は、各物体の現在位置と搬送による得点の記録です。赤・青それぞれの加点状況を確認できます。" /></h3>
        <div className="row">
          <input type="search" aria-label="物体を検索" placeholder="物体ID・所在" value={objectQuery} onChange={(e) => setObjectQuery(e.target.value)} />
          <select aria-label="物体の種別" value={objectKind} onChange={(e) => setObjectKind(e.target.value)}>
            <option value="all">すべての種別</option>{[...new Set(detail.state.objects.map((o) => o.kind))].map((kind) => <option key={kind} value={kind}>{objectNames[kind] || kind}</option>)}
          </select>
          <span>{objects.length} / {detail.state.objects.length}個</span>
          {(objectQuery || objectKind !== "all") && <button onClick={() => { setObjectQuery(""); setObjectKind("all"); }}>絞り込みを解除</button>}
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>種別</th>
              <th>所在</th>
              <th>加点済 赤/青</th>
            </tr>
          </thead>
          <tbody>
            {!objects.length && <tr><td colSpan={4}>一致する物体はありません</td></tr>}
            {objects.map((o) => (
              <tr key={o.id}>
                <td><button className="entity-reference" onClick={() => ui.select(`obj:${o.id}`)}>{o.id}</button></td>
                <td>{objectNames[o.kind] || o.kind}</td>
                <td>{locationName(o.loc)}</td>
                <td>{o.delivered.map((v) => (v ? "有" : "無")).join(" / ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>}
    </section>
  );
}
