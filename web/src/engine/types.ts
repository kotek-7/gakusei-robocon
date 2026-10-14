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
export type Goal = {
  resource?: string;
  amount?: number;
  kind: string;
  spot?: number;
  count?: number;
  at?: number;
  height?: number;
};
export type StrategyPolicy = {
  id: string;
  name: string;
  targets: number[];
  height: number;
  mustika: boolean;
  opportunistic: boolean;
  lateFlip: boolean;
  skyFirst: number;
};
