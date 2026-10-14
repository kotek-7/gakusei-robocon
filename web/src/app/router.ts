/**
 * Deep links. `#/s/<search>/<workspace>?node=&path=&t=&sel=&run=`
 * Hash routing keeps static hosting and sub-directory deployment working.
 */
import { layout, useLayout } from "./layout";
import { ui, useUI } from "./store";
import type { EntityRef } from "./refs";

/** Edge lists compress well as runs: "1-10.12-45.47". */
export function encodePath(p: number[]) {
  const out: string[] = [];
  for (let i = 0; i < p.length; ) {
    let j = i;
    while (j + 1 < p.length && p[j + 1] === p[j] + 1) j++;
    out.push(j > i ? `${p[i]}-${p[j]}` : String(p[i]));
    i = j + 1;
  }
  return out.join(".");
}
export function decodePath(s: string): number[] {
  if (!s) return [];
  return s.split(/[.,]/).flatMap((part) => {
    const [a, b] = part.split("-").map(Number);
    if (!Number.isInteger(a)) return [];
    if (b === undefined) return [a];
    return Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  });
}

export function parseHash(hash: string) {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const parts = path.split("/").filter(Boolean);
  const q = new URLSearchParams(query);
  const num = (k: string) => {
    const v = q.get(k);
    return v === null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
  };
  return {
    search: parts[0] === "s" ? (parts[1] ?? null) : null,
    workspace: parts[0] === "s" ? (parts[2] ?? null) : (parts[0] ?? null),
    node: num("node"),
    run: num("run"),
    time: num("t"),
    path: q.has("path") ? decodePath(q.get("path")!) : null,
    selection: (q.get("sel") as EntityRef | null) ?? null,
  };
}

export function currentHash() {
  const { session, playback } = useUI.getState();
  const { active } = useLayout.getState();
  const q = new URLSearchParams();
  if (session.node !== null) q.set("node", String(session.node));
  else if (session.run) q.set("run", String(session.run));
  if (session.path && session.path.length <= 2000) q.set("path", encodePath(session.path));
  if (playback.time) q.set("t", playback.time.toFixed(2).replace(/\.?0+$/, ""));
  if (session.selection && session.selection !== `node:${session.node}`)
    q.set("sel", session.selection);
  const qs = q.toString();
  return session.search
    ? `#/s/${session.search}/${active}${qs ? `?${qs}` : ""}`
    : `#/${active}`;
}

export function shareURL() {
  return location.href.replace(/#.*$/, "") + currentHash();
}

let applying = false;
function apply() {
  const r = parseHash(location.hash);
  applying = true;
  try {
    if (r.workspace && useLayout.getState().workspaces.some((w) => w.id === r.workspace))
      layout.activate(r.workspace);
    if (r.search) {
      ui.openSearch(r.search);
      const s = useUI.getState().session;
      ui.patchSession({
        run: r.run ?? s.run,
        node: r.node ?? s.node,
        path: r.path ?? (r.node !== null ? null : s.path),
        selection: r.selection ?? (r.node !== null ? `node:${r.node}` : s.selection),
      });
      if (r.time !== null) ui.seek(r.time);
    }
  } finally {
    applying = false;
  }
}

export function installRouter() {
  apply();
  let timer = 0;
  let lastSearch = useUI.getState().session.search,
    lastWorkspace = useLayout.getState().active;
  const write = () => {
    if (applying) return;
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      const next = currentHash();
      if (next === location.hash) return;
      const s = useUI.getState().session.search,
        w = useLayout.getState().active;
      // A new search or workspace is a navigation step; selection changes are not.
      if (s !== lastSearch || w !== lastWorkspace) history.pushState(null, "", next);
      else history.replaceState(null, "", next);
      lastSearch = s;
      lastWorkspace = w;
    }, 150);
  };
  const u1 = useUI.subscribe((s, p) => {
    if (s.session !== p.session || s.playback.time !== p.playback.time) write();
  });
  const u2 = useLayout.subscribe((s, p) => {
    if (s.active !== p.active) write();
  });
  window.addEventListener("hashchange", apply);
  return () => {
    u1();
    u2();
    window.removeEventListener("hashchange", apply);
  };
}
