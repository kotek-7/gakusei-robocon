import { objectNames } from "../common/labels";
import { useState } from "react";
import { register, run } from "../../app/commands";
import { fetchQuery } from "../../app/data";
import { ui, useUI } from "../../app/store";

import type { Action, Detail, Edge } from "../../engine/types";
import { saveJSON } from "../../app/coreCommands";
import { actionName, robotNames, locationName } from "../common/labels";

register({
  id: "properties.seekNode",
  title: "選択局面の時刻へ移動",
  category: "移動",
  enabled: () => !!useUI.getState().session.search && useUI.getState().session.node !== null,
  run: async () => {
    const { search, node } = useUI.getState().session;
    if (!search || node === null) return;
    const detail = await fetchQuery("node.get", { search, node });
    const current = useUI.getState().session;
    if (current.search === search && current.node === node)
      ui.patchPlayback({ time: detail.state.t, playing: false });
  },
});

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
  const time = useUI((s) => s.playback.time);
  const [indices, setIndices] = useState([0, 0, 0, 0]);
  const outgoing = detail.edges.filter((e) => e.src === detail.id),
    incoming = detail.edges.filter((e) => e.dst === detail.id);
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
      <details open>
        <summary>選べる行動から次の局面へ</summary>
        {detail.actions.every((a) => a.length > 0) ? (
          <>
            <p>
              双方の行動を指定して1分岐を計算します。選択していない分岐も探索対象に残ります。
            </p>
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
      </details>
      <div className="section-title">
        <h3>出る遷移 {outgoing.length}</h3>
        <button disabled={busy || detail.expanded} onClick={onExpand}>
          {detail.expanded ? "展開済み" : "この局面を展開"}
        </button>
      </div>
      <div className="edge-list">
        {outgoing.map((e) => (
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
      <details>
        <summary>入る遷移 {incoming.length}</summary>
        <div className="edge-list">
          {incoming.map((e) => (
            <button key={e.id} onClick={() => onEdge(e)}>
              E{e.id} : N{e.src} → N{e.dst}
            </button>
          ))}
        </div>
      </details>
      <button onClick={() => saveJSON(detail.state, `state-${detail.id}.json`)}>
        局面JSONを保存
      </button>
      <details>
        <summary>物体の所在・保持・搬送履歴</summary>
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
            {detail.state.objects.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{objectNames[o.kind] || o.kind}</td>
                <td>{locationName(o.loc)}</td>
                <td>{o.delivered.map((v) => (v ? "有" : "無")).join(" / ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
