import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createWorld } from "./world.js";
import { EDGES } from "../engine/model";

export function createScene(el, callbacks = {}) {
  const scene = new T.Scene();
  scene.background = new T.Color("#10171e");
  const camera = new T.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(11, 13, 15);
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  el.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.4, 0);
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.minDistance = 1;
  controls.maxDistance = 40;
  scene.add(new T.HemisphereLight(0xb8deff, 0x333941, 1.8));
  const light = new T.DirectionalLight(0xfff6b5, 2);
  light.position.set(-5, 15, 8);
  light.castShadow = true;
  light.shadow.bias = -0.0002;
  light.shadow.normalBias = 0.02;
  light.shadow.mapSize.set(2048, 2048);
  Object.assign(light.shadow.camera, {
    left: -9,
    right: 9,
    top: 9,
    bottom: -9,
  });
  scene.add(light);
  const world = createWorld(scene),
    raycaster = new T.Raycaster();
  const paths = new T.Group(),
    trails = new T.Group();
  scene.add(paths, trails);
  for (const e of EDGES) {
    const g = new T.BufferGeometry().setFromPoints(
      e.route.map((p) => new T.Vector3(p[0], p[1] + 0.06, p[2])),
    );
    paths.add(
      new T.Line(
        g,
        new T.LineBasicMaterial({
          color: 0x98c9de,
          transparent: true,
          opacity: 0.65,
        }),
      ),
    );
  }
  paths.visible = false;
  const labels = new Map();
  const highlight = new T.BoxHelper(new T.Object3D(), 0xffdd66);
  highlight.visible = false;
  scene.add(highlight);
  let currentFrame,
    currentFrames = [],
    options = {},
    previousCamera,
    savedCamera,
    followPosition;
  const cameraState = () => ({
    position: camera.position.toArray(),
    target: controls.target.toArray(),
  });
  const publish = () => callbacks.onCamera?.(cameraState());
  function applyCamera(value) {
    camera.position.fromArray(value.position);
    controls.target.fromArray(value.target);
    controls.update();
  }
  function changeCamera(action) {
    previousCamera = cameraState();
    action();
    controls.update();
    publish();
  }
  controls.addEventListener("start", () => {
    previousCamera = cameraState();
  });
  controls.addEventListener("end", publish);
  function clearGroup(group) {
    for (const line of [...group.children]) {
      group.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
  }
  function update(frame, frames = currentFrames, nextOptions = options) {
    currentFrame = frame;
    currentFrames = frames;
    options = nextOptions;
    world.update(frame, frames);
    paths.visible = !!options.paths;
    const selected = world.entities.get(options.selection);
    highlight.visible = !!selected;
    if (selected) highlight.setFromObject(selected);
    for (const [id, entity] of world.entities) {
      entity.traverse((child) => {
        if (!child.isMesh || id.startsWith("tower:")) return;
        if (!child.userData.privateMaterial) {
          child.material = child.material.clone();
          child.userData.privateMaterial = true;
        }
        child.material.transparent = !!options.dim;
        child.material.opacity =
          options.dim && options.selection && id !== options.selection
            ? 0.2
            : 1;
      });
      if (!labels.has(id)) {
        const label = document.createElement("span");
        label.className = "viewport-object-label";
        label.textContent = id.startsWith("robot:")
          ? frame.robots[Number(id.split(":")[1])].id
          : id.startsWith("tower:")
            ? `建設スポット ${Number(id.split(":")[1])}`
            : `資源 ${id.split(":")[1]}`;
        el.append(label);
        labels.set(id, label);
      }
    }
    clearGroup(trails);
    if (options.trails) {
      const lower =
        options.trailRange === "recent"
          ? frame.t - 10
          : options.trailRange === "range"
            ? (options.range?.[0] ?? 0)
            : 0;
      const upper =
        options.trailRange === "range"
          ? Math.min(frame.t, options.range?.[1] ?? frame.t)
          : frame.t;
      frame.robots.forEach((_, i) => {
        if (options.trailScope !== "all" && options.selection !== `robot:${i}`)
          return;
        const points = frames
          .filter((f) => f.t >= lower && f.t <= upper)
          .map((f) =>
            new T.Vector3(...f.robots[i].p).add(new T.Vector3(0, 0.1, 0)),
          );
        if (points.length > 1)
          trails.add(
            new T.Line(
              new T.BufferGeometry().setFromPoints(points),
              new T.LineBasicMaterial({ color: i < 2 ? 0xff8b7d : 0x8bb9ff }),
            ),
          );
      });
    }
    if (options.follow && selected && options.selection?.startsWith("robot:")) {
      if (followPosition) {
        const delta = selected.position.clone().sub(followPosition);
        camera.position.add(delta);
        controls.target.add(delta);
        controls.update();
        publish();
      }
      followPosition = selected.position.clone();
    } else followPosition = null;
  }
  let pointer;
  function down(e) {
    pointer = { x: e.clientX, y: e.clientY, button: e.button };
  }
  function up(e) {
    if (
      !pointer ||
      Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 5 ||
      ![0, 2].includes(pointer.button)
    )
      return;
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(
      new T.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const ids = [];
    for (const hit of raycaster.intersectObjects(
      [...world.entities.values()],
      true,
    )) {
      let object = hit.object;
      while (object && !object.userData.semanticId) object = object.parent;
      const id = object?.userData.semanticId;
      if (id && !ids.includes(id)) ids.push(id);
    }
    callbacks.onPick?.(ids, pointer.button === 2);
    pointer = null;
  }
  const context = (e) => e.preventDefault();
  renderer.domElement.addEventListener("pointerdown", down);
  renderer.domElement.addEventListener("pointerup", up);
  renderer.domElement.addEventListener("contextmenu", context);
  const resize = new ResizeObserver(() => {
    const w = Math.max(1, el.clientWidth),
      h = Math.max(1, el.clientHeight);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  resize.observe(el);
  let animation;
  function loop() {
    animation = requestAnimationFrame(loop);
    controls.update();
    for (const [id, label] of labels) {
      const entity = world.entities.get(id),
        p = entity.position
          .clone()
          .add(new T.Vector3(0, id.startsWith("robot:") ? 0.85 : 0.4, 0))
          .project(camera);
      label.hidden =
        !options.labels ||
        !entity.visible ||
        p.z > 1 ||
        p.z < -1 ||
        Math.abs(p.x) > 1 ||
        Math.abs(p.y) > 1;
      label.style.left = `${((p.x + 1) * el.clientWidth) / 2}px`;
      label.style.top = `${((1 - p.y) * el.clientHeight) / 2}px`;
    }
    renderer.render(scene, camera);
  }
  loop();
  return {
    update,
    camera: applyCamera,
    view(v) {
      changeCamera(() => {
        camera.position.set(
          ...({
            top: [0, 23, 0.01],
            red: [-16, 9, 0],
            blue: [16, 9, 0],
            iso: [11, 13, 15],
            all: [11, 13, 15],
          }[v] ?? [11, 13, 15]),
        );
        controls.target.set(0, 0.4, 0);
      });
    },
    focus() {
      const selected = world.entities.get(options.selection);
      if (selected)
        changeCamera(() => {
          const offset = camera.position
            .clone()
            .sub(controls.target)
            .normalize()
            .multiplyScalar(4);
          controls.target.copy(selected.position);
          camera.position.copy(selected.position).add(offset);
        });
    },
    previous() {
      if (previousCamera) {
        const current = cameraState();
        applyCamera(previousCamera);
        previousCamera = current;
        publish();
      }
    },
    save() {
      savedCamera = cameraState();
    },
    restore() {
      if (savedCamera) changeCamera(() => applyCamera(savedCamera));
    },
    capture(label) {
      renderer.render(scene, camera);
      const canvas = document.createElement("canvas");
      canvas.width = renderer.domElement.width;
      canvas.height = renderer.domElement.height + 64;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#10171e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(renderer.domElement, 0, 64);
      ctx.fillStyle = "#ffffff";
      ctx.font = "20px sans-serif";
      ctx.fillText(
        `${label} · ${currentFrame.t}秒 · 赤 ${currentFrame.scores[0]} / 青 ${currentFrame.scores[1]}`,
        16,
        38,
        canvas.width - 32,
      );
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        a.download = `試合-${currentFrame.t}秒.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    },
    dispose() {
      cancelAnimationFrame(animation);
      resize.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("contextmenu", context);
      const materials = new Set();
      scene.traverse((object) => {
        object.geometry?.dispose();
        if (object.material)
          for (const material of [].concat(object.material))
            materials.add(material);
      });
      for (const material of materials) {
        material.map?.dispose();
        material.dispose();
      }
      for (const label of labels.values()) label.remove();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
