/**
 * Typed contract between the UI and the computation Worker.
 * Queries read, commands change saved data, events are pushed by the Worker.
 */
import type {
  Action,
  CandidateInstructions,
  CandidateAnalysis,
  CandidateAnalysisTarget,
  Config,
  Detail,
  Graph,
  Model,
  Replay,
  Search,
} from "./types";
import type { MatchAnalysis } from "./analysis";
import type { StoredSearch } from "./store";

export type JobKind = NonNullable<Search["job"]>;
export type JobOptions = { budget?: number; node?: number; seconds?: number; target?: CandidateAnalysisTarget };

export type ReviewRecord = {
  id: string;
  title: string;
  note: string;
  status: "open" | "keep" | "dismiss";
  node: number;
  path: number[];
  selection: string | null;
  time: number;
  range: [number, number] | null;
  created: number;
};

/** Per-search UI state kept with the search (markers, A/B paths, camera bookmarks). */
export type Workspace = {
  id: string;
  markers: { id: string; t: number; name: string; color?: string }[];
  bookmarks: { id: string; name: string; camera: number[] }[];
  pins: string[];
  ab: { a: number[] | null; b: number[] | null; label?: [string, string]; sourceA?: ReplayContext | null; sourceB?: ReplayContext | null };
  notes: Record<string, string>;
  reviews?: ReviewRecord[];
  candidateReview?: {
    shortlist: string[];
    decisions: Record<string, { status: "open" | "keep" | "dismiss"; note: string }>;
    views?: {
      id: string;
      name: string;
      filters: {
        run: string; query: string; sort: string; status: string;
        opponent: string; decision?: string; shortlistOnly: boolean;
      };
    }[];
  };
  updated: number;
};

export type Backup = {
  format: "robocon-browser";
  version: 2;
  search: StoredSearch;
  workspace: Workspace | null;
};

type Def<P, R> = { params: P; result: R };
export interface Queries {
  "model.get": Def<void, Model>;
  "config.validate": Def<{ config: unknown }, Config>;
  "search.list": Def<void, Search[]>;
  "search.get": Def<{ search: string }, Search>;
  "search.export": Def<{ search: string }, Backup>;
  "candidate.analysis": Def<{ search: string; run: number; candidate: string }, CandidateAnalysis>;
  "candidate.instructions": Def<
    { search: string; run: number; candidate: string; opponent?: string },
    CandidateInstructions
  >;
  "graph.page": Def<
    { search: string; run: number; offset: number; limit?: number },
    Graph
  >;
  "graph.locate": Def<{ search: string; node: number }, { run: number; offset: number }>;
  "node.get": Def<{ search: string; node: number }, Detail>;
  "path.toNode": Def<{ search: string; node: number }, number[]>;
  "replay.get": Def<{ search: string; edges: number[] }, Replay>;
  "analysis.match": Def<{ search: string; edges: number[] }, MatchAnalysis>;
  "workspace.get": Def<{ search: string }, Workspace>;
}
export interface Commands {
  "search.create": Def<{ config: Config }, Search>;
  "search.import": Def<{ backup: unknown }, Search>;
  "search.duplicate": Def<{ search: string; name?: string }, Search>;
  "search.rename": Def<{ search: string; name: string }, Search>;
  "search.delete": Def<{ search: string }, null>;
  "run.ensure": Def<{ search: string; index: number }, Search>;
  "node.step": Def<
    { search: string; node: number; red: Action[]; blue: Action[] },
    { edges: number[] }
  >;
  "job.start": Def<{ search: string; kind: JobKind } & JobOptions, Search>;
  "job.pause": Def<{ search: string; target?: CandidateAnalysisTarget }, Search>;
  "workspace.put": Def<{ search: string; workspace: Workspace }, Workspace>;
}
export type Methods = Queries & Commands;
export type Method = keyof Methods;
export type Params<M extends Method> = Methods[M]["params"];
export type Result<M extends Method> = Methods[M]["result"];

export type EngineEvent =
  | { type: "search.changed"; search: Search }
  | { type: "search.removed"; id: string }
  | { type: "job.finished"; search: string; kind: JobKind; reason: string; target?: CandidateAnalysisTarget };

export type RequestMessage = { id: number; method: Method; params: unknown };
export type WorkerMessage =
  | { id: number; result: unknown }
  | { id: number; error: string }
  | { event: EngineEvent };

export const QUERY_METHODS = new Set<Method>([
  "model.get",
  "config.validate",
  "search.list",
  "search.get",
  "search.export",
  "candidate.instructions",
  "candidate.analysis",
  "graph.page",
  "graph.locate",
  "node.get",
  "path.toNode",
  "replay.get",
  "analysis.match",
  "workspace.get",
]);

export const emptyWorkspace = (id: string): Workspace => ({
  id,
  markers: [],
  bookmarks: [],
  pins: [],
  ab: { a: null, b: null },
  notes: {},
  reviews: [],
  updated: 0,
});

/** Saved source of a replay or fixed comparison path. */
export type ReplayContext = {
  search: string;
  run: number;
  candidate: string;
  /** Stable evidence key, not a changing ranking such as "worst". */
  evidence: string;
  label: string;
  opponent?: string;
  node: number;
  path: number[];
};
