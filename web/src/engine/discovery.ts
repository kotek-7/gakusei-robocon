import type {
  Candidate,
  CandidateEvidence,
  Discovery,
  DiscoverySession,
  Goal,
  State,
  StrategyPolicy,
} from "../explorer/types";
import {
  action,
  countConfigs,
  legal,
  matched,
  payload,
  scores,
  tower,
} from "./model";
import {
  Planner,
  choices,
  continuing,
  fixedChoice,
  instruction,
  type Choice,
  type Failure,
  type Instruction,
  type Intent,
} from "./planner";
import {
  classification,
  digest,
  sortTrace,
  structural,
  tokens,
} from "./classification";
import { successors } from "./transition";
import type { Store } from "./store";
import {
  policySeeds,
  policyOpponents,
  policyGoal,
  policyAction,
  policyFromPlan,
} from "./policy";
import { assert, combination, equal, key } from "./util";
export const SCOPE =
  "条件付き作戦13案を5種類の能動的な相手と比較し、主要な得点源・切替条件・必要機構を示します。用意した13案に加え、行動探索や対抗手から最大8案を組み立て直して比較します。全戦略の網羅ではありません。並行する行動探索では、両チームの取得個数・混載・床／直接受け渡し・建設途中の切替・先行搬送を探索します。移動は最短経路です。条件付き作戦は待機中に1秒刻みで条件を確認します。行動探索の待機は次の動作完了か終了直前の反転開始に限定し、保存手順では絶対時刻として再現します。未探索の分岐を保存して続行できます。作戦の比較と行動経路の例を区別して表示します。最適性・勝率・全相手への点差を保証しません。";
