import type { Candidate, Goal } from "../../engine/types";
import data from "../../engine/model-data.json";
import { worstCommonResponse } from "./evidence";
import type { CandidateReview } from "./review";

export type CandidateCollectionRow = { run: number; common: string[]; candidate: Candidate };
export type QueryField = "id" | "plan" | "note" | "issue";
export type QueryTerm = { field: QueryField | null; text: string; exclude: boolean };
export type CandidateIndex = Record<QueryField, string>;
const normalize = (text: string) => text.normalize("NFKC").toLocaleLowerCase();
const fields: Record<string, QueryField> = { id: "id", 手順: "plan", plan: "plan", メモ: "note", note: "note", 理由: "issue", issue: "issue" };
/** Whitespace means AND. Quotes keep phrases together. Unknown prefixes remain literal. */
export function parseCandidateQuery(query: string): QueryTerm[] {
  const chunks = normalize(query).match(/(?:[^\s"]|"[^"]*"|"[^"]*$)+/g) ?? [];
  return chunks.map(chunk => {
    const exclude = chunk.startsWith("-") && chunk.length > 1;
    let text = exclude ? chunk.slice(1) : chunk;
    const separator = text.indexOf(":");
    const field = separator > 0 ? fields[text.slice(0, separator)] ?? null : null;
    if (field) text = text.slice(separator + 1);
    return { field, text: text.replaceAll('"', "").trim(), exclude };
  }).filter(term => term.text.length > 0);
}
/** Visible plan labels also form the literal phrase search surface. */
export function candidateGoalLabel(goal: Goal): string {
  if (goal.kind === "mustika") return "ムスティカ設置";
  if (goal.kind === "deliver") return "受け渡し";
  return `${goal.kind === "flip" ? "反転" : "建設"} ${goal.spot}${goal.height === 2 ? "（アース2段）" : ""}${goal.at !== undefined ? `（${goal.at}秒開始）` : ""}`;
}
export function candidatePlanLabel(plan: Goal[]): string {
  return plan.map(candidateGoalLabel).join(" → ") || "建設・反転なし";
}
function goalSearchText(goal: Goal): string {
  const action = goal.kind === "mustika" ? "ムスティカ 設置" : goal.kind === "deliver" ? "受け渡し 搬送" : goal.kind === "flip" ? "反転 スカイ 裏返し" : "建設 設置 アース";
  const spot = goal.spot === undefined ? undefined : data.spots[goal.spot];
  const location = spot ? `スポット${goal.spot} スポット ${goal.spot} L${spot[3]} ${spot[4] === -1 ? "共有 共有域 共有エリア" : spot[4] === 0 ? "赤専用 赤エリア" : "青専用 青エリア"}` : "";
  return `${action} ${goal.kind} ${location} ${goal.height === 2 ? "アース2段" : ""} ${goal.at === undefined ? "" : `${goal.at}秒開始`}`;
}
/** Plan/location words describe this candidate's plan, never an opponent's observed actions. */
export function buildCandidateIndex(row: CandidateCollectionRow, decision?: CandidateReview["decisions"][string]): CandidateIndex {
  const c = row.candidate;
  return {
    id: normalize(`C${row.run} ${c.id} ${c.baseline.strategy}`),
    plan: normalize(`${candidatePlanLabel(c.plan)} ${c.plan.map(goalSearchText).join(" ")}`),
    note: normalize(decision?.note ?? ""),
    issue: normalize([c.baseline, ...c.responses].flatMap(e => e.blocked ?? []).map(issue => issue.reason).join(" ")),
  };
}
export function matchCandidateQuery(index: CandidateIndex, terms: QueryTerm[]): { matches: boolean; fields: QueryField[] } {
  const matchedFields = new Set<QueryField>();
  const matches = terms.every(term => {
    const scope = term.field ? [term.field] : Object.keys(index) as QueryField[];
    const found = scope.filter(field => index[field].includes(term.text));
    if (!term.exclude) found.forEach(field => matchedFields.add(field));
    return term.exclude ? found.length === 0 : found.length > 0;
  });
  return { matches, fields: matches ? [...matchedFields] : [] };
}
/** Never rank different configurations against each other on score. Missing scores sort last. */
export function sortCandidateRows<T extends CandidateCollectionRow>(rows: T[], sort: string, opponent = ""): T[] {
  const margin = (e: {scores: number[]}) => e.scores[0] - e.scores[1];
  return rows.map((row, index) => ({row, index, worst: sort === "worst" ? worstCommonResponse(row.candidate, row.common, opponent) : null}))
    .sort((a,b) => {
      if (sort === "baseline" || sort === "worst") {
        const config = a.row.run - b.row.run;
        if (config) return config;
      }
      if (sort === "baseline") return margin(b.row.candidate.baseline) - margin(a.row.candidate.baseline) || a.index - b.index;
      if (sort === "pending") return b.row.candidate.pending - a.row.candidate.pending || a.index - b.index;
      if (sort === "worst") {
        if (!a.worst) return b.worst ? 1 : a.index - b.index;
        if (!b.worst) return -1;
        return margin(b.worst) - margin(a.worst) || a.index - b.index;
      }
      return a.index - b.index;
    }).map(({row}) => row);
}
/** A scope operation must not remove selections hidden by filters. */
export function mergeShortlistScope(current: string[], visibleKeys: string[], mode: "add" | "remove"): string[] {
  const scope = new Set(visibleKeys);
  return mode === "add" ? [...new Set([...current, ...visibleKeys])] : current.filter(key => !scope.has(key));
}

export type CandidateFilterView = { run: string; query: string; sort: string; status: string; opponent: string; decision: string; shortlistOnly: boolean };
export type SavedCandidateView = { id: string; name: string; filters: CandidateFilterView };
export function sameCandidateFilters(a: CandidateFilterView, b: CandidateFilterView): boolean {
  return (Object.keys(a) as (keyof CandidateFilterView)[]).every(key => a[key] === b[key]) && (Object.keys(b) as (keyof CandidateFilterView)[]).every(key => a[key] === b[key]);
}
