import type { Discovery } from "../../engine/types";
export function coverageRows(report: Discovery, filter: string, sort: string) {
  return report.runs.map((r) => ({ ...r, pending: r.candidates.reduce((sum, c) => sum + c.pending, 0), responses: r.candidates.reduce((sum, c) => sum + c.responses.length, 0) }))
    .filter((r) => filter === "all" || (filter === "empty" ? !r.candidates.length : filter === "pending" ? r.pending > 0 : !r.scopeComplete))
    .sort((a, b) => (sort === "pending" ? b.pending - a.pending : sort === "frontier" ? b.frontier - a.frontier : a.run - b.run) || a.run - b.run);
}
