/**
 * Workspaces are named area layouts (Blender-style). Each area shows one
 * editor type and can be split, resized, swapped to another editor or
 * maximized. Layouts persist per browser.
 */
import { create } from "zustand";
import { useUI } from "./store";

export type AreaLeaf = {
  kind: "area";
  id: string;
  editor: string;
  /** Editor-specific view state (zoom, filters...). */
  state?: Record<string, unknown>;
};
export type AreaSplit = {
  kind: "split";
  id: string;
  /** row: children side by side; col: stacked. */
  dir: "row" | "col";
  sizes: number[];
  children: AreaNode[];
};
export type AreaNode = AreaLeaf | AreaSplit;
export type Workspace = { id: string; name: string; root: AreaNode };

let uid = 0;
const nid = (p: string) => `${p}${Date.now().toString(36)}${(uid++).toString(36)}`;
const A = (editor: string, state?: Record<string, unknown>): AreaLeaf => ({
  kind: "area",
  id: nid("a"),
  editor,
  state,
});
const S = (dir: "row" | "col", sizes: number[], children: AreaNode[]): AreaSplit => ({
  kind: "split",
  id: nid("s"),
  dir,
  sizes,
  children,
});

export function defaultWorkspaces(): Workspace[] {
  return [
    {
      id: "analysis",
      name: "試合解析",
      root: S("row", [18, 60, 22], [
        S("col", [55, 45], [A("outliner"), A("events")]),
        S("col", [66, 34], [A("viewport"), A("timeline")]),
        S("col", [58, 42], [A("properties"), A("score")]),
      ]),
    },
    {
      id: "discover",
      name: "探索",
      root: S("row", [70, 30], [
        S("col", [62, 38], [A("candidates"), A("jobs")]),
        S("col", [55, 45], [A("viewport"), A("score")]),
      ]),
    },
    {
      id: "graph",
      name: "状態グラフ",
      root: S("row", [64, 36], [
        S("col", [72, 28], [A("graph"), A("timeline")]),
        S("col", [45, 55], [A("viewport"), A("properties")]),
      ]),
    },
    {
      id: "compare",
      name: "比較",
      root: S("col", [62, 38], [
        S("row", [50, 50], [A("viewport", { side: "a" }), A("viewport", { side: "b" })]),
        S("row", [55, 45], [A("timeline"), A("compare")]),
      ]),
    },
    {
      id: "evaluate",
      name: "評価",
      root: S("row", [68, 32], [A("evaluation"), S("col", [50, 50], [A("viewport"), A("jobs")])]),
    },
    {
      id: "conditions",
      name: "条件",
      root: A("conditions"),
    },
    { id: "documentation", name: "ドキュメント", root: A("model") },
    {
      id: "review",
      name: "検討記録",
      root: S("row", [38, 62], [A("review"), S("col", [70, 30], [A("viewport"), A("timeline")])]),
    },
    {
      id: "interval",
      name: "区間解析",
      root: S("row", [42, 58], [S("col", [55, 45], [A("interval-analysis"), A("score")]), S("col", [60, 40], [A("viewport"), A("timeline")])]),
    },
  ];
}

/** Move reference prose out of saved condition layouts, retaining editor state. */
export function separateDocumentation(workspaces: Workspace[]): Workspace[] {
  const prune = (node: AreaNode): AreaNode | null => {
    if (node.kind === "area") return node.editor === "model" ? null : node;
    const kept = node.children.map((child, i) => ({ child: prune(child), size: node.sizes[i] })).filter(x => x.child);
    if (!kept.length) return null;
    if (kept.length === 1) return kept[0].child!;
    const total = kept.reduce((sum, x) => sum + x.size, 0);
    return { ...node, children: kept.map(x => x.child!), sizes: kept.map(x => x.size * 100 / total) };
  };
  const result = workspaces.map(w => w.id === "conditions" ? { ...w, root: prune(w.root) ?? A("conditions") } : w);
  if (!result.some(w => w.id === "documentation")) result.push({ id: "documentation", name: "ドキュメント", root: A("model") });
  return result;
}

