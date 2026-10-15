import type { ActivityNode, JobActivity, JobProgress, EvaluationProgress } from "./types";

export const ACTIVITY_NODE_LIMIT = 48, ACTIVITY_EDGE_LIMIT = 64;
/** A recent working set, not a second graph or an invented traversal. */
export class ActivityTrace {
  private nodes = new Map<string, ActivityNode>();
  private edges: JobActivity["edges"] = [];
  private sequence = 0;
  private lastElapsed = 0;
  private lastUnits = 0;
  units = 0;
  run: number | null = null;
  mode: JobActivity["mode"] = null;
  current: string | null = null;
  constructor(readonly kind: JobActivity["kind"]) {}
  private touch(node: ActivityNode) {
    this.nodes.delete(node.id);
    this.nodes.set(node.id, node);
    while (this.nodes.size > ACTIVITY_NODE_LIMIT) this.nodes.delete(this.nodes.keys().next().value!);
    this.edges = this.edges.filter(e => this.nodes.has(e.src) && this.nodes.has(e.dst));
  }
  visit(node: ActivityNode, mode: JobActivity["mode"] = null) {
    this.touch(node);
    this.current = node.id;
    this.run = node.run;
    this.mode = mode;
    this.units++;
  }
  connect(src: ActivityNode, dst: ActivityNode) {
    this.touch(src); this.touch(dst);
    this.edges = this.edges.filter(e => e.src !== src.id || e.dst !== dst.id);
    this.edges.push({ src: src.id, dst: dst.id });
    this.edges = this.edges.slice(-ACTIVITY_EDGE_LIMIT);
  }
  snapshot(progress: JobProgress, evaluation: EvaluationProgress | null): JobActivity {
    const elapsed = progress.elapsed;
    const units = this.kind === "evaluation" ? evaluation?.done ?? 0 : this.units;
    const unitsPerSecond = this.kind === "evaluation" ? 0 : Math.max(0, units - this.lastUnits) / Math.max(0.001, elapsed - this.lastElapsed);
    this.lastUnits = units; this.lastElapsed = elapsed;
    return { kind: this.kind, phase: progress.phase, sequence: ++this.sequence, elapsed,
      unitsDone: units, unitsPerSecond, run: evaluation?.run ?? this.run, mode: this.mode,
      current: this.current, nodes: [...this.nodes.values()].map(n => ({...n})),
      edges: this.edges.map(e => ({...e})), evaluation: evaluation ? {...evaluation} : null };
  }
}
