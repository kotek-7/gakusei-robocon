import * as T from "three";
import { box } from "./primitives.js";
export function createRobots(scene, materials) {
  return [0, 1].flatMap((team) =>
    ["TR", "BR"].map((role) => {
      let g = new T.Group();
      g.userData = { robot: `${team ? "B" : "R"}-${role}` };
      box(g, 0.5, 0.18, 0.55, 0, 0.27, 0, materials.metal);
      box(
        g,
        0.48,
        0.12,
        0.5,
        0,
        0.42,
        0,
        team ? materials.blue : materials.red,
      );
      box(g, 0.28, 0.13, 0.26, 0, 0.54, -0.1, materials.black);
      for (let x of [-0.27, 0.27])
        for (let z of [-0.18, 0.18]) {
          let wheel = new T.Mesh(
            new T.CylinderGeometry(0.15, 0.15, 0.08, 18),
            materials.black,
          );
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(x, 0.17, z);
          g.add(wheel);
          let hub = new T.Mesh(
            new T.CylinderGeometry(0.07, 0.07, 0.085, 12),
            materials.metal,
          );
          hub.rotation.z = Math.PI / 2;
          hub.position.copy(wheel.position);
          g.add(hub);
        }
      for (let x of [-0.22, 0.22])
        box(g, 0.055, 0.3, 0.055, x, 0.5, 0.2, materials.metal);
      box(g, 0.48, 0.08, 0.2, 0, 0.28, 0.2, materials.black);
      let cargo = new T.Group();
      g.add(cargo);
      g.userData.cargo = cargo;
      scene.add(g);
      return g;
    }),
  );
}
