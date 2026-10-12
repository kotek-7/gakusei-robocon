import {
  side,
  transfer,
  builderTransfer,
  startPosition,
  earthApproach,
  skyApproach,
  mustikaApproach,
  spotApproach,
} from "./field.js";
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
// Role-specific corridor graph. Stair edges are kinematic abstractions, not wheel dynamics.
function network(team, role) {
  const s = side(team),
    nodes = [],
    edges = [];
  const add = (p) => {
    nodes.push(p);
    return nodes.length - 1;
  };
  const link = (a, b) => {
    edges.push([a, b]);
    return b;
  };
  const chain = (points) => {
    const ids = points.map(add);
    ids.slice(1).forEach((id, i) => link(ids[i], id));
    return ids;
  };
  const spawn = add(startPosition(team, role));
  const outer = chain([
    [s * 4.6, 0, 4.6],
    [s * 4.6, 0, 3.1],
    [s * 4.6, 0, -3.15],
    [s * 4.6, 0, -4.05],
  ]);
  link(spawn, outer[0]);
  let t;
  if (role === "TR") {
    link(outer[0], add(skyApproach(team)));
    link(outer[3], add(earthApproach(team)));
    link(outer[3], add(mustikaApproach(team)));
    const ramp = chain([
      [s * 3.5, 0, -3.15],
      [s * 3.5, 0, -2.694],
      [s * 3.5, 0.6, 0.8],
      transfer(team),
    ]);
    link(outer[2], ramp[0]);
    t = ramp.at(-1);
  } else {
    const stair = chain([
      [s * 3.5, 0, 3.1],
      [s * 3.5, 0, 2.7],
      [s * 3.5, 0.15, 2.55],
      [s * 3.5, 0.3, 2.25],
      [s * 3.5, 0.45, 1.95],
      transfer(team),
      builderTransfer(team),
      [s * 2.1, 0.6, 1.3],
      [s * 2.1, 0.6, 0],
    ]);
    link(outer[1], stair[0]);
    t = stair[5];
    for (const z of [-1, 1]) {
      const lane = chain([
        [s * 2.1, 0.6, z * 2.05],
        [s * 0.55, 0.6, z * 2.05],
        [s * 0.55, 0.6, z * 2.55],
      ]);
      link(stair[8], lane[0]);
      link(lane[0], add([s * 2.15, 0.6, z * 2.55]));
    }
    const upper = chain([
      [s * 1.95, 0.6, 0],
      [s * 1.65, 0.75, 0],
      [s * 1.15, 0.9, 0],
      [s * 0.65, 0.9, 0],
    ]);
    link(stair[8], upper[0]);
    const ring = chain([
      [-0.65, 0.9, -0.65],
      [0.65, 0.9, -0.65],
      [0.65, 0.9, 0.65],
      [-0.65, 0.9, 0.65],
    ]);
    link(ring[3], ring[0]);
    link(upper[3], ring[team ? 1 : 0]);
    link(upper[3], ring[team ? 2 : 3]);
    for (let id = 6; id < 10; id++) {
      let p = spotApproach(id, team);
      let nearest = ring.reduce((a, b) =>
        distance(nodes[a], p) < distance(nodes[b], p) ? a : b,
      );
      link(nearest, add(p));
    }
    link(upper[3], add([s * 0.55, 0.9, 0]));
  }
  return { nodes, edges };
}
const graphs = new Map();
export function planMovement(r, to) {
  const key = `${r.team}/${r.role}`;
  if (!graphs.has(key)) graphs.set(key, network(r.team, r.role));
  const { nodes, edges } = graphs.get(key);
  const nearest = (p) =>
    nodes.reduce(
      (best, v, i) => (distance(v, p) < distance(nodes[best], p) ? i : best),
      0,
    );
  const from = nearest(r.p),
    end = nearest(to);
  if (distance(nodes[from], r.p) > 0.001 || distance(nodes[end], to) > 0.001)
    throw new Error(`Unmapped movement ${r.id}: ${r.p} -> ${to}`);
  const costs = nodes.map(() => Infinity),
    prev = nodes.map(() => -1),
    pending = new Set(nodes.map((_, i) => i));
  costs[from] = 0;
  while (pending.size) {
    const u = [...pending].reduce((a, b) => (costs[a] < costs[b] ? a : b));
    pending.delete(u);
    if (u === end) break;
    for (const [a, b] of edges) {
      let v = a === u ? b : b === u ? a : -1;
      if (v < 0 || !pending.has(v)) continue;
      let c = costs[u] + distance(nodes[u], nodes[v]);
      if (c < costs[v]) {
        costs[v] = c;
        prev[v] = u;
      }
    }
  }
  if (!Number.isFinite(costs[end])) throw new Error("No permitted route");
  const ids = [];
  for (let u = end; u !== -1; u = prev[u]) ids.unshift(u);
  const route = ids.map((i) => [...nodes[i]]);
  if (route.length === 1) route.push([...to]);
  const lengths = route.slice(1).map((p, i) => distance(p, route[i]));
  return { route, lengths, distance: lengths.reduce((a, b) => a + b, 0) };
}
