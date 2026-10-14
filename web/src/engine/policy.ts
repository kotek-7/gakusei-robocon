/** Editable construction plans and state-dependent decisions. */
import type { Action, Goal, State, StrategyPolicy } from "../engine/types";
import { action, duration, legal, payload, SPOTS, tower } from "./model";
import { equal } from "./util";
import { Planner } from "./planner";

export function policySeeds(): StrategyPolicy[] {
  const make = (
    id: string,
    name: string,
    targets: number[],
    extra: Partial<StrategyPolicy> = {},
  ): StrategyPolicy => ({
    id,
    name,
    targets,
    height: 3,
    mustika: false,
    opportunistic: false,
    lateFlip: false,
    skyFirst: 0,
    ...extra,
  });
  const base = [
    make("safe", "自陣L1を2本確保", [0, 1]),
    make("earth", "L2のアース2段を先行", [6, 7, 8, 9], { height: 2 }),
    make("hybrid", "自陣＋共有からムスティカ", [0, 4], { mustika: true }),
    make("upper", "L2の2本を完成", [6, 7]),
    make("mustika", "L2の2本からムスティカ", [6, 7], { mustika: true }),
    make("opportunist", "建設と相手塔の反転を併用", [0, 4], {
      mustika: true,
      opportunistic: true,
    }),
    make("thief", "相手塔を反転して取得権を狙う", [], {
      mustika: true,
      opportunistic: true,
    }),
    make("late", "自陣確保から終盤の反転", [0, 1], { lateFlip: true }),
    make("sky", "スカイ3個を先に確保して建設", [0, 4], {
      skyFirst: 3,
      mustika: true,
    }),
    make("transport", "搬送点を積み上げる", []),
  ];
  return [
    ...base,
    ...base
      .filter((p) => ["safe", "hybrid", "upper"].includes(p.id))
      .map((p) => ({
        ...p,
        id: `${p.id}-reverse`,
        name: `${p.name}（逆順）`,
        targets: [...p.targets].reverse(),
      })),
  ];
}
export const policyOpponents = () =>
  policySeeds().filter((p) =>
    ["safe", "mustika", "thief", "earth", "sky"].includes(p.id),
  );
const relativeSpot = (i: number, team: number) =>
  team ? (i < 4 ? (i + 2) % 4 : i >= 6 ? 6 + ((i - 6 + 2) % 4) : i) : i;

/** Reconsider at BR action boundaries, keeping an in-flight manipulation intact. */
export function policyGoal(
  p: Planner,
  s: State,
  team: number,
  policy: StrategyPolicy,
  previous: Goal | null,
): Goal | null {
  const br = team * 2 + 1,
    caps = p.v.teams[team].caps;
  if (s.robots[br].job && previous) return previous;
  const available = p.goals(s, team);
  const m = available.find((g) => g.kind === "mustika");
  if (policy.mustika && m) {
    const route = p.route(s.robots[br].pos, `pillar${team}`, br);
    if (
      route &&
      route[0] + duration(action("placeM"), p.c, p.v, br) <= p.c.horizon - s.t
    )
      return m;
  }
  const flips = available.filter(
    (g) => g.kind === "flip" && g.at === undefined,
  );
  if (
    !payload(s, br).length &&
    (policy.opportunistic || (policy.lateFlip && p.c.horizon - s.t <= 30))
  ) {
    const flip = flips.find(
      (g) =>
        p.route(s.robots[br].pos, `spot${g.spot}-${team}`, br)![0] +
          duration(action("flip"), p.c, p.v, br) <=
        p.c.horizon - s.t,
    );
    if (flip) return flip;
  }
  const skyDelivered = s.objects.filter(
    (o) => o.kind === "S" && o.delivered[team],
  ).length;
  if (
    caps.sky &&
    skyDelivered < policy.skyFirst &&
    s.objects.some(
      (o) =>
        o.kind === "S" &&
        (o.loc === "groundSky" || o.loc === `robot${team * 2}`),
    )
  )
    return {
      kind: "deliver",
      count: s.transfer[team] + 1,
      resource: "S",
      amount: policy.skyFirst - skyDelivered,
    };
  for (const raw of policy.targets) {
    const spot = relativeSpot(raw, team),
      ts = tower(s, spot);
    if (ts.length >= policy.height || ![-1, team].includes(SPOTS[spot][4]))
      continue;
    if (
      !caps.capacity_br ||
      !p.route(s.robots[br].pos, `spot${spot}-${team}`, br)
    )
      continue;
    const needed = {
      E: Math.max(0, Math.min(2, policy.height) - ts.length),
      S: Number(policy.height === 3 && ts.length < 3),
    };
    const usable = (kind: string) =>
      s.objects.filter(
        (o) =>
          o.kind === kind &&
          [
            `store${team}`,
            "groundSky",
            `buffer${team}`,
            `robot${team * 2}`,
            `robot${br}`,
          ].includes(o.loc),
      ).length;
    if (
      (needed.E && (!caps.earth || usable("E") < needed.E)) ||
      (needed.S && (!caps.sky || usable("S") < needed.S))
    )
      continue;
    const route = p.route(s.robots[br].pos, `spot${spot}-${team}`, br)!;
    if (route[0] + duration(action("place"), p.c, p.v, br) > p.c.horizon - s.t)
      continue;
    return { kind: "build", spot, height: policy.height };
  }
  return { kind: "deliver", count: s.transfer[team] + 1 };
}
export function policyAction(
  p: Planner,
  s: State,
  r: number,
  goal: Goal | null,
): Action {
  const opts = legal(s, r, p.c, p.v);
  if (s.robots[r].job) return action("continue");
  const a = p.command(s, r, goal, opts);
  // Emit a legal action for the current state.
  if (a.kind === "wait")
    return (
      opts.find((x) => x.kind === "delay") ||
      opts.find((x) => x.kind === "wait")!
    );
  return (
    opts.find((x) => equal(x, a)) ||
    opts.find((x) => x.kind === "delay") ||
    opts.find((x) => x.kind === "wait")!
  );
}
