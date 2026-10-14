import test from "node:test";
import assert from "node:assert/strict";
import { RunQueue } from "./queue";
import { createStudy, activeConfig } from "../study/state";
import type { RunInput } from "./types";
const fixture = () => {
  const s = createStudy();
  return {
    config: activeConfig(s),
    red: s.policies[0],
    blue: s.opponents[0],
    priority: "red" as const,
    conditionName: "標準",
  };
};
const tick = () => new Promise((r) => setTimeout(r, 5));
test("one failed job does not stop remaining jobs, retry only reruns failed jobs", async () => {
  let fail = true;
  const calls: string[] = [];
  const q = new RunQueue({
    executor: {
      async run(i) {
        calls.push(i.priority);
        if (fail && i.priority === "red") throw Error("test");
        return {
          red: i.red.id,
          blue: i.blue.id,
          priority: i.priority,
          scores: [0, 0],
          frames: [],
          events: [],
        };
      },
      cancel() {},
    },
    saveJobs: async () => {},
    saveResult: async (j, m) => ({
      key: j.key,
      scores: m.scores,
      completedAt: "now",
    }),
    changed() {},
    result() {},
    error() {},
  });
  const a = fixture();
  await q.enqueue([a, { ...a, priority: "blue" }]);
  while (q.busy) await tick();
  assert.deepEqual(
    q.jobs.map((j) => j.status),
    ["failed", "completed"],
  );
  fail = false;
  await q.retry();
  while (q.busy) await tick();
  assert.deepEqual(calls, ["red", "blue", "red"]);
});
test("pause ignores late worker results and restored running jobs require explicit resume", async () => {
  let resolve: ((m: any) => void) | undefined;
  const results: string[] = [];
  const input: RunInput = fixture();
  const q = new RunQueue({
    executor: {
      run() {
        return new Promise((r) => {
          resolve = r;
        });
      },
      cancel() {},
    },
    saveJobs: async () => {},
    saveResult: async (j, m) => ({
      key: j.key,
      scores: m.scores,
      completedAt: "now",
    }),
    changed() {},
    result: (s) => results.push(s.key),
    error() {},
  });
  await q.enqueue([input]);
  await tick();
  q.pause();
  resolve!({ scores: [10, 20] });
  await tick();
  assert.equal(q.jobs[0].status, "queued");
  assert.equal(results.length, 0);
  q.restore([{ ...q.jobs[0], status: "running" }]);
  assert.equal(q.busy, false);
  assert.equal(q.jobs[0].status, "queued");
});
test("status writes grow linearly with jobs and enqueue can be paused while saving", async () => {
  const writes: number[] = [];
  let release: (() => void) | undefined;
  let started = 0;
  let first = true;
  const q = new RunQueue({
    executor: {
      async run(i) {
        started++;
        return {
          red: i.red.id,
          blue: i.blue.id,
          priority: i.priority,
          scores: [0, 0],
          frames: [],
          events: [],
        };
      },
      cancel() {},
    },
    saveJobs: async (jobs) => {
      writes.push(jobs.length);
      if (first) {
        first = false;
        await new Promise<void>((r) => {
          release = r;
        });
      }
    },
    saveResult: async (j, m) => ({
      key: j.key,
      scores: m.scores,
      completedAt: "now",
    }),
    changed() {},
    result() {},
    error() {},
  });
  const a = fixture();
  const enqueue = q.enqueue([a, { ...a, priority: "blue" }]);
  assert.equal(q.busy, true);
  q.pause();
  release!();
  await enqueue;
  await tick();
  assert.equal(started, 0);
  await q.resume();
  assert.equal(started, 2);
  assert.ok(writes.reduce((a, b) => a + b, 0) <= 6);
  assert.equal(
    q.jobs.every((j) => j.status === "completed"),
    true,
  );
});
