// Metres, Y up. Coordinates measured from the supplied STEP; object sizes from rulebook §2.
export const dimensions = Object.freeze({
  earth: 0.35,
  sky: 0.2,
  mustika: 0.21,
  spot: 0.5,
  field: 11,
  l1: 0.6,
  l2: 0.9,
});
export const spots = [
  [-2.75, 0.6, -2.75, "P", 0],
  [-2.75, 0.6, 2.75, "P", 0],
  [2.75, 0.6, -2.75, "P", 1],
  [2.75, 0.6, 2.75, "P", 1],
  [0, 0.6, -2.75, "S", -1],
  [0, 0.6, 2.75, "S", -1],
  [-1.25, 0.9, -1.25, "U", -1],
  [-1.25, 0.9, 1.25, "U", -1],
  [1.25, 0.9, -1.25, "U", -1],
  [1.25, 0.9, 1.25, "U", -1],
];
export const side = (team) => (team ? 1 : -1);
export const transfer = (team) => [side(team) * 3.5, 0.6, 1.3];
export const builderTransfer = (team) => [side(team) * 2.65, 0.6, 1.3];
export const startPosition = (team, role) => [
  side(team) * (role === "TR" ? 5.1 : 4.25),
  0,
  5.1,
];
export const earthApproach = (team) => [side(team) * 4.5, 0, -4.05];
export const skyApproach = (team) => [side(team) * 0.95, 0, 4.607333306];
export const mustikaApproach = (team) => [side(team) * 0.55, 0, -3.885589571];
export const pillar = [0, 0.9, -0.002];
export const groundPillar = [0, 0, -3.885589571];
export const spotApproach = (id, team) => {
  const [x, y, z, zone] = spots[id];
  return zone === "U"
    ? [Math.sign(x) * 0.85, y, Math.sign(z) * 0.85]
    : zone === "S"
      ? [side(team) * 0.55, y, Math.sign(z) * 2.55]
      : [side(team) * 2.15, y, Math.sign(z) * 2.55];
};
// Figure 4: blocks lie on their sides; each top view shows two colour halves.
export const skyLayout = [
  [0, 0, "x", -1],
  [0, 2, "x", -1],
  [0, 4, "x", 1],
  [1, 1, "z", -1],
  [1, 3, "z", 1],
  [2, 0, "x", 1],
  [2, 4, "x", -1],
  [3, 1, "z", 1],
  [3, 3, "z", -1],
  [4, 0, "x", -1],
  [4, 2, "x", 1],
  [4, 4, "x", 1],
].map(([row, col, axis, sign]) => ({
  p: [(col - 2) * 0.2, 0, 4.607333306 + (row - 2) * 0.2],
  axis,
  angle: (sign * Math.PI) / 2,
}));
