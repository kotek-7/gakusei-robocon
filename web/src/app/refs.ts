/**
 * Entity references shared by selection, quick open, links and context menus.
 * They are scoped to the active search, e.g. `node:12`, `robot:1`, `spot:6`.
 */
export type EntityKind =
  | "node"
  | "edge"
  | "run"
  | "cand"
  | "robot"
  | "obj"
  | "spot"
  | "marker";
export type EntityRef = `${EntityKind}:${string}`;
export const ref = (kind: EntityKind, id: string | number): EntityRef =>
  `${kind}:${id}`;
export function parseRef(r: string): { kind: EntityKind; id: string } | null {
  const i = r.indexOf(":");
  if (i < 0) return null;
  const kind = r.slice(0, i) as EntityKind;
  if (!["node", "edge", "run", "cand", "robot", "obj", "spot", "marker"].includes(kind))
    return null;
  return { kind, id: r.slice(i + 1) };
}
export const refNumber = (r: string | null | undefined, kind: EntityKind) => {
  const p = r ? parseRef(r) : null;
  return p?.kind === kind ? Number(p.id) : null;
};
