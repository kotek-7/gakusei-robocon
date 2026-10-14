import * as T from "three";
import { box } from "./primitives";
export type Materials = Record<"red" | "blue" | "metal" | "black" | "yellow", T.Material>;
export const ROBOT_IDS = ["R-TR", "R-BR", "B-TR", "B-BR"];
/** Representative robot bodies: TR is lower and wider, BR carries a mast. */
export function createRobot(team: number, role: "TR" | "BR", materials: Materials) {
  const g = new T.Group();
  const color = team ? materials.blue : materials.red;
  box(g, 0.5, 0.18, 0.55, 0, 0.27, 0, materials.metal);
  box(g, 0.48, 0.12, 0.5, 0, 0.42, 0, color);
  box(g, 0.28, 0.13, 0.26, 0, 0.54, -0.1, materials.black);
  for (const x of [-0.27, 0.27])
    for (const z of [-0.18, 0.18]) {
      const wheel = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.08, 18), materials.black);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.17, z);
      g.add(wheel);
    }
  if (role === "BR") {
    for (const x of [-0.22, 0.22]) box(g, 0.055, 0.6, 0.055, x, 0.75, 0.2, materials.metal);
    box(g, 0.5, 0.06, 0.06, 0, 1.05, 0.2, color);
  } else {
    for (const x of [-0.22, 0.22]) box(g, 0.055, 0.3, 0.055, x, 0.5, 0.2, materials.metal);
  }
  box(g, 0.48, 0.08, 0.2, 0, 0.28, 0.2, materials.black);
  return g;
}
