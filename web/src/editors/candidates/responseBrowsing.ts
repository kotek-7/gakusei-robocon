import type { Candidate, CandidateEvidence } from "../../engine/types";

export type ResponseOption = { key: string; label: string; evidence: CandidateEvidence & Partial<Pick<Candidate["responses"][number], "opponent" | "shared">> };
export type ResponseFilter = "all" | "common" | "exploratory" | "blocked" | "negative";
export type ResponseOrder = "original" | "margin" | "blocked";
export const responseMargin = (option: ResponseOption) => option.evidence.scores[0] - option.evidence.scores[1];
export const isResponse = (option: ResponseOption) => option.key !== "worst" && option.key !== "baseline";
export function isCommonResponse(option: ResponseOption, common: readonly string[]) {
  return !!option.evidence.shared && !!option.evidence.opponent && common.includes(option.evidence.opponent);
}
export function browseResponses(options: ResponseOption[], common: readonly string[], filter: ResponseFilter, opponent: string, order: ResponseOrder) {
  return options.filter(option => {
    if (opponent && option.evidence.opponent !== opponent) return false;
    if (filter === "common") return isResponse(option) && isCommonResponse(option, common);
    if (filter === "exploratory") return isResponse(option) && !isCommonResponse(option, common);
    if (filter === "blocked") return !!option.evidence.blocked?.length;
    if (filter === "negative") return responseMargin(option) < 0;
    return true;
  }).map((option,index) => ({option,index})).sort((a,b) => {
    const difference = order === "margin" ? responseMargin(a.option) - responseMargin(b.option)
      : order === "blocked" ? (b.option.evidence.blocked?.length ?? 0) - (a.option.evidence.blocked?.length ?? 0) : 0;
    return difference || a.index-b.index;
  }).map(({option}) => option);
}
/** Summary excludes baseline and the duplicate shortcut for the worst response. */
export function responseGroups(options: ResponseOption[], common: readonly string[]) {
  const groups = new Map<string, {opponent: string; count: number; commonCount: number; min: number; max: number}>();
  for (const option of options.filter(isResponse)) {
    const opponent = option.evidence.opponent;
    if (!opponent) continue;
    const margin = responseMargin(option);
    const value = groups.get(opponent) ?? {opponent, count: 0, commonCount: 0, min: margin, max: margin};
    value.count++; value.commonCount += Number(isCommonResponse(option, common)); value.min = Math.min(value.min, margin); value.max = Math.max(value.max, margin);
    groups.set(opponent,value);
  }
  return [...groups.values()];
}
