export type Action = {
  kind: string;
  dest?: string;
  edge?: number;
  spot?: number;
  objects?: number[];
  seconds?: number;
  partner?: number;
};
export type Job = { action: Action; start: number; end: number; from: string };
export type State = {
  t: number;
  robots: { pos: string; job: Job | null; entered: boolean; waited: boolean }[];
  objects: Obj[];
  mandate: boolean[];
  ever: number[][];
  transfer: number[];
};
export type Obj = {
  id: number;
  kind: string;
  loc: string;
  owner: number;
  face: number;
  slot: number;
  layer: number;
  delivered: boolean[];
  p?: number[];
};
export type Frame = {
  t: number;
  scores: number[];
  robots: {
    id: string;
    team: number;
    role: string;
    p: number[];
    state: string;
    location: string;
    action: Action | null;
    carry: string[];
  }[];
  objects: Obj[];
  mandate: boolean[];
};
export type Variant = {
  teams: {
    caps: Record<string, boolean | number>;
    speeds: Record<string, number>;
  }[];
  start: number;
  layout: string;
};
export type Config = {
  root?: State;
  version: string;
  name: string;
  scenario: string;
  horizon: number;
  rules: Record<string, string | boolean>;
  profiles: Record<string, number[]>;
  teams: {
    caps: Record<string, (boolean | number)[]>;
    speeds: Record<string, number[]>;
  }[];
  starts: number[];
  layouts: string[];
};
export type Strategy = {
  id: string;
  prefix: string[][];
  groups: number;
  paths: string;
  groupWinFraction: number;
  pathWinFraction: number;
  unresolvedFraction: number;
  distribution: [number, number][];
  scores: { red: number; blue: number; count: string }[];
  node: number;
};
export type Evaluation = {
  classification: string;
  cut: number | null;
  meaning: string;
  runs: {
    run: number;
    variant: Variant;
    complete: boolean;
    statisticsComplete: boolean;
    historyLimited: boolean;
    rawGraphPaths: string;
    paths: string;
    groups: number;
    strategies: Strategy[];
    windowEnd: number;
    groupWinFraction: number | null;
    unresolvedFraction: number | null;
    distribution: [number, number][];
    guarantee: null | {
      winLower: number;
      winUpper: number;
      marginLower: number;
      meaning: string;
      actions: Action[][];
      probabilities: number[];
    };
  }[];
};
export type Search = {
  id: string;
  name: string;
  status: string;
  error: string | null;
  created: number;
  config: Config;
  nodes: number;
  expanded: number;
  edges: number;
  runs: number;
  completeRuns: number;
  totalRuns: string;
  complete: boolean;
  evaluation: Evaluation | null;
  job: "discovery" | "exact" | "evaluation" | null;
  evaluationProgress: EvaluationProgress | null;
  discovery: Discovery | null;
};
export type Model = {
  version: string;
  defaults: Config;
  caps: Record<string, string>;
  profiles: Record<string, string>;
  rules: Record<
    string,
    { options: (string | boolean)[]; label: string; source: string }
  >;
  scope: string[];
  field: {
    nodes: Record<string, { id: string; p: number[] }>;
    edges: unknown[];
  };
};
export type Node = {
  id: number;
  state: State;
  scores: number[];
  winner: number;
  expanded: boolean;
  cursor?: number;
};
export type Edge = {
  id: number;
  run?: number;
  src: number;
  dst: number;
  red?: Action[];
  blue?: Action[];
  events?: { t: number; robot: number; phase: string; action: Action }[];
  cases?: number[];
};
export type Detail = Node & {
  offset: number;
  run: number;
  variant: Variant;
  edges: Edge[];
  actions: Action[][];
  frame: Frame;
  path: number[];
};
export type Graph = {
  nodes: Node[];
  edges: Edge[];
  root: number;
  variant: Variant;
  total: number;
  offset: number;
};
export type Replay = {
  frames: Frame[];
  edges: number[];
  events: { t: number; robot: number; phase: string; action: Action }[];
};

export type Goal = {
  resource?: string;
  amount?: number;
  kind: string;
  spot?: number;
  count?: number;
  at?: number;
  height?: number;
};
export type CandidateEvidence = {
  node: number;
  path: number[];
  scores: number[];
  strategy: string;
  milestones: string[][];
  blocked?: { robot: number; t: number; instruction: number; reason: string }[];
};
export type StrategyPolicy = {
  derivedFrom?: string;
  id: string;
  name: string;
  family: string;
  targets: number[];
  height: number;
  mustika: boolean;
  opportunistic: boolean;
  lateFlip: boolean;
  skyFirst: number;
  requirements: string[];
  conditions: string[];
};
export type Candidate = {
  policy?: StrategyPolicy;
  comparedOpponents?: string[];
  id: string;
  plan: Goal[];
  baseline: CandidateEvidence;
  responses: (CandidateEvidence & {
    kind: string;
    targets?: number[];
    opponent?: string;
    shared?: boolean;
  })[];
  pending: number;
};
export type EvaluationProgress = {
  phase:
    | "loading"
    | "histories"
    | "statistics"
    | "guarantees"
    | "saving"
    | "complete";
  state: "running" | "complete" | "cancelled" | "interrupted" | "error";
  done: number;
  total: number | null;
  run: number | null;
  completedRuns: number;
  totalRuns: number;
  elapsed: number;
};
export type DiscoverySession = {
  seconds: number;
  budget: number;
  reason: string;
  newCandidates: number;
  newStrategies: number;
  responses: number;
  scoreChanges: { run: number; before: number; after: number }[];
};
export type Discovery = {
  elapsed: number;
  scope: string;
  complete: false;
  scopeComplete: boolean;
  stopReason: string | null;
  metrics: {
    candidates: number;
    strategies: number;
    responses: number;
    pending: number;
    frontier: number;
    bestScores: Record<string, number | null>;
  };
  sessions: DiscoverySession[];
  runs: {
    run: number;
    tested: number;
    frontier: number;
    remainingChoices: number;
    scopeComplete: boolean;
    commonOpponents: string[];
    policyOpponents?: Record<string, string>;
    policyComparisonComplete?: boolean;
    policyCommonOpponents?: string[];
    variant: Variant;
    firstCandidateSeconds: number | null;
    candidates: Candidate[];
  }[];
};
