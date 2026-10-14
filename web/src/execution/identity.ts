import { configAt } from "../engine/model";
import type { StrategyPolicy } from "../engine/types";
import type { RunInput } from "./types";
const sort = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(sort)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.entries(v)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, sort(v)]),
        )
      : v;
const policy = (p: StrategyPolicy) => ({
  targets: p.targets,
  height: p.height,
  mustika: p.mustika,
  opportunistic: p.opportunistic,
  lateFlip: p.lateFlip,
  skyFirst: p.skyFirst,
});
/** Only effective simulator inputs participate; display names and unused profile slots do not. */
export function runKey(input: RunInput): string {
  const c = input.config,
    v = configAt(c, 0);
  const teams = v.teams.map((t) => ({
    caps: t.caps,
    times: Object.fromEntries(
      Object.entries(t.speeds).map(([k, i]) => [k, c.profiles[k][i]]),
    ),
  }));
  return JSON.stringify(
    sort({
      engine: 1,
      version: c.version,
      scenario: c.scenario,
      horizon: c.horizon,
      root: c.root,
      rules: { ...c.rules, conflict: input.priority },
      start: v.start,
      layout: v.layout,
      teams,
      red: policy(input.red),
      blue: policy(input.blue),
    }),
  );
}
