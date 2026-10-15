import { test } from "node:test";
import assert from "node:assert/strict";
import type { Search, JobProgress } from "../../engine/types";
import { jobSummary } from "./summary";

const progress = (changes: Partial<JobProgress> = {}): JobProgress => ({
  kind: "discovery", phase: "computing", elapsed: 65, secondsLimit: 120,
  unitsDone: 0, unitsLimit: null, savedAt: null, saveState: "unsaved", stopReason: null, ...changes,
});
const search = (changes: Partial<Search> = {}): Search => ({
  job: "discovery", status: "running", error: null, jobProgress: progress(),
  evaluationProgress: null, complete: false, ...changes,
} as Search);

test("pending start takes precedence over previous completion", () => {
  assert.deepEqual(jobSummary(search({ job: null, complete: true }), "evaluation"), {
    label: "評価を準備中", detail: "", active: true,
  });
});
test("discovery reports measured elapsed without claiming coverage", () => {
  assert.equal(jobSummary(search()).detail, "経過 1分5秒");
  assert.equal(jobSummary(search({ job: null, jobProgress: progress({ phase: "finished", stopReason: "time_limit" }) })).label, "候補探索の指定時間終了");
});
test("exact action pairs do not reuse candidate cumulative totals", () => {
  assert.equal(jobSummary(search({ job: "exact", jobProgress: progress({ kind: "exact", unitsDone: 1234 }) })).detail, "経過 1分5秒 · 1,234組処理");
});
test("evaluation phase and completed configurations are shown together", () => {
  const value = jobSummary(search({ job: "evaluation", jobProgress: progress({ kind: "evaluation" }), evaluationProgress: {
    phase: "guarantees", state: "running", done: 1, total: 10, run: 0, completedRuns: 2, totalRuns: 5, elapsed: 4,
  } }));
  assert.equal(value.label, "保証値を計算中");
  assert.equal(value.detail, "経過 1分5秒 · 2/5構成");
});
test("saving and cancellation never claim normal completion", () => {
  assert.equal(jobSummary(search({ jobProgress: progress({ phase: "saving" }) })).label, "候補探索を保存中");
  assert.equal(jobSummary(search(), undefined, true).label, "停止処理中");
  assert.equal(jobSummary(search({ job: null, jobProgress: progress({ phase: "finished", saveState: "error" }) })).label, "保存失敗");
});

test("final save stays active after job has been cleared", () => {
  const value = jobSummary(search({ job: null, status: "paused", jobProgress: progress({ phase: "saving" }) }));
  assert.equal(value.active, true);
  assert.equal(value.label, "候補探索を保存中");
});
