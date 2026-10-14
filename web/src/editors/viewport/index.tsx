import { useEffect, useMemo, useRef, useState } from "react";
import { register, run } from "../../app/commands";
import { definePrefs, usePref } from "../../app/prefs";
import { layout, useLayout, findArea } from "../../app/layout";
import { useFrame, usePath, useReplay, useSearch } from "../../app/session";
import { ui, useUI, type MenuItem } from "../../app/store";
import { newId, updateWorkspace, useWorkspaceData } from "../../app/workspace";
import { NODES } from "../../engine/model";
import type { Frame } from "../../engine/types";
import { Icon } from "../../shell/icons";
import { actionName, locationName, robotNames } from "../common/labels";
import { defineEditor, type EditorProps } from "../registry";
import {
  DEFAULT_OVERLAYS,
  type CameraState,
  type Overlays,
  type SceneAPI,
  type ViewName,
} from "../../viewport/scene";
import model from "../../engine/model-data.json";

/** Live scenes by area id, so commands act on the viewport under the pointer. */
const scenes = new Map<string, SceneAPI>();
const activeScene = () => {
  const a = useUI.getState().activeArea;
  return (a && scenes.get(a)) || [...scenes.values()][0] || null;
};
const activeAreaId = () => {
  const a = useUI.getState().activeArea;
  return a && scenes.has(a) ? a : [...scenes.keys()][0] ?? null;
};
const areaState = (id: string | null) => {
  if (!id) return undefined;
  const s = useLayout.getState();
  for (const w of s.workspaces) {
    const a = findArea(w.root, id);
    if (a) return a.state;
  }
};
const overlaysOf = (id: string | null): Overlays => ({ ...DEFAULT_OVERLAYS, ...(areaState(id)?.overlays as Partial<Overlays>) });
function setOverlay(key: keyof Overlays, value?: boolean) {
  const id = activeAreaId();
  if (!id) return;
  const o = overlaysOf(id);
  layout.setAreaState(id, { overlays: { ...o, [key]: value ?? !o[key] } });
}

definePrefs([
  { id: "viewport.background", category: "3Dビュー", label: "背景", type: "enum", default: "night", options: [["night", "濃紺"], ["slate", "灰"], ["paper", "明るい"]] },
  { id: "viewport.labelSize", category: "3Dビュー", label: "ラベルの大きさ", type: "number", default: 12, min: 10, max: 16, unit: "px" },
  { id: "viewport.hud", category: "3Dビュー", label: "得点と時刻を重ねて表示", type: "boolean", default: true },
  { id: "viewport.robotTable", category: "3Dビュー", label: "機体の状態表を重ねて表示", type: "boolean", default: true },
  { id: "viewport.gizmo", category: "3Dビュー", label: "視点操作ボタンを表示", type: "boolean", default: true },
]);
const BACKGROUNDS: Record<string, string> = { night: "#10171e", slate: "#2b333b", paper: "#cfd6d4" };

const VIEW_LABELS: [ViewName, string, string][] = [
  ["iso", "斜視", "Numpad0"],
  ["top", "上面", "Numpad7"],
  ["front", "正面（赤青を左右に）", "Numpad1"],
  ["back", "背面", "Ctrl+Numpad1"],
  ["red", "赤陣から", "Numpad3"],
  ["blue", "青陣から", "Ctrl+Numpad3"],
];
const OVERLAY_LABELS: [keyof Overlays, string][] = [
  ["labels", "ラベル"],
  ["trails", "軌跡"],
  ["ghost", "比較Bのゴースト"],
  ["spots", "建設スポット"],
  ["zones", "エリア名"],
  ["routes", "経路網"],
  ["grid", "グリッド"],
  ["field", "競技場"],
  ["xray", "競技場を半透明"],
];

