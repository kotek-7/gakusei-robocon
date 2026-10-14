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

/** Horizontal keys follow graph connections; vertical keys stay in the time column. */
export function graphFocusTarget(nodes: Graph["nodes"], edges: Graph["edges"], current: number, key: string): number | undefined {
  if (key === "Home") return nodes[0]?.id;
  if (key === "End") return nodes.at(-1)?.id;
  const visible = new Set(nodes.map(n => n.id));
  if (key === "ArrowRight") return edges.find(e => e.src === current && visible.has(e.dst))?.dst;
  if (key === "ArrowLeft") return edges.find(e => e.dst === current && visible.has(e.src))?.src;
  const node = nodes.find(n => n.id === current);
  if (!node || !["ArrowUp", "ArrowDown"].includes(key)) return undefined;
  const column = nodes.filter(n => n.state.t === node.state.t);
  const index = column.findIndex(n => n.id === current);
  return column[index + (key === "ArrowDown" ? 1 : -1)]?.id;
}
