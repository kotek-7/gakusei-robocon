import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Runtime } from "./runtime";
import { Persistence } from "./persistence";
import { Store } from "./store";
import { defaults } from "./model";
import type { JobActivity } from "./types";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
};
async function bounded(promise: Promise<void>, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { await Promise.race([promise, new Promise<void>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), 10000);
  })]); } finally { clearTimeout(timer); }
}
class DelayedCheckpoint extends Persistence {
  started = deferred();
  release = deferred();
  active = 0;
  maximumActive = 0;
  delayed = false;
  fail = false;
  override async save(st: Store) {
    this.active++;
    this.maximumActive = Math.max(this.maximumActive, this.active);
    try {
      const delay = st.jobProgress?.phase === "computing" && !this.delayed;
      if (delay) this.delayed = true;
      await super.save(st);
      if (delay) {
        this.started.resolve();
        await this.release.promise;
        if (this.fail) throw new Error("periodic checkpoint failed");
      }
    } finally { this.active--; }
  }
}

test("periodic saving allows actual expansions; pause drains it without overlapping final save", async () => {
  const db = new DelayedCheckpoint(crypto.randomUUID()), runtime = new Runtime(db);
  const search = await runtime.call("search.create", { config: defaults() });
  let latest: JobActivity | undefined;
  runtime.subscribe(event => { if (event.type === "job.activity") latest = event.activity; });
  await runtime.call("job.start", { search: search.id, kind: "discovery", seconds: 30 });
  try {
    await bounded(db.started.promise, "periodic save begins");
    const units = latest?.unitsDone ?? 0;
    const advanced = deferred();
    const unsubscribe = runtime.subscribe(event => {
      if (event.type === "job.activity" && event.activity.phase === "computing" && event.activity.unitsDone > units)
        advanced.resolve();
    });
    try { await bounded(advanced.promise, "expansions advance while save is pending"); }
    finally { unsubscribe(); }
    assert.equal((await runtime.get(search.id)).jobProgress?.saveState, "saving");
    let stopped = false;
    const pause = runtime.pause(search.id).then(() => { stopped = true; });
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(stopped, false);
    assert.equal(db.maximumActive, 1);
    db.release.resolve();
    await pause;
    assert.equal(db.maximumActive, 1);
    const st = await runtime.get(search.id), saved = await db.load(search.id);
    assert.deepEqual(saved.data, st.data);
    assert.equal(st.jobProgress?.saveState, "saved");
    await runtime.call("job.start", { search: search.id, kind: "exact", budget: 1 });
    await runtime.wait(search.id);
    assert.deepEqual((await db.load(search.id)).data, st.data);
  } finally {
    db.release.resolve();
    await runtime.pause(search.id);
    await db.close();
  }
});

test("a periodic save failure during cancellation wins over cancelled/success and is retained", async () => {
  const db = new DelayedCheckpoint(crypto.randomUUID()), runtime = new Runtime(db);
  db.fail = true;
  const search = await runtime.call("search.create", { config: defaults() });
  await runtime.call("job.start", { search: search.id, kind: "discovery", seconds: 30 });
  try {
    await bounded(db.started.promise, "periodic save begins");
    const pause = runtime.pause(search.id);
    db.release.resolve();
    await pause;
    const st = await runtime.get(search.id);
    assert.equal(st.data.status, "error");
    assert.equal(st.jobProgress?.stopReason, "error");
    assert.equal(st.jobProgress?.saveState, "error");
    assert.match(st.data.error!, /periodic checkpoint failed/);
    assert.equal(db.maximumActive, 1);
    assert.deepEqual((await db.load(search.id)).data, st.data);
  } finally {
    db.release.resolve();
    await runtime.pause(search.id);
    await db.close();
  }
});

test("periodic checkpoint rejection stops ongoing computation without waiting for the time budget", async () => {
  const db = new DelayedCheckpoint(crypto.randomUUID()), runtime = new Runtime(db);
  db.fail = true;
  const search = await runtime.call("search.create", { config: defaults() });
  await runtime.call("job.start", { search: search.id, kind: "discovery", seconds: 30 });
  try {
    await bounded(db.started.promise, "periodic save begins");
    db.release.resolve();
    await bounded(runtime.wait(search.id), "save failure stops ongoing computation");
    const st = await runtime.get(search.id);
    assert.equal(st.data.status, "error");
    assert.equal(st.data.job, null);
    assert.equal(st.jobProgress?.stopReason, "error");
    assert.equal(st.activity, undefined);
    assert.equal(db.maximumActive, 1);
  } finally {
    db.release.resolve();
    await runtime.pause(search.id);
    await db.close();
  }
});
