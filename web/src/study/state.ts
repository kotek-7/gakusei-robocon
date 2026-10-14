import { defaults, validateConfig } from "../engine/model";
import { policySeeds, policyOpponents } from "../engine/policy";
import type { Config, StrategyPolicy } from "../engine/types";
export type Condition = {
  id: string;
  name: string;
  config: Config;
  notes: string;
};
export type RunNote = {
  id: string;
  runKey: string;
  t: number;
  text: string;
  label: string;
};
export type Study = {
  version: 2;
  conditions: Condition[];
  activeConditionId: string;
  baselineConditionId: string;
  baselineConfig: Config;
  policies: StrategyPolicy[];
  opponents: StrategyPolicy[];
  notes: RunNote[];
};
export const activeCondition = (s: Study) =>
  s.conditions.find((c) => c.id === s.activeConditionId) || s.conditions[0];
export const activeConfig = (s: Study) => activeCondition(s).config;
export const createStudy = (): Study => ({
  version: 2,
  conditions: [
    { id: "default", name: "標準条件", config: defaults(), notes: "" },
  ],
  activeConditionId: "default",
  baselineConditionId: "default",
  baselineConfig: defaults(),
  policies: policySeeds(),
  opponents: policyOpponents(),
  notes: [],
});
export const spotNames: Record<number, string> = {
  0: "自陣 L1・アース側",
  1: "自陣 L1・スカイ側",
  4: "共有 L1・アース側",
  5: "共有 L1・スカイ側",
  6: "L2・手前左",
  7: "L2・手前右",
  8: "L2・奥左",
  9: "L2・奥右",
};
export function readStudy(raw: unknown): Study {
  const input = raw as Study & { config?: Config };
  if (
    !input ||
    ![1, 2].includes(input.version) ||
    !Array.isArray(input.policies) ||
    !Array.isArray(input.opponents)
  )
    throw Error("作戦ノートの形式を確認してください。");
  const s: Study =
    input.version === 2
      ? input
      : {
          version: 2,
          conditions: [
            {
              id: "default",
              name: "標準条件",
              config: input.config!,
              notes: "",
            },
          ],
          activeConditionId: "default",
          baselineConditionId: "default",
          baselineConfig: input.config!,
          policies: input.policies,
          opponents: input.opponents,
          notes: [],
        };
  if (
    !Array.isArray(s.conditions) ||
    !s.conditions.length ||
    new Set(s.conditions.map((c) => c?.id)).size !== s.conditions.length
  )
    throw Error("機体条件を1件以上、重複しないIDで指定してください。");
  const conditions = s.conditions.map((c) => {
    if (
      !c ||
      typeof c.id !== "string" ||
      !c.id ||
      typeof c.name !== "string" ||
      typeof c.notes !== "string"
    )
      throw Error("機体条件の名前・メモを確認してください。");
    return {
      ...c,
      name: c.name.trim() || "名前のない条件",
      config: validateStudyConfig(c.config),
    };
  });
  if (
    ![s.activeConditionId, s.baselineConditionId].every((id) =>
      conditions.some((c) => c.id === id),
    )
  )
    throw Error("選択中の機体条件を確認してください。");
  if (
    !Array.isArray(s.notes) ||
    s.notes.some(
      (n) =>
        !n ||
        typeof n.id !== "string" ||
        typeof n.runKey !== "string" ||
        typeof n.text !== "string" ||
        typeof n.label !== "string" ||
        !Number.isInteger(n.t) ||
        n.t < 0 ||
        n.t > 180,
    )
  )
    throw Error("場面メモの形式を確認してください。");
  for (const list of [s.policies, s.opponents]) {
    if (
      !list.length ||
      list.length > 100 ||
      new Set(list.map((p) => p?.id)).size !== list.length
    )
      throw Error("作戦は1〜100件、IDは重複せず指定してください。");
    for (const p of list) {
      if (
        !p ||
        typeof p.id !== "string" ||
        !p.id ||
        p.id.length > 200 ||
        typeof p.name !== "string" ||
        !Array.isArray(p.targets) ||
        p.targets.length > 8 ||
        new Set(p.targets).size !== p.targets.length ||
        p.targets.some(
          (t) => !Number.isInteger(t) || !Object.hasOwn(spotNames, t),
        ) ||
        ![1, 2, 3].includes(p.height) ||
        !Number.isInteger(p.skyFirst) ||
        p.skyFirst < 0 ||
        p.skyFirst > 12 ||
        ["mustika", "opportunistic", "lateFlip"].some(
          (k) => typeof p[k as keyof StrategyPolicy] !== "boolean",
        )
      )
        throw Error("作戦の目標・切替条件が不正です。");
    }
  }
  return structuredClone({
    version: 2,
    conditions,
    activeConditionId: s.activeConditionId,
    baselineConditionId: s.baselineConditionId,
    baselineConfig: validateStudyConfig(
      s.baselineConfig ||
        conditions.find((c) => c.id === s.baselineConditionId)!.config,
    ),
    notes: s.notes,
    policies: s.policies.map((p) => ({
      ...p,
      name: p.name.trim() || "名前のない作戦",
    })),
    opponents: s.opponents.map((p) => ({
      ...p,
      name: p.name.trim() || "名前のない作戦",
    })),
  });
}

