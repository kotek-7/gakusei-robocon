import test from "node:test";
import assert from "node:assert/strict";
import { createCalculation } from "./calculation";
import type { Request, WorkerPort, Result } from "./protocol";
import { canonicalPlans } from "./navigation";
const plans = canonicalPlans();
const request: Request = {
  type: "catalog",
  plans: plans.slice(0, 2),
  enemy: plans[0],
  cfg: { speed: 1.1, handling: 2.2, success: 1, seed: 42, priority: 0 },
};
function fake() {
  let stopped = false;
  const port: WorkerPort = {
    onmessage: null,
    onerror: null,
    postMessage() {},
    terminate() {
      stopped = true;
    },
  };
  return {
    port,
    get stopped() {
      return stopped;
    },
    emit(data: Result) {
      port.onmessage?.({ data });
    },
  };
}
const result = (count: number): Result => ({
  type: "catalog",
  id: count,
  scores: [10, 20],
  margin: [-5, 5],
  values: [10, 20],
  count,
  total: 2,
});
test("replacement and cancellation ignore stale worker messages", () => {
  const workers: ReturnType<typeof fake>[] = [];
  const c = createCalculation(() => {
    const w = fake();
    workers.push(w);
    return w.port;
  });
  c.start(request);
  c.start(request);
  assert(workers[0].stopped);
  workers[0].emit(result(2));
  assert.equal(c.getSnapshot().results.size, 0);
  workers[1].emit(result(1));
  workers[1].emit(result(2));
  assert.equal(c.getSnapshot().status, "complete");
  assert.equal(c.getSnapshot().results.size, 2);
  assert(workers[1].stopped);
  c.start(request);
  c.stop();
  workers[2].emit(result(2));
  assert.equal(c.getSnapshot().status, "stopped");
  c.dispose();
});
test("worker construction, postMessage, and runtime errors remain retryable", () => {
  let fail = true;
  const w = fake();
  const c = createCalculation(() => {
    if (fail) throw Error("unavailable");
    return w.port;
  });
  c.start(request);
  assert.equal(c.getSnapshot().status, "error");
  fail = false;
  c.start(request);
  w.port.onerror?.({});
  assert.equal(c.getSnapshot().status, "error");
  assert(w.stopped);
  w.port.postMessage = () => {
    throw Error("clone");
  };
  c.start(request);
  assert.equal(c.getSnapshot().status, "error");
});
test("response jobs retain all cases and empty catalog completes without a worker", () => {
  const w = fake(),
    c = createCalculation(() => w.port);
  c.start({ ...request, plans: [] });
  assert.equal(c.getSnapshot().status, "complete");
  c.start({ type: "responses", plan: plans[0], cfg: request.cfg });
  w.emit(result(2));
  assert.equal(c.getSnapshot().status, "running");
  const matches = [
    { enemy: plans[0], ids: [plans[0].id], priority: 0, scores: [100, 50] },
  ];
  w.emit({ type: "responses", count: 297, total: 297, matches });
  assert.deepEqual(c.getSnapshot().matches, matches);
  assert(w.stopped);
  c.reset();
  assert.equal(c.getSnapshot().matches, null);
});
