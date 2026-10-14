export type CameraState = { position: number[]; target: number[] };
export type DisplayOptions = {
  selection: string | null;
  follow: boolean;
  dim: boolean;
  labels: boolean;
  paths: boolean;
  trails: boolean;
  trailScope: "selected" | "all";
  trailRange: "recent" | "range" | "all";
  range: [number, number] | null;
};