register(
  ...VIEW_LABELS.map(([v, title, key]) => ({
    id: `viewport.view.${v}`,
    title: `視点: ${title}`,
    category: "3Dビュー",
    keys: [key],
    scope: "viewport",
    run: () => activeScene()?.view(v),
  })),
  {
    id: "viewport.ortho",
    title: "透視・平行投影を切り替え",
    category: "3Dビュー",
    keys: ["Numpad5"],
    scope: "viewport",
    checked: () => !!activeScene()?.isOrtho(),
    run: () => {
      const s = activeScene();
      if (s) s.setOrtho(!s.isOrtho());
    },
  },
  {
    id: "viewport.frameAll",
    title: "競技場全体を表示",
    category: "3Dビュー",
    keys: ["Home"],
    scope: "viewport",
    run: () => activeScene()?.focus(null),
  },
  {
    id: "viewport.frameSelected",
    title: "選択対象を中央に表示",
    category: "3Dビュー",
    keys: [".", "NumpadDecimal"],
    scope: "viewport",
    enabled: () => !!useUI.getState().session.selection,
    run: () => activeScene()?.focus(useUI.getState().session.selection),
  },
  {
    id: "viewport.follow",
    title: "選択した機体を追従",
    category: "3Dビュー",
    keys: ["F"],
    scope: "viewport",
    checked: () => !!areaState(activeAreaId())?.follow,
    run: () => {
      const id = activeAreaId();
      if (!id) return;
      const sel = useUI.getState().session.selection;
      const cur = areaState(id)?.follow as string | null;
      layout.setAreaState(id, { follow: cur ? null : sel?.startsWith("robot:") ? sel : "robot:0" });
    },
  },
  ...OVERLAY_LABELS.map(([k, title]) => ({
    id: `viewport.overlay.${k}`,
    title: `表示: ${title}`,
    category: "3Dビュー",
    keys: k === "xray" ? ["Alt+Z"] : k === "grid" ? ["Alt+G"] : k === "labels" ? ["Alt+L"] : k === "trails" ? ["Alt+T"] : undefined,
    scope: k === "xray" || k === "grid" || k === "labels" || k === "trails" ? "viewport" : undefined,
    checked: () => overlaysOf(activeAreaId())[k],
    run: () => setOverlay(k),
  })),
  {
    id: "viewport.screenshot",
    title: "3Dビューを画像で保存",
    category: "3Dビュー",
    keys: ["F12"],
    run: () => {
      const s = activeScene();
      if (!s) return;
      const a = document.createElement("a");
      a.href = s.screenshot();
      a.download = `view-${useUI.getState().playback.time.toFixed(1)}s.png`;
      a.click();
    },
  },
  {
    id: "viewport.copyImage",
    title: "3Dビューの画像をコピー",
    category: "3Dビュー",
    run: async () => {
      const s = activeScene();
      if (!s) return;
      const blob = await (await fetch(s.screenshot())).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      ui.toast("画像をコピーしました");
    },
  },
  {
    id: "viewport.measure",
    title: "距離を測る",
    category: "3Dビュー",
    keys: ["Shift+D"],
    scope: "viewport",
    checked: () => !!areaState(activeAreaId())?.measuring,
    run: () => {
      const id = activeAreaId();
      if (id) layout.setAreaState(id, { measuring: !areaState(id)?.measuring, measure: null });
    },
  },
  {
    id: "viewport.bookmark",
    title: "現在の視点を保存",
    category: "3Dビュー",
    keys: ["Ctrl+B"],
    scope: "viewport",
    enabled: () => !!useUI.getState().session.search,
    run: async () => {
      const s = activeScene();
      if (!s) return;
      const name = await ui.prompt("視点の名前", "視点");
      if (!name) return;
      const c = s.camera();
      await updateWorkspace((w) => ({
        ...w,
        bookmarks: [...w.bookmarks, { id: newId(), name, camera: [...c.position, ...c.target, c.ortho ? 1 : 0] }],
      }));
    },
  },
  {
    id: "viewport.orbitLeft",
    title: "視点を左に回す",
    category: "3Dビュー",
    keys: ["Numpad4"],
    scope: "viewport",
    run: () => activeScene()?.orbit(-Math.PI / 12, 0),
  },
  {
    id: "viewport.orbitRight",
    title: "視点を右に回す",
    category: "3Dビュー",
    keys: ["Numpad6"],
    scope: "viewport",
    run: () => activeScene()?.orbit(Math.PI / 12, 0),
  },
  {
    id: "viewport.orbitUp",
    title: "視点を上げる",
    category: "3Dビュー",
    keys: ["Numpad8"],
    scope: "viewport",
    run: () => activeScene()?.orbit(0, -Math.PI / 12),
  },
  {
    id: "viewport.orbitDown",
    title: "視点を下げる",
    category: "3Dビュー",
    keys: ["Numpad2"],
    scope: "viewport",
    run: () => activeScene()?.orbit(0, Math.PI / 12),
  },
  {
    id: "viewport.zoomIn",
    title: "ズームイン",
    category: "3Dビュー",
    keys: ["NumpadAdd"],
    scope: "viewport",
    run: () => activeScene()?.zoom(1.2),
  },
  {
    id: "viewport.zoomOut",
    title: "ズームアウト",
    category: "3Dビュー",
    keys: ["NumpadSubtract"],
    scope: "viewport",
    run: () => activeScene()?.zoom(1 / 1.2),
  },
);

