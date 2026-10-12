import type { Plan, Performance } from "../simulation/types";
export type Request =
  | { type: "catalog"; plans: Plan[]; enemy: Plan; cfg: Performance }
  | { type: "responses"; plan: Plan; cfg: Performance };
export interface CatalogResult {
  type: "catalog";
  id: number;
  scores: number[];
  margin: number[];
  values: number[];
  count: number;
  total: number;
}
export interface Match {
  enemy: Plan;
  ids: number[];
  priority: number;
  scores: number[];
}
export interface ResponsesResult {
  type: "responses";
  count: number;
  total: number;
  matches?: Match[];
}
export type Result = CatalogResult | ResponsesResult;
export interface WorkerPort {
  postMessage(request: Request): void;
  terminate(): void;
  onmessage: ((event: { data: Result }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}
