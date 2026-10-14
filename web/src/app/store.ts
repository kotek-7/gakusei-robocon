/**
 * UI state that is not saved data: what is selected, where the playhead is,
 * which overlays are open. Saved data lives in the Worker and is read through
 * `data.ts`.
 */
import { create } from "zustand";
import type { EntityRef } from "./refs";

export type Session = {
  search: string | null;
  run: number;
  /** First node index of the graph page. */
  offset: number;
  node: number | null;
  /** Edge ids from the run root to `node`. null until known. */
  path: number[] | null;
  /** The entity shown in the properties editor and highlighted everywhere. */
  selection: EntityRef | null;
  hover: EntityRef | null;
  /** Compared paths. A is usually the current path. */
  compare: { a: number[] | null; b: number[] | null; label: [string, string] };
};
export type Playback = {
  time: number;
  playing: boolean;
  /** 1 forward, -1 reverse. */
  direction: 1 | -1;
  speed: number;
  loop: boolean;
  range: [number, number] | null;
};
export type Toast = { id: number; text: string; tone: "info" | "error"; action?: { label: string; command: string; args?: unknown } };
export type Overlay =
  | { kind: "palette"; mode: "commands" | "goto" }
  | { kind: "prefs"; tab?: string }
  | { kind: "shortcuts" }
  | { kind: "about" }
  | { kind: "documentation"; topic?: string }
  | { kind: "notices" }
  | { kind: "prompt"; title: string; value: string; resolve: (v: string | null) => void }
  | { kind: "confirm"; title: string; body?: string; danger?: boolean; resolve: (v: boolean) => void };
export type MenuItem =
  | { command: string; args?: unknown; label?: string }
  | { label: string; run: () => void; disabled?: boolean; checked?: boolean; shortcut?: string }
  | { separator: true }
  | { label: string; submenu: MenuItem[] };
export type ContextMenu = { x: number; y: number; items: MenuItem[]; title?: string };

type UIState = {
  session: Session;
  playback: Playback;
  overlay: Overlay | null;
  menu: ContextMenu | null;
  toasts: Toast[];
  /** Area under the pointer or last clicked; keyboard shortcuts go there. */
  activeArea: string | null;
  activeEditor: string | null;
  /** Navigation history for back/forward (node + selection). */
  history: { node: number | null; path: number[] | null; selection: EntityRef | null; time: number }[];
  historyIndex: number;
  busy: Record<string, boolean>;
  /** Every notification of this session, newest last (the notification center). */
  notices: { id: number; text: string; tone: Toast["tone"]; at: number; read: boolean }[];
  /** Jobs started from this tab: when and with what time budget. */
  jobRun: Record<string, { kind: string; startedAt: number; seconds: number; elapsedBase: number }>;
  /** Hide the menu bar and status bar (F11). */
  zen: boolean;
};

const emptySession = (search: string | null = null): Session => ({
  search,
  run: 0,
  offset: 0,
  node: null,
  path: null,
  selection: null,
  hover: null,
  compare: { a: null, b: null, label: ["A", "B"] },
});

export const useUI = create<UIState>(() => ({
  session: emptySession(),
  playback: { time: 0, playing: false, direction: 1, speed: 1, loop: false, range: null },
  overlay: null,
  menu: null,
  toasts: [],
  activeArea: null,
  activeEditor: null,
  history: [],
  historyIndex: -1,
  busy: {},
  notices: [],
  jobRun: {},
  zen: false,
}));

const set = useUI.setState;
const get = useUI.getState;

export const ui = {
  get,
  patchSession(p: Partial<Session>) {
    set((s) => ({ session: { ...s.session, ...p } }));
  },
  patchPlayback(p: Partial<Playback>) {
    set((s) => ({ playback: { ...s.playback, ...p } }));
  },
  openSearch(id: string | null) {
    if (get().session.search === id) return;
    set({
      session: emptySession(id),
      playback: { ...get().playback, time: 0, playing: false, range: null },
      history: [],
      historyIndex: -1,
    });
  },
  /** Select a node, optionally with the exact path that reached it. */
  selectNode(node: number, path: number[] | null = null, time?: number) {
    const s = get();
    pushHistory();
    set({
      session: { ...s.session, node, path, selection: `node:${node}` },
      playback: {
        ...s.playback,
        playing: false,
        time: time ?? s.playback.time,
      },
    });
  },
  select(selection: EntityRef | null) {
    set((s) => ({ session: { ...s.session, selection } }));
  },
  hover(hover: EntityRef | null) {
    if (get().session.hover !== hover)
      set((s) => ({ session: { ...s.session, hover } }));
  },
  seek(time: number) {
    set((s) => ({ playback: { ...s.playback, time: Math.max(0, time) } }));
  },
  toast(text: string, tone: Toast["tone"] = "info", action?: Toast["action"]) {
    const id = Date.now() + Math.random();
    set((s) => ({
      toasts: [...s.toasts.slice(-3), { id, text, tone, action }],
      notices: [...s.notices, { id, text, tone, at: Date.now(), read: false }].slice(-100),
    }));
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      tone === "error" ? 9000 : 4500,
    );
  },
  dismissToast(id: number) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
  error(e: unknown) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    ui.toast(e instanceof Error ? e.message : String(e), "error");
  },
  open(overlay: Overlay | null) {
    set({ overlay });
  },
  prompt(title: string, value = ""): Promise<string | null> {
    return new Promise((resolve) => set({ overlay: { kind: "prompt", title, value, resolve } }));
  },
  confirm(title: string, body?: string, danger = false): Promise<boolean> {
    return new Promise((resolve) => set({ overlay: { kind: "confirm", title, body, danger, resolve } }));
  },
  contextMenu(e: { clientX: number; clientY: number; preventDefault(): void }, items: MenuItem[], title?: string) {
    e.preventDefault();
    set({ menu: { x: e.clientX, y: e.clientY, items, title } });
  },
  closeMenu() {
    if (get().menu) set({ menu: null });
  },
  setBusy(key: string, value: boolean) {
    set((s) => ({ busy: { ...s.busy, [key]: value } }));
  },
  back() {
    const s = get();
    if (s.historyIndex < 0) return;
    if (s.historyIndex === s.history.length - 1) pushHistory(true);
    const i = get().historyIndex - 1;
    restore(i);
  },
  forward() {
    const s = get();
    if (s.historyIndex >= s.history.length - 1) return;
    restore(s.historyIndex + 1);
  },
};

function snapshot() {
  const s = get();
  return {
    node: s.session.node,
    path: s.session.path,
    selection: s.session.selection,
    time: s.playback.time,
  };
}
function pushHistory(atEnd = false) {
  const s = get();
  const cur = snapshot();
  const last = s.history[s.historyIndex];
  if (last && last.node === cur.node && last.selection === cur.selection) return;
  const history = [...s.history.slice(0, s.historyIndex + 1), cur].slice(-100);
  set({ history, historyIndex: atEnd ? history.length - 1 : history.length - 1 });
}
function restore(i: number) {
  const s = get(),
    h = s.history[i];
  if (!h) return;
  set({
    historyIndex: i,
    session: { ...s.session, node: h.node, path: h.path, selection: h.selection },
    playback: { ...s.playback, time: h.time, playing: false },
  });
}

/** Run an async UI action with a busy flag and toast on error. */
export async function act<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
  ui.setBusy(key, true);
  try {
    return await fn();
  } catch (e) {
    ui.error(e);
    return undefined;
  } finally {
    ui.setBusy(key, false);
  }
}
