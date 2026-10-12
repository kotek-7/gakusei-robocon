import fs from "node:fs/promises";
import { catalog } from "../src/catalog/plans.ts";
import { simulate } from "../src/simulation/engine.js";
const plans = catalog(),
  opponents = ["UP", "SP", "SU"].map((z) =>
    plans.find(
      (p) =>
        p.zones.join("") === z &&
        p.mission &&
        p.mode === (z === "SU" ? "flip" : "build"),
    ),
  );
const rows = [];
for (const enemy of opponents)
  for (const priority of [0, 1])
    for (const plan of plans) {
      const r = simulate(plan, enemy, { priority }, false);
      if (!r.scores.every(Number.isFinite)) throw new Error("Invalid score");
      rows.push({
        plan: plan.id,
        enemy: enemy.id,
        priority,
        scores: r.scores,
        winner: r.winner,
      });
    }
const out = new URL("../../results/web-cad/", import.meta.url);
await fs.mkdir(out, { recursive: true });
await fs.writeFile(
  new URL("catalog.json", out),
  JSON.stringify(
    {
      modelVersion: "cad-corridor-2",
      conditions: { speed: 1.1, handling: 2.2, success: 1, seed: 42 },
      count: rows.length,
      rows,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `${rows.length} matches recalculated; no claim of exhaustive strategy search.`,
);
