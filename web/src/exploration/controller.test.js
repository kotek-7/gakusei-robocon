import test from "node:test";
import assert from "node:assert/strict";
import { createExploration } from "./controller.js";
test("invalidating a run ignores stale worker results", () => {
  let workers = [],
    states = [];
  const task = createExploration({
    createWorker() {
      let worker = {
        postMessage() {},
        terminate() {
          this.stopped = true;
        },
      };
      workers.push(worker);
      return worker;
    },
    onChange: (s) => states.push(s),
  });
  task.toggle({}, {});
  workers[0].onmessage({ data: { id: 1, scores: [5, 0], count: 1, total: 2 } });
  assert.equal(task.results.size, 1);
  task.invalidate();
  workers[0].onmessage({ data: { id: 2, scores: [9, 9], count: 2, total: 2 } });
  assert.equal(task.results.size, 0);
  assert.equal(workers[0].stopped, true);
  assert.equal(states.at(-1).status, "idle");
});
test("completion and failure release the worker", () => {
  let worker, status;
  const task = createExploration({
    createWorker: () =>
      (worker = {
        postMessage() {},
        terminate() {
          this.stopped = true;
        },
      }),
    onChange: (s) => (status = s.status),
  });
  task.toggle({}, {});
  worker.onmessage({ data: { id: 1, scores: [0, 0], count: 1, total: 1 } });
  assert.equal(status, "complete");
  assert(worker.stopped);
  task.toggle({}, {});
  worker.onerror();
  assert.equal(status, "error");
  assert(worker.stopped);
});
test("worker construction failure produces a recoverable error state", () => {
  let state;
  const c = createExploration({
    createWorker() {
      throw new Error("unavailable");
    },
    onChange(s) {
      state = s;
    },
  });
  c.toggle({}, {});
  assert.equal(state.status, "error");
  c.invalidate();
  assert.equal(state.status, "idle");
});
