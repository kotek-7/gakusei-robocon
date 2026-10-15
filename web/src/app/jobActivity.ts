import { create } from "zustand";
import type { JobActivity } from "../engine/types";

/** Volatile, bounded cache: activity never invalidates queries or writes workspace data. */
const useActivityState = create<{ entries: Record<string, JobActivity> }>(() => ({ entries: {} }));
export function receiveJobActivity(search: string, activity: JobActivity) {
  useActivityState.setState(state => {
    const entries = { ...state.entries };
    delete entries[search];
    entries[search] = activity;
    while (Object.keys(entries).length > 8) delete entries[Object.keys(entries)[0]];
    return { entries };
  });
}
export function removeJobActivity(search: string) {
  useActivityState.setState(state => {
    const entries = { ...state.entries };
    delete entries[search];
    return { entries };
  });
}
export function useJobActivity(search: string) {
  return useActivityState(state => state.entries[search]);
}
