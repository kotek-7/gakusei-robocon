import { openDB, type DBSchema } from "idb";
import type { Search } from "./types";
import { Store, type StoredEdge, type StoredNode, type StoredSearch } from "./store";
import { VERSION, validateConfig, validateState } from "./model";
import { assert, clone } from "./util";
import { emptyWorkspace, type Backup, type Workspace } from "./protocol";

type Meta = Omit<StoredSearch, "nodes" | "edges">;
type Row<T> = T & { search: string };
interface Database extends DBSchema {
  searches: { key: string; value: Meta };
  summaries: { key: string; value: Search };
  nodes: { key: [string, number]; value: Row<StoredNode> };
  edges: { key: [string, number]; value: Row<StoredEdge> };
  workspaces: { key: string; value: Workspace };
}
const range = (id: string) => IDBKeyRange.bound([id, 0], [id, Infinity]);
/**
 * Schema browser-2. Nodes and edges are stored as rows keyed by [search, id]
 * and appended incrementally; search metadata and its summary are rewritten
 * in the same readwrite transaction, so a checkpoint is all-or-nothing.
 */
export class Persistence {
  private db;
  constructor(name = "robocon-browser-2") {
    this.db = openDB<Database>(name, 1, {
      upgrade(db) {
        db.createObjectStore("searches", { keyPath: "id" });
        db.createObjectStore("summaries", { keyPath: "id" });
        db.createObjectStore("nodes", { keyPath: ["search", "id"] });
        db.createObjectStore("edges", { keyPath: ["search", "id"] });
        db.createObjectStore("workspaces", { keyPath: "id" });
      },
    });
  }
  async save(st: Store) {
    const db = await this.db,
      id = st.data.id,
      { nodes, edges, ...meta } = st.data,
      // Captured synchronously: rows changed after this point go to the next checkpoint.
      nodeRows = [
        ...nodes.slice(st.saved.nodes),
        ...[...st.dirty]
          .filter((n) => n <= st.saved.nodes)
          .map((n) => nodes[n - 1]),
      ],
      edgeRows = edges.slice(st.saved.edges),
      marks = { nodes: nodes.length, edges: edges.length },
      dirty = new Set(st.dirty);
    st.dirty.clear();
    const tx = db.transaction(
      ["searches", "summaries", "nodes", "edges"],
      "readwrite",
    );
    try {
      const n = tx.objectStore("nodes"),
        e = tx.objectStore("edges");
      await Promise.all([
        tx.objectStore("searches").put(meta),
        tx.objectStore("summaries").put(st.summary(false)),
        ...nodeRows.map((row) => n.put({ ...row, search: id })),
        ...edgeRows.map((row) => e.put({ ...row, search: id })),
      ]);
      await tx.done;
      st.saved = marks;
    } catch (e) {
      for (const n of dirty) st.dirty.add(n);
      await tx.done.catch(() => {});
      throw new Error(
        e instanceof DOMException && e.name === "QuotaExceededError"
          ? "ブラウザの保存容量が不足しています。探索を停止しました。結果を書き出し、不要な探索を削除してください。"
          : `保存に失敗しました: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  async load(id: string) {
    const db = await this.db,
      meta = await db.get("searches", id);
    assert(meta, "保存済み探索が存在しません");
    assert(meta.config.version === VERSION, "保存データの版が一致しません");
    const strip = <T,>({ search: _, ...row }: Row<T>) => row as unknown as T;
    const [nodes, edges] = await Promise.all([
      db.getAll("nodes", range(id)),
      db.getAll("edges", range(id)),
    ]);
    const st = new Store({
      ...meta,
      nodes: nodes.map(strip<StoredNode>).sort((a, b) => a.id - b.id),
      edges: edges.map(strip<StoredEdge>).sort((a, b) => a.id - b.id),
    });
    st.saved = { nodes: st.data.nodes.length, edges: st.data.edges.length };
    return st;
  }
  async list() {
    return (await (await this.db).getAll("summaries")).sort(
      (a, b) => b.created - a.created,
    );
  }
  async remove(id: string) {
    const tx = (await this.db).transaction(
      ["searches", "summaries", "nodes", "edges", "workspaces"],
      "readwrite",
    );
    await Promise.all([
      tx.objectStore("searches").delete(id),
      tx.objectStore("summaries").delete(id),
      tx.objectStore("nodes").delete(range(id)),
      tx.objectStore("edges").delete(range(id)),
      tx.objectStore("workspaces").delete(id),
    ]);
    await tx.done;
  }
  async workspace(id: string): Promise<Workspace> {
    return (await (await this.db).get("workspaces", id)) ?? emptyWorkspace(id);
  }
  async putWorkspace(w: Workspace) {
    const value = { ...clone(w), updated: Date.now() };
    await (await this.db).put("workspaces", value);
    return value;
  }
  async recover() {
    for (const summary of await this.list())
      if (["running", "evaluating"].includes(summary.status)) {
        const st = await this.load(summary.id);
        st.data.status = "paused";
        st.data.job = null;
        if (st.data.evaluationProgress?.state === "running")
          st.data.evaluationProgress.state = "interrupted";
        if (st.data.discovery) st.data.discovery.stopReason = "interrupted";
        await this.save(st);
      }
  }
  async close() {
    (await this.db).close();
  }
}
export function exportSearch(st: Store, workspace: Workspace | null = null): Backup {
  return { format: "robocon-browser", version: 2, search: st.data, workspace };
}
/** New browser backups only. Older Python records have no import path. */
export function importSearch(input: unknown): Store {
  assert(input && typeof input === "object", "バックアップ形式が不正です");
  const b = input as Backup;
  assert(
    b.format === "robocon-browser" && b.version === 2 && b.search,
    "この版（形式2）のバックアップを選んでください",
  );
  const d = clone(b.search) as StoredSearch;
  validateConfig(d.config);
  assert(
    Array.isArray(d.nodes) &&
      Array.isArray(d.edges) &&
      Array.isArray(d.runs) &&
      d.runs.length > 0,
    "探索グラフが不正です",
  );
  const runs = new Set(d.runs.map((r) => r.id));
  assert(runs.size === d.runs.length, "構成が重複しています");
  d.nodes.forEach((n, i) => {
    assert(
      n.id === i + 1 &&
        runs.has(n.run) &&
        Number.isSafeInteger(n.cursor) &&
        n.cursor >= 0 &&
        typeof n.expanded === "boolean",
      "保存局面が不正です",
    );
    validateState(n.state);
  });
  d.edges.forEach((e, i) => {
    const src = d.nodes[e.src - 1],
      dst = d.nodes[e.dst - 1];
    assert(
      e.id === i + 1 &&
        src &&
        dst &&
        src.run === e.run &&
        dst.run === e.run &&
        src.state.t < dst.state.t &&
        Array.isArray(e.events) &&
        e.red?.length === 2 &&
        e.blue?.length === 2,
      "保存経路が不正です",
    );
    validateState(e.started);
  });
  for (const r of d.runs)
    assert(d.nodes[r.root - 1]?.run === r.id, "初期局面が不正です");
  if (d.discovery) {
    const q = d.discovery;
    assert(
      Array.isArray(q.jobs) &&
        Array.isArray(q.nodes) &&
        Array.isArray(q.links) &&
        q.runs &&
        Array.isArray(q.sessions),
      "候補探索の保存状態が不正です",
    );
    q.jobs.forEach((j, i) =>
      assert(
        j.id === i + 1 &&
          runs.has(j.run) &&
          ["baseline", "counter", "compare"].includes(j.mode) &&
          Number.isSafeInteger(j.ticks) &&
          j.ticks >= 0 &&
          j.scripts,
        "探索ジョブが不正です",
      ),
    );
    q.nodes.forEach((n, i) =>
      assert(
        n.id === i + 1 &&
          q.jobs[n.job - 1] &&
          d.nodes[n.node - 1] &&
          Number.isSafeInteger(n.cursor) &&
          n.cursor >= 0 &&
          (!n.options || n.cursor <= n.total) &&
          (n.parent === null || (n.parent < n.id && n.parent >= 1)) &&
          n.context?.commitments.length === 4 &&
          n.context.indices.length === 4 &&
          Array.isArray(n.context.blocked),
        "未探索の分岐が不正です",
      ),
    );
  }
  d.id = crypto.randomUUID();
  d.created = Date.now() / 1000;
  d.status = "paused";
  d.job = null;
  d.error = null;
  if (d.evaluationProgress?.state === "running")
    d.evaluationProgress.state = "interrupted";
  return new Store(d);
}