type Context = {
  commitments: (Intent | null)[];
  indices: number[];
  blocked: Failure[];
};
type Options = { robots: Choice[][]; indices: number[]; blocked: Failure[] };
type DNode = {
  id: number;
  job: number;
  node: number;
  context: Context;
  parent: number | null;
  edge: number | null;
  additions: (Instruction | null)[];
  hints: (Goal | null)[];
  options: Options | null;
  cursor: number;
  total: number;
  done: boolean;
  priority: number;
};
type DJob = {
  policies?: Record<string, StrategyPolicy>;
  id: number;
  run: number;
  mode: "baseline" | "counter" | "compare";
  candidate: string;
  opponent: string;
  scripts: Record<string, Instruction[][]>;
  active: number | null;
  ticks: number;
  done: boolean;
};
type DRun = {
  policyOpponents?: Record<string, StrategyPolicy>;
  candidates: (Candidate & { script: Instruction[][] })[];
  opponents: Record<string, Instruction[][]>;
  tested: number;
  frontier: number;
  remainingChoices: number;
  complete: boolean;
  firstCandidateSeconds: number | null;
  commonOpponents: string[];
};
export type DiscoveryState = {
  version?: number;
  elapsed: number;
  schedule: number;
  runs: Record<string, DRun>;
  sessions: DiscoverySession[];
  stopReason: string | null;
  jobs: DJob[];
  nodes: DNode[];
  links: {
    src: number;
    dst: number;
    edge: number;
    additions: (Instruction | null)[];
  }[];
};
export const emptyDiscovery = (): DiscoveryState => ({
  version: 2,
  elapsed: 0,
  schedule: 0,
  runs: {},
  sessions: [],
  stopReason: null,
  jobs: [],
  nodes: [],
  links: [],
});
export function scopeComplete(st: Store) {
  const d = st.data.discovery;
  return (
    !!d &&
    BigInt(Object.keys(d.runs).length) === countConfigs(st.c) &&
    Object.values(d.runs).every((r) => r.complete)
  );
}
export function metrics(d: DiscoveryState): Discovery["metrics"] {
  const candidates = Object.values(d.runs).flatMap((r) => r.candidates);
  return {
    candidates: candidates.length,
    strategies: new Set(candidates.map((a) => a.baseline.strategy)).size,
    responses: candidates.reduce((n, a) => n + a.responses.length, 0),
    pending: candidates.reduce((n, a) => n + a.pending, 0),
    frontier: Object.values(d.runs).reduce((n, r) => n + r.frontier, 0),
    bestScores: Object.fromEntries(
      Object.entries(d.runs).map(([k, r]) => [
        k,
        r.candidates.length
          ? Math.max(...r.candidates.map((a) => a.baseline.scores[0]))
          : null,
      ]),
    ),
  };
}
export function publicDiscovery(st: Store): Discovery | null {
  const d = st.data.discovery;
  if (!d) return null;
  return {
    elapsed: d.elapsed,
    scope:
      d.version === 2
        ? SCOPE
        : "旧方式の結果です。新方式の比較には同じ構成で新しい探索を作成してください。",
    complete: false,
    scopeComplete: scopeComplete(st),
    stopReason: scopeComplete(st) ? "exhausted" : d.stopReason,
    metrics: metrics(d),
    sessions: d.sessions,
    runs: Object.entries(d.runs)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([k, r]) => {
        const compared = new Map<string, Set<string>>();
        for (const job of d.jobs)
          if (job.run === Number(k) && job.mode === "compare" && job.done) {
            if (!compared.has(job.candidate))
              compared.set(job.candidate, new Set());
            compared.get(job.candidate)!.add(job.opponent);
          }
        const core = r.candidates.filter(
          (a) => a.policy && !a.policy.derivedFrom,
        );
        const opponents = Object.keys(r.policyOpponents || {});
        const common = opponents.filter(
          (id) =>
            core.length === policySeeds().length &&
            core.every((a) => compared.get(a.id)?.has(id)),
        );
        return {
          run: Number(k),
          variant: st.run(Number(k)).variant,
          tested: r.tested,
          frontier: r.frontier,
          remainingChoices: r.remainingChoices,
          scopeComplete: r.complete,
          commonOpponents: r.commonOpponents,
          policyOpponents: Object.fromEntries(
            Object.entries(r.policyOpponents || {}).map(([id, p]) => [
              id,
              p.name,
            ]),
          ),
          policyCommonOpponents: common,
          policyComparisonComplete:
            opponents.length > 0 && common.length === opponents.length,
          firstCandidateSeconds: r.firstCandidateSeconds,
          candidates: r.candidates.map(({ script: _, ...a }) => ({
            ...a,
            comparedOpponents: [...(compared.get(a.id) || [])],
          })),
        };
      }),
  };
}
function alternatives(
  p: Planner,
  s: State,
  ctx: Context,
  oldHints: (Goal | null)[],
  job: DJob,
): [Options, (Goal | null)[]] {
  const options: Choice[][] = [],
    indices = [...ctx.indices],
    blocked = [...ctx.blocked],
    hints = [...oldHints];
  const failure = (f: Failure | null) => {
    if (
      f &&
      !blocked.some(
        (x) => x.robot === f.robot && x.instruction === f.instruction,
      )
    )
      blocked.push(f);
  };
  for (let t = 0; t < 2; t++) {
    const policy = job.policies?.[t];
    if (policy) hints[t] = policyGoal(p, s, t, policy, hints[t]);
    else if (!hints[t] || p.achieved(s, hints[t]!, t))
      hints[t] = p.goals(s, t)[0] || null;
  }
  for (let r = 0; r < 4; r++) {
    const t = r >> 1,
      fixed = job.scripts[t];
    let opts: Choice[];
    if (job.policies?.[t]) {
      opts = [[policyAction(p, s, r, hints[t]), null]];
    } else if (fixed) {
      let f;
      [opts, indices[r], f] = fixedChoice(
        p,
        s,
        r,
        ctx.commitments[r],
        fixed[r % 2],
        indices[r],
      );
      failure(f);
    } else if (job.mode === "baseline" && t === 1)
      opts = [
        [
          s.robots[r].job
            ? action("continue")
            : action("wait", { seconds: p.c.horizon - s.t }),
          null,
        ],
      ];
    else {
      const hint = p.command(s, r, hints[t], legal(s, r, p.c, p.v));
      opts = choices(p, s, r, ctx.commitments[r], hint, p.destinations.get(r));
    }
    const g = hints[t];
    if (!fixed && !job.policies?.[t] && r % 2 === 0 && g?.kind === "flip") {
      const held = payload(s, r).length > 0;
      const useful = ([a, i]: Choice) =>
        ["drop", "give"].includes(a.kind) ||
        (held && i?.kind === "travel" && i.dest === `transfer${t}`) ||
        (!held && a.kind === "pick");
      opts.sort(
        (a, b) =>
          Number(!useful(a)) - Number(!useful(b)) ||
          (b[0].objects?.length || 0) - (a[0].objects?.length || 0),
      );
    }
    if (!fixed && !job.policies?.[t] && r % 2 && g?.kind === "build") {
      const len = tower(s, g.spot!).length,
        need: Record<string, number> = {
          E: Math.max(0, 2 - len),
          S: Number(len < 3 && (g.height ?? 3) === 3),
        };
      const load = ([a]: Choice) =>
        a.kind === "pick"
          ? Object.entries(need).reduce(
              (sum, [k, n]) =>
                sum +
                Math.min(
                  n,
                  a.objects!.filter((i) => s.objects[i].kind === k).length,
                ),
              0,
            )
          : 0;
      opts.sort((a, b) => load(b) - load(a));
    }
    options.push(opts);
  }
  for (let t = 0; t < 2; t++) {
    const r = t * 2,
      [aa, bb] = options.slice(r, r + 2);
    if (job.policies?.[t]) continue;
    if (job.scripts[t]) {
      const a = aa[0][0],
        b = bb[0][0];
      if ((a.kind === "give" || b.kind === "receive") && !matched([a, b])) {
        for (const rr of [r, r + 1])
          if (
            !s.robots[rr].job &&
            ["give", "receive"].includes(options[rr][0][0].kind)
          ) {
            options[rr] = [
              [action("wait", { seconds: p.c.horizon - s.t }), null],
            ];
            indices[rr] = ctx.indices[rr];
          }
        failure({
          robot: r,
          t: s.t,
          instruction: indices[r],
          reason: "直接受け渡しの相手手順がまだ成立していません",
        });
      }
    } else if (!(job.mode === "baseline" && t === 1)) {
      const pair = aa.flatMap((a) =>
        bb
          .filter(
            (b) =>
              a[0].kind === "give" &&
              b[0].kind === "receive" &&
              equal(a[0].objects, b[0].objects),
          )
          .map((b) => [a, b]),
      )[0];
      if (pair) {
        aa.splice(aa.indexOf(pair[0]), 1);
        aa.unshift(pair[0]);
        bb.splice(bb.indexOf(pair[1]), 1);
        bb.unshift(pair[1]);
      }
    }
  }
  return [{ robots: options, indices, blocked }, hints];
}
export class DiscoveryEngine {
  d: DiscoveryState;
  private planners = new Map<number, Planner>();
  private stateKeys = new Map<string, number>();
  constructor(public st: Store) {
    assert(
      !st.data.discovery || st.data.discovery.version === 2,
      "旧方式の候補探索は再開できません。結果を書き出して保存し、同じ構成で新しい探索を作成してください。",
    );
    this.d = st.data.discovery ??= emptyDiscovery();
    for (const row of this.d.nodes)
      this.stateKeys.set(
        key([row.job, row.node, row.context, row.hints]),
        row.id,
      );
  }
  private newJob(
    run: number,
    mode: DJob["mode"],
    candidate = "",
    opponent = "",
    scripts: Record<string, Instruction[][]> = {},
    policies: Record<string, StrategyPolicy> = {},
  ) {
    if (
      this.d.jobs.some(
        (j) =>
          j.run === run &&
          j.mode === mode &&
          j.candidate === candidate &&
          j.opponent === opponent &&
          ((mode === "baseline" && candidate !== "") ||
            equal(j.policies || {}, policies)),
      )
    )
      return;
    const job: DJob = {
      id: this.d.jobs.length + 1,
      run,
      mode,
      candidate,
      opponent,
      scripts,
      policies,
      active: null,
      ticks: 0,
      done: false,
    };
    this.d.jobs.push(job);
    job.active = this.addState(
      job.id,
      this.st.run(run).root,
      {
        commitments: [null, null, null, null],
        indices: [0, 0, 0, 0],
        blocked: [],
      },
      null,
      null,
      [null, null, null, null],
      [null, null],
      0,
    ).id;
  }
  private addState(
    job: number,
    node: number,
    context: Context,
    parent: number | null,
    edge: number | null,
    additions: (Instruction | null)[],
    hints: (Goal | null)[],
    priority: number,
  ): DNode {
    const k = key([job, node, context, hints]),
      old = this.stateKeys.get(k);
    if (old) return this.d.nodes[old - 1];
    const row: DNode = {
      id: this.d.nodes.length + 1,
      job,
      node,
      context,
      parent,
      edge,
      additions,
      hints,
      options: null,
      cursor: 0,
      total: 0,
      done: false,
      priority,
    };
    this.d.nodes.push(row);
    this.stateKeys.set(k, row.id);
    return row;
  }
  private evidence(row: DNode): [CandidateEvidence, Instruction[][], Goal[]] {
    const path: number[] = [],
      scripts: Instruction[][] = [[], [], [], []];
    let n = row;
    while (n.parent !== null) {
      path.push(n.edge!);
      n.additions.forEach((ins, r) => {
        if (ins) scripts[r].push(ins);
      });
      n = this.d.nodes[n.parent - 1];
    }
    path.reverse();
    scripts.forEach((a) => a.reverse());
    const events = path.flatMap((e) => this.st.edge(e).events),
      [strategy, milestones] = classification(
        structural(sortTrace(tokens(events))),
      ),
      plan: Goal[] = [];
    for (const e of events)
      if (
        e.robot < 2 &&
        e.phase === "finish" &&
        ["place", "flip", "placeM"].includes(e.action.kind)
      ) {
        const g: Goal = {
          kind:
            e.action.kind === "place"
              ? "build"
              : e.action.kind === "placeM"
                ? "mustika"
                : "flip",
          ...(e.action.spot !== undefined ? { spot: e.action.spot } : {}),
        };
        if (!equal(plan.at(-1), g)) plan.push(g);
      }
    return [
      {
        node: row.node,
        path,
        scores: scores(this.st.node(row.node).state),
        strategy,
        milestones,
        blocked: row.context.blocked,
      },
      scripts,
      plan,
    ];
  }
  private expand(
    p: Planner,
    job: DJob,
  ): ReturnType<DiscoveryEngine["evidence"]> | null {
    const active = job.active,
      oldTicks = job.ticks;
    let row =
      oldTicks % 2 === 0 && active ? this.d.nodes[active - 1] : undefined;
    if (row?.done) row = undefined;
    if (!row && oldTicks % 2 === 0)
      row = this.d.nodes
        .filter((n) => n.job === job.id && !n.done && !n.options)
        .sort((a, b) => b.priority - a.priority || a.id - b.id)[0];
    row ??= this.d.nodes.find((n) => n.job === job.id && !n.done);
    if (!row) {
      job.done = true;
      return null;
    }
    const s = this.st.node(row.node).state;
    if (s.t >= p.c.horizon) {
      row.done = true;
      row.total = 0;
      job.active = null;
      job.ticks++;
      return this.evidence(row);
    }
    if (!row.options) {
      [row.options, row.hints] = alternatives(
        p,
        s,
        row.context,
        row.hints,
        job,
      );
      row.total = row.options.robots.reduce((n, x) => n * x.length, 1);
    }
    const data = row.options,
      chosen = combination(data.robots, row.cursor),
      acts = chosen.map((x) => x[0]);
    row.cursor++;
    row.done = row.cursor === row.total;
    job.ticks++;
    if (!matched(acts)) return null;
    const adds = chosen.map(([a, intent], r) =>
      continuing(s, r, row!.context.commitments[r])
        ? null
        : instruction(s, r, a, intent),
    );
    const ctx: Context = {
      commitments: chosen.map((x) => x[1]),
      indices: data.indices,
      blocked: data.blocked,
    };
    const outs = successors(s, acts.slice(0, 2), acts.slice(2), p.c, p.v),
      ids = this.st.addOutcomes(
        job.run,
        row.node,
        acts.slice(0, 2),
        acts.slice(2),
        outs,
      );
    let first: number | null = null;
    ids.forEach((eid, i) => {
      const point = scores(outs[i].state),
        priority =
          job.mode === "counter" ? point[1] - point[0] : point[0] - point[1];
      const additions = adds.map((ins) =>
        ins?.kind === "operation" && ins.action.kind === "wait"
          ? { kind: "until" as const, at: outs[i].state.t }
          : ins,
      );
      const child = this.addState(
        job.id,
        this.st.edge(eid).dst,
        ctx,
        row!.id,
        eid,
        additions,
        row!.hints,
        priority,
      );
      // Keep alternative histories even when continuation states are shared.
      this.d.links.push({
        src: row!.id,
        dst: child.id,
        edge: eid,
        additions,
      });
      if (first === null && !child.done) first = child.id;
    });
    if (oldTicks % 2 === 0 || active === null) job.active = first;
    return null;
  }
  private record(
    data: DRun,
    job: DJob,
    [ev, scripts, plan]: ReturnType<DiscoveryEngine["evidence"]>,
  ) {
    if (
      (job.mode === "baseline" && !job.policies?.[0]) ||
      job.mode === "counter"
    ) {
      const team = job.mode === "counter" ? 1 : 0;
      const discovered =
        team === 0
          ? plan
          : ev.path
              .flatMap((id) => this.st.edge(id).events)
              .filter(
                (e) =>
                  e.robot >> 1 === team &&
                  e.phase === "finish" &&
                  ["place", "flip", "placeM"].includes(e.action.kind),
              )
              .map((e) => ({
                kind:
                  e.action.kind === "place"
                    ? "build"
                    : e.action.kind === "flip"
                      ? "flip"
                      : "mustika",
                ...(e.action.spot !== undefined ? { spot: e.action.spot } : {}),
              }));
      const learned = policyFromPlan(
        discovered,
        job.mode === "counter" ? "対抗手の探索" : "行動の探索",
        team,
      );
      if (
        learned &&
        this.d.jobs.filter(
          (j) =>
            j.run === job.run &&
            j.mode === "baseline" &&
            j.policies?.[0]?.derivedFrom,
        ).length < 8
      )
        this.newJob(
          job.run,
          "baseline",
          "Q-" + learned.id,
          "",
          {},
          { 0: learned },
        );
    }
    if (job.mode === "baseline") {
      const policy = job.policies?.[0];
      const id = policy ? "Q-" + policy.id : "P-" + digest(scripts.slice(0, 2));
      if (data.candidates.some((a) => a.id === id)) return;
      data.candidates.push({
        id,
        ...(policy ? { policy } : {}),
        plan,
        script: scripts.slice(0, 2),
        baseline: ev,
        responses: [],
        pending: 0,
      });
      if (data.firstCandidateSeconds === null && ev.scores[0] > 0)
        data.firstCandidateSeconds = this.d.elapsed;
      this.newJob(
        job.run,
        "counter",
        id,
        "",
        policy ? {} : { 0: scripts.slice(0, 2) },
        policy ? { 0: policy } : {},
      );
      for (const [oid, opponent] of Object.entries(data.policyOpponents || {}))
        this.newJob(
          job.run,
          "compare",
          id,
          oid,
          policy ? {} : { 0: scripts.slice(0, 2) },
          { ...(policy ? { 0: policy } : {}), 1: opponent },
        );
      for (const [oid, script] of Object.entries(data.opponents))
        this.newJob(
          job.run,
          "compare",
          id,
          oid,
          {
            ...(policy ? {} : { 0: scripts.slice(0, 2) }),
            1: script,
          },
          policy ? { 0: policy } : {},
        );
    } else {
      const candidate = data.candidates.find((a) => a.id === job.candidate)!,
        oid = job.opponent || "O-" + digest(scripts.slice(2));
      if (job.mode === "counter" && !data.opponents[oid]) {
        data.opponents[oid] = scripts.slice(2);
        for (const a of data.candidates)
          this.newJob(
            job.run,
            "compare",
            a.id,
            oid,
            {
              ...(a.policy ? {} : { 0: a.script }),
              1: scripts.slice(2),
            },
            a.policy ? { 0: a.policy } : {},
          );
      }
      if (!candidate) return;
      const prev = candidate.responses.find(
        (x) => x.opponent === oid && equal(x.path, ev.path),
      );
      if (prev) prev.shared = prev.shared || job.mode === "compare";
      else
        candidate.responses.push({
          ...ev,
          kind: "procedure",
          opponent: oid,
          shared: job.mode === "compare",
        });
    }
  }
  tick(): boolean {
    if (scopeComplete(this.st)) return false;
    const count = countConfigs(this.st.c),
      run = Number(BigInt(this.d.schedule++) % count);
    this.st.ensureRun(run);
    if (!this.planners.has(run))
      this.planners.set(run, new Planner(this.st.c, this.st.run(run).variant));
    const data = (this.d.runs[run] ??= {
      candidates: [],
      opponents: {},
      tested: 0,
      frontier: 0,
      remainingChoices: 0,
      complete: false,
      firstCandidateSeconds: null,
      commonOpponents: [],
    });
    if (!data.policyOpponents) {
      data.policyOpponents = Object.fromEntries(
        policyOpponents().map((p) => ["QO-" + p.id, p]),
      );
      for (const policy of policySeeds())
        this.newJob(run, "baseline", "Q-" + policy.id, "", {}, { 0: policy });
    }
    this.newJob(run, "baseline");
    const mode = (["baseline", "counter", "compare"] as const)[data.tested % 3];
    const all = this.d.jobs.filter((j) => j.run === run && !j.done),
      ordered = all.filter((j) => j.mode === mode);
    const firstOpponent = (j: DJob) =>
      this.d.jobs.find((k) => k.run === j.run && k.opponent === j.opponent)!.id;
    ordered.sort(
      (a, b) =>
        (mode === "compare" ? firstOpponent(a) - firstOpponent(b) : 0) ||
        a.ticks - b.ticks ||
        a.id - b.id,
    );
    const bounded = all.filter(
      (j) =>
        (j.mode === "baseline" && j.policies?.[0]) ||
        (j.mode === "compare" && j.policies?.[0] && j.policies?.[1]),
    );
    bounded.sort(
      (a, b) =>
        Number(!!a.policies?.[0]?.derivedFrom) -
          Number(!!b.policies?.[0]?.derivedFrom) ||
        Number(a.mode !== "baseline") - Number(b.mode !== "baseline") ||
        a.id - b.id,
    );
    const job =
      (data.tested % 4 !== 3 ? bounded[0] : undefined) ||
      ordered[0] ||
      all.sort((a, b) => a.ticks - b.ticks || a.id - b.id)[0];
    if (job) {
      const result = this.expand(this.planners.get(run)!, job);
      if (result) this.record(data, job, result);
      data.tested++;
    }
    this.refresh();
    return true;
  }
  refresh() {
    for (const [k, data] of Object.entries(this.d.runs)) {
      const jobs = this.d.jobs.filter((j) => j.run === Number(k)),
        ids = new Set(jobs.map((j) => j.id)),
        pending = this.d.nodes.filter((n) => ids.has(n.job) && !n.done);
      data.frontier = pending.length;
      data.remainingChoices = pending.reduce(
        (sum, n) => sum + (n.options ? n.total - n.cursor : 0),
        0,
      );
      data.complete = jobs.every((j) => j.done);
      const opponents = [
        ...Object.keys(data.opponents),
        ...Object.keys(data.policyOpponents || {}),
      ];
      let common = new Set(opponents);
      for (const a of data.candidates) {
        const confirmed = new Set(
          jobs
            .filter(
              (j) => j.mode === "compare" && j.candidate === a.id && j.done,
            )
            .map((j) => j.opponent),
        );
        common = new Set([...common].filter((o) => confirmed.has(o)));
        a.pending = opponents.filter((o) => !confirmed.has(o)).length;
      }
      data.commonOpponents = data.candidates.length ? [...common].sort() : [];
    }
  }
}
