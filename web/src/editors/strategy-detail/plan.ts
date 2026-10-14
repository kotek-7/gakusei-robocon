import type { Goal } from "../../engine/types";
import data from "../../engine/model-data.json";

export function planTarget(goal: Goal) {
  if (goal.kind === "mustika") return "中央柱";
  if (goal.kind === "deliver") return "受け渡しエリア";
  return goal.spot === undefined ? "場所未記録" : `スポット ${goal.spot}`;
}
export function planAction(goal: Goal) {
  return ({ build: "建設", flip: "スカイ反転", mustika: "ムスティカ設置", deliver: "受け渡し" } as Record<string, string>)[goal.kind] ?? goal.kind;
}
export function spotDescription(spot: number) {
  const p = data.spots[spot];
  return p ? `L${p[3]}・${p[4] === -1 ? "共有" : p[4] === 0 ? "赤専用" : "青専用"}` : "位置未記録";
}
/** Rows preserve source order; a row is a compressed completion, not an instruction or tower count. */
export function planRows(plan: Goal[]) {
  return plan.map((goal, index) => ({
    order: index + 1, goal, action: planAction(goal), target: planTarget(goal),
    area: goal.spot === undefined ? "" : spotDescription(goal.spot),
    recorded: [goal.height === undefined ? "" : `高さ指定 ${goal.height}段`, goal.count === undefined ? "" : `数量指定 ${goal.count}`, goal.at === undefined ? "" : `時刻指定 ${goal.at}秒`].filter(Boolean).join("・"),
  }));
}
export function planTargets(plan: Goal[]) {
  const groups = new Map<string, { key: string; target: string; spot?: number; orders: number[]; actions: string[] }>();
  for (const row of planRows(plan)) {
    const key = row.goal.spot === undefined ? `kind:${row.goal.kind}` : `spot:${row.goal.spot}`;
    const group = groups.get(key) ?? { key, target: row.target, spot: row.goal.spot, orders: [], actions: [] };
    group.orders.push(row.order);
    if (!group.actions.includes(row.action)) group.actions.push(row.action);
    groups.set(key, group);
  }
  return [...groups.values()];
}

import type { Instruction } from "../../engine/planner";
import { actionName, locationName } from "../common/labels";

function resourceLabel(value: unknown): string {
  if (!Array.isArray(value)) throw new Error("attributes");
  const [kind, owner, face, delivered] = value;
  const team = (v: unknown) => v === 0 ? "赤" : v === 1 ? "青" : "未指定";
  const label = kind === "E" ? `${team(owner)}アース` : kind === "S" ? `スカイ（${team(face)}面）` : kind === "M" ? "ムスティカ" : String(kind);
  const transfers = Array.isArray(delivered) ? delivered.flatMap((yes, i) => yes ? [i === 0 ? "赤" : "青"] : []) : [];
  return label + (transfers.length ? `［${transfers.join("・")}受渡済］` : "");
}
/** Decode the model's canonical resource match, keeping source locations and stack positions. */
export function instructionResources(demand: string): string[] {
  try {
    const [selected, stacks] = JSON.parse(demand);
    if (!Array.isArray(selected) || !Array.isArray(stacks)) throw new Error("demand");
    const labels = selected.map((raw: string) => {
      const [loc, attrs] = JSON.parse(raw);
      return `${locationName(loc)}: ${resourceLabel(attrs)}`;
    });
    for (const raw of stacks) {
      const [loc, shape, positions] = JSON.parse(raw);
      labels.push(`${locationName(loc)}: ${shape.map(resourceLabel).join(" / ")}（下から${positions.map((n: number) => n + 1).join("・")}段目を選択）`);
    }
    const counts = new Map<string, number>();
    labels.forEach(label => counts.set(label, (counts.get(label) ?? 0) + 1));
    return [...counts].map(([label, count]) => label + (count > 1 ? ` ×${count}` : ""));
  } catch { return ["物体条件を解読できません"]; }
}
export function instructionRow(instruction: Instruction, index: number) {
  if (instruction.kind === "travel") return { order: index + 1, action: "移動", location: locationName(instruction.dest), resources: [] as string[] };
  if (instruction.kind === "until") return { order: index + 1, action: `${instruction.at}秒まで待機`, location: "その場", resources: [] as string[] };
  return { order: index + 1, action: actionName(instruction.action), location: locationName(instruction.at), resources: instructionResources(instruction.demand) };
}

/** Count fixed commands, never inferred successes, quantities, or completed towers. */
export function instructionSummary(script: Instruction[]) {
  const actions = new Map<string, number>();
  const destinations = new Set<string>();
  for (const instruction of script) {
    const label = instruction.kind === "travel" ? "移動" : instruction.kind === "until" ? "時刻待機" : actionName({ kind: instruction.action.kind });
    actions.set(label, (actions.get(label) ?? 0) + 1);
    if (instruction.kind === "travel") destinations.add(locationName(instruction.dest));
    if (instruction.kind === "operation") destinations.add(locationName(instruction.at));
  }
  return { count: script.length, actions: [...actions].map(([action, count]) => ({ action, count })), destinations: [...destinations] };
}
