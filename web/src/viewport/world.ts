import * as T from "three";
import cad from "./generated/field.json";
import { box } from "./primitives";
import { createRobot, ROBOT_IDS, type Materials } from "./robots";
import type { Frame } from "../engine/types";

type CadMesh = { positions: number[]; indices: number[]; faces: { color: number[]; first: number; last: number }[] };

export function createMaterials(): Materials {
  const m = (color: number) => new T.MeshStandardMaterial({ color, roughness: 0.85 });
  return { red: m(0xd53939), blue: m(0x315ce2), metal: m(0x88969e), black: m(0x24303a), yellow: m(0xffcb20) };
}

export function createField(scene: T.Scene) {
  const field = new T.Group();
  field.name = "field";
  for (const source of (cad as { meshes: CadMesh[] }).meshes) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(source.positions, 3));
    geometry.setIndex(source.indices);
    geometry.computeVertexNormals();
    const palette: T.Material[] = [],
      keys = new Map<string, number>();
    for (const face of source.faces) {
      const key = face.color.join(",");
      if (!keys.has(key)) {
        keys.set(key, palette.length);
        palette.push(
          new T.MeshStandardMaterial({
            color: new T.Color(face.color[0], face.color[1], face.color[2]),
            roughness: 0.9,
            side: T.DoubleSide,
            transparent: true,
          }),
        );
      }
      geometry.addGroup(face.first * 3, (face.last - face.first + 1) * 3, keys.get(key)!);
    }
    const mesh = new T.Mesh(geometry, palette);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    field.add(mesh);
  }
  scene.add(field);
  return field;
}

/** Robots and game objects driven by frames. Each body is tagged for picking. */
export function createActors(scene: T.Scene, materials: Materials, opacity = 1) {
  const root = new T.Group();
  scene.add(root);
  const ghostify = (g: T.Object3D) => {
    if (opacity >= 1) return;
    g.traverse((o) => {
      const mesh = o as T.Mesh;
      if (mesh.material) {
        mesh.material = (mesh.material as T.Material).clone();
        (mesh.material as T.Material).transparent = true;
        (mesh.material as T.Material).opacity = opacity;
        (mesh.material as T.Material).depthWrite = false;
        mesh.castShadow = false;
      }
    });
  };
  const robots = [0, 1].flatMap((team) =>
    (["TR", "BR"] as const).map((role, i) => {
      const g = createRobot(team, role, materials);
      g.userData.ref = `robot:${team * 2 + i}`;
      g.userData.label = ROBOT_IDS[team * 2 + i];
      ghostify(g);
      root.add(g);
      return g;
    }),
  );
  const objects = new Map<number, T.Group>();
  function object(o: Frame["objects"][number]) {
    const g = new T.Group();
    if (o.kind === "E") box(g, 0.35, 0.35, 0.35, 0, 0, 0, o.owner ? materials.blue : materials.red);
    else if (o.kind === "S") {
      box(g, 0.2, 0.1, 0.2, 0, -0.05, 0, materials.blue);
      box(g, 0.2, 0.1, 0.2, 0, 0.05, 0, materials.red);
    } else {
      g.add(new T.Mesh(new T.SphereGeometry(0.105, 20, 14), materials.yellow));
      g.add(new T.Mesh(new T.TorusGeometry(0.105, 0.008, 6, 32), materials.blue));
    }
    g.userData.ref = `obj:${o.id}`;
    ghostify(g);
    root.add(g);
    return g;
  }
  const headings = [0, 0, 0, 0];
  function update(frame: Frame) {
    frame.robots.forEach((r, i) => {
      const g = robots[i],
        old = g.position.clone();
      g.position.set(r.p[0], r.p[1], r.p[2]);
      if (old.distanceTo(g.position) > 0.001) headings[i] = Math.atan2(g.position.x - old.x, g.position.z - old.z);
      g.rotation.y = headings[i];
    });
    for (const o of frame.objects) {
      if (!objects.has(o.id)) objects.set(o.id, object(o));
      const g = objects.get(o.id)!;
      g.position.set(o.p![0], o.p![1], o.p![2]);
      if (o.kind === "S") g.rotation.set(o.loc === "groundSky" ? Math.PI / 2 : o.face === 1 ? Math.PI : 0, 0, 0);
    }
  }
  return { root, robots, objects, update };
}
