import type { Config, StrategyPolicy } from "../engine/types";
export type Priority = "red" | "blue";
export type RunInput = {
  config: Config;
  red: StrategyPolicy;
  blue: StrategyPolicy;
  priority: Priority;
  conditionName: string;
};
export type ResultSummary = {
  key: string;
  scores: number[];
  completedAt: string;
};
export type Job = {
  key: string;
  input: RunInput;
  status: "queued" | "running" | "completed" | "failed";
  error?: string;
};
