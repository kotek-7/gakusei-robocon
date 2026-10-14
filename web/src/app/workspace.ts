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
      if (disposed || version !== generation || useUI.getState().session.search !== search ||
          useUI.getState().session.compare !== original) return;
      restoring = true;
      try {
        ui.patchSession({ compare: { a: w.ab.a, b: w.ab.b, label: w.ab.label ?? ["A", "B"] } });
      } finally { restoring = false; }
    }).catch(ui.error);
  };
  restore(useUI.getState().session.search);
  const unsubscribe = useUI.subscribe((s, previous) => {
    if (s.session.search !== previous.session.search) {
      restore(s.session.search);
    } else if (!restoring && s.session.compare !== previous.session.compare && s.session.search) {
      const ab = structuredClone(s.session.compare);
      updateWorkspace((w) => ({ ...w, ab })).catch(ui.error);
    }
  });
  return () => { disposed = true; unsubscribe(); };
}
export const newId = () => Math.random().toString(36).slice(2, 10);
