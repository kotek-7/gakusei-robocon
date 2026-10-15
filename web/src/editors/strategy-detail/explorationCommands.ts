import { register } from "../../app/commands";
import { call } from "../../app/client";
import { invalidate, upsertSearch, useSearches } from "../../app/data";
import { leaves, useLayout } from "../../app/layout";
import { act, useUI } from "../../app/store";
import { matchesExplorationSelection } from "./explorationIdentity";
import type { CandidateAnalysisTarget } from "../../engine/types";

export type ExplorationArgs = {search: string; target: CandidateAnalysisTarget; seconds: number};
function valid(value: unknown): value is ExplorationArgs {
  if (!value || typeof value !== "object") return false;
  const a = value as ExplorationArgs;
  return typeof a.search === "string" && !!a.target && Number.isInteger(a.target.run) && typeof a.target.candidate === "string" && ["counter", "compare"].includes(a.target.mode) && Number.isInteger(a.seconds) && a.seconds > 0 && a.seconds <= 86400;
}
function selected(a: ExplorationArgs) {
  const s = useSearches.getState().list.find(s => s.id === a.search);
  const layout = useLayout.getState();
  const workspace = layout.workspaces.find(w => w.id === layout.active);
  // Buttons have an explicit candidate; focusing the adjacent 3D must not disable them.
  const matches = workspace && leaves(workspace.root).some(area =>
    (!layout.maximized || area.id === layout.maximized) && area.editor === "strategy-detail" &&
    matchesExplorationSelection(area.state?.strategySelection, a.search, a.target));
  return matches && useUI.getState().session.search === a.search && s?.discovery?.runs.some(r => r.run === a.target.run && r.candidates.some(c => c.id === a.target.candidate)) ? s : undefined;
}
register({
  id: "strategy.explore.start", title: "この候補を追加探索", category: "候補", hidden: true,
  enabled: ({args}) => { if (!valid(args)) return false; const s = selected(args); return !!s && !["running", "evaluating"].includes(s.status) && !useUI.getState().busy[`strategy.explore.${args.search}`]; },
  run: ({args}) => { if (!valid(args)) return; return act(`strategy.explore.${args.search}`, async () => {
    if (!selected(args)) return;
    const s = await call("job.start", {search:args.search, kind:"discovery", seconds:args.seconds, target:args.target});
    upsertSearch(s); invalidate(args.search);
    useUI.setState(st => ({jobRun: {...st.jobRun, [args.search]: {kind:"discovery", startedAt:Date.now(), seconds:args.seconds, elapsedBase:s.discovery?.elapsed ?? 0}}}));
  }); },
}, {
  id: "strategy.explore.pause", title: "候補の追加探索を停止", category: "候補", hidden: true,
  enabled: ({args}) => { if (!valid(args)) return false; const s = selected(args), t = s?.discovery?.activeTarget; return s?.status === "running" && !!t && t.run === args.target.run && t.candidate === args.target.candidate && t.mode === args.target.mode && !useUI.getState().busy[`strategy.explore.${args.search}`]; },
  run: ({args}) => { if (!valid(args)) return; return act(`strategy.explore.${args.search}`, async () => { upsertSearch(await call("job.pause", {search:args.search, target:args.target})); invalidate(args.search); }); },
});