/** Which path an area shows: the current one, or side A/B of the comparison. */
function useSidePath(side: string | undefined) {
  const current = usePath();
  const compare = useUI((s) => s.session.compare);
  if (side === "a") return compare.a ?? current;
  if (side === "b") return compare.b;
  return current;
}

const ZONES = ["startA0", "startA1", "store0", "store1", "sky0", "sky1", "ball0", "transfer0", "transfer1", "upper0", "pillar0"];
function labelsFor(frame: Frame | null, o: Overlays) {
  const out: { id: string; text: string; p: number[]; tone?: "red" | "blue" | "muted" }[] = [];
  if (frame)
    frame.robots.forEach((r, i) =>
      out.push({
        id: `robot:${i}`,
        text: `${robotNames[i]}${r.carry.length ? ` ${r.carry.length}` : ""}`,
        p: [r.p[0], r.p[1] + (i % 2 ? 1.35 : 0.95), r.p[2]],
        tone: r.team ? "blue" : "red",
      }),
    );
  if (o.spots)
    (model.spots as number[][]).forEach((s, i) =>
      out.push({ id: `spot:${i}`, text: `S${i}${s[3] === 2 ? " L2" : ""}`, p: [s[0], s[1] + 0.05, s[2] + 0.45], tone: "muted" }),
    );
  if (o.zones)
    for (const z of ZONES) {
      const n = (NODES as Record<string, { p: number[] }>)[z];
      if (n) out.push({ id: `zone:${z}`, text: locationName(z), p: [n.p[0], n.p[1] + 0.1, n.p[2]], tone: "muted" });
    }
  return out;
}

function Gizmo({ scene }: { scene: SceneAPI | null }) {
  const [h, setH] = useState({ azimuth: 0.6, polar: 0.8 });
  useEffect(() => {
    if (!scene) return;
    const t = setInterval(() => setH(scene.heading()), 120);
    return () => clearInterval(t);
  }, [scene]);
  // Axis dots on a disc: field +x (blue side) and +z (front).
  const r = 26;
  const pt = (a: number) => [32 + Math.sin(a - h.azimuth) * r, 32 + Math.cos(a - h.azimuth) * r * Math.cos(h.polar)];
  const [bx, by] = pt(Math.PI / 2),
    [rx, ry] = pt(-Math.PI / 2),
    [fx, fy] = pt(0),
    [kx, ky] = pt(Math.PI);
  return (
    <div className="gizmo" aria-label="視点操作">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="30" className="gizmo-disc" />
        <line x1={rx} y1={ry} x2={bx} y2={by} className="gizmo-axis" />
        <line x1={fx} y1={fy} x2={kx} y2={ky} className="gizmo-axis" />
        <g role="button" tabIndex={-1} onClick={() => scene?.view("red")}>
          <circle cx={rx} cy={ry} r="8" className="gizmo-red" />
          <text x={rx} y={ry + 3.5}>赤</text>
        </g>
        <g role="button" tabIndex={-1} onClick={() => scene?.view("blue")}>
          <circle cx={bx} cy={by} r="8" className="gizmo-blue" />
          <text x={bx} y={by + 3.5}>青</text>
        </g>
        <g role="button" tabIndex={-1} onClick={() => scene?.view("front")}>
          <circle cx={fx} cy={fy} r="7" className="gizmo-front" />
          <text x={fx} y={fy + 3.5}>前</text>
        </g>
        <g role="button" tabIndex={-1} onClick={() => scene?.view("top")}>
          <circle cx="32" cy="32" r="6" className="gizmo-top" />
          <text x="32" y="35.5">上</text>
        </g>
      </svg>
      <div className="gizmo-buttons">
        <button className="tool icon-only" title="ズームイン (テンキー+)" onClick={() => scene?.zoom(1.25)}>
          <Icon name="zoomIn" />
        </button>
        <button className="tool icon-only" title="ズームアウト (テンキー-)" onClick={() => scene?.zoom(0.8)}>
          <Icon name="zoomOut" />
        </button>
        <button className="tool icon-only" title="全体を表示 (Home)" onClick={() => scene?.focus(null)}>
          <Icon name="fit" />
        </button>
        <button className="tool icon-only" title="透視・平行投影 (テンキー5)" onClick={() => scene && scene.setOrtho(!scene.isOrtho())}>
          <Icon name="ortho" />
        </button>
      </div>
    </div>
  );
}

