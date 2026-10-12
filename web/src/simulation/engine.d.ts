import type { Plan, Performance, Run } from "./types";
export function simulate(
  plan: Plan,
  enemy: Plan,
  settings?: Partial<Performance>,
  record?: boolean,
): Run;
