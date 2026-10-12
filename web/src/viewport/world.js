import * as T from "three";
import cad from "./generated/field.json";
import { createRobots } from "./robots.js";
import { box } from "./primitives.js";
import {
  spots,
  skyLayout,
  transfer,
  groundPillar,
  side,
} from "../simulation/field.js";
function clear(group) {
  group.traverse((o) => o.geometry?.dispose());
  group.clear();
}
export function createWorld(scene) {
  const material = (color) =>
    new T.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
  const materials = {
    red: material(0xdf2222),
    blue: material(0x3200ff),
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
  grid.position.y = 0.003;
  grid.visible = false;
  scene.add(grid);
  const towers = spots.map((p) => {
    const g = new T.Group();
    g.position.set(...p.slice(0, 3));
    scene.add(g);
    return g;
  });
  const robots = createRobots(scene, materials),
    storage = new T.Group();
  scene.add(storage);
  function sky(parent, x, y, z, top) {
    box(
      parent,
      0.2,
      0.1,
      0.2,
      x,
      y + 0.05,
      z,
      top ? materials.red : materials.blue,
    );
    box(
      parent,
      0.2,
      0.1,
      0.2,
      x,
      y + 0.15,
      z,
      top ? materials.blue : materials.red,
    );
  }
  function ball(parent, x, y, z) {
    const g = new T.Group();
    const geo = new T.SphereGeometry(0.105, 24, 16);
    const mesh = new T.Mesh(geo, materials.yellow);
    g.add(mesh);
    for (let k = 0; k < 3; k++) {
      const band = new T.Mesh(
        new T.TorusGeometry(0.103, 0.008, 6, 48),
        materials.blue,
      );
      band.rotation.set((k * Math.PI) / 3, Math.PI / 2, 0);
      g.add(band);
    }
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }
  const mustika = ball(scene, 0, 0, 0);
  let lastKey = "";
  const cargoKeys = [];
  function update(f) {
    robots.forEach((g, i) => {
      const r = f.robots[i],
        old = g.position.clone();
      g.position.set(...r.p);
      if (old.distanceTo(g.position) > 0.001)
        g.rotation.y = Math.atan2(g.position.x - old.x, g.position.z - old.z);
      const key = r.carry.join("");
      if (cargoKeys[i] !== key) {
        cargoKeys[i] = key;
        clear(g.userData.cargo);
        r.carry.forEach((c, j) => {
          if (c === "M") ball(g.userData.cargo, 0, 0.7, 0);
          else if (c === "S")
            sky(g.userData.cargo, 0, 0.5 + j * 0.2, 0, r.team);
          else
            box(
              g.userData.cargo,
              0.35,
              0.35,
              0.35,
              0,
              0.675 + j * 0.35,
              0,
              r.team ? materials.blue : materials.red,
            );
        });
      }
    });
    const key = JSON.stringify([
      f.towers,
      f.teams.map((t) => [t.earth, t.bufferE, t.bufferS, t.mustika]),
      f.groundSkyIds,
    ]);
    if (key !== lastKey) {
      lastKey = key;
      towers.forEach((g, i) => {
        clear(g);
        f.towers[i].earth.forEach((owner, k) =>
          box(
            g,
            0.35,
            0.35,
            0.35,
            0,
            0.175 + k * 0.35,
            0,
            owner ? materials.blue : materials.red,
          ),
        );
        if (f.towers[i].sky !== null) sky(g, 0, 0.7, 0, f.towers[i].sky);
      });
      clear(storage);
      f.teams.forEach((t, team) => {
        // 2 x 5 columns, two blocks high, inside the 2m x 1m storage area (§4.1.3).
        for (let j = 0; j < t.earth; j++) {
          const column = Math.floor(j / 2);
          box(
            storage,
            0.35,
            0.35,
            0.35,
            side(team) * (3.7 + (column % 5) * 0.375),
            0.175 + (j % 2) * 0.35,
            -4.7 - Math.floor(column / 5) * 0.375,
            team ? materials.blue : materials.red,
          );
        }
        const [x, y, z] = transfer(team);
        let slot = 0;
        for (const [n, type] of [
          [t.bufferE, "E"],
          [t.bufferS, "S"],
        ])
          for (let j = 0; j < n; j++, slot++) {
            const xx = x + ((slot % 2) - 0.5) * 0.36,
              zz = z + ((Math.floor(slot / 2) % 2) - 0.5) * 0.36,
              base = y + Math.floor(slot / 4) * 0.35;
            if (type === "E")
              box(
                storage,
                0.35,
                0.35,
                0.35,
                xx,
                base + 0.175,
                zz,
                team ? materials.blue : materials.red,
              );
            else sky(storage, xx, base, zz, team);
          }
        if (t.mustika) ball(storage, x, y + 0.105, z);
      });
      for (const item of (f.groundSkyIds || []).map((id) => skyLayout[id])) {
        const g = new T.Group();
        sky(g, 0, -0.1, 0, 0);
        g.rotation[item.axis] = item.angle;
        g.position.set(item.p[0], 0.1, item.p[2]);
        storage.add(g);
      }
    }
    mustika.visible = f.mustika === "ground" || typeof f.mustika === "number";
    // Sphere rests in the CAD receptacle, radius 105mm / aperture radius 90mm.
    mustika.position.set(
      0,
      (f.mustika === "ground" ? 0.5 : 1.7) + Math.sqrt(0.105 ** 2 - 0.09 ** 2),
      f.mustika === "ground" ? groundPillar[2] : -0.002,
    );
  }
  return { update, grid };
}
