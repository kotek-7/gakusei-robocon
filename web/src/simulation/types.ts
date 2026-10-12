export type Zone = "P" | "S" | "U";
export type Access = "stairs" | "ramp";
export interface Plan {
  id: number;
  zones: Zone[];
  mode: "build" | "reuse" | "flip";
  mission: boolean;
  supply: "balanced" | "earth" | "sky";
  end: "expand" | "flip" | "late";
  allowedZones?: Zone[];
  access?: { BR: Access; TR: Access };
}
export interface Performance {
  speed: number;
  handling: number;
  success: number;
  seed: number;
  priority: number;
}
export interface RobotFrame {
  id: string;
  team: number;
  role: string;
  p: number[];
  state: string;
  carry: string[];
}
export interface TeamFrame {
  earth: number;
  sky: number;
  bufferE: number;
  bufferS: number;
  transfer: number;
  mandate: boolean;
  ever: number[];
  mustika: boolean;
}
export interface Frame {
  t: number;
  scores: number[];
  robots: RobotFrame[];
  teams: TeamFrame[];
  towers: { earth: number[]; sky: number | null }[];
  groundSky: number;
  groundSkyIds: number[];
  mustika: string | number;
}
export interface MatchEvent {
  t: number;
  robot: string;
  team: number;
  label: string;
}
export interface Interval {
  robot: string;
  start: number;
  end: number;
  label: string;
}
export interface Run {
  modelVersion: string;
  plan: Plan;
  enemy: Plan;
  cfg: Performance;
  frames: Frame[];
  events: MatchEvent[];
  intervals: Interval[];
  scores: number[];
  ranks: number[][];
  winner: number | null;
  mandates: boolean[];
  mustika: string | number;
}
