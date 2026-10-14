import type { Evaluation, Strategy } from "../../engine/types";
import { structuralEventName } from "../common/labels";

export type Result = Evaluation["runs"][number];
export type RunFilter = "all" | "pending" | "guaranteed" | "limited";
export type RunSort = "id" | "groups" | "guarantee";
export function selectRuns(
  runs: Result[],
  query: string,
  filter: RunFilter,
  sort: RunSort,
): Result[] {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return runs
    .filter((r) => words.every((word) => `c${r.run}`.includes(word)))
    .filter(
      (r) =>
        filter === "all" ||
        (filter === "pending"
          ? !r.statisticsComplete
          : filter === "guaranteed"
            ? !!r.guarantee
            : r.historyLimited),
    )
    .sort((a, b) => {
      if (sort === "groups") return b.groups - a.groups || a.run - b.run;
      if (sort === "guarantee") {
        if (!a.guarantee) return b.guarantee ? 1 : a.run - b.run;
        if (!b.guarantee) return -1;
        return b.guarantee.winLower - a.guarantee.winLower || a.run - b.run;
      }
      return a.run - b.run;
    });
}
export type StrategySort = "id" | "groups" | "paths" | "minimum" | "unresolved";
export function marginRange(
  distribution: [number, number][],
): [number, number] | null {
  const margins = distribution
    .filter(([, weight]) => weight > 0)
    .map(([margin]) => margin);
  return margins.length ? [Math.min(...margins), Math.max(...margins)] : null;
}
export function selectStrategies(
  strategies: Strategy[],
  query: string,
  ids: string[] | null,
  sort: StrategySort,
  unresolvedOnly = false,
): Strategy[] {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const allowed = ids && new Set(ids);
  return strategies
    .filter(
      (s) =>
        (!unresolvedOnly || s.unresolvedFraction > 0) &&
        (!allowed || allowed.has(s.id)) &&
        words.every((word) =>
          `${s.id} ${s.prefix.flat().map(structuralEventName).join(" ")}`
            .toLocaleLowerCase()
            .includes(word),
        ),
    )
    .sort((a, b) => {
      if (sort === "groups")
        return b.groups - a.groups || a.id.localeCompare(b.id);
      if (sort === "paths") {
        const delta = BigInt(b.paths) - BigInt(a.paths);
        return delta > 0n ? 1 : delta < 0n ? -1 : a.id.localeCompare(b.id);
      }
      if (sort === "unresolved")
        return (
          b.unresolvedFraction - a.unresolvedFraction ||
          a.id.localeCompare(b.id)
        );
      if (sort === "minimum") {
        const av = marginRange(a.distribution)?.[0];
        const bv = marginRange(b.distribution)?.[0];
        if (av == null) return bv == null ? a.id.localeCompare(b.id) : 1;
        if (bv == null) return -1;
        return bv - av || a.id.localeCompare(b.id);
      }
      return a.id.localeCompare(b.id);
    });
}
