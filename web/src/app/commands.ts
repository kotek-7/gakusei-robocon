/**
 * Every user operation is a command. Menus, toolbars, context menus, the
 * command palette and keyboard shortcuts all resolve to the same registry, so
 * a new operation becomes reachable from each of them by registering it once.
 */
import { create } from "zustand";
import { ui, useUI } from "./store";

export type CommandContext = {
  /** Editor type under the pointer / last clicked. */
  editor: string | null;
  args?: unknown;
};
export type Command = {
  id: string;
  title: string;
  category: string;
  /** Default key chords, e.g. "Ctrl+Shift+P", "Space", "Alt+ArrowLeft". */
  keys?: string[];
  /** Keys only apply while this editor type is active. */
  scope?: string;
  /** Hidden from the palette (still runnable). */
  hidden?: boolean;
  enabled?: (ctx: CommandContext) => boolean;
  checked?: (ctx: CommandContext) => boolean;
  run: (ctx: CommandContext) => unknown;
  /** Longer explanation shown in the palette and keymap editor. */
  detail?: string;
};

const registry = new Map<string, Command>();
type Registry = { version: number; overrides: Record<string, string[]>; recent: string[]; pinned: string[] };
const KEYMAP = "robocon.keymap.v1",
  RECENT = "robocon.recent.v1",
  PINNED = "robocon.pinnedCommands.v1";
const load = <T,>(k: string, d: T): T => {
  try {
    return JSON.parse(localStorage.getItem(k) || "null") ?? d;
  } catch {
    return d;
  }
};
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // Storage disabled: settings last for this session only.
  }
};
export const useCommands = create<Registry>(() => ({
  version: 0,
  overrides: load(KEYMAP, {}),
  recent: load(RECENT, []),
  pinned: (() => { const value = load<unknown>(PINNED, []); return Array.isArray(value) ? [...new Set(value.filter((x): x is string => typeof x === "string"))] : []; })(),
}));

export function register(...commands: Command[]) {
  for (const c of commands) registry.set(c.id, c);
  useCommands.setState((s) => ({ version: s.version + 1 }));
}
export const getCommand = (id: string) => registry.get(id);
export const allCommands = () => [...registry.values()];

export function context(args?: unknown): CommandContext {
  return { editor: useUI.getState().activeEditor, args };
}
export function isEnabled(id: string, args?: unknown) {
  const c = registry.get(id);
  return !!c && (c.enabled?.(context(args)) ?? true);
}
export function isChecked(id: string, args?: unknown) {
  return registry.get(id)?.checked?.(context(args)) ?? false;
}
export function run(id: string, args?: unknown) {
  const c = registry.get(id);
  if (!c) return;
  const ctx = context(args);
  if (c.enabled && !c.enabled(ctx)) return;
  if (!c.hidden)
    useCommands.setState((s) => {
      const recent = [id, ...s.recent.filter((x) => x !== id)].slice(0, 12);
      save(RECENT, recent);
      return { recent };
    });
  try {
    const r = c.run(ctx);
    if (r instanceof Promise) r.catch(ui.error);
  } catch (e) {
    ui.error(e);
  }
}

/** Pin command identities, never arguments or stale editor selections. */
export function togglePinned(id: string) {
  if (!registry.has(id) || registry.get(id)?.hidden) return;
  useCommands.setState((s) => {
    const pinned = s.pinned.includes(id) ? s.pinned.filter((x) => x !== id) : [...s.pinned, id];
    save(PINNED, pinned);
    return { pinned };
  });
}
export function clearRecent() {
  save(RECENT, []);
  useCommands.setState({ recent: [] });
}

export function keysFor(id: string): string[] {
  return useCommands.getState().overrides[id] ?? registry.get(id)?.keys ?? [];
}
export function setKeys(id: string, keys: string[] | null) {
  useCommands.setState((s) => {
    const overrides = { ...s.overrides };
    if (keys === null) delete overrides[id];
    else overrides[id] = keys;
    save(KEYMAP, overrides);
    return { overrides };
  });
}

const MAC = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
/** Normalize a KeyboardEvent to "Ctrl+Shift+K" form. Ctrl means Cmd on macOS. */
export function chord(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (MAC ? e.metaKey : e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  let k = e.key;
  if (k === " ") k = "Space";
  else if (k.length === 1) k = k.toUpperCase();
  if (e.code.startsWith("Numpad") && /\d/.test(e.code.slice(6))) k = e.code;
  if (!["Control", "Shift", "Alt", "Meta"].includes(k)) parts.push(k);
  return parts.join("+");
}
export function formatKeys(k: string) {
  return k
    .replace("Ctrl", MAC ? "⌘" : "Ctrl")
    .replace("ArrowLeft", "←")
    .replace("ArrowRight", "→")
    .replace("ArrowUp", "↑")
    .replace("ArrowDown", "↓")
    .replace(/Numpad(\d)/, "テンキー$1");
}

/** Bindings that resolve the chord, most specific scope first. */
export function resolveChord(c: string, editor: string | null): Command | undefined {
  let global: Command | undefined;
  for (const cmd of registry.values()) {
    if (!keysFor(cmd.id).includes(c)) continue;
    if (cmd.scope) {
      if (cmd.scope === editor) return cmd;
    } else global ??= cmd;
  }
  return global;
}
export function conflicts(): Map<string, string[]> {
  const byKey = new Map<string, string[]>();
  for (const cmd of registry.values())
    for (const k of keysFor(cmd.id)) {
      const slot = `${cmd.scope ?? "*"} ${k}`;
      byKey.set(slot, [...(byKey.get(slot) ?? []), cmd.id]);
    }
  return new Map([...byKey].filter(([, ids]) => ids.length > 1));
}

const TYPING = /^(INPUT|TEXTAREA|SELECT)$/;
export function installKeyboard() {
  const handler = (e: KeyboardEvent) => {
    if (e.isComposing) return;
    const c = chord(e);
    const target = e.target as HTMLElement | null;
    const typing =
      !!target && (TYPING.test(target.tagName) || target.isContentEditable);
    const st = useUI.getState();
    if (c === "Escape") {
      if (st.menu) return ui.closeMenu();
      if (st.overlay) return; // dialogs handle their own Escape
    }
    if (st.overlay) return;
    // While typing, only chords with Ctrl/Alt or function keys reach commands.
    if (typing && !/^(Ctrl|Alt)\+|^F\d+$/.test(c)) return;
    const cmd = resolveChord(c, st.activeEditor);
    if (!cmd) return;
    if (cmd.enabled && !cmd.enabled(context())) return;
    e.preventDefault();
    run(cmd.id);
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}
