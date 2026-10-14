import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Frame } from "../engine/types";
import { createActors, createField, createMaterials } from "./world";
import model from "../engine/model-data.json";

export type ViewName = "iso" | "top" | "front" | "back" | "red" | "blue";
export type Overlays = {
  grid: boolean;
  routes: boolean;
  spots: boolean;
  zones: boolean;
  labels: boolean;
  trails: boolean;
  ghost: boolean;
  field: boolean;
  xray: boolean;
};
export const DEFAULT_OVERLAYS: Overlays = {
  grid: false,
  routes: false,
  spots: true,
  zones: false,
  labels: true,
  trails: true,
  ghost: true,
  field: true,
  xray: false,
};
export type Trail = { robot: number; points: number[][] };
export type Label = { id: string; text: string; p: number[]; tone?: "red" | "blue" | "muted" };
export type CameraState = { position: number[]; target: number[]; ortho: boolean; zoom?: number; orthoHeight?: number };

const VIEWS: Record<ViewName, [number, number, number]> = {
  iso: [11, 13, 15],
  top: [0, 24, 0.001],
  front: [0, 6, 17],
  back: [0, 6, -17],
  red: [-17, 6, 0.001],
  blue: [17, 6, 0.001],
};
const TEAM_COLORS = [0xd53939, 0x3466e8];

