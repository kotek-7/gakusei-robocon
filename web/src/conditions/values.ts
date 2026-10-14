import type { Config } from "../engine/types";
import { validateStudyConfig } from "../study/state";
export type Parameter = {
  kind: "caps" | "profiles";
  key: string;
  label: string;
  unit: string;
};
export function valueAt(
  config: Config,
  parameter: Parameter,
  side: number,
): number | boolean {
  return parameter.kind === "caps"
    ? config.teams[side].caps[parameter.key][0]
    : config.profiles[parameter.key][
        config.teams[side].speeds[parameter.key][0]
      ];
}
export function withValue(
  config: Config,
  parameter: Parameter,
  side: number,
  value: number | boolean,
): Config {
  const next = structuredClone(config);
  if (parameter.kind === "caps") next.teams[side].caps[parameter.key] = [value];
  else {
    const values = [
      Number(valueAt(config, parameter, 0)),
      Number(valueAt(config, parameter, 1)),
    ];
    values[side] = Number(value);
    next.profiles[parameter.key] = [values[0], values[1], values[1]];
    next.teams[0].speeds[parameter.key] = [0];
    next.teams[1].speeds[parameter.key] = [1];
  }
  return validateStudyConfig(next);
}
export function sweepCases(
  config: Config,
  parameter: Parameter,
  side: number,
  text: string,
) {
  const tokens = text
    .trim()
    .split(/[\s,、]+/)
    .filter(Boolean);
  if (!tokens.length) throw Error("比較する値を入力してください。");
  const boolean = typeof valueAt(config, parameter, side) === "boolean";
  const values = tokens.map((token) => {
    if (boolean) {
      if (["あり", "true", "1"].includes(token)) return true;
      if (["なし", "false", "0"].includes(token)) return false;
      throw Error("能力は「あり、なし」で指定してください。");
    }
    if (!Number.isFinite(Number(token)))
      throw Error("数値を読点か空白で区切ってください。");
    return Number(token);
  });
  return [...new Set(values)].map((value) => ({
    name: `${side ? "相手" : "自分"} ${parameter.label} ${typeof value === "boolean" ? (value ? "あり" : "なし") : `${value}${parameter.unit}`}`,
    config: withValue(config, parameter, side, value),
  }));
}
