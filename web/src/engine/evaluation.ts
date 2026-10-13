import type {
  Action,
  Evaluation,
  EvaluationProgress,
  Strategy,
} from "../explorer/types";
import { scores, winner } from "./model";
import {
  CLASS_VERSION,
  classification,
  sortTrace,
  structural,
  tokens,
} from "./classification";
import { matrixValue } from "./linear";
import type { Store } from "./store";
import { assert, key } from "./util";
type Group = {
  strategy: string;
  outcomes: Map<string, number>;
  count: number;
  node: number;
};
type Aggregate = {
  id: string;
  prefix: string[][];
  groups: Set<string>;
  paths: number;
  points: Map<string, number>;
  wins: number;
  unresolved: number;
  node: number;
};
const increment = <K>(m: Map<K, number>, k: K, n = 1) =>
  m.set(k, (m.get(k) || 0) + n);
const distribution = (m: Map<number, number>): [number, number][] =>
  [...m.entries()].sort((a, b) => a[0] - b[0]);
/** Yield between graph work and solver calls, so Worker RPC and cancellation stay live. */
export async function analyze(
  st: Store,
  checkpoint: () => Promise<void>,
  historyLimit = 30000,
): Promise<Evaluation> {
  const all: Evaluation["runs"] = [],
    started = performance.now();
  let current: number | null = null,
    completed = 0;
  async function report(
    phase: EvaluationProgress["phase"],
    done = 0,
    total: number | null = null,
  ) {
    st.data.evaluationProgress = {
      phase,
      done,
      total,
      run: current,
      completedRuns: completed,
      totalRuns: st.data.runs.length,
      elapsed: (performance.now() - started) / 1000,
      state: phase === "complete" ? "complete" : "running",
    };
    await checkpoint();
  }
  for (const run of [...st.data.runs].sort((a, b) => a.id - b.id)) {
    current = run.id;
    await report("loading");
    const nodes = st.data.nodes.filter((n) => n.run === run.id),
      order = nodes.sort((a, b) => a.state.t - b.state.t || a.id - b.id),
      complete = nodes.every((n) => n.expanded);
    const raw = new Map<number, bigint>([[run.root, 1n]]),
      paths = new Map<number, Map<string, string[]>>([
        [run.root, new Map([["[]", []]])],
      ]),
      exact = new Set<string>(),
      groups = new Map<string, Group>(),
      strategies = new Map<string, Aggregate>();
    let histComplete = true,
      totalHist = 1;
    for (let i = 0; i < order.length; i++) {
      await report("histories", i, order.length);
      const nd = order[i],
        traces = paths.get(nd.id) ?? new Map<string, string[]>();
      paths.delete(nd.id);
      if (nd.state.t >= st.c.horizon) {
        const sc = scores(nd.state),
          w = winner(nd.state);
        for (const [traceKey, trace] of traces) {
          await checkpoint();
          if (exact.has(traceKey)) continue;
          exact.add(traceKey);
          const sig = structural(trace),
            [sid, prefix] = classification(sig),
            gk = key(sig);
          if (!groups.has(gk))
            groups.set(gk, {
              strategy: sid,
              outcomes: new Map(),
              count: 0,
              node: nd.id,
            });
          const group = groups.get(gk)!;
          increment(group.outcomes, key([...sc, w]));
          group.count++;
          if (!strategies.has(sid))
            strategies.set(sid, {
              id: sid,
              prefix,
              groups: new Set(),
              paths: 0,
              points: new Map(),
              wins: 0,
              unresolved: 0,
              node: nd.id,
            });
          const ss = strategies.get(sid)!;
          ss.groups.add(gk);
          ss.paths++;
          increment(ss.points, key(sc));
          ss.wins += Number(w === 1);
          ss.unresolved += Number(w === 0);
        }
      }
      for (const e of st.outgoing.get(nd.id) || []) {
        raw.set(e.dst, (raw.get(e.dst) || 0n) + (raw.get(nd.id) || 0n));
        if (!histComplete) continue;
        const additions = tokens(e.events);
        if (!paths.has(e.dst)) paths.set(e.dst, new Map());
        const dest = paths.get(e.dst)!;
        for (const trace of traces.values()) {
          await checkpoint();
          const next = sortTrace([...trace, ...additions]),
            k = key(next);
          if (!dest.has(k)) {
            dest.set(k, next);
            totalHist++;
            if (totalHist > historyLimit) {
              histComplete = false;
              break;
            }
          }
        }
      }
    }
    const stats: Strategy[] = [];
    await report("statistics", 0, strategies.size);
    for (const ss of strategies.values()) {
      let win = 0,
        unresolved = 0;
      const dist = new Map<number, number>();
      for (const gk of ss.groups) {
        const g = groups.get(gk)!;
        for (const [out, num] of g.outcomes) {
          const [a, b, w] = JSON.parse(out),
            weight = num / g.count / ss.groups.size;
          win += weight * Number(w === 1);
          unresolved += weight * Number(w === 0);
          increment(dist, a - b, weight);
        }
      }
      stats.push({
        id: ss.id,
        prefix: ss.prefix,
        groups: ss.groups.size,
        paths: String(ss.paths),
        groupWinFraction: win,
        pathWinFraction: ss.wins / ss.paths,
        unresolvedFraction: unresolved,
        distribution: distribution(dist),
        scores: [...ss.points]
          .map(([sc, count]) => {
            const [red, blue] = JSON.parse(sc);
            return { red, blue, count: String(count) };
          })
          .sort((a, b) => a.red - b.red || a.blue - b.blue),
        node: ss.node,
      });
      await report("statistics", stats.length, strategies.size);
    }
    let runWin = 0,
      runUnresolved = 0;
    const runDist = new Map<number, number>();
    for (const g of groups.values()) {
      await checkpoint();
      for (const [out, num] of g.outcomes) {
        const [a, b, w] = JSON.parse(out),
          weight = num / g.count / groups.size;
        runWin += weight * Number(w === 1);
        runUnresolved += weight * Number(w === 0);
        increment(runDist, a - b, weight);
      }
    }
    const result: Evaluation["runs"][number] = {
      run: run.id,
      variant: run.variant,
      complete,
      statisticsComplete: complete && histComplete,
      historyLimited: !histComplete,
      rawGraphPaths: String(
        nodes
          .filter((n) => n.state.t >= st.c.horizon)
          .reduce((sum, n) => sum + (raw.get(n.id) || 0n), 0n),
      ),
      paths: String(exact.size),
      groups: groups.size,
      strategies: stats.sort((a, b) => a.id.localeCompare(b.id)),
      windowEnd: st.c.horizon,
      groupWinFraction: groups.size ? runWin : null,
      unresolvedFraction: groups.size ? runUnresolved : null,
      distribution: distribution(runDist),
      guarantee: null,
    };
    if (complete) {
      const vals = new Map<number, number[]>();
      let policy: { actions: Action[][]; probabilities: number[] } = {
        actions: [],
        probabilities: [],
      };
      for (const [i, nd] of [...order].reverse().entries()) {
        await report("guarantees", i, order.length);
        if (nd.state.t >= st.c.horizon) {
          const w = winner(nd.state),
            sc = scores(nd.state);
          vals.set(nd.id, [Number(w === 1), Number(w !== -1), sc[0] - sc[1]]);
          continue;
        }
        const edges = st.outgoing.get(nd.id) || [],
          rows = [...new Set(edges.map((e) => key(e.red)))].sort(),
          cols = [...new Set(edges.map((e) => key(e.blue)))].sort(),
          cells = new Map<string, number[][]>();
        for (const e of edges) {
          const k = key([key(e.red), key(e.blue)]);
          cells.set(k, [...(cells.get(k) || []), vals.get(e.dst)!]);
        }
        const matrix = (index: number) =>
          rows.map((a) =>
            cols.map((b) => {
              const cell = cells.get(key([a, b]));
              assert(
                cell?.length,
                "探索済み局面に未処理の行動の組合せがあります",
              );
              return Math.min(...cell.map((v) => v[index]));
            }),
          );
        const lower = matrix(0),
          upper = matrix(1),
          margin = matrix(2);
        const [vl] = await matrixValue(lower);
        await checkpoint();
        const [vu] = await matrixValue(upper);
        await checkpoint();
        const [vm, dist] = await matrixValue(margin, lower, vl);
        await checkpoint();
        vals.set(nd.id, [vl, vu, vm]);
        if (nd.id === run.root)
          policy = {
            actions: rows.map((a) => JSON.parse(a)),
            probabilities: dist,
          };
      }
      const [winLower, winUpper, marginLower] = vals.get(run.root)!;
      result.guarantee = {
        winLower,
        winUpper,
        marginLower,
        ...policy,
        meaning:
          "モデル内で相手が最善の行動を選ぶ場合の勝利確率です。同時操作の競合は不利な結果も考慮します。点差は勝利確率の保証を維持する保守的な下限です。",
      };
    }
    all.push(result);
    completed++;
  }
  await report("saving");
  const result: Evaluation = {
    classification: CLASS_VERSION,
    cut: null,
    runs: all,
    meaning:
      "展開グループを等重みとし、各グループ内の試合展開も等重みで集計します。実大会の勝率ではありません。未完了の値は発見済みの範囲です。",
  };
  st.data.evaluation = result;
  st.data.evaluationProgress = {
    phase: "complete",
    state: "complete",
    done: completed,
    total: completed,
    run: current,
    completedRuns: completed,
    totalRuns: completed,
    elapsed: (performance.now() - started) / 1000,
  };
  return result;
}
