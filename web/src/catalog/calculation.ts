import type {
  CatalogResult,
  Match,
  Request,
  Result,
  WorkerPort,
} from "./protocol";
export interface CalculationState {
  status: "idle" | "running" | "complete" | "stopped" | "error";
  results: Map<number, CatalogResult>;
  matches: Match[] | null;
  count: number;
  total: number;
}
const empty = (): CalculationState => ({
  status: "idle",
  results: new Map(),
  matches: null,
  count: 0,
  total: 0,
});
/** Owns one computation, including cancellation and messages from superseded workers. */
export function createCalculation(createWorker: () => WorkerPort) {
  let state = empty(),
    worker: WorkerPort | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: CalculationState) => {
    state = next;
    listeners.forEach((fn) => fn());
  };
  function release() {
    const previous = worker;
    worker = null;
    previous?.terminate();
  }
  return {
    getSnapshot: () => state,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    reset() {
      release();
      publish(empty());
    },
    stop() {
      release();
      publish({ ...state, status: "stopped" });
    },
    dispose() {
      release();
      listeners.clear();
    },
    start(request: Request) {
      release();
      const initial = {
        ...empty(),
        total: request.type === "catalog" ? request.plans.length : 297,
      };
      if (initial.total === 0) {
        publish({ ...initial, status: "complete" });
        return;
      }
      let active: WorkerPort;
      try {
        active = createWorker();
        worker = active;
      } catch {
        publish({ ...initial, status: "error" });
        return;
      }
      publish({ ...initial, status: "running" });
      const results = new Map<number, CatalogResult>();
      active.onmessage = ({ data }: { data: Result }) => {
        if (worker !== active || data.type !== request.type) return;
        const complete = data.count === data.total;
        if (data.type === "catalog") results.set(data.id, data);
        if (complete) release();
        publish({
          status: complete ? "complete" : "running",
          results: new Map(results),
          matches: data.type === "responses" ? (data.matches ?? null) : null,
          count: data.count,
          total: data.total,
        });
      };
      const fail = () => {
        if (worker !== active) return;
        release();
        publish({ ...state, status: "error" });
      };
      active.onerror = fail;
      try {
        active.postMessage(request);
      } catch {
        fail();
      }
    },
  };
}