export function createScene(host: HTMLElement) {
  const scene = new T.Scene();
  const bg = new T.Color("#10171e");
  scene.background = bg;
  scene.fog = new T.Fog("#10171e", 30, 70);
  const persp = new T.PerspectiveCamera(38, 1, 0.1, 120);
  persp.position.set(...VIEWS.iso);
  const ortho = new T.OrthographicCamera(-8, 8, 8, -8, 0.1, 120);
  let camera: T.PerspectiveCamera | T.OrthographicCamera = persp;
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  host.append(renderer.domElement);
  const labelLayer = document.createElement("div");
  labelLayer.className = "scene-labels";
  host.append(labelLayer);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.4, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.minDistance = 2;
  controls.maxDistance = 40;
  controls.screenSpacePanning = true;
  scene.add(new T.HemisphereLight(0xb8deff, 0x333941, 1.8));
  const light = new T.DirectionalLight(0xfff0d5, 2);
  light.position.set(-5, 15, 8);
  light.castShadow = true;
  light.shadow.bias = -0.0002;
  light.shadow.normalBias = 0.02;
  light.shadow.mapSize.set(2048, 2048);
  Object.assign(light.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
  scene.add(light);

  const materials = createMaterials();
  const field = createField(scene);
  const actors = createActors(scene, materials);
  const ghost = createActors(scene, materials, 0.32);
  ghost.root.visible = false;

  // Overlays
  const grid = new T.GridHelper(11, 22, 0x56606b, 0x3a434c);
  grid.position.y = 0.005;
  scene.add(grid);
  const routes = new T.Group();
  {
    const mat = new T.LineBasicMaterial({ color: 0x8fa3ad, transparent: true, opacity: 0.55 });
    for (const e of model.model.field.edges as { route: number[][] }[]) {
      const g = new T.BufferGeometry().setFromPoints(e.route.map((p) => new T.Vector3(p[0], p[1] + 0.03, p[2])));
      routes.add(new T.Line(g, mat));
    }
    const dot = new T.SphereGeometry(0.05, 8, 6),
      dm = new T.MeshBasicMaterial({ color: 0xc7d3d9 });
    for (const n of Object.values(model.model.field.nodes) as { p: number[] }[]) {
      const m = new T.Mesh(dot, dm);
      m.position.set(n.p[0], n.p[1] + 0.03, n.p[2]);
      routes.add(m);
    }
  }
  scene.add(routes);
  const spotRings = new T.Group();
  (model.spots as number[][]).forEach((s, i) => {
    const color = s[4] === 0 ? TEAM_COLORS[0] : s[4] === 1 ? TEAM_COLORS[1] : 0xe8edf0;
    const ring = new T.Mesh(
      new T.RingGeometry(0.3, 0.36, 32),
      new T.MeshBasicMaterial({ color, side: T.DoubleSide, transparent: true, opacity: 0.85 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(s[0], s[1] + 0.012, s[2]);
    ring.userData.ref = `spot:${i}`;
    spotRings.add(ring);
  });
  scene.add(spotRings);
  const trails = new T.Group();
  scene.add(trails);
  const selection = new T.BoxHelper(new T.Object3D(), 0x2ee6d6);
  selection.visible = false;
  scene.add(selection);
  const hover = new T.BoxHelper(new T.Object3D(), 0x9bd8d2);
  hover.visible = false;
  scene.add(hover);
  const measure = new T.Group();
  scene.add(measure);

  let overlays: Overlays = { ...DEFAULT_OVERLAYS };
  let labels: Label[] = [];
  let selected: string | null = null;
  let hovered: string | null = null;
  let follow: string | null = null;
  const labelEls = new Map<string, HTMLDivElement>();

  function applyOverlays() {
    grid.visible = overlays.grid;
    routes.visible = overlays.routes;
    spotRings.visible = overlays.spots;
    trails.visible = overlays.trails;
    field.visible = overlays.field;
    field.traverse((o) => {
      const mesh = o as T.Mesh;
      if (!mesh.material) return;
      for (const m of ([] as T.Material[]).concat(mesh.material)) {
        m.opacity = overlays.xray ? 0.35 : 1;
        m.depthWrite = !overlays.xray;
      }
    });
    labelLayer.hidden = !overlays.labels;
  }
  applyOverlays();

  const size = () => [host.clientWidth || 1, host.clientHeight || 1];
  function resize() {
    const [w, h] = size();
    renderer.setSize(w, h);
    persp.aspect = w / h;
    persp.updateProjectionMatrix();
    const span = ortho.top - ortho.bottom;
    ortho.left = (-span / 2) * (w / h);
    ortho.right = (span / 2) * (w / h);
    ortho.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  function findRef(o: T.Object3D | null): string | null {
    while (o) {
      if (o.userData.ref) return o.userData.ref as string;
      o = o.parent;
    }
    return null;
  }
  const objectFor = (ref: string | null): T.Object3D | null => {
    if (!ref) return null;
    const [kind, id] = ref.split(":");
    if (kind === "robot") return actors.robots[Number(id)] ?? null;
    if (kind === "obj") return actors.objects.get(Number(id)) ?? null;
    if (kind === "spot") return spotRings.children[Number(id)] ?? null;
    return null;
  };
  const raycaster = new T.Raycaster();
  function pick(x: number, y: number): { ref: string | null; point: number[] | null } {
    const r = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new T.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
    const hits = raycaster.intersectObjects([actors.root, spotRings, field], true);
    for (const h of hits) {
      const ref = findRef(h.object);
      if (ref) return { ref, point: h.point.toArray() };
    }
    return { ref: null, point: hits[0]?.point.toArray() ?? null };
  }

  const tmp = new T.Vector3();
  function updateLabels() {
    if (!overlays.labels) return;
    const [w, h] = size();
    const seen = new Set<string>();
    for (const l of labels) {
      tmp.set(l.p[0], l.p[1], l.p[2]).project(camera);
      let el = labelEls.get(l.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "scene-label";
        labelLayer.append(el);
        labelEls.set(l.id, el);
      }
      seen.add(l.id);
      if (el.textContent !== l.text) el.textContent = l.text;
      el.dataset.tone = l.tone ?? "";
      el.dataset.selected = String(selected !== null && l.id === selected);
      const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
      el.style.display = visible ? "" : "none";
      el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px) translate(-50%, -100%)`;
    }
    for (const [id, el] of labelEls)
      if (!seen.has(id)) {
        el.remove();
        labelEls.delete(id);
      }
  }

  let animation = 0;
  const loop = () => {
    animation = requestAnimationFrame(loop);
    // Workspaces stay mounted; hidden viewports need no GPU or label work.
    if (document.hidden || !host.getClientRects().length || host.closest("[hidden]")) return;
    if (follow) {
      const o = objectFor(follow);
      if (o) {
        const d = o.position.clone().sub(controls.target);
        controls.target.add(d);
        camera.position.add(d);
      }
    }
    controls.update();
    for (const [helper, ref] of [
      [selection, selected],
      [hover, hovered !== selected ? hovered : null],
    ] as const) {
      const o = objectFor(ref);
      helper.visible = !!o;
      if (o) helper.setFromObject(o);
    }
    renderer.render(scene, camera);
    updateLabels();
  };
  resize();
  loop();

  function setCamera(c: T.PerspectiveCamera | T.OrthographicCamera) {
    c.position.copy(camera.position);
    c.quaternion.copy(camera.quaternion);
    camera = c;
    controls.object = c;
    if (c === ortho) {
      const dist = persp.position.distanceTo(controls.target);
      const span = 2 * dist * Math.tan(T.MathUtils.degToRad(persp.fov / 2));
      const [w, h] = size();
      ortho.top = span / 2;
      ortho.bottom = -span / 2;
      ortho.left = (-span / 2) * (w / h);
      ortho.right = (span / 2) * (w / h);
      ortho.zoom = 1;
      ortho.updateProjectionMatrix();
    }
    controls.update();
  }

  return {
    update(frame: Frame) {
      actors.update(frame);
    },
    ghost(frame: Frame | null) {
      ghost.root.visible = !!frame && overlays.ghost;
      if (frame) ghost.update(frame);
    },
    trails(list: Trail[], time: number) {
      for (const c of [...trails.children]) {
        trails.remove(c);
        (c as T.Line).geometry.dispose();
      }
      for (const t of list) {
        if (t.points.length < 2) continue;
        const color = TEAM_COLORS[t.robot >> 1];
        const past = t.points.filter((p) => p[3] <= time);
        const future = t.points.filter((p) => p[3] >= time);
        for (const [pts, opacity] of [
          [past, 0.95],
          [future, 0.28],
        ] as const) {
          if (pts.length < 2) continue;
          const g = new T.BufferGeometry().setFromPoints(pts.map((p) => new T.Vector3(p[0], p[1] + 0.05 + (t.robot % 2) * 0.03, p[2])));
          trails.add(new T.Line(g, new T.LineBasicMaterial({ color, transparent: true, opacity })));
        }
      }
    },
    labels(list: Label[]) {
      labels = list;
    },
    overlays(next: Overlays) {
      overlays = next;
      applyOverlays();
    },
    select(ref: string | null) {
      selected = ref;
    },
    hover(ref: string | null) {
      hovered = ref;
    },
    pick,
    view(v: ViewName) {
      follow = null;
      camera.position.set(...VIEWS[v]);
      if (camera === ortho) {
        ortho.zoom = Math.min(ortho.right - ortho.left, ortho.top - ortho.bottom) / 14;
        ortho.updateProjectionMatrix();
      }
      controls.target.set(0, 0.4, 0);
      controls.update();
    },
    setOrtho(on: boolean) {
      setCamera(on ? ortho : persp);
    },
    isOrtho: () => camera === ortho,
    /** Frame an entity or the whole field. */
    focus(ref: string | null) {
      const o = objectFor(ref);
      const box = o ? new T.Box3().setFromObject(o) : new T.Box3(new T.Vector3(-5.5, 0, -5.5), new T.Vector3(5.5, 1.5, 5.5));
      const center = box.getCenter(new T.Vector3());
      const radius = Math.max(o ? 1.6 : 7, box.getSize(new T.Vector3()).length() / 2);
      const dir = camera.position.clone().sub(controls.target).normalize();
      controls.target.copy(center);
      if (camera === ortho) {
        ortho.zoom = Math.min(ortho.right - ortho.left, ortho.top - ortho.bottom) / (2 * radius);
        ortho.updateProjectionMatrix();
      }
      camera.position.copy(center.clone().add(dir.multiplyScalar(radius / Math.tan(T.MathUtils.degToRad(persp.fov / 2)))));
      controls.update();
    },
    follow(ref: string | null) {
      follow = ref;
      if (ref) this.focus(ref);
    },
    zoom(factor: number) {
      if (camera === ortho) {
        ortho.zoom *= factor;
        ortho.updateProjectionMatrix();
      } else {
        const d = camera.position.clone().sub(controls.target).multiplyScalar(1 / factor);
        camera.position.copy(controls.target.clone().add(d));
      }
      controls.update();
    },
    orbit(azimuth: number, polar: number) {
      const offset = camera.position.clone().sub(controls.target);
      const s = new T.Spherical().setFromVector3(offset);
      s.theta += azimuth;
      s.phi = Math.max(0.01, Math.min(Math.PI / 2 - 0.02, s.phi + polar));
      camera.position.copy(controls.target.clone().add(new T.Vector3().setFromSpherical(s)));
      controls.update();
    },
    /** Measurement line between two points; null clears. */
    measure(a: number[] | null, b: number[] | null) {
      for (const c of [...measure.children]) measure.remove(c);
      if (!a || !b) return;
      const g = new T.BufferGeometry().setFromPoints([new T.Vector3(...a), new T.Vector3(...b)]);
      measure.add(new T.Line(g, new T.LineBasicMaterial({ color: 0xffd34d, depthTest: false })));
      const dm = new T.MeshBasicMaterial({ color: 0xffd34d, depthTest: false });
      for (const p of [a, b]) {
        const m = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), dm);
        m.position.set(p[0], p[1], p[2]);
        measure.add(m);
      }
    },
    camera(): CameraState {
      return {
        position: camera.position.toArray(),
        target: controls.target.toArray(),
        ortho: camera === ortho,
        zoom: ortho.zoom,
        orthoHeight: ortho.top - ortho.bottom,
      };
    },
    setCameraState(c: CameraState) {
      follow = null;
      if ((camera === ortho) !== c.ortho) setCamera(c.ortho ? ortho : persp);
      camera.position.fromArray(c.position);
      controls.target.fromArray(c.target);
      if (c.orthoHeight && Number.isFinite(c.orthoHeight) && c.orthoHeight > 0) {
        const [w, h] = size();
        ortho.top = c.orthoHeight / 2;
        ortho.bottom = -ortho.top;
        ortho.right = ortho.top * w / h;
        ortho.left = -ortho.right;
      }
      ortho.zoom = c.zoom && Number.isFinite(c.zoom) && c.zoom > 0 ? c.zoom : 1;
      ortho.updateProjectionMatrix();
      controls.update();
    },
    onCameraChange(fn: () => void) {
      controls.addEventListener("end", fn);
      return () => controls.removeEventListener("end", fn);
    },
    screenshot(): string {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL("image/png");
    },
    /** Azimuth for the navigation gizmo (radians, 0 = looking from +z). */
    heading() {
      const d = camera.position.clone().sub(controls.target);
      return { azimuth: Math.atan2(d.x, d.z), polar: Math.acos(Math.min(1, d.y / d.length())) };
    },
    background(color: string) {
      bg.set(color);
      (scene.fog as T.Fog).color.set(color);
    },
    dispose() {
      cancelAnimationFrame(animation);
      ro.disconnect();
      controls.dispose();
      const mats = new Set<T.Material>();
      scene.traverse((o) => {
        const mesh = o as T.Mesh;
        mesh.geometry?.dispose();
        if (mesh.material) for (const m of ([] as T.Material[]).concat(mesh.material)) mats.add(m);
      });
      for (const m of mats) m.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.remove();
    },
  };
}
export type SceneAPI = ReturnType<typeof createScene>;
