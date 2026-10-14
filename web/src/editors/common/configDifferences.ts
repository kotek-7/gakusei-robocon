import type { Config, Model } from "../../engine/types";

export type ConfigDifference = {
  id: string;
  group: string;
  label: string;
  before: unknown;
  after: unknown;
  /** Different context prevents a specification-only comparison. */
  context: boolean;
  restore: (config: Config) => void;
};
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, stable(v)]));
  return JSON.stringify(value) ?? "undefined";
}
export function configDifferences(before: Config, after: Config, model: Model): ConfigDifference[] {
  const rows: ConfigDifference[] = [];
  function add(id: string, group: string, label: string, a: unknown, b: unknown, restore: ConfigDifference["restore"], context = false, unordered = false) {
    const normalize = (v: unknown) => unordered && Array.isArray(v) ? [...v].sort((a, b) => stable(a).localeCompare(stable(b))) : v;
    if (stable(normalize(a)) !== stable(normalize(b))) rows.push({ id, group, label, before: a, after: b, restore, context });
  }
  for (const [key, label] of [["version", "モデル版"], ["name", "探索名"], ["horizon", "終了時刻（秒）"]] as const) {
    add(key, "基本条件", label, before[key], after[key], (c) => { Object.assign(c, { [key]: before[key] }); }, key !== "name");
  }
  add("initial", "基本条件", "初期局面", { scenario: before.scenario, root: before.root }, { scenario: after.scenario, root: after.root }, (c) => { c.scenario = before.scenario; if (before.root) c.root = structuredClone(before.root); else delete c.root; }, true);
  for (const [key, label] of [["starts", "スタートゾーン"], ["layouts", "アース初期配置"]] as const) {
    add(key, "基本条件", label, before[key], after[key], (c) => Object.assign(c, { [key]: [...before[key]] }), true, true);
  }
  for (const key of new Set([...Object.keys(before.rules), ...Object.keys(after.rules)])) {
    add(`rules.${key}`, "ルール解釈", model.rules[key]?.label ?? key, before.rules[key], after.rules[key], (c) => { if (key in before.rules) c.rules[key] = before.rules[key]; else delete c.rules[key]; }, true);
  }
  for (const key of new Set([...Object.keys(before.profiles), ...Object.keys(after.profiles)])) {
    add(`profiles.${key}`, "共通の数値", model.profiles[key] ?? key, before.profiles[key], after.profiles[key], (c) => { if (before.profiles[key]) c.profiles[key] = [...before.profiles[key]]; else delete c.profiles[key]; });
  }
  for (let team = 0; team < after.teams.length; team++) {
    for (const kind of ["caps", "speeds"] as const) {
      for (const key of Object.keys(after.teams[team][kind])) {
        add(`teams.${team}.${kind}.${key}`, `${team ? "青" : "赤"}の${kind === "caps" ? "能力" : "数値候補"}`, (kind === "caps" ? model.caps : model.profiles)[key] ?? key, before.teams[team][kind][key], after.teams[team][kind][key], (c) => { Object.assign(c.teams[team][kind], { [key]: [...before.teams[team][kind][key]] }); }, false, true);
      }
    }
  }
  return rows;
}
export function differenceValue(value: unknown, id: string): string {
  if (id === "initial") {
    const initial = value as { scenario: string; root?: { t: number; robots: unknown[]; objects: unknown[] } };
    return initial.root ? `読込局面 · ${initial.root.t}秒 · 機体${initial.root.robots.length}台 · 物体${initial.root.objects.length}個` : ({ start: "試合開始", opening: "試合開始", endgame: "終盤の検証局面", custom: "読込局面" } as Record<string, string>)[initial.scenario] ?? initial.scenario;
  }
  if (Array.isArray(value)) return value.map((v) => id.includes(".speeds.") ? ["速い", "標準", "遅い"][Number(v)] ?? String(v) : differenceValue(v, id)).join(" / ");
  if (id === "layouts") return ({ stacked: "2段積み", single: "1段配置" } as Record<string, string>)[String(value)] ?? String(value);
  if (id === "starts") return ["両側 標準", "赤側 入替", "青側 入替", "両側 入替"][Number(value)] ?? String(value);
  if (id.startsWith("rules.")) return ({ true: "許可", false: "不許可", retain: "保持して再開", return: "初期位置へ戻す", branch: "両結果を分岐", red: "赤優先", blue: "青優先", simultaneous: "同時保有", historical: "保有履歴の累積" } as Record<string, string>)[String(value)] ?? String(value);
  if (typeof value === "boolean") return value ? "可能" : "不可";
  return value == null ? "未設定" : String(value);
}
