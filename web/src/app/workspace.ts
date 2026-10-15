/** Per-search annotations saved with the search: markers, bookmarks, pins, A/B paths. */
import type { Workspace } from "../engine/protocol";
import { emptyWorkspace } from "../engine/protocol";
import { call } from "./client";
import { fetchQuery, setQueryData, useQuery } from "./data";
import { ui, useUI } from "./store";

export function useWorkspaceData(): Workspace | null {
  const search = useUI((s) => s.session.search);
  return useQuery("workspace.get", search ? { search } : null).data ?? null;
}
const pending = new Map<string, Promise<unknown>>();
export async function updateWorkspace(fn: (w: Workspace) => Workspace) {
  const search = useUI.getState().session.search;
  if (!search) return;
  // Serialize read-modify-write operations so rapid A/B or marker edits do not overwrite each other.
  const task = (pending.get(search) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const current = (await fetchQuery("workspace.get", { search })) ?? emptyWorkspace(search);
    const next = fn(structuredClone(current));
    const saved = await call("workspace.put", { search, workspace: next });
    setQueryData("workspace.get", { search }, saved);
  });
  pending.set(search, task);
  try { await task; }
  finally { if (pending.get(search) === task) pending.delete(search); }
}

/** Restore per-search comparisons and persist edits from every command entrypoint. */
export function installComparisonSync() {
  let disposed = false;
  let restoring = false;
  let generation = 0;
  const restore = (search: string | null) => {
    const version = ++generation;
    if (!search) return;
    const original = useUI.getState().session.compare;
    (pending.get(search) ?? Promise.resolve()).catch(() => {}).then(() => fetchQuery("workspace.get", { search })).then((w) => {
      if (disposed || version !== generation || useUI.getState().session.search !== search) return;
      const current = useUI.getState().session.compare;
      restoring = true;
      try {
        ui.patchSession({ compare: {
          a: current.a !== original.a ? current.a : w.ab.a,
          b: current.b !== original.b ? current.b : w.ab.b,
          ...(current.a !== original.a ? (current.sourceA !== undefined ? { sourceA: current.sourceA } : {}) : (w.ab.sourceA !== undefined ? { sourceA: w.ab.sourceA } : {})),
          ...(current.b !== original.b ? (current.sourceB !== undefined ? { sourceB: current.sourceB } : {}) : (w.ab.sourceB !== undefined ? { sourceB: w.ab.sourceB } : {})),
          label: [
            current.label[0] !== original.label[0] ? current.label[0] : w.ab.label?.[0] ?? "A",
            current.label[1] !== original.label[1] ? current.label[1] : w.ab.label?.[1] ?? "B",
          ],
        } });
      } finally { restoring = false; }
    }).catch(ui.error);
  };
  restore(useUI.getState().session.search);
  const unsubscribe = useUI.subscribe((s, previous) => {
    if (s.session.search !== previous.session.search) {
      restore(s.session.search);
    } else if (!restoring && s.session.compare !== previous.session.compare && s.session.search) {
      const ab = structuredClone(s.session.compare);
      const changedA = s.session.compare.a !== previous.session.compare.a || s.session.compare.sourceA !== previous.session.compare.sourceA;
      const changedB = s.session.compare.b !== previous.session.compare.b || s.session.compare.sourceB !== previous.session.compare.sourceB;
      const changedLabelA = ab.label[0] !== previous.session.compare.label[0];
      const changedLabelB = ab.label[1] !== previous.session.compare.label[1];
      updateWorkspace((w) => ({ ...w, ab: {
        a: changedA ? ab.a : w.ab.a,
        b: changedB ? ab.b : w.ab.b,
        ...(changedA ? { sourceA: ab.sourceA ?? null } : (w.ab.sourceA !== undefined ? { sourceA: w.ab.sourceA } : {})),
        ...(changedB ? { sourceB: ab.sourceB ?? null } : (w.ab.sourceB !== undefined ? { sourceB: w.ab.sourceB } : {})),
        label: [
          changedLabelA ? ab.label[0] : w.ab.label?.[0] ?? "A",
          changedLabelB ? ab.label[1] : w.ab.label?.[1] ?? "B",
        ],
      } })).catch(ui.error);
    }
  });
  return () => { disposed = true; unsubscribe(); };
}
export const newId = () => Math.random().toString(36).slice(2, 10);
