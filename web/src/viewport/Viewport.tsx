import { useEffect, useRef, useState } from "react";
import type { createScene } from "./scene.js";
import type { Frame } from "../simulation/types";
export function Viewport({
  frame,
  time,
  active,
}: {
  frame: Frame;
  time: number;
  active: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<ReturnType<typeof createScene> | null>(null);
  const [view, setView] = useState("iso"),
    [error, setError] = useState(false);
  const [started, setStarted] = useState(active);
  const latest = useRef({ frame, view });
  useEffect(() => {
    latest.current = { frame, view };
  }, [frame, view]);
  useEffect(() => {
    if (active) setStarted(true);
  }, [active]);
  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    import("./scene.js")
      .then(({ createScene }) => {
        if (cancelled) return;
        scene.current = createScene(host.current!);
        scene.current.update(latest.current.frame);
        scene.current.view(latest.current.view);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [started]);
  useEffect(() => {
    scene.current?.update(frame);
  }, [frame]);
  useEffect(() => {
    scene.current?.view(view);
  }, [view]);
  return (
    <>
      <div className="viewportbar">
        <span>
          <b>3D ビュー</b>
          <small>提供CAD</small>
        </span>
        <div>
          {[
            ["iso", "斜視"],
            ["top", "上面"],
            ["red", "赤陣"],
          ].map(([id, name]) => (
            <button
              key={id}
              data-view={id}
              className={view === id ? "active" : ""}
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div id="viewport" ref={host}>
        <div className="scoreboard">
          <div className="red">
            <span>RED</span>
            <b id="redscore">{frame.scores[0]}</b>
          </div>
          <div className="matchclock">
            <span>試合経過</span>
            <b id="clock">
              {String(Math.floor(time / 60)).padStart(2, "0")}:
              {(time % 60).toFixed(1).padStart(4, "0")}
            </b>
          </div>
          <div className="blue">
            <b id="bluescore">{frame.scores[1]}</b>
            <span>BLUE</span>
          </div>
        </div>
        <div className="viewhint">
          ドラッグ：回転　右ドラッグ：移動　スクロール：拡大
        </div>
        <div id="qualifications">
          {frame.teams.map((t, i) => (
            <span key={i} className={i ? "blue" : "red"}>
              {i ? "BLUE" : "RED"}　
              {t.mandate ? "ムスティカ設置可" : "ムスティカ設置条件未達成"}
            </span>
          ))}
        </div>
        {error && (
          <p className="render-error" role="alert">
            3D表示を開始できません。ブラウザのWebGL設定を確認してください。得点と再生時刻は引き続き確認できます。
          </p>
        )}
      </div>
      <p className="model-note">
        CADに基づく経路・得点の簡略計算。機体同士の衝突・把持・転倒は未計算。
      </p>
    </>
  );
}
