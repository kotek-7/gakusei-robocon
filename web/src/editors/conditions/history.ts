import type { Config } from "../../engine/types";

export type ConditionHistory = {
  past: Config[];
  present: Config;
  future: Config[];
};
export type ConditionAction =
  | { type: "change"; edit: (config: Config) => void }
  | { type: "replace"; config: Config }
  | { type: "undo" | "redo" };

export function conditionHistory(
  state: ConditionHistory,
  action: ConditionAction,
): ConditionHistory {
  if (action.type === "undo") {
    if (!state.past.length) return state;
    return {
      past: state.past.slice(0, -1),
      present: state.past.at(-1)!,
      future: [state.present, ...state.future],
    };
  }
  if (action.type === "redo") {
    if (!state.future.length) return state;
    return {
      past: [...state.past, state.present],
      present: state.future[0],
      future: state.future.slice(1),
    };
  }
  const next = structuredClone(
    action.type === "replace" ? action.config : state.present,
  );
  if (action.type === "change") action.edit(next);
  if (JSON.stringify(next) === JSON.stringify(state.present)) return state;
  return {
    past: [...state.past.slice(-49), state.present],
    present: next,
    future: [],
  };
}

export function selectProfile(
  config: Config,
  team: number,
  profile: number | "all",
) {
  for (const key of Object.keys(config.teams[team].speeds)) {
    config.teams[team].speeds[key] = profile === "all" ? [0, 1, 2] : [profile];
  }
}
