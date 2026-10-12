import type { Request, Result, Match } from "./protocol";
const postMessage = (data: Result) => self.postMessage(data);
import { simulate } from "../simulation/engine.js";
import { opponents } from "./decisions.ts";
self.onmessage = ({ data }: MessageEvent<Request>) => {
  if (data.type === "catalog") {
    for (let i = 0; i < data.plans.length; i++) {
      const plan = data.plans[i],
        runs = [0, 1].map((priority) =>
          simulate(plan, data.enemy, { ...data.cfg, priority }, false),
        );
      const values = runs.map((r) => r.scores[0]),
        margins = runs.map((r) => r.scores[0] - r.scores[1]);
      postMessage({
        type: "catalog",
        id: plan.id,
        scores: [Math.min(...values), Math.max(...values)],
        margin: [Math.min(...margins), Math.max(...margins)],
        values,
        count: i + 1,
        total: data.plans.length,
      });
    }
  } else if (data.type === "responses") {
    const enemies = opponents(),
      matches: Match[] = [];
    for (let i = 0; i < enemies.length; i++) {
      const { plan: enemy, ids } = enemies[i];
      for (const priority of [0, 1])
        matches.push({
          enemy,
          ids,
          priority,
          scores: simulate(data.plan, enemy, { ...data.cfg, priority }, false)
            .scores,
        });
      if (i % 20 === 0)
        postMessage({ type: "responses", count: i + 1, total: enemies.length });
    }
    postMessage({
      type: "responses",
      matches,
      count: enemies.length,
      total: enemies.length,
    });
  }
};