type LayoutState = {
  workspaces: Workspace[];
  active: string;
  maximized: string | null;
  /** Workspaces mounted at least once; kept alive so 3D scenes are not rebuilt. */
  mounted: string[];
};
const STORAGE = "robocon.layout.v2";
const initial = (): LayoutState => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
    if (saved?.workspaces?.length)
      return { ...saved, workspaces: separateDocumentation(saved.workspaces), maximized: null, mounted: [saved.active] };
  } catch {
    // fall through to defaults
  }
  return { workspaces: defaultWorkspaces(), active: "analysis", maximized: null, mounted: ["analysis"] };
};
export const useLayout = create<LayoutState>(initial);
useLayout.subscribe((s) => {
  try {
    localStorage.setItem(
      STORAGE,
      JSON.stringify({ workspaces: s.workspaces, active: s.active }),
    );
  } catch {
    // ignore
  }
});

const mapNode = (n: AreaNode, id: string, f: (n: AreaNode) => AreaNode | null): AreaNode | null => {
  if (n.id === id) return f(n);
  if (n.kind === "area") return n;
  const children: AreaNode[] = [],
    sizes: number[] = [];
  n.children.forEach((c, i) => {
    const m = mapNode(c, id, f);
    if (m) {
      children.push(m);
      sizes.push(n.sizes[i]);
    }
  });
  if (!children.length) return null;
  if (children.length === 1) return children[0];
  const total = sizes.reduce((a, b) => a + b, 0);
  return { ...n, children, sizes: sizes.map((x) => (x * 100) / total) };
};
const updateActive = (f: (root: AreaNode) => AreaNode | null) =>
  useLayout.setState((s) => ({
    workspaces: s.workspaces.map((w) =>
      w.id === s.active ? { ...w, root: f(w.root) ?? w.root } : w,
    ),
  }));

export function findArea(root: AreaNode, id: string): AreaLeaf | null {
  if (root.kind === "area") return root.id === id ? root : null;
  for (const c of root.children) {
    const f = findArea(c, id);
    if (f) return f;
  }
  return null;
}
export const leaves = (n: AreaNode): AreaLeaf[] =>
  n.kind === "area" ? [n] : n.children.flatMap(leaves);

