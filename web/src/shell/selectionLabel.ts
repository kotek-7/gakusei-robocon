import { robotNames } from "../editors/common/labels";

export const selectionLabel = (r: string) => {
  const [k, id] = r.split(":");
  if (k === "robot") return robotNames[Number(id)];
  if (k === "spot") return `建設スポット S${id}`;
  if (k === "obj") return `物体 ${id}`;
  if (k === "edge") return `遷移 E${id}`;
  return r;
};