/** Explore independent decisions while retaining the user's construction objective. */
export function alternatives(
  base: StrategyPolicy,
  existing: StrategyPolicy[],
): StrategyPolicy[] {
  const signature = (p: StrategyPolicy) =>
    JSON.stringify([
      p.targets,
      p.height,
      p.mustika,
      p.opportunistic,
      p.lateFlip,
      p.skyFirst,
    ]);
  const seen = new Set(existing.map(signature));
  const variants: [string, Partial<StrategyPolicy>][] = [
    ["逆順", { targets: [...base.targets].reverse() }],
    ["アース2段", { height: 2 }],
    ["完成塔", { height: 3 }],
    ["ムスティカ切替", { mustika: !base.mustika }],
    ["反転切替", { opportunistic: !base.opportunistic }],
    ["終盤反転", { lateFlip: !base.lateFlip }],
    ["スカイ先行", { skyFirst: base.skyFirst ? 0 : 3 }],
  ];
  return variants.flatMap(([name, patch]) => {
    const p = {
      ...structuredClone(base),
      ...patch,
      id: crypto.randomUUID(),
      name: `${base.name} / ${name}`,
    };
    const key = signature(p);
    if (seen.has(key)) return [];
    seen.add(key);
    return [p];
  });
}

export function requirements(policy: StrategyPolicy): string[] {
  return [
    ...new Set([
      ...(policy.targets.length
        ? ["earth", "capacity_tr", "capacity_br"]
        : ["capacity_tr"]),
      ...((policy.height === 3 && policy.targets.length) || policy.skyFirst
        ? ["sky"]
        : []),
      ...(policy.mustika ? ["mustika", "stairs2", "capacity_br"] : []),
      ...(policy.targets.some((t) => t >= 6) ? ["stairs2"] : []),
      ...(policy.opportunistic || policy.lateFlip
        ? ["flip", "capacity_br"]
        : []),
    ]),
  ];
}

export function validateStudyConfig(raw: unknown): Config {
  const config = validateConfig(raw);
  if (
    config.teams.some(
      (t) =>
        Object.values(t.caps).some((v) => v.length !== 1) ||
        Object.values(t.speeds).some((v) => v.length !== 1),
    ) ||
    config.starts.length !== 1 ||
    config.layouts.length !== 1 ||
    config.root ||
    config.scenario !== "start" ||
    config.horizon !== 180
  )
    throw Error(
      "機体と初期配置はそれぞれ1条件、試合時間は180秒を指定してください。",
    );
  return config;
}
