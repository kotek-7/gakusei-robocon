import * as T from "three";
import cad from "./generated/field.json";
import { createRobots } from "./robots.js";
import { box } from "./primitives.js";
import { SPOTS } from "../engine/model";
import { headingAt } from "./heading";
export function createWorld(scene) {
  const material = (color) =>
    new T.MeshStandardMaterial({ color, roughness: 0.85 });
  const materials = {
    red: material(0xd53939),
    blue: material(0x315ce2),
    metal: material(0x88969e),
    black: material(0x24303a),
    yellow: material(0xffcb20),
  };
  for (const source of cad.meshes) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(source.positions, 3),
    );
    geometry.setIndex(source.indices);
    geometry.computeVertexNormals();
    const palette = [],
      keys = new Map();
    for (const face of source.faces) {
      const key = face.color.join(",");
      if (!keys.has(key)) {
        keys.set(key, palette.length);
        palette.push(
          new T.MeshStandardMaterial({
            color: new T.Color(...face.color),
            roughness: 0.9,
            side: T.DoubleSide,
          }),
        );
      }
      geometry.addGroup(
        face.first * 3,
        (face.last - face.first + 1) * 3,
        keys.get(key),
      );
    }
    const mesh = new T.Mesh(geometry, palette);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
  }
  const grid = new T.GridHelper(11, 22, 0x56606b, 0x8a9297);
  grid.visible = false;
  scene.add(grid);
  const robots = createRobots(scene, materials);
  const entities = new Map();
  robots.forEach((g, i) => {
    g.userData.semanticId = `robot:${i}`;
    entities.set(`robot:${i}`, g);
  });
  SPOTS.forEach((p, i) => {
    const g = new T.Mesh(
      new T.CylinderGeometry(0.34, 0.34, 0.12, 16),
      new T.MeshBasicMaterial({
        transparent: true,
        opacity: 0.01,
        depthWrite: false,
      }),
    );
    g.position.set(p[0], p[1] + 0.06, p[2]);
    g.userData.semanticId = `tower:${i}`;
    scene.add(g);
    entities.set(`tower:${i}`, g);
  });
  const objects = new Map();
  function object(o) {
    const g = new T.Group();
    if (o.kind === "E")
      box(
        g,
        0.35,
        0.35,
        0.35,
        0,
        0,
        0,
        o.owner ? materials.blue : materials.red,
      );
    else if (o.kind === "S") {
      box(g, 0.2, 0.1, 0.2, 0, -0.05, 0, materials.blue);
      box(g, 0.2, 0.1, 0.2, 0, 0.05, 0, materials.red);
    } else {
      const m = new T.Mesh(
        new T.SphereGeometry(0.105, 20, 14),
        materials.yellow,
      );
      g.add(m);
      const ring = new T.Mesh(
        new T.TorusGeometry(0.105, 0.008, 6, 32),
        materials.blue,
      );
      g.add(ring);
    }
    g.userData.semanticId = `object:${o.id}`;
    entities.set(`object:${o.id}`, g);
    scene.add(g);
    return g;
  }
  function update(frame, frames = []) {
    frame.robots.forEach((r, i) => {
      const g = robots[i];
      g.position.set(...r.p);
      g.rotation.y = headingAt(frames, frame, i);
    });
    for (const g of objects.values()) g.visible = false;
    for (const o of frame.objects) {
      if (!objects.has(o.id)) objects.set(o.id, object(o));
      const g = objects.get(o.id);
      g.visible = true;
      g.position.set(...o.p);
      if (o.kind === "S")
        g.rotation.set(
          o.loc === "groundSky" ? Math.PI / 2 : o.face === 1 ? Math.PI : 0,
          0,
          0,
        );
    }
  }
  return { grid, update, entities };
}
