import { simulate } from "../simulation/engine.js";
export function createSession(plans) {
  let selected = plans[0],
    enemy = opponent("upper"),
    cfg = { speed: 1.1, handling: 2.2, success: 1, seed: 42, priority: 0 },
    run,
    baseline = null;
  function opponent(key) {
    return plans.find(
      (p) =>
        p.zones.join("") === { upper: "UP", shared: "SP", flip: "SU" }[key] &&
        p.mode === (key === "flip" ? "flip" : "build") &&
        p.mission,
    );
  }
  function calculate() {
    run = simulate(selected, enemy, cfg);
    return run;
  }
  calculate();
  return {
    get run() {
      return run;
    },
    get baseline() {
      return baseline;
    },
    select(id) {
      const plan = plans.find((p) => p.id === id);
      if (plan) {
        selected = plan;
        calculate();
      }
    },
    changePerformance(key, value) {
      if (!["speed", "handling", "success", "seed", "priority"].includes(key))
        throw new TypeError("Unknown performance setting");
      const next = { ...cfg, [key]: value };
      const nextRun = simulate(selected, enemy, next);
      cfg = next;
      run = nextRun;
    },
    changeOpponent(key) {
      const next = opponent(key);
      const nextRun = simulate(selected, next, cfg);
      enemy = next;
      run = nextRun;
    },
    pin() {
      baseline = run;
    },
    exportResult() {
      return {
        selected,
        enemy,
        cfg: { ...cfg },
        events: run.events,
        finalScores: run.scores,
        modelVersion: run.modelVersion,
        winner: run.winner,
        ranks: run.ranks,
      };
    },
  };
}
