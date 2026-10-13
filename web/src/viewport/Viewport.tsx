import { useEffect, useRef, useState } from "react";
import { actionName, locationName } from "../explorer/api";
import type { Frame } from "../explorer/types";
import type { createScene } from "./scene.js";
export function Viewport({
  frame,
  replaying = false,
}: {
  frame: Frame;
  replaying?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof createScene> | null>(null);
  const latest = useRef(frame);
  const [error, setError] = useState("");
  const [view, setView] = useState("iso");
  latest.current = frame;
  useEffect(() => {
    let stopped = false;
    import("./scene.js")
      .then(({ createScene }) => {
        if (stopped) return;
        try {
          scene.current = createScene(host.current!);
          scene.current.update(latest.current);
        } catch (e) {
          setError(String(e));
        }
      })
      .catch((e) => setError(String(e)));
    return () => {
      stopped = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);
  useEffect(() => {
    scene.current?.update(frame);
  }, [frame]);
  useEffect(() => {
    scene.current?.view(view);
  }, [view]);
  return (
    <div className="viewer">
      <div className="viewer-tools">
        <span>
          3D局面 <b>{frame.t}秒</b>
        </span>
        <div>
          {[
            ["iso", "斜視"],
            ["top", "上面"],
            ["red", "赤陣"],
          ].map(([id, name]) => (
            <button
              key={id}
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="replay-score" aria-live="off">
        <span className="red-text">赤 {frame.scores[0]}</span>
        <span>表示時刻の得点</span>
        <span className="blue-text">青 {frame.scores[1]}</span>
      </div>
      <div
        className="viewport"
        ref={host}
        aria-label="選択した探索局面の3D表示"
      >
        {error && (
          <p role="alert" className="render-error">
            3Dを開始できません。WebGLを確認してください。局面表・得点は利用できます。
          </p>
        )}
      </div>
      {replaying && (
        <table className="replay-robots">
          <caption>再生時刻の機体状態</caption>
          <tbody>
            {frame.robots.map((r) => (
              <tr key={r.id}>
                <th>{r.id}</th>
                <td>
                  {r.action ? actionName(r.action) : "待機"}
                  <small>
                    {locationName(r.location)}
                    {r.state === "move" ? " から移動中" : ""} · 保持{" "}
                    {r.carry.length}個
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="view-note">
        ドラッグで回転・右ドラッグで移動。代表機体と有限経路の表示です。
      </p>
    </div>
  );
}
