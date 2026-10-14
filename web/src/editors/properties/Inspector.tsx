import "./commands";
import "./properties.css";
import { Help } from "../common/Help";
import { DetailView } from "../common/DetailView";
import { stateDelta, objectStateLabel } from "./delta";
import { objectNames } from "../common/labels";
import { useEffect, useState } from "react";
import { run } from "../../app/commands";
import { useQuery } from "../../app/data";
import { useUI } from "../../app/store";

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
        <span>{detail.state.t}秒</span>
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
      <nav className="inspector-tabs" aria-label="局面の表示内容">
        {[["state", "局面"], ["changes", "変化"], ["actions", "行動・遷移"], ["objects", "物体"]].map(([id, label]) => <button key={id} className="tool" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}
      </nav>
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
              <th>{robotNames[i]}</th>
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
        <h3>直前の局面からの変化 <Help topic="graph" text="比較元の局面と選択局面の時刻・得点・物体・機体の変化を表示します。入る遷移が複数ある場合は比較元を選べます。" /></h3>
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
            <button onClick={() => run("nav.node", { node: previousNode })}>比較元の局面へ移動</button>
            <button onClick={() => run("properties.exportDelta", changes)}>変化をJSON保存</button>
          </>}
        </>}
      </section>}
      {tab === "actions" && <section>
        <h3>次の局面を計算 <Help topic="graph" text="双方の行動を指定して1分岐を計算します。選択していない分岐も探索対象に残ります。" /></h3>
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
        <button disabled={busy || detail.expanded} onClick={onExpand}>
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
      <DetailView label={`入る遷移 ${incoming.length}件`} title="入る遷移">
        <div className="edge-list">
          {incoming.map((e) => (
            <button key={e.id} onClick={() => onEdge(e)}>
              E{e.id} : N{e.src} → N{e.dst}
            </button>
          ))}
        </div>
      </DetailView>
      </section>}
      <button onClick={() => saveJSON(detail.state, `state-${detail.id}.json`)}>
        局面JSONを保存
      </button>
      {tab === "objects" && <section>
        <h3>物体の所在・加点状況 <Help topic="model" text="各物体の現在の所在と、赤・青それぞれの搬送による加点済み状態を表示します。" /></h3>
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
                <td>{o.id}</td>
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
