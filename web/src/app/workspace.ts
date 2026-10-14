/** Per-search annotations saved with the search: markers, bookmarks, pins, A/B paths. */
import type { Workspace } from "../engine/protocol";
import { emptyWorkspace } from "../engine/protocol";
import { call } from "./client";
import { fetchQuery, setQueryData, useQuery } from "./data";
import { useUI } from "./store";

export function useWorkspaceData(): Workspace | null {
  const search = useUI((s) => s.session.search);
  return useQuery("workspace.get", search ? { search } : null).data ?? null;
}
export async function updateWorkspace(fn: (w: Workspace) => Workspace) {
  const search = useUI.getState().session.search;
  if (!search) return;
  const current = (await fetchQuery("workspace.get", { search })) ?? emptyWorkspace(search);
  const next = fn(structuredClone(current));
  setQueryData("workspace.get", { search }, next);
  const saved = await call("workspace.put", { search, workspace: next });
  setQueryData("workspace.get", { search }, saved);
}
export const newId = () => Math.random().toString(36).slice(2, 10);