export const layout = {
  activate(id: string) {
    useLayout.setState((s) => ({
      active: id,
      maximized: null,
      mounted: s.mounted.includes(id) ? s.mounted : [...s.mounted, id],
    }));
  },
  setEditor(area: string, editor: string) {
    updateActive((r) => mapNode(r, area, (n) => ({ ...(n as AreaLeaf), editor, state: undefined })));
  },
  setAreaState(area: string, patch: Record<string, unknown>) {
    useLayout.setState((s) => ({
      workspaces: s.workspaces.map((w) => ({
        ...w,
        root:
          mapNode(w.root, area, (n) =>
            n.kind === "area" ? { ...n, state: { ...n.state, ...patch } } : n,
          ) ?? w.root,
      })),
    }));
  },
  split(area: string, dir: "row" | "col") {
    updateActive((r) =>
      mapNode(r, area, (n) => S(dir, [50, 50], [n, A((n as AreaLeaf).editor)])),
    );
  },
  close(area: string) {
    const ws = useLayout.getState();
    const w = ws.workspaces.find((x) => x.id === ws.active)!;
    if (leaves(w.root).length <= 1) return;
    updateActive((r) => mapNode(r, area, () => null));
  },
  resize(split: string, sizes: number[]) {
    updateActive((r) => mapNode(r, split, (n) => ({ ...(n as AreaSplit), sizes })));
  },
  toggleMaximize(area: string | null) {
    useLayout.setState((s) => ({ maximized: s.maximized === area ? null : area }));
  },
  swap(a: string, b: string) {
    const ws = useLayout.getState();
    const w = ws.workspaces.find((x) => x.id === ws.active)!;
    const la = findArea(w.root, a),
      lb = findArea(w.root, b);
    if (!la || !lb) return;
    updateActive((r) =>
      mapNode(mapNode(r, a, () => ({ ...lb, id: a }))!, b, () => ({ ...la, id: b })),
    );
  },
  resetActive() {
    const def = defaultWorkspaces().find((w) => w.id === useLayout.getState().active);
    if (def)
      useLayout.setState((s) => ({
        workspaces: s.workspaces.map((w) => (w.id === s.active ? { ...def, name: w.name } : w)),
        maximized: null,
      }));
  },
  resetAll() {
    useLayout.setState({ workspaces: defaultWorkspaces(), active: "analysis", maximized: null, mounted: ["analysis"] });
  },
  duplicate() {
    const s = useLayout.getState(),
      w = s.workspaces.find((x) => x.id === s.active)!,
      id = nid("w");
    const copy = JSON.parse(JSON.stringify(w)) as Workspace;
    const rename = (n: AreaNode): AreaNode =>
      n.kind === "area" ? { ...n, id: nid("a") } : { ...n, id: nid("s"), children: n.children.map(rename) };
    useLayout.setState({
      workspaces: [...s.workspaces, { id, name: `${w.name} 2`, root: rename(copy.root) }],
      active: id,
      mounted: [...s.mounted, id],
    });
  },
  create(name: string) {
    const id = nid("w");
    useLayout.setState((s) => ({
      workspaces: [...s.workspaces, { id, name, root: S("row", [70, 30], [A("viewport"), A("properties")]) }],
      active: id,
      mounted: [...s.mounted, id],
    }));
  },
  move(id: string, to: number) {
    useLayout.setState((s) => {
      const list = s.workspaces.filter((w) => w.id !== id);
      list.splice(Math.max(0, Math.min(list.length, to)), 0, s.workspaces.find((w) => w.id === id)!);
      return { workspaces: list };
    });
  },
  rename(id: string, name: string) {
    useLayout.setState((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name } : w)),
    }));
  },
  remove(id: string) {
    const s = useLayout.getState();
    if (s.workspaces.length <= 1) return;
    const workspaces = s.workspaces.filter((w) => w.id !== id);
    useLayout.setState({
      workspaces,
      active: s.active === id ? workspaces[0].id : s.active,
      mounted: s.mounted.filter((m) => m !== id),
    });
  },
  /** Show an editor: activate a workspace that has it, or swap it into the active area. */
  reveal(editor: string, state?: Record<string, unknown>) {
    const s = useLayout.getState();
    const cur = s.workspaces.find((w) => w.id === s.active)!;
    const target = leaves(cur.root).find((l) => l.editor === editor);
    const other = target ? cur : s.workspaces.find((w) => leaves(w.root).some((l) => l.editor === editor));
    const area = target ?? (other && leaves(other.root).find((l) => l.editor === editor));
    if (!other || !area) {
      const template = defaultWorkspaces().find(w => leaves(w.root).some(l => l.editor === editor));
      const id = nid("w");
      const leaf = A(editor, state);
      const workspace = template ? { ...template, id } : { id, name: editor, root: leaf };
      useLayout.setState(current => ({
        workspaces: [...current.workspaces, workspace],
        active: id, mounted: [...current.mounted, id], maximized: null,
      }));
      if (state && template) layout.setAreaState(leaves(workspace.root).find(l => l.editor === editor)!.id, state);
      useUI.setState({ activeArea: leaves(workspace.root).find(l => l.editor === editor)!.id, activeEditor: editor });
      return;
    }
    if (other.id !== s.active) layout.activate(other.id);
    if (s.maximized && s.maximized !== area.id) useLayout.setState({ maximized: null });
    if (state) layout.setAreaState(area.id, state);
    useUI.setState({ activeArea: area.id, activeEditor: editor });
  },
};
