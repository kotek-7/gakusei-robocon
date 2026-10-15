
import { MODEL, countConfigs, validateConfig } from "./model";
import { Store } from "./store";
import { Persistence, exportSearch, importSearch } from "./persistence";
import { DiscoveryEngine, metrics, scopeComplete } from "./discovery";
import { analyze } from "./evaluation";
import { assert, clone, pauseTurn } from "./util";
import type { CandidateAnalysisTarget, DiscoverySession, Search } from "./types";
import type {
  Backup,
  JobOptions,
  EngineEvent,
  Method,
  Params,
  Result,
} from "./protocol";
class Cancelled extends Error {}
// Bounded worker memory: pause with all frontiers intact rather than lose data to a tab crash.
export const NODE_LIMIT = 50000,
  EDGE_LIMIT = 150000;
export class Runtime {
  private cache = new Map<string, Store>();
  private jobs = new Map<string, { cancel: boolean; done: Promise<void> }>();
  private listeners = new Set<(e: EngineEvent) => void>();
  constructor(public persistence = new Persistence()) {}
  subscribe(listener: (e: EngineEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private emit(e: EngineEvent) {
    for (const l of this.listeners) l(e);
  }
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
  private loading = new Map<string, Promise<Store>>();
  async get(id: string): Promise<Store> {
    const cached = this.cache.get(id);
    if (cached) return cached;
    // Concurrent queries share one load so a search never has two live copies.
    let pending = this.loading.get(id);
    if (!pending) {
      pending = this.persistence
        .load(id)
        .then((st) => (this.remember(st), st))
        .finally(() => this.loading.delete(id));
      this.loading.set(id, pending);
    }
    return pending;
  }
  async list() {
    const saved = await this.persistence.list();
    return saved.map((s) => this.cache.get(s.id)?.summary() || s);
  }
  async start(
    st: Store,
    kind: NonNullable<Search["job"]>,
    options: JobOptions = {},
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
    if (options.node !== undefined) st.node(options.node);
    if (options.target !== undefined)
      assert(options.target && typeof options.target === "object", "追加探索の対象が不正です");
    const target = options.target === undefined ? undefined : clone(options.target);
    if (target) {
      assert(kind === "discovery" && options.node === undefined, "追加探索は作戦候補を指定してください");
      new DiscoveryEngine(st).validateTarget(target);
    }
    if (st.data.discovery) st.data.discovery.activeTarget = target ?? null;
    st.data.status = kind === "evaluation" ? "evaluating" : "running";
    st.data.job = kind;
    st.data.error = null;
    let finish!: () => void;
    const job = { cancel: false, done: new Promise<void>((resolve) => { finish = resolve; }) };
    this.jobs.set(st.data.id, job);
    try {
      await this.persistence.save(st);
    } catch (error) {
      this.jobs.delete(st.data.id);
      finish();
      if (st.data.discovery) st.data.discovery.activeTarget = null;
      st.data.status = "error";
      st.data.job = null;
      st.data.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
    void this.work(st, kind, job, budget, seconds, options.node, target).finally(finish);
    this.emit({ type: "search.changed", search: st.summary() });
    return st.summary();
  }
  private async work(
    st: Store,
    kind: NonNullable<Search["job"]>,
    job: { cancel: boolean },
    budget: number,
    seconds: number,
    node?: number,
    target?: CandidateAnalysisTarget,
  ) {
    const start = performance.now();
    let lastSave = start,
      lastYield = start,
      reason = "time_limit";
    const engine = kind === "discovery" ? new DiscoveryEngine(st) : null,
      base = engine?.d.elapsed ?? 0,
      before = engine ? metrics(engine.d) : null;
    const session: DiscoverySession | null = engine && target ? {
      target, started: Date.now(), seconds: 0, budget: seconds, reason: "running",
      newCandidates: 0, newStrategies: 0, responses: 0, scoreChanges: [],
      before: engine.snapshot(target), after: engine.snapshot(target),
    } : null;
    if (engine) engine.d.activeSession = session;
    const updateSession = () => {
      if (engine && session && target) {
        session.seconds = (performance.now() - start) / 1000;
        session.after = engine.snapshot(target);
        session.responses = session.after.responses - session.before!.responses;
      }
    };
    const checkpoint = async (force = false) => {
      if (job.cancel) throw new Cancelled();
      const now = performance.now();
      if (force || now - lastYield >= 20) {
        await pauseTurn();
        lastYield = performance.now();
        if (job.cancel) throw new Cancelled();
      }
      if (force || now - lastSave >= 1000) {
        updateSession();
        await this.persistence.save(st);
        this.emit({ type: "search.changed", search: st.summary() });
        lastSave = performance.now();
      }
    };
    try {
      await pauseTurn();
      if (kind === "evaluation") {
        await analyze(st, () => checkpoint());
        reason = "completed";
      }
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
            if (!engine.tick(target)) {
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
        reason = !target && scopeComplete(st) ? "exhausted" : reason;
        engine.d.stopReason = reason;
        if (!target) engine.d.sessions.push({
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
        updateSession();
        if (session) {
          session.reason = reason;
          (engine.d.candidateSessions ??= []).push(session);
        }
        engine.d.activeSession = null;
        engine.d.activeTarget = null;
      }
      if (reason === "resource_limit")
        st.data.error =
          "この端末で扱う探索量の上限に達したため中断しました。条件を絞って新しい探索を作成してください。現在の結果は保存できます。";
      st.data.job = null;
      try {
        await this.persistence.save(st);
      } catch (e) {
        reason = "error";
        if (session) session.reason = "error";
        st.data.status = "error";
        st.data.error = e instanceof Error ? e.message : String(e);
      }
      this.jobs.delete(st.data.id);
      this.emit({ type: "search.changed", search: st.summary() });
      this.emit({ type: "job.finished", search: st.data.id, kind, reason, ...(target ? {target} : {}) });
    }
  }
  async pause(id: string, target?: CandidateAnalysisTarget) {
    if (target) {
      const st = await this.get(id);
      new DiscoveryEngine(st).validateTarget(target);
      const active = st.data.discovery?.activeTarget;
      assert(st.data.job === "discovery" && active?.run === target.run && active.candidate === target.candidate && active.mode === target.mode,
        "実行中の追加探索の対象が変わりました");
    }
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
  /** Typed entry point used by the Worker. */
  async call<M extends Method>(method: M, params: Params<M>): Promise<Result<M>> {
    const handler = this.handlers[method] as (p: Params<M>) => Promise<Result<M>> | Result<M>;
    assert(handler, "指定された操作が見つかりません");
    return handler(params);
  }
  private idle(st: Store) {
    assert(
      !this.jobs.has(st.data.id),
      "探索または集計を停止してから操作してください",
    );
  }
  private async commit(st: Store) {
    await this.persistence.save(st);
    this.emit({ type: "search.changed", search: st.summary() });
    return st.summary();
  }
  private handlers: {
    [M in Method]: (p: Params<M>) => Promise<Result<M>> | Result<M>;
  } = {
    "model.get": () => MODEL,
    "config.validate": ({ config }) => validateConfig(config),
    "search.list": () => this.list(),
    "search.get": async ({ search }) => (await this.get(search)).summary(),
    "candidate.analysis": async ({ search, run, candidate }) => {
      const st = await this.get(search);
      assert(st.data.discovery, "候補探索が見つかりません");
      return new DiscoveryEngine(st).analysis(run, candidate);
    },
    "candidate.instructions": async ({ search, run, candidate, opponent }) => {
      assert(Number.isSafeInteger(run) && run >= 0, "構成番号が不正です");
      const st = await this.get(search);
      const data = st.data.discovery?.runs[run];
      assert(data, "この構成の候補探索が見つかりません");
      const selected = data.candidates.find((entry) => entry.id === candidate);
      assert(selected, "作戦候補が見つかりません");
      assert(
        Array.isArray(selected.script) && selected.script.length === 2 && selected.script.every(Array.isArray),
        "この作戦の固定指示は保存されていません",
      );
      let blue = null;
      if (opponent !== undefined) {
        assert(data.opponents && Object.hasOwn(data.opponents, opponent), "相手の作戦が見つかりません");
        blue = data.opponents[opponent];
        assert(
          Array.isArray(blue) && blue.length === 2 && blue.every(Array.isArray),
          "この相手の固定指示は保存されていません",
        );
      }
      return clone({ red: selected.script, blue });
    },
    "search.export": async ({ search }) =>
      exportSearch(
        await this.get(search),
        await this.persistence.workspace(search),
      ),
    "graph.page": async ({ search, run, offset, limit = 100 }) => {
      assert(
        [run, offset, limit].every((n) => Number.isSafeInteger(n) && n >= 0),
        "番号が不正です",
      );
      return (await this.get(search)).graph(
        run,
        offset,
        Math.min(200, Math.max(1, limit)),
      );
    },
    "graph.locate": async ({ search, node }) =>
      (await this.get(search)).locate(node),
    "node.get": async ({ search, node }) => (await this.get(search)).detail(node),
    "path.toNode": async ({ search, node }) =>
      (await this.get(search)).path(node),
    "replay.get": async ({ search, edges }) =>
      (await this.get(search)).replay(edges),
    "analysis.match": async ({ search, edges }) =>
      (await this.get(search)).analysis(edges),
    "workspace.get": ({ search }) => this.persistence.workspace(search),
    "search.create": async ({ config }) => {
      const st = Store.create(config);
      this.remember(st);
      return this.commit(st);
    },
    "search.import": async ({ backup }) => {
      const st = importSearch(backup),
        workspace = (backup as Backup).workspace;
      this.remember(st);
      if (workspace)
        await this.persistence.putWorkspace({ ...workspace, id: st.data.id });
      return this.commit(st);
    },
    "search.duplicate": async ({ search, name }) => {
      const source = await this.get(search);
      this.idle(source);
      const backup = exportSearch(source);
      const st = importSearch(JSON.parse(JSON.stringify(backup)));
      st.data.config.name = name ?? `${source.c.name} のコピー`;
      this.remember(st);
      return this.commit(st);
    },
    "search.rename": async ({ search, name }) => {
      const st = await this.get(search);
      assert(typeof name === "string" && name.trim(), "名前を入力してください");
      st.data.config.name = name.trim().slice(0, 80);
      return this.commit(st);
    },
    "search.delete": async ({ search }) => {
      assert(!this.jobs.has(search), "停止してから削除してください");
      await this.persistence.remove(search);
      this.cache.delete(search);
      this.emit({ type: "search.removed", id: search });
      return null;
    },
    "run.ensure": async ({ search, index }) => {
      const st = await this.get(search);
      this.idle(st);
      st.ensureRun(index);
      return this.commit(st);
    },
    "node.step": async ({ search, node, red, blue }) => {
      const st = await this.get(search);
      this.idle(st);
      const edges = st.step(node, red, blue);
      await this.commit(st);
      return { edges };
    },
    "job.start": async ({ search, kind, ...options }) => {
      assert(
        ["discovery", "exact", "evaluation"].includes(kind),
        "計算の種類が不正です",
      );
      return this.start(await this.get(search), kind, options);
    },
    "job.pause": ({ search, target }) => this.pause(search, target),
    "workspace.put": ({ search, workspace }) =>
      this.persistence.putWorkspace({ ...workspace, id: search }),
  };
}
