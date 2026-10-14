import { useEffect, useRef, useState } from "react";
import type { Frame } from "../engine/types";
import type { createScene } from "./scene.js";
import type { CameraState, DisplayOptions } from "./types";
import "./viewport.css";
export type { CameraState } from "./types";
type Props = {
  frame: Frame;
  replaying?: boolean;
  frames?: Frame[];
  selection?: string | null;
  onSelect?: (id: string | null) => void;
  range?: [number, number] | null;
  onRelated?: () => void;
  camera?: CameraState;
  onCameraChange?: (camera: CameraState) => void;
  captureLabel?: string;
  defaultLabels?: boolean;
  defaultTrails?: boolean;
};
export function Viewport({
  frame,
  frames = [],
  selection,
  onSelect,
  range = null,
  onRelated,
  camera,
  onCameraChange,
  captureLabel = "試合",
  defaultLabels = false,
  defaultTrails = false,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<ReturnType<typeof createScene> | null>(null);
  const [localSelection, setLocalSelection] = useState<string | null>(null);
  const selected = selection === undefined ? localSelection : selection;
  const [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [saved, setSaved] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]),
    [contextOpen, setContextOpen] = useState(false);
  const [follow, setFollow] = useState(false),
    [dim, setDim] = useState(false);
  const [labels, setLabels] = useState(defaultLabels),
    [paths, setPaths] = useState(false),
    [trails, setTrails] = useState(defaultTrails);
  const [trailScope, setTrailScope] = useState<"selected" | "all">("selected");
  const [trailRange, setTrailRange] = useState<"recent" | "range" | "all">(
    "recent",
  );
  const options: DisplayOptions = {
    selection: selected,
    follow,
    dim,
    labels,
    paths,
    trails,
    trailScope,
    trailRange,
    range,
  };
  const latest = useRef({
    frame,
    frames,
    options,
    camera,
    onCameraChange,
    onSelect,
  });
  latest.current = { frame, frames, options, camera, onCameraChange, onSelect };
  function select(id: string | null) {
    setLocalSelection(id);
    onSelect?.(id);
    setFollow(false);
    setCandidates([]);
  }
  useEffect(() => {
    let stopped = false;
    import("./scene.js")
      .then(({ createScene }) => {
        if (stopped) return;
        try {
          scene.current = createScene(host.current!, {
            onCamera: (value: CameraState) =>
              latest.current.onCameraChange?.(value),
            onPick: (ids: string[], context: boolean) => {
              setCandidates(ids.length > 1 ? ids : []);
              setContextOpen(context || ids.length > 1);
              const id = ids[0] ?? null;
              setLocalSelection(id);
              latest.current.onSelect?.(id);
              setFollow(false);
            },
          });
          scene.current.update(
            latest.current.frame,
            latest.current.frames,
            latest.current.options,
          );
          if (latest.current.camera)
            scene.current.camera(latest.current.camera);
          setReady(true);
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
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (
        event.type === "pointerdown" &&
        root.current?.contains(event.target as Node)
      )
        return;
      root.current?.querySelectorAll("details[open]").forEach((el) => {
        (el as HTMLDetailsElement).open = false;
      });
      setContextOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  useEffect(() => {
    scene.current?.update(frame, frames, options);
  }, [
    frame,
    frames,
    selected,
    follow,
    dim,
    labels,
    paths,
    trails,
    trailScope,
    trailRange,
    range,
  ]);
  useEffect(() => {
    if (camera) scene.current?.camera(camera);
  }, [camera]);
  useEffect(() => {
    setLabels(defaultLabels);
  }, [defaultLabels]);
  useEffect(() => {
    setTrails(defaultTrails);
  }, [defaultTrails]);
  const name = (id: string) =>
    id.startsWith("robot:")
      ? frame.robots[Number(id.split(":")[1])]?.id
      : id.startsWith("tower:")
        ? `建設スポット ${Number(id.split(":")[1])}`
        : `資源 ${id.split(":")[1]}`;
  const action = (fn: () => void) => {
    setFollow(false);
    fn();
  };
  return (
    <div className="viewer interactive-viewer" ref={root}>
      <div className="viewer-tools">
        <span>
          3D局面 <b>{frame.t}秒</b>
        </span>
        <div className="viewport-menus">
          <button
            disabled={!ready}
            onClick={() => action(() => scene.current?.view("all"))}
          >
            全体表示
          </button>
          <details>
            <summary>視点</summary>
            <div className="viewport-menu">
              {(
                [
                  ["top", "上面"],
                  ["red", "赤陣側"],
                  ["blue", "青陣側"],
                  ["iso", "斜視"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  disabled={!ready}
                  onClick={() => action(() => scene.current?.view(id))}
                >
                  {label}
                </button>
              ))}
              <button
                disabled={!selected || !ready}
                onClick={() => action(() => scene.current?.focus())}
              >
                選択へ寄る
              </button>
              <button
                disabled={!ready}
                onClick={() => action(() => scene.current?.previous())}
              >
                前の視点へ戻る
              </button>
              <button
                disabled={!ready}
                onClick={() => {
                  scene.current?.save();
                  setSaved(true);
                }}
              >
                視点を保存
              </button>
              <button
                disabled={!saved}
                onClick={() => action(() => scene.current?.restore())}
              >
                保存した視点へ戻る
              </button>
            </div>
          </details>
          <details>
            <summary>表示</summary>
            <div className="viewport-menu">
              <label>
                <input
                  type="checkbox"
                  checked={labels}
                  onChange={(e) => setLabels(e.target.checked)}
                />
                名前
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={paths}
                  onChange={(e) => setPaths(e.target.checked)}
                />
                移動経路
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={trails}
                  onChange={(e) => setTrails(e.target.checked)}
                />
                移動履歴
              </label>
              {trails && (
                <>
                  <label>
                    対象
                    <select
                      value={trailScope}
                      onChange={(e) =>
                        setTrailScope(e.target.value as typeof trailScope)
                      }
                    >
                      <option value="selected">選択機体</option>
                      <option value="all">全機体</option>
                    </select>
                  </label>
                  <label>
                    範囲
                    <select
                      value={trailRange}
                      onChange={(e) =>
                        setTrailRange(e.target.value as typeof trailRange)
                      }
                    >
                      <option value="recent">直近10秒</option>
                      <option value="range" disabled={!range}>
                        指定区間
                      </option>
                      <option value="all">全経過</option>
                    </select>
                  </label>
                </>
              )}
              <button
                onClick={() => {
                  setLabels(defaultLabels);
                  setPaths(false);
                  setTrails(defaultTrails);
                  setDim(false);
                  setTrailScope("selected");
                  setTrailRange("recent");
                }}
              >
                表示を戻す
              </button>
              <button
                disabled={!ready}
                onClick={() => scene.current?.capture(captureLabel)}
              >
                画像を保存
              </button>
            </div>
          </details>
          <details
            open={contextOpen}
            onToggle={(e) => setContextOpen(e.currentTarget.open)}
          >
            <summary>対象</summary>
            <div className="viewport-menu">
              {candidates.length > 1 && (
                <label>
                  重なっている対象
                  <select
                    value={selected ?? ""}
                    onChange={(e) => select(e.target.value)}
                  >
                    {candidates.map((id) => (
                      <option key={id} value={id}>
                        {name(id)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                選択
                <select
                  value={selected ?? ""}
                  onChange={(e) => select(e.target.value || null)}
                >
                  <option value="">選択なし</option>
                  {frame.robots.map((r, i) => (
                    <option key={r.id} value={`robot:${i}`}>
                      {r.id}
                    </option>
                  ))}
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={`t${i}`} value={`tower:${i}`}>
                      建設スポット {i}
                    </option>
                  ))}
                  {frame.objects.map((o) => (
                    <option key={o.id} value={`object:${o.id}`}>
                      資源 {o.id}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={!selected}
                onClick={() => action(() => scene.current?.focus())}
              >
                選択へ寄る
              </button>
              <button
                disabled={!selected?.startsWith("robot:")}
                aria-pressed={follow}
                onClick={() => setFollow(!follow)}
              >
                {follow ? "追従を解除" : "機体を追従"}
              </button>
              <button
                disabled={!selected}
                aria-pressed={dim}
                onClick={() => setDim(!dim)}
              >
                {dim ? "通常表示へ戻す" : "ほかの対象を薄くする"}
              </button>
              {onRelated && (
                <button
                  disabled={!selected}
                  onClick={() => {
                    onRelated();
                    setContextOpen(false);
                  }}
                >
                  関連する履歴
                </button>
              )}
              <button
                disabled={!selected}
                onClick={() => {
                  select(null);
                  setDim(false);
                }}
              >
                選択を解除
              </button>
            </div>
          </details>
        </div>
      </div>
      <div className="replay-score">
        <span className="red-text">赤 {frame.scores[0]}</span>
        <span>表示時刻の得点</span>
        <span className="blue-text">青 {frame.scores[1]}</span>
      </div>
      <div className="viewport" ref={host} aria-label="試合の3D表示">
        {error && (
          <p role="alert" className="render-error">
            3Dを開始できません。WebGLを確認してください。得点と履歴は利用できます。
          </p>
        )}
      </div>
      <div className="viewport-status">
        <span>{selected ? name(selected) : "対象をクリックして選択"}</span>
        {selected && (
          <button
            onClick={() => {
              select(null);
              setDim(false);
            }}
          >
            選択解除
          </button>
        )}
        {follow && <button onClick={() => setFollow(false)}>追従解除</button>}
        {dim && <button onClick={() => setDim(false)}>通常表示</button>}
      </div>
      <p className="view-note">
        ドラッグで回転、右ドラッグで移動。対象はメニューからも選べます。
      </p>
    </div>
  );
}
