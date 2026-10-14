import type { Action, State } from "./types";
import { SPOTS, tower } from "./model";
import type { StoredEdge } from "./store";
import { assert } from "./util";

/** Score split by rule item. The sum per team equals `scores()`. */
export type ScoreParts = {
  transfer: number;
  earthL1: number;
  earthL2: number;
  skyL1: number;
  skyL2: number;
  mustika: number;
  total: number;
};
export type JobInterval = {
  robot: number;
  start: number;
  end: number;
  /** Scheduled end. Waits are cut short when another robot finishes. */
  planned: number;
  action: Action;
  from: string;
  edge: number;
};
export type MarkerKind =
  | "place"
  | "flip"
  | "take"
  | "transfer"
  | "mustika"
  | "retry"
  | "blocked"
  | "mandate"
  | "branch";
export type Marker = {
  t: number;
  kind: MarkerKind;
  robot: number | null;
  team: number;
  edge: number;
  spot?: number;
  action?: Action;
};
export type StackItem = { id: number; kind: string; owner: number; face: number };
export type SpotTrack = {
  spot: number;
  level: number;
  /** -1 for shared spots. */
  owner: number;
  history: { t: number; stack: StackItem[] }[];
};
export type StockSample = {
  t: number;
  groundSky: number;
  store: number[];
  buffer: number[];
  carried: number[];
};
export type MatchAnalysis = {
  start: number;
  end: number;
  samples: { t: number; edge: number | null; parts: ScoreParts[] }[];
  intervals: JobInterval[];
  markers: Marker[];
  spots: SpotTrack[];
  stock: StockSample[];
  mandate: (number | null)[];
};

export function scoreParts(s: State): ScoreParts[] {
  const parts = [0, 1].map(
    (t): ScoreParts => ({
      transfer: 5 * s.transfer[t],
      earthL1: 0,
      earthL2: 0,
      skyL1: 0,
      skyL2: 0,
      mustika: 0,
      total: 0,
    }),
  );
  for (let i = 0; i < SPOTS.length; i++) {
    const level = SPOTS[i][3];
    for (const o of tower(s, i)) {
      if (o.kind === "E")
        parts[o.owner][level === 2 ? "earthL2" : "earthL1"] +=
          [10, 20][o.layer] * level;
      else if (o.face === 0 || o.face === 1)
        parts[o.face][level === 2 ? "skyL2" : "skyL1"] += 40 * level;
    }
  }
  const m = s.objects[52];
  if (m.loc === "pillar") parts[m.owner].mustika += 250;
  for (const p of parts)
    p.total = p.transfer + p.earthL1 + p.earthL2 + p.skyL1 + p.skyL2 + p.mustika;
  return parts;
}

const stackOf = (s: State, i: number): StackItem[] =>
  tower(s, i).map((o) => ({ id: o.id, kind: o.kind, owner: o.owner, face: o.face }));

const stockOf = (s: State): StockSample => {
  const count = (loc: string) => s.objects.filter((o) => o.loc === loc).length;
  return {
    t: s.t,
    groundSky: count("groundSky"),
    store: [count("store0"), count("store1")],
    buffer: [count("buffer0"), count("buffer1")],
    carried: [0, 1, 2, 3].map((r) => count(`robot${r}`)),
  };
};

const FINISH_MARKERS: Record<string, MarkerKind> = {
  place: "place",
  flip: "flip",
  take: "take",
  takeM: "mustika",
  placeM: "mustika",
  drop: "transfer",
  give: "transfer",
};

/** Derive timelines from a continuous stored path. Nothing is re-simulated. */
export function analyzeMatch(
  edges: StoredEdge[],
  states: Map<number, State>,
  branching: boolean,
): MatchAnalysis {
  assert(edges.length > 0, "経路がありません");
  assert(edges.length <= 2000, "経路が長すぎます");
  const first = edges[0].started;
  const sequence: { state: State; edge: number | null }[] = [
    { state: first, edge: null },
  ];
  const intervals = new Map<string, JobInterval>();
  const markers: Marker[] = [];
  edges.forEach((e, i) => {
    assert(!i || e.src === edges[i - 1].dst, "連続しない経路です");
    const dst = states.get(e.dst);
    assert(dst, "局面が存在しません");
    e.started.robots.forEach((rob, r) => {
      const j = rob.job;
      if (!j) return;
      const k = `${r}:${j.start}:${j.action.kind}`;
      const old = intervals.get(k);
      if (old) old.end = Math.min(j.end, dst.t);
      else
        intervals.set(k, {
          robot: r,
          start: j.start,
          end: Math.min(j.end, dst.t),
          planned: j.end,
          action: j.action,
          from: j.from,
          edge: e.id,
        });
    });
    for (const ev of e.events) {
      const team = ev.robot >> 1;
      const kind =
        ev.phase === "blocked"
          ? "blocked"
          : ev.phase === "start" && ev.action.kind === "retry"
            ? "retry"
            : ev.phase === "finish"
              ? FINISH_MARKERS[ev.action.kind]
              : undefined;
      if (kind)
        markers.push({
          t: ev.t,
          kind,
          robot: ev.robot,
          team,
          edge: e.id,
          spot: ev.action.spot,
          action: ev.action,
        });
    }
    if (branching && e.cases.length === 1)
      markers.push({
        t: e.started.t,
        kind: "branch",
        robot: null,
        team: e.cases[0],
        edge: e.id,
      });
    sequence.push({ state: dst, edge: e.id });
  });
  const mandate: (number | null)[] = [null, null];
  let previous = first;
  for (const { state, edge } of sequence) {
    for (const t of [0, 1])
      if (state.mandate[t] && mandate[t] === null) {
        mandate[t] = state.t;
        if (state !== first || previous.mandate[t])
          markers.push({ t: state.t, kind: "mandate", robot: null, team: t, edge: edge ?? edges[0].id });
      }
    previous = state;
  }
  const spots: SpotTrack[] = SPOTS.map((p, i) => ({
    spot: i,
    level: p[3],
    owner: p[4],
    history: [],
  }));
  const stock: StockSample[] = [];
  for (const { state } of sequence) {
    spots.forEach((track, i) => {
      const stack = stackOf(state, i),
        last = track.history.at(-1);
      if (!last || JSON.stringify(last.stack) !== JSON.stringify(stack))
        track.history.push({ t: state.t, stack });
    });
    const s = stockOf(state),
      last = stock.at(-1);
    if (
      !last ||
      last.groundSky !== s.groundSky ||
      last.store.join() !== s.store.join() ||
      last.buffer.join() !== s.buffer.join() ||
      last.carried.join() !== s.carried.join()
    )
      stock.push(s);
  }
  markers.sort((a, b) => a.t - b.t || (a.robot ?? -1) - (b.robot ?? -1));
  return {
    start: first.t,
    end: sequence.at(-1)!.state.t,
    samples: sequence.map(({ state, edge }) => ({
      t: state.t,
      edge,
      parts: scoreParts(state),
    })),
    intervals: [...intervals.values()].sort(
      (a, b) => a.robot - b.robot || a.start - b.start,
    ),
    markers,
    spots,
    stock,
    mandate,
  };
}
