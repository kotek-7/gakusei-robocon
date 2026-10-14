import type { Frame } from "../../engine/types";
import { actionName, locationName, objectNames, robotNames } from "../common/labels";
import type { EntityRef } from "../../app/refs";

export type SceneRow = { id: string; depth: number; label: string; hint?: string; entity?: EntityRef; branch?: boolean; icon: string };
/** The hierarchy follows physical containment at the playhead, not object ID order. */
export function sceneRows(frame: Frame): SceneRow[] {
  const rows: SceneRow[] = [];
  const objectRow = (o: Frame["objects"][number], depth: number): SceneRow => ({ id: `obj:${o.id}`, entity: `obj:${o.id}`, depth, label: `${objectNames[o.kind] || o.kind} ${o.id}`, hint: o.kind === "S" ? (o.face === 0 ? "赤面" : "青面") : undefined, icon: "ortho" });
  for (let team = 0; team < 2; team++) {
    rows.push({ id: `team:${team}`, depth: 0, label: team ? "青チーム" : "赤チーム", branch: true, icon: "layers" });
    frame.robots.forEach((robot, index) => {
      if (robot.team !== team) return;
      const held = frame.objects.filter(o => o.loc === `robot${index}`);
      rows.push({ id: `robot:${index}`, entity: `robot:${index}`, depth: 1, label: robotNames[index], hint: robot.action ? actionName(robot.action) : "待機", branch: !!held.length, icon: "ortho" });
      rows.push(...held.map(o => objectRow(o, 2)));
    });
  }
  rows.push({ id: "towers", depth: 0, label: "建設スポット", branch: true, icon: "layers" });
  for (let spot = 0; spot < 10; spot++) {
    const stack = frame.objects.filter(o => o.loc === `tower${spot}`).sort((a, b) => b.layer - a.layer);
    rows.push({ id: `spot:${spot}`, entity: `spot:${spot}`, depth: 1, label: `S${spot}`, hint: stack.length ? `${stack.length}個` : "空き", branch: !!stack.length, icon: "grid" });
    rows.push(...stack.map(o => objectRow(o, 2)));
  }
  const loose = frame.objects.filter(o => !/^robot\d+$|^tower\d+$/.test(o.loc));
  for (const loc of [...new Set(loose.map(o => o.loc))].sort()) {
    const objects = loose.filter(o => o.loc === loc);
    rows.push({ id: `loc:${loc}`, depth: 0, label: locationName(loc), hint: `${objects.length}個`, branch: true, icon: "layers" });
    rows.push(...objects.map(o => objectRow(o, 1)));
  }
  return rows;
}
