import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createWorld } from "./world.js";
export function createScene(el) {
  const scene = new T.Scene();
  scene.background = new T.Color("#10171e");
  scene.fog = new T.Fog("#10171e", 24, 60);
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
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.06;
  controls.minDistance = 5;
  controls.maxDistance = 32;
  scene.add(new T.HemisphereLight(12115455, 3356993, 1.8));
  const light = new T.DirectionalLight(16773845, 2);
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
  const { update, grid } = createWorld(scene);
  const resize = new ResizeObserver(() => {
    let w = el.clientWidth,
      h = el.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  resize.observe(el);
  let animation;
  function loop() {
    animation = requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  }
  loop();
  return {
    update,
    dispose() {
      cancelAnimationFrame(animation);
      resize.disconnect();
      controls.dispose();
      const materials = /* @__PURE__ */ new Set();
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
      renderer.dispose();
      renderer.domElement.remove();
    },
    view(v) {
      camera.position.set(
        ...(v === "top"
          ? [0, 23, 0.01]
          : v === "red"
            ? [-13, 9, 10]
            : [11, 13, 15]),
      );
      controls.target.set(0, 0.4, 0);
    },
    grid(v) {
      grid.visible = v;
    },
  };
}