function entityMenu(ref: string | null, frame: Frame | null): MenuItem[] {
  const items: MenuItem[] = [];
  if (ref?.startsWith("robot:")) {
    const r = Number(ref.slice(6));
    items.push(
      { label: `${robotNames[r]}を選択`, run: () => ui.select(ref as never) },
      { label: "この機体を追従", run: () => (ui.select(ref as never), run("viewport.follow")) },
      { label: "中央に表示", run: () => activeScene()?.focus(ref) },
    );
    if (frame?.robots[r].action) items.push({ label: `動作: ${actionName(frame.robots[r].action!)}`, run: () => {}, disabled: true });
    items.push({ separator: true });
  } else if (ref?.startsWith("spot:")) {
    items.push(
      { label: `建設スポット ${ref.slice(5)} を選択`, run: () => ui.select(ref as never) },
      { label: "スポット盤で表示", run: () => (ui.select(ref as never), layout.reveal("spots")) },
      { separator: true },
    );
  } else if (ref?.startsWith("obj:")) {
    items.push({ label: `物体 ${ref.slice(4)} を選択`, run: () => ui.select(ref as never) }, { separator: true });
  }
  items.push(
    { label: "視点", submenu: VIEW_LABELS.map(([v]) => ({ command: `viewport.view.${v}` })) },
    { label: "表示", submenu: OVERLAY_LABELS.map(([k]) => ({ command: `viewport.overlay.${k}` })) },
    { command: "viewport.ortho" },
    { command: "viewport.frameAll" },
    { separator: true },
    { command: "viewport.measure" },
    { command: "viewport.bookmark" },
    { command: "viewport.screenshot" },
    { command: "viewport.copyImage" },
  );
  return items;
}

function Header({ area }: EditorProps) {
  const ws = useWorkspaceData();
  const o: Overlays = { ...DEFAULT_OVERLAYS, ...(area.state?.overlays as Partial<Overlays>) };
  const follow = area.state?.follow as string | null;
  const side = area.state?.side as string | undefined;
  const compare = useUI((s) => s.session.compare);
  const open = (e: React.MouseEvent, items: MenuItem[]) => {
    useUI.setState({ activeArea: area.id, activeEditor: "viewport" });
    const r = e.currentTarget.getBoundingClientRect();
    useUI.setState({ menu: { x: r.left, y: r.bottom + 2, items } });
  };
  return (
    <div className="area-tools">
      <button className="tool" onClick={(e) => open(e, VIEW_LABELS.map(([v]) => ({ command: `viewport.view.${v}` })))}>
        視点
        <Icon name="chevron" size={12} />
      </button>
      <button
        className="tool"
        onClick={(e) =>
          open(
            e,
            OVERLAY_LABELS.map(([k, title]) => ({
              label: title,
              checked: o[k],
              run: () => layout.setAreaState(area.id, { overlays: { ...o, [k]: !o[k] } }),
            })),
          )
        }
      >
        表示
        <Icon name="chevron" size={12} />
      </button>
      <button
        className="tool icon-only"
        aria-pressed={!!follow}
        title="選択した機体を追従 (F)"
        onClick={() => {
          useUI.setState({ activeArea: area.id, activeEditor: "viewport" });
          run("viewport.follow");
        }}
      >
        <Icon name="follow" />
      </button>
      <button
        className="tool icon-only"
        aria-pressed={!!area.state?.measuring}
        title="距離を測る (Shift+D)：2点をクリック"
        onClick={() => layout.setAreaState(area.id, { measuring: !area.state?.measuring, measure: null })}
      >
        <Icon name="ruler" />
      </button>
      <button
        className="tool"
        title="保存した視点"
        onClick={(e) =>
          open(e, [
            ...(ws?.bookmarks.length
              ? ws.bookmarks.map((b) => ({
                  label: b.name,
                  run: () =>
                    scenes.get(area.id)?.setCameraState({ position: b.camera.slice(0, 3), target: b.camera.slice(3, 6), ortho: !!b.camera[6] }),
                }))
              : [{ label: "保存した視点はありません", run: () => {}, disabled: true }]),
            { separator: true },
            { command: "viewport.bookmark" },
            ...(ws?.bookmarks.length
              ? [
                  {
                    label: "保存した視点を削除",
                    submenu: ws.bookmarks.map((b) => ({
                      label: b.name,
                      run: () => updateWorkspace((w) => ({ ...w, bookmarks: w.bookmarks.filter((x) => x.id !== b.id) })),
                    })),
                  },
                ]
              : []),
          ])
        }
      >
        <Icon name="camera" />
        <Icon name="chevron" size={12} />
      </button>
      <button className="tool icon-only" title="画像で保存 (F12)" onClick={() => (useUI.setState({ activeArea: area.id }), run("viewport.screenshot"))}>
        <Icon name="download" />
      </button>
      <label className="header-field" title="この領域に表示する経路">
        経路
        <select value={side ?? ""} onChange={(e) => layout.setAreaState(area.id, { side: e.target.value || undefined })}>
          <option value="">選択中</option>
          <option value="a">比較A{compare.a ? "" : "（未設定）"}</option>
          <option value="b">比較B{compare.b ? "" : "（未設定）"}</option>
        </select>
      </label>
    </div>
  );
}

