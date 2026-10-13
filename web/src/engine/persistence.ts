import { openDB, type DBSchema } from "idb";
import type { Search } from "../explorer/types";
import { Store, type StoredSearch } from "./store";
import { VERSION, validateConfig, validateState } from "./model";
import { assert, clone } from "./util";
interface Database extends DBSchema {
  searches: { key: string; value: StoredSearch };
  summaries: { key: string; value: Search };
}
export class Persistence {
  private db;
  constructor(name = "robocon-browser-1") {
    this.db = openDB<Database>(name, 1, {
      upgrade(db) {
        db.createObjectStore("searches", { keyPath: "id" });
        db.createObjectStore("summaries", { keyPath: "id" });
      },
    });
  }
  async save(st: Store) {
    const db = await this.db,
      tx = db.transaction(["searches", "summaries"], "readwrite");
    try {
      await Promise.all([
        tx.objectStore("searches").put(st.data),
        tx.objectStore("summaries").put(st.summary()),
      ]);
      await tx.done;
    } catch (e) {
      await tx.done.catch(() => {});
      throw new Error(
        e instanceof DOMException && e.name === "QuotaExceededError"
          ? "ブラウザの保存容量が不足しています。探索を停止しました。結果を書き出し、不要な探索を削除してください。"
          : `保存に失敗しました: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  async load(id: string) {
    const data = await (await this.db).get("searches", id);
    assert(data, "保存済み探索が存在しません");
    assert(data.config.version === VERSION, "保存データの版が一致しません");
    return new Store(data);
  }
  async list() {
    return (await (await this.db).getAll("summaries")).sort(
      (a, b) => b.created - a.created,
    );
  }
  async remove(id: string) {
    const tx = (await this.db).transaction(
      ["searches", "summaries"],
      "readwrite",
    );
    await Promise.all([
      tx.objectStore("searches").delete(id),
      tx.objectStore("summaries").delete(id),
    ]);
    await tx.done;
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
export function exportSearch(st: Store) {
  return { format: "robocon-browser", version: 1, search: st.data };
}
/** New browser backups only. Older Python records have no import path. */
export function importSearch(input: unknown): Store {
  assert(input && typeof input === "object", "バックアップ形式が不正です");
  const b = input as ReturnType<typeof exportSearch>;
  assert(
    b.format === "robocon-browser" && b.version === 1 && b.search,
    "ブラウザ版のバックアップを選んでください",
  );
  const d = clone(b.search);
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
