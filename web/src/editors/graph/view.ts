import type { Graph } from "../../engine/types";
export type GraphScope = "page" | "neighbors" | "path";
/** Filters the loaded page only; unloaded branches remain unknown. */
export function graphNodes(data: Graph, selected: number | null, path: number[], scope: GraphScope) {
  if (scope === "page") return data.nodes;
  const ids = new Set<number>(selected === null ? [] : [selected]);
  for (const edge of data.edges) {
    if (scope === "path" ? path.includes(edge.id) : edge.src === selected || edge.dst === selected) {
      ids.add(edge.src); ids.add(edge.dst);
    }
  }
  return data.nodes.filter((node) => ids.has(node.id));
}
