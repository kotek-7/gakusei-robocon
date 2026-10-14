/** Strategic hypotheses. The action search remains free to challenge these seeds. */
import type { Action, Goal, State, StrategyPolicy } from "../explorer/types";
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
    family: id,
    targets,
    height: 3,
    mustika: false,
    opportunistic: false,
    lateFlip: false,
    skyFirst: 0,
    requirements: ["アース搬送・設置", "スカイ搬送・設置"],
    conditions: ["目標の完成・資材不足で次の目標へ", "建設終了後は搬送で加点"],
    ...extra,
  });
  const base = [
    make("safe", "自陣L1を2本確保", [0, 1]),
    make("earth", "L2のアース2段を先行", [6, 7, 8, 9], {
      height: 2,
      requirements: ["アース搬送・設置", "L2への昇降"],
    }),
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
      requirements: ["反転", "ムスティカ搬送・設置"],
      conditions: ["相手の完成塔が現れたら反転", "相手塔がなければ搬送で加点"],
    }),
    make("late", "自陣確保から終盤の反転", [0, 1], { lateFlip: true }),
    make("sky", "スカイ3個を先に確保して建設", [0, 4], {
      skyFirst: 3,
      mustika: true,
    }),
    make("transport", "搬送点を積み上げる", [], {
      requirements: ["TRの取得・床置き"],
      conditions: ["未搬送資材を優先", "アースがなくなったらスカイへ"],
    }),
  ];
  for (const p of base) {
    if (p.mustika) {
      p.conditions.push("取得権が成立し、到達時間が残るとムスティカへ");
      p.requirements.push("ムスティカ搬送・設置", "L2への昇降");
    }
    if (p.opportunistic) {
      p.conditions.push("空荷のBRで相手の完成塔を利用");
      p.requirements.push("反転");
    }
    if (p.lateFlip) {
      p.conditions.push("残り30秒では到達可能な相手塔の反転を優先");
      p.requirements.push("反転");
    }
    if (p.targets.some((i) => i >= 6)) p.requirements.push("L2への昇降");
    p.requirements = [...new Set(p.requirements)];
  }
  // Parameter variations retain the family, rather than inflating family counts.
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
  // Commands are hints in the primitive search, but policies must emit legal actions.
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

/** Lift a discovered trajectory into a reusable hypothesis, not a frozen replay. */
export function policyFromPlan(
  plan: Goal[],
  source: string,
  team = 0,
): StrategyPolicy | null {
  const targets = [
    ...new Set(
      plan
        .filter((g) => g.kind === "build")
        .map((g) => relativeSpot(g.spot!, team)),
    ),
  ];
  const flip = plan.some((g) => g.kind === "flip"),
    mustika = plan.some((g) => g.kind === "mustika");
  if (!targets.length && !flip) return null;
  const signature = `${targets.join("-")}-${Number(flip)}-${Number(mustika)}`;
  return {
    height: 3,
    lateFlip: false,
    skyFirst: 0,
    id: `learned-${signature}`,
    family: "learned",
    name: `探索から得た目標順 ${targets.join("→") || "反転主体"}`,
    targets,
    opportunistic: flip,
    mustika,
    derivedFrom: source,
    requirements: [
      ...(targets.length
        ? ["アース搬送・設置", "スカイ搬送・設置"]
        : ["TRの取得・床置き"]),
      ...(flip ? ["反転"] : []),
      ...(mustika ? ["ムスティカ搬送・設置"] : []),
      ...(mustika || targets.some((i) => i >= 6) ? ["L2への昇降"] : []),
    ],
    conditions: [
      "探索で得た目標順を現在の盤面で再判断",
      "目標の完成・資材不足で次の目標へ",
      ...(flip ? ["空荷のBRで相手の完成塔を利用"] : []),
      ...(mustika ? ["取得権が成立し、到達時間が残るとムスティカへ"] : []),
      "建設終了後は搬送で加点",
    ],
  };
}
