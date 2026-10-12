import { opponents, flipCondition } from "./decisions.js";
import { effort } from "./effort.js";
export const stages = [
  {
    id: "mission",
    label: "得点の狙い",
    title: "ムスティカを狙うか",
    description:
      "ブロックの建設は全作戦で行います。奉納まで狙う場合は、L2への進入と専用の回収・設置機構が必要です。",
    options: [
      ["no", "ブロックの得点に集中", "ムスティカの回収・奉納を行わない。"],
      ["yes", "ムスティカも狙う", "資格を得たら回収・奉納を優先する。"],
    ],
  },
  {
    id: "hardware",
    label: "活動範囲と登り方",
    title: "機体の対応範囲を決める",
  },
  {
    id: "flip",
    label: "塔の取り合い",
    title: "相手の塔をどう扱うか",
    description:
      "反転できる相手の塔があるとき、建設より反転を優先する条件を選びます。",
    options: [
      ["never", "反転しない", "ブロックの積み上げを続ける。"],
      ["late", "終盤に反転する", "120秒以降に反転を優先する。"],
      ["always", "常に反転を優先する", "相手の塔がなければ建設する。"],
    ],
  },
  {
    id: "reuse",
    label: "建設の進め方",
    title: "建設先の選び方",
    description:
      "どちらも空いている建設場所を使います。「場所を優先」でも、既存の土台に積む場合があります。",
    options: [
      ["no", "場所を優先", "狙うエリアと近さで建設先を選ぶ。"],
      ["yes", "既存の土台を優先", "同じ優先エリアなら、土台が多い場所を選ぶ。"],
    ],
  },
  {
    id: "zones",
    label: "建設場所の優先順",
    title: "どこから建て始めるか",
    description:
      "最初の塔を取得する前と、その後の優先エリアです。空きや資源がなければ、活動範囲内の別の場所を使います。",
  },
  {
    id: "supply",
    label: "搬送方針",
    title: "TRが何を先に運ぶか",
    description: "受け渡し場所の在庫量に応じて、運ぶブロックを選びます。",
    options: [
      [
        "balanced",
        "土台を確保して供給",
        "土台を2個確保したら、上段ブロックを運ぶ。",
      ],
      [
        "earth",
        "土台を多めに確保",
        "土台を5個確保してから、上段ブロックを優先する。",
      ],
      ["sky", "上段ブロックを先行", "上段ブロックの補充を優先する。"],
    ],
  },
];
export const initialHardware = () => ({
  level: "upper",
  BR: "stairs",
  TR: "ramp",
});
export function canonicalPlans() {
  return opponents().map((g) => ({ ...g.plan, sourceIds: g.ids }));
}
export function configure(p, h) {
  return {
    ...p,
    allowedZones: h.level === "upper" ? ["P", "S", "U"] : ["P", "S"],
    access: { BR: h.BR, TR: h.TR },
  };
}
export function candidates(plans, answers, h, estimates, budget = "") {
  return plans
    .filter(
      (p) =>
        (!answers.mission || p.mission === (answers.mission === "yes")) &&
        (h.level === "upper" || (!p.mission && !p.zones.includes("U"))) &&
        (!answers.flip || flipCondition(p) === answers.flip) &&
        (!answers.reuse ||
          (p.mode === "reuse") === (answers.reuse === "yes")) &&
        (!answers.zones || p.zones.join("") === answers.zones) &&
        (!answers.supply || p.supply === answers.supply),
    )
    .map((p) => configure(p, h))
    .filter((p) => budget === "" || effort(p, estimates) <= Number(budget));
}
export function backTo(answers, index) {
  return Object.fromEntries(
    stages
      .slice(0, index)
      .filter((s) => answers[s.id])
      .map((s) => [s.id, answers[s.id]]),
  );
}
export function scoreRange(plans, results, key = "scores") {
  const values = plans.flatMap((p) => results.get(p.id)?.[key] ?? []);
  return values.length ? [Math.min(...values), Math.max(...values)] : null;
}
