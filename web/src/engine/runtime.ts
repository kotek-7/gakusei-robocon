import type { Action, Config, Search } from "../explorer/types";
import { MODEL, countConfigs, validateConfig } from "./model";
import { Store } from "./store";
import { Persistence, exportSearch, importSearch } from "./persistence";
import { DiscoveryEngine, metrics, scopeComplete } from "./discovery";
import { analyze } from "./evaluation";
import { assert, pauseTurn } from "./util";
class Cancelled extends Error {}
// Bounded worker memory: pause with all frontiers intact rather than lose data to a tab crash.
export const NODE_LIMIT = 50000,
  EDGE_LIMIT = 150000;
export class Runtime {
  private cache = new Map<string, Store>();
  private jobs = new Map<string, { cancel: boolean; done: Promise<void> }>();
  constructor(public persistence = new Persistence()) {}
  async initialize() {
    await this.persistence.recover();
  }
  private remember(st: Store) {
    this.cache.delete(st.data.id);
    this.cache.set(st.data.id, st);
    for (const [id, cached] of this.cache) {
      if (this.cache.size <= 2) break;
      if (
        id !== st.data.id &&
        !this.jobs.has(id) &&
        cached.data.status !== "error"
      )
        this.cache.delete(id);
    }
  }
  async get(id: string) {
    if (!this.cache.has(id)) this.remember(await this.persistence.load(id));
    return this.cache.get(id)!;
  }
  async list() {
    const saved = await this.persistence.list();
    return saved.map((s) => this.cache.get(s.id)?.summary() || s);
  }
  async start(
    st: Store,
    kind: NonNullable<Search["job"]>,
    options: { budget?: number; node?: number; seconds?: number } = {},
  ) {
    assert(!this.jobs.has(st.data.id), "この探索は実行中です");
    const budget = options.budget ?? 1000,
      seconds = options.seconds ?? 10;
    assert(
      Number.isInteger(budget) && budget >= 1 && budget <= 1000000,
      "計算予算は1〜1000000の整数です",
    );
    assert(
      Number.isInteger(seconds) && seconds >= 1 && seconds <= 86400,
      "候補探索の時間は1〜86400秒の整数です",
    );
    if (kind === "discovery")
      assert(
        !st.data.discovery || st.data.discovery.version === 2,
        "旧方式の結果は保存したまま、同じ構成で新しい探索を作成してください。",
      );
    if (options.node !== undefined) st.node(options.node);
    st.data.status = kind === "evaluation" ? "evaluating" : "running";
    st.data.job = kind;
    st.data.error = null;
    try {
      await this.persistence.save(st);
    } catch (error) {
      st.data.status = "error";
      st.data.job = null;
      st.data.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
    const job = { cancel: false, done: Promise.resolve() };
    this.jobs.set(st.data.id, job);
    job.done = this.work(st, kind, job, budget, seconds, options.node);
    return st.summary();
  }
  private async work(
    st: Store,
    kind: NonNullable<Search["job"]>,
    job: { cancel: boolean },
    budget: number,
    seconds: number,
    node?: number,
  ) {
    const start = performance.now();
    let lastSave = start,
      lastYield = start,
      reason = "time_limit";
    const engine = kind === "discovery" ? new DiscoveryEngine(st) : null,
      base = engine?.d.elapsed ?? 0,
      before = engine ? metrics(engine.d) : null;
    const checkpoint = async (force = false) => {
      if (job.cancel) throw new Cancelled();
      const now = performance.now();
      if (force || now - lastYield >= 20) {
        await pauseTurn();
        lastYield = performance.now();
        if (job.cancel) throw new Cancelled();
      }
      if (force || now - lastSave >= 1000) {
        await this.persistence.save(st);
        lastSave = performance.now();
      }
    };
    try {
      await pauseTurn();
      if (kind === "evaluation") await analyze(st, () => checkpoint());
      else {
        let used = 0;
        while (
          kind === "discovery"
            ? performance.now() - start < seconds * 1000
            : used < budget
        ) {
          await checkpoint();
          if (
            st.data.nodes.length >= NODE_LIMIT ||
            st.data.edges.length >= EDGE_LIMIT ||
            (engine && engine.d.nodes.length >= NODE_LIMIT)
          ) {
            reason = "resource_limit";
            break;
          }
          if (engine) {
            engine.d.elapsed = base + (performance.now() - start) / 1000;
            if (!engine.tick()) {
              reason = "exhausted";
              break;
            }
          } else {
            let run: number | undefined;
            if (node === undefined) {
              const next = st.data.runs.reduce(
                  (max, r) => Math.max(max, r.id + 1),
                  0,
                ),
                schedule = st.data.schedule++;
              if (schedule % 2 === 0 && BigInt(next) < countConfigs(st.c))
                st.ensureRun(next);
              let pending = [
                ...new Set(
                  st.data.nodes.filter((n) => !n.expanded).map((n) => n.run),
                ),
              ].sort((a, b) => a - b);
              if (!pending.length) {
                if (BigInt(next) >= countConfigs(st.c)) break;
                st.ensureRun(next);
                pending = [next];
              }
              run = pending[Math.floor(schedule / 2) % pending.length];
            }
            const made = st.batch(Math.min(100, budget - used), node, run);
            used += made;
            if (!made && node !== undefined) break;
          }
        }
      }
      st.data.status = st.summary().complete ? "complete" : "paused";
    } catch (e) {
      if (e instanceof Cancelled) {
        reason = "cancelled";
        st.data.status = "paused";
        if (kind === "evaluation" && st.data.evaluationProgress)
          st.data.evaluationProgress.state = "cancelled";
      } else {
        reason = "error";
        st.data.status = "error";
        st.data.error = e instanceof Error ? e.message : String(e);
        if (kind === "evaluation" && st.data.evaluationProgress)
          st.data.evaluationProgress.state = "error";
      }
    } finally {
      if (engine) {
        engine.d.elapsed = base + (performance.now() - start) / 1000;
        engine.refresh();
        const after = metrics(engine.d);
        reason = scopeComplete(st) ? "exhausted" : reason;
        engine.d.stopReason = reason;
        engine.d.sessions.push({
          seconds: (performance.now() - start) / 1000,
          budget: seconds,
          reason,
          newCandidates: after.candidates - before!.candidates,
          newStrategies: after.strategies - before!.strategies,
          responses: after.responses - before!.responses,
          scoreChanges: Object.entries(after.bestScores).flatMap(
            ([k, value]) => {
              const old = before!.bestScores[k];
              return old != null && value != null && value > old
                ? [{ run: Number(k), before: old, after: value }]
                : [];
            },
          ),
        });
        engine.d.sessions = engine.d.sessions.slice(-12);
      }
      if (reason === "resource_limit")
        st.data.error =
          "この端末で扱う探索量の上限に達したため中断しました。条件を絞って新しい探索を作成してください。現在の結果は保存できます。";
      st.data.job = null;
      try {
        await this.persistence.save(st);
      } catch (e) {
        st.data.status = "error";
        st.data.error = e instanceof Error ? e.message : String(e);
      }
      this.jobs.delete(st.data.id);
    }
  }
  async pause(id: string) {
    const job = this.jobs.get(id);
    if (job) {
      job.cancel = true;
      await job.done;
    }
    return (await this.get(id)).summary();
  }
  async wait(id: string) {
    await this.jobs.get(id)?.done;
  }
  async request(path: string, body?: unknown): Promise<unknown> {
    const [pathname, query] = path.split("?"),
      parts = pathname.split("/"),
      q = new URLSearchParams(query),
      op = parts[2];
    const input = (body ?? {}) as {
      budget?: number;
      node?: number;
      seconds?: number;
      index: number;
      red: Action[];
      blue: Action[];
      edges: number[];
    };
    if (path === "model") return MODEL;
    if (path === "validate") return validateConfig(body);
    if (path === "import") {
      const st = importSearch(body);
      await this.persistence.save(st);
      this.remember(st);
      return st.summary();
    }
    if (path === "searches") {
      if (body === undefined) return this.list();
      const st = Store.create(body as Config);
      await this.persistence.save(st);
      this.remember(st);
      return st.summary();
    }
    assert(
      parts[0] === "searches" && parts[1],
      "指定されたデータが見つかりません",
    );
    const st = await this.get(parts[1]);
    const num = (k: string, d: number) => {
      const n = Number(q.get(k) ?? d);
      assert(Number.isSafeInteger(n) && n >= 0, "番号が不正です");
      return n;
    };
    switch (op) {
      case undefined:
        return st.summary();
      case "graph":
        return st.graph(
          num("run", 0),
          num("offset", 0),
          Math.min(200, Math.max(1, num("limit", 100))),
        );
      case "node":
        return st.detail(num("id", 1));
      case "export":
        return exportSearch(st);
      case "replay":
        return st.replay(input.edges);
      case "discover":
        return this.start(st, "discovery", input);
      case "start":
        return this.start(st, "exact", input);
      case "evaluate":
        return this.start(st, "evaluation");
      case "pause":
        return this.pause(st.data.id);
      case "delete":
        assert(!this.jobs.has(st.data.id), "停止してから削除してください");
        await this.persistence.remove(st.data.id);
        this.cache.delete(st.data.id);
        return null;
      case "run":
      case "step": {
        assert(
          !this.jobs.has(st.data.id),
          "探索または集計を停止してから操作してください",
        );
        const result =
          op === "run"
            ? (st.ensureRun(input.index), st.summary())
            : { edges: st.step(input.node!, input.red, input.blue) };
        await this.persistence.save(st);
        return result;
      }
      default:
        throw new Error("指定された操作が見つかりません");
    }
  }
}
