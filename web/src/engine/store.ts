import type {
  Action,
  Config,
  Detail,
  Evaluation,
  EvaluationProgress,
  Graph,
  Search,
  State,
  Variant,
} from "./types";
import {
  configAt,
  countConfigs,
  initial,
  legal,
  snapshot,
  teamChoices,
  validateConfig,
} from "./model";
import { successors, type Outcome, type Event } from "./transition";
import { frame, replay } from "./presentation";
import { analyzeMatch } from "./analysis";
import { assert, key } from "./util";
import type { DiscoveryState } from "./discovery";
import { publicDiscovery } from "./discovery";
export type StoredNode = {
  id: number;
  run: number;
  state: State;
  cursor: number;
  expanded: boolean;
};
export type StoredEdge = {
  id: number;
  run: number;
  src: number;
  dst: number;
  red: Action[];
  blue: Action[];
  events: Event[];
  started: State;
  cases: number[];
};
export type Run = { id: number; variant: Variant; root: number };
export type StoredSearch = {
  id: string;
  config: Config;
  created: number;
  status: string;
  error: string | null;
  job: Search["job"];
  schedule: number;
  evaluation: Evaluation | null;
  evaluationProgress: EvaluationProgress | null;
  discovery: DiscoveryState | null;
  nodes: StoredNode[];
  edges: StoredEdge[];
  runs: Run[];
};
/** Worker-local graph. Persistence checkpoints the complete continuation atomically. */
export class Store {
  data: StoredSearch;
  jobProgress?: Search["jobProgress"];
  /** Rows already in IndexedDB; nodes changed since then are in `dirty`. */
  saved = { nodes: 0, edges: 0 };
  dirty = new Set<number>();
  private nodeKeys = new Map<string, number>();
  private edgeKeys = new Map<string, number>();
  outgoing = new Map<number, StoredEdge[]>();
  incoming = new Map<number, StoredEdge[]>();
  constructor(data: StoredSearch) {
    this.data = data;
    for (const n of data.nodes)
      this.nodeKeys.set(`${n.run}:${key(n.state)}`, n.id);
    for (const e of data.edges) {
      this.edgeKeys.set(this.edgeKey(e.src, e.red, e.blue, e.dst), e.id);
      this.indexEdge(e);
    }
  }
  static create(c: Config) {
    validateConfig(c);
    const st = new Store({
      id: crypto.randomUUID(),
      config: c,
      created: Date.now() / 1000,
      status: "paused",
      error: null,
      job: null,
      schedule: 0,
      evaluation: null,
      evaluationProgress: null,
      discovery: null,
      nodes: [],
      edges: [],
      runs: [],
    });
    st.ensureRun(0);
    return st;
  }
  get c() {
    return this.data.config;
  }
  ensureRun(index: number): Run {
    let run = this.data.runs.find((r) => r.id === index);
    if (run) return run;
    const variant = configAt(this.c, index);
    run = {
      id: index,
      variant,
      root: this.addNode(index, initial(this.c, variant)),
    };
    this.data.runs.push(run);
    return run;
  }
  run(id: number) {
    const r = this.data.runs.find((r) => r.id === id);
    assert(r, "構成はまだ生成されていません");
    return r;
  }
  node(id: number) {
    const n = this.data.nodes[id - 1];
    assert(n && n.id === id, "局面が存在しません");
    return n;
  }
  edge(id: number) {
    const e = this.data.edges[id - 1];
    assert(e && e.id === id, "遷移が存在しません");
    return e;
  }
  private addNode(run: number, state: State): number {
    const k = `${run}:${key(state)}`,
      old = this.nodeKeys.get(k);
    if (old) return old;
    const id = this.data.nodes.length + 1;
    this.data.nodes.push({
      id,
      run,
      state,
      cursor: 0,
      expanded: state.t >= this.c.horizon,
    });
    this.nodeKeys.set(k, id);
    return id;
  }
  private edgeKey(src: number, red: Action[], blue: Action[], dst: number) {
    return key([src, red, blue, dst]);
  }
  private indexEdge(e: StoredEdge) {
    this.outgoing.set(e.src, [...(this.outgoing.get(e.src) || []), e]);
    this.incoming.set(e.dst, [...(this.incoming.get(e.dst) || []), e]);
  }
  addOutcomes(
    run: number,
    src: number,
    red: Action[],
    blue: Action[],
    outs: Outcome[],
  ): number[] {
    this.data.evaluation = null;
    return outs.map((out) => {
      const dst = this.addNode(run, out.state),
        k = this.edgeKey(src, red, blue, dst),
        old = this.edgeKeys.get(k);
      if (old) return old;
      const id = this.data.edges.length + 1,
        e = {
          id,
          run,
          src,
          dst,
          red,
          blue,
          events: out.events,
          started: out.started,
          cases: out.cases,
        };
      this.data.edges.push(e);
      this.edgeKeys.set(k, id);
      this.indexEdge(e);
      return id;
    });
  }
  step(node: number, red: Action[], blue: Action[]) {
    const n = this.node(node);
    return this.addOutcomes(
      n.run,
      node,
      red,
      blue,
      successors(n.state, red, blue, this.c, this.run(n.run).variant),
    );
  }
  batch(limit: number, node?: number, run?: number): number {
    let processed = 0;
    const deadline = performance.now() + 25;
    while (processed < limit && performance.now() < deadline) {
      const n = this.data.nodes.find(
        (n) =>
          !n.expanded &&
          (node === undefined || n.id === node) &&
          (run === undefined || n.run === run),
      );
      if (!n) break;
      const v = this.run(n.run).variant,
        aa = teamChoices(n.state, 0, this.c, v),
        bb = teamChoices(n.state, 1, this.c, v),
        total = aa.length * bb.length;
      while (
        n.cursor < total &&
        processed < limit &&
        performance.now() < deadline
      ) {
        const a = aa[Math.floor(n.cursor / bb.length)],
          b = bb[n.cursor % bb.length];
        this.addOutcomes(
          n.run,
          n.id,
          a,
          b,
          successors(n.state, a, b, this.c, v),
        );
        n.cursor++;
        processed++;
      }
      n.expanded = n.cursor === total;
      this.dirty.add(n.id);
    }
    return processed;
  }
  summary(includeLive = true): Search {
    const pending = new Set(
        this.data.nodes.filter((n) => !n.expanded).map((n) => n.run),
      ),
      completeRuns = this.data.runs.filter((r) => !pending.has(r.id)).length;
    return {
      id: this.data.id,
      name: this.c.name,
      status: this.data.status,
      error: this.data.error,
      created: this.data.created,
      config: this.c,
      nodes: this.data.nodes.length,
      expanded: this.data.nodes.filter((n) => n.expanded).length,
      edges: this.data.edges.length,
      runs: this.data.runs.length,
      completeRuns,
      totalRuns: String(countConfigs(this.c)),
      complete: BigInt(completeRuns) === countConfigs(this.c),
      evaluation: this.data.evaluation,
      evaluationProgress: this.data.evaluationProgress,
      job: this.data.job,
      ...(includeLive && this.jobProgress ? { jobProgress: { ...this.jobProgress } } : {}),
      discovery: publicDiscovery(this),
    };
  }
  graph(run = 0, offset = 0, limit = 100): Graph {
    const r = this.run(run),
      all = this.data.nodes.filter((n) => n.run === run),
      ns = all.slice(offset, offset + limit),
      ids = new Set(ns.map((n) => n.id));
    return {
      nodes: ns.map((n) => ({ ...n, ...snapshot(n.state) })),
      edges: this.data.edges
        .filter((e) => e.run === run && ids.has(e.src))
        .map(({ id, src, dst }) => ({ id, src, dst })),
      root: r.root,
      variant: r.variant,
      total: all.length,
      offset,
    };
  }
  path(node: number): number[] {
    const ids: number[] = [];
    let n = this.node(node);
    while (n.id !== this.run(n.run).root) {
      const e = this.incoming.get(n.id)?.[0];
      assert(e, "経路がありません");
      ids.push(e.id);
      n = this.node(e.src);
    }
    return ids.reverse();
  }
  detail(id: number): Detail {
    const n = this.node(id),
      v = this.run(n.run).variant;
    return {
      ...n,
      ...snapshot(n.state),
      offset: this.locate(id).offset,
      variant: v,
      edges: [
        ...(this.outgoing.get(id) || []),
        ...(this.incoming.get(id) || []),
      ]
        .sort((a, b) => a.id - b.id)
        .map(({ started: _, ...edge }) => edge),
      actions: [0, 1, 2, 3].map((r) => legal(n.state, r, this.c, v)),
      frame: frame(n.state),
      path: this.path(id),
    };
  }
  locate(id: number) {
    const n = this.node(id);
    return {
      run: n.run,
      offset:
        Math.floor(
          this.data.nodes.filter((x) => x.run === n.run && x.id < id).length /
            100,
        ) * 100,
    };
  }
  analysis(ids: number[]) {
    assert(Array.isArray(ids) && ids.every(Number.isInteger), "不正な経路です");
    const edges = ids.map((id) => this.edge(id));
    return analyzeMatch(
      edges,
      new Map(edges.map((e) => [e.dst, this.node(e.dst).state])),
      this.c.rules.conflict === "branch",
    );
  }
  replay(ids: number[]) {
    assert(Array.isArray(ids) && ids.every(Number.isInteger), "不正な経路です");
    const edges = ids.map((id) => this.edge(id));
    return replay(
      edges,
      new Map(edges.map((e) => [e.dst, this.node(e.dst).state])),
    );
  }
}
