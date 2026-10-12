// Planning assumptions, not measured build time. All values are editable person-days.
export const capabilities = [
  ...[
    ["br_stairs", "BRのL1階段対応", 8],
    ["br_ramp", "BRのL1スロープ対応", 3],
    ["tr_stairs", "TRのL1階段対応", 10],
    ["tr_ramp", "TRのL1スロープ対応", 3],
  ].map(([id, name, days]) => ({
    id,
    name,
    days,
    reason: "設計・製作・走破試験の仮見積もり。",
  })),
  {
    id: "base",
    name: "2台の走行・搬送・ブロックの積み上げ",
    days: 30,
    reason:
      "TR/BRの基本走行、受け渡し、土台と上段ブロックの積み上げ。昇段機構は別に見積もります。",
  },
  {
    id: "shared",
    name: "L1共有エリアでの位置決め",
    days: 6,
    reason: "L1共有エリアを狙う経路と配置の調整。",
  },
  {
    id: "upper",
    name: "L2への昇降・ブロック設置",
    days: 10,
    reason: "L2への移動とブロック設置精度の検証。",
  },
  {
    id: "reuse",
    name: "既存土台の認識・利用",
    days: 5,
    reason: "土台の状態判定と積み上げ場所の選び直し。",
  },
  {
    id: "flip",
    name: "上段ブロックを裏返す機構・制御",
    days: 12,
    reason: "相手の上段ブロックに対する操作、位置合わせ、裏返し後の確認。",
  },
  {
    id: "mission",
    name: "ムスティカの回収・設置",
    days: 10,
    reason: "ムスティカの設置条件の判定、回収・受け渡し・中央柱への配置。",
  },
  {
    id: "late",
    name: "終盤の方針切り替え",
    days: 3,
    reason: "残り時間に応じた裏返しへの切り替えと検証。",
  },
];
export const defaultEstimates = () =>
  Object.fromEntries(capabilities.map((c) => [c.id, c.days]));
export function requirements(plan) {
  const flip = plan.mode === "flip" || plan.end !== "expand";
  // The simulator can choose fallback sites; reflections prioritize upper sites.
  return capabilities.filter(
    (c) =>
      (plan.access &&
        [`br_${plan.access.BR}`, `tr_${plan.access.TR}`].includes(c.id)) ||
      c.id === "base" ||
      (c.id === "shared" &&
        (plan.allowedZones
          ? plan.allowedZones.includes("S")
          : plan.zones.includes("S") || flip)) ||
      (c.id === "upper" &&
        (plan.allowedZones
          ? plan.allowedZones.includes("U")
          : plan.zones.includes("U") || flip)) ||
      (c.id === "reuse" && plan.mode === "reuse") ||
      (c.id === "flip" && flip) ||
      (c.id === "mission" && plan.mission) ||
      (c.id === "late" && plan.end === "late" && plan.mode !== "flip"),
  );
}
export function effort(plan, estimates) {
  return (
    Math.round(
      requirements(plan).reduce((sum, c) => sum + estimates[c.id], 0) * 10,
    ) / 10
  );
}
export function rankedPlans(plans, results, estimates) {
  const rows = plans.map((plan) => ({
    plan,
    days: effort(plan, estimates),
    scores: results.get(plan.id),
  }));
  return rows.map((row) => ({
    ...row,
    frontier:
      !!row.scores &&
      !rows.some(
        (other) =>
          other.scores &&
          other.days <= row.days &&
          other.scores[0] >= row.scores[0] &&
          (other.days < row.days || other.scores[0] > row.scores[0]),
      ),
  }));
}
export function filterRows(
  rows,
  {
    query = "",
    mode = "",
    mission = "",
    budget = "",
    frontier = false,
    sort = "effort",
  },
  describe,
) {
  return rows
    .filter(
      ({ plan, days, frontier: efficient }) =>
        (!mode || plan.mode === mode) &&
        (!mission || plan.mission === (mission === "yes")) &&
        (budget === "" || days <= Number(budget)) &&
        (!frontier || efficient) &&
        describe(plan).toLowerCase().includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === "score" || sort === "margin") {
        if (!!a.scores !== !!b.scores) return a.scores ? -1 : 1;
        if (a.scores) {
          const metric = (r) =>
            sort === "score" ? r.scores[0] : r.scores[0] - r.scores[1];
          const delta = metric(b) - metric(a);
          if (delta) return delta;
        }
      }
      return (sort === "id" ? 0 : a.days - b.days) || a.plan.id - b.plan.id;
    });
}