function ViewportEditor({ area }: EditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<SceneAPI | null>(null);
  const [error, setError] = useState("");
  const side = area.state?.side as string | undefined;
  const path = useSidePath(side);
  const frame = useFrame(path);
  const compareB = useUI((s) => s.session.compare.b);
  const ghostFrame = useFrame(side ? null : compareB);
  const replay = useReplay(path).data;
  const time = useUI((s) => s.playback.time);
  const selection = useUI((s) => s.session.selection);
  const hover = useUI((s) => s.session.hover);
  const search = useSearch();
  const overlays: Overlays = useMemo(() => ({ ...DEFAULT_OVERLAYS, ...(area.state?.overlays as Partial<Overlays>) }), [area.state?.overlays]);
  const follow = area.state?.follow as string | null;
  const measuring = !!area.state?.measuring;
  const measure = area.state?.measure as number[][] | null;
  const bgPref = usePref<string>("viewport.background");
  const hud = usePref<boolean>("viewport.hud");
  const table = usePref<boolean>("viewport.robotTable");
  const gizmo = usePref<boolean>("viewport.gizmo");
  const labelSize = usePref<number>("viewport.labelSize");
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    let stopped = false;
    let s: SceneAPI | null = null;
    let off = () => {};
    import("../../viewport/scene")
      .then(({ createScene }) => {
        if (stopped || !host.current) return;
        try {
          s = createScene(host.current);
          scenes.set(area.id, s);
          const cam = areaState(area.id)?.camera as CameraState | undefined;
          if (cam) s.setCameraState(cam);
          off = s.onCameraChange(() => layout.setAreaState(area.id, { camera: s!.camera() }));
          if (frameRef.current) s.update(frameRef.current);
          setScene(s);
        } catch (e) {
          setError(String(e));
        }
      })
      .catch((e) => setError(String(e)));
    return () => {
      stopped = true;
      off();
      scenes.delete(area.id);
      s?.dispose();
    };
  }, [area.id]);
  useEffect(() => {
    if (scene && frame) scene.update(frame);
  }, [scene, frame]);
  useEffect(() => {
    scene?.ghost(compareB && !side ? ghostFrame : null);
  }, [scene, ghostFrame, compareB, side, overlays.ghost]);
  useEffect(() => {
    scene?.overlays(overlays);
  }, [scene, overlays]);
  useEffect(() => {
    scene?.background(BACKGROUNDS[bgPref] ?? BACKGROUNDS.night);
  }, [scene, bgPref]);
  useEffect(() => {
    scene?.labels(labelsFor(frame, overlays));
  }, [scene, frame, overlays]);
  useEffect(() => {
    scene?.select(selection);
  }, [scene, selection]);
  useEffect(() => {
    scene?.hover(hover);
  }, [scene, hover]);
  useEffect(() => {
    scene?.follow(follow);
  }, [scene, follow]);
  useEffect(() => {
    scene?.measure(measure?.[0] ?? null, measure?.[1] ?? null);
  }, [scene, measure]);
  const trails = useMemo(() => {
    if (!replay) return [];
    return [0, 1, 2, 3].map((r) => ({ robot: r, points: replay.frames.map((f) => [...f.robots[r].p, f.t]) }));
  }, [replay]);
  useEffect(() => {
    scene?.trails(trails, time);
    // Redraw at whole-second steps; finer playhead moves don't change the split visibly.
  }, [scene, trails, Math.floor(time)]);

  const down = useRef<[number, number] | null>(null);
  const dist = measure?.length === 2 ? Math.hypot(measure[1][0] - measure[0][0], measure[1][2] - measure[0][2]) : null;
  return (
    <div className="viewport-editor" style={{ ["--label-size" as string]: `${labelSize}px` }}>
      <div
        ref={host}
        className={`viewport-host${measuring ? " measuring" : ""}`}
        aria-label="3D競技場"
        onPointerDown={(e) => (down.current = [e.clientX, e.clientY])}
        onPointerMove={(e) => {
          if (!scene || e.buttons) return;
          const { ref } = scene.pick(e.clientX, e.clientY);
          ui.hover((ref as never) ?? null);
        }}
        onPointerLeave={() => ui.hover(null)}
        onClick={(e) => {
          if (!scene || !down.current) return;
          if (Math.hypot(e.clientX - down.current[0], e.clientY - down.current[1]) > 4) return;
          const hit = scene.pick(e.clientX, e.clientY);
          if (measuring) {
            if (!hit.point) return;
            const next = !measure || measure.length >= 2 ? [hit.point] : [measure[0], hit.point];
            layout.setAreaState(area.id, { measure: next });
            return;
          }
          if (hit.ref) ui.select(hit.ref as never);
          else if (selection && !selection.startsWith("node:")) ui.select(null);
        }}
        onDoubleClick={(e) => {
          const hit = scene?.pick(e.clientX, e.clientY);
          scene?.focus(hit?.ref ?? null);
        }}
        onContextMenu={(e) => {
          useUI.setState({ activeArea: area.id, activeEditor: "viewport" });
          const hit = scene?.pick(e.clientX, e.clientY);
          ui.contextMenu(e, entityMenu(hit?.ref ?? null, frame), hit?.ref ?? "3Dビュー");
        }}
      >
        {error && (
          <p role="alert" className="render-error">
            3Dを開始できません。WebGLを確認してください。他のエディタは使えます。
          </p>
        )}
      </div>
      {!search && <div className="viewport-note">探索を作成すると、局面の3Dを表示します</div>}
      {side === "b" && !path && <div className="viewport-note">比較Bの経路が未設定です。探索メニューの「現在の経路をBに設定」で選びます</div>}
      {hud && frame && (
        <div className="viewport-hud">
          {side && <span className="hud-side">{side.toUpperCase()}</span>}
          <span className="tabular">{frame.t.toFixed(2)}秒</span>
          <span className="red-text tabular">赤 {frame.scores[0]}</span>
          <span className="blue-text tabular">青 {frame.scores[1]}</span>
          {frame.mandate.some(Boolean) && (
            <span className="muted">取得条件 {frame.mandate.map((m, i) => (m ? (i ? "青" : "赤") : "")).filter(Boolean).join("・")}</span>
          )}
        </div>
      )}
      {measuring && (
        <div className="viewport-measure">
          {dist !== null ? `水平距離 ${dist.toFixed(2)} m · 高低差 ${(measure![1][1] - measure![0][1]).toFixed(2)} m` : "2点をクリック"}
        </div>
      )}
      {gizmo && <Gizmo scene={scene} />}
      {table && frame && (
        <table className="viewport-robots">
          <tbody>
            {frame.robots.map((r, i) => (
              <tr
                key={r.id}
                aria-selected={selection === `robot:${i}`}
                onClick={() => ui.select(`robot:${i}`)}
                onPointerEnter={() => ui.hover(`robot:${i}`)}
                onPointerLeave={() => ui.hover(null)}
              >
                <th className={r.team ? "blue-text" : "red-text"}>{robotNames[i]}</th>
                <td>{r.action ? actionName(r.action) : "待機"}</td>
                <td className="muted">{r.carry.length ? `保持 ${r.carry.join("")}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

defineEditor({ type: "viewport", title: "3Dビュー", group: "解析", Component: ViewportEditor, Header });
