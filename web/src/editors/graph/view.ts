import type { Graph } from "../../engine/types";
export type GraphScope = "page" | "neighbors" | "path" | "frontier" | "scored";
/** Filters the loaded page only; unloaded branches remain unknown. */
export function graphNodes(data: Graph, selected: number | null, path: number[], scope: GraphScope) {
  if (scope === "page") return data.nodes;
  if (scope === "frontier") return data.nodes.filter(node => !node.expanded || node.id === selected);
  if (scope === "scored") return data.nodes.filter(node => node.scores.some(score => score > 0) || node.id === selected);
  const ids = new Set<number>(selected === null ? [] : [selected]);
  for (const edge of data.edges) {
    if (scope === "path" ? path.includes(edge.id) : edge.src === selected || edge.dst === selected) {
      ids.add(edge.src); ids.add(edge.dst);
    }
  }
  return data.nodes.filter((node) => ids.has(node.id));
}
