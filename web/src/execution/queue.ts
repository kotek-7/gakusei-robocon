import type { Match } from "../study/match";
import type { Job, RunInput, ResultSummary } from "./types";
import { runKey } from "./identity";
export type Executor = { run(input: RunInput): Promise<Match>; cancel(): void };
export class RunQueue {
  jobs: Job[] = [];
  busy = false;
  private epoch = 0;
  constructor(
    private io: {
      executor: Executor;
      saveJobs: (j: Job[]) => Promise<void>;
      saveResult: (j: Job, m: Match) => Promise<ResultSummary>;
      changed: () => void;
      result: (s: ResultSummary) => void;
      error: (s: string) => void;
    },
  ) {}
  restore(jobs: Job[]) {
    if (this.busy) return;
    this.jobs = jobs.map((j) => ({
      ...j,
      status: j.status === "running" ? "queued" : j.status,
    }));
    this.io.changed();
  }
  private async persist(jobs: Job[]) {
    try {
      if (jobs.length) await this.io.saveJobs(jobs);
    } catch {
      this.io.error(
        "実行状況を保存できません。ファイル保存と端末の空き容量を確認してください。",
      );
    }
  }
  async enqueue(inputs: RunInput[], force = false) {
    const shouldStart = !this.busy,
      epoch = this.epoch;
    if (shouldStart) this.busy = true;
    const existing = new Map(this.jobs.map((j) => [j.key, j]));
    const changed: Job[] = [];
    for (const input of inputs) {
      const key = runKey(input),
        old = existing.get(key);
      if (!old) {
        const job: Job = {
          key,
          input: structuredClone(input),
          status: "queued",
        };
        this.jobs.push(job);
        existing.set(key, job);
        changed.push(job);
      } else if (
        force ||
        old.status === "failed" ||
        old.status === "completed"
      ) {
        old.input = structuredClone(input);
        old.status = "queued";
        old.error = undefined;
        changed.push(old);
      }
    }
    this.io.changed();
    await this.persist(changed);
    if (shouldStart && epoch === this.epoch) {
      this.busy = false;
      void this.resume();
    }
  }
  pause() {
    this.epoch++;
    this.busy = false;
    this.io.executor.cancel();
    const changed: Job[] = [];
    this.jobs = this.jobs.map((j) => {
      if (j.status !== "running") return j;
      const next: Job = { ...j, status: "queued" };
      changed.push(next);
      return next;
    });
    this.io.changed();
    void this.persist(changed);
  }
  async retry() {
    const changed: Job[] = [];
    this.jobs = this.jobs.map((j) => {
      if (j.status !== "failed") return j;
      const next: Job = { ...j, status: "queued", error: undefined };
      changed.push(next);
      return next;
    });
    await this.persist(changed);
    void this.resume();
  }
  async resume() {
    if (this.busy) return;
    this.busy = true;
    const epoch = ++this.epoch;
    this.io.changed();
    let cursor = 0;
    while (epoch === this.epoch) {
      while (cursor < this.jobs.length && this.jobs[cursor].status !== "queued")
        cursor++;
      const job = this.jobs[cursor++];
      if (!job) break;
      job.status = "running";
      this.io.changed();
      await this.persist([job]);
      if (epoch !== this.epoch) return;
      try {
        const match = await this.io.executor.run(job.input);
        if (epoch !== this.epoch) return;
        const summary = await this.io.saveResult(job, match);
        if (epoch !== this.epoch) return;
        job.status = "completed";
        job.error = undefined;
        this.io.result(summary);
      } catch (e) {
        if (epoch !== this.epoch) return;
        job.status = "failed";
        job.error = String(e);
      }
      this.io.changed();
      await this.persist([job]);
    }
    if (epoch === this.epoch) {
      this.busy = false;
      this.io.changed();
    }
  }
}
