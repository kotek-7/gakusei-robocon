import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, type Workspace } from "../engine/protocol";
import { ui, useUI } from "./store";
import { installComparisonSync, updateWorkspace } from "./workspace";

const saved = new Map<string, Workspace>();
class WorkspaceWorker {
  onmessage?: (event: { data: unknown }) => void;
  postMessage({ id, method, params }: { id: number; method: string; params: { search: string; workspace?: Workspace } }) {
    setTimeout(() => {
      if (method === "workspace.put") saved.set(params.search, structuredClone(params.workspace!));
      this.onmessage?.({ data: { id, result: structuredClone(saved.get(params.search) ?? emptyWorkspace(params.search)) } });
    }, 5);
  }
}
Object.assign(globalThis, { Worker: WorkspaceWorker });
const settle = () => new Promise((resolve) => setTimeout(resolve, 80));

test("workspace edits retain rapid comparison and marker updates in their originating search", async () => {
  ui.openSearch("edits");
  const first = updateWorkspace((w) => ({ ...w, ab: { a: [1, 2], b: null, label: ["A1", "B"] } }));
  const second = updateWorkspace((w) => ({ ...w, markers: [{ id: "m", t: 12, name: "反転" }] }));
  ui.openSearch("other");
  await Promise.all([first, second]);
  assert.deepEqual(saved.get("edits")?.ab.a, [1, 2]);
  assert.equal(saved.get("edits")?.markers[0].name, "反転");
  assert.equal(saved.has("other"), false);
});

test("comparison sync restores labels and protects new edits from an in-flight restore", async () => {
  saved.set("restore", { ...emptyWorkspace("restore"), ab: { a: [4], b: [5], label: ["基準", "対応"] } });
  ui.openSearch("restore");
  const stop = installComparisonSync();
  await settle();
  assert.deepEqual(useUI.getState().session.compare, { a: [4], b: [5], label: ["基準", "対応"] });
  ui.patchSession({ compare: { a: [7], b: [8], label: ["新A", "新B"] } });
  ui.openSearch("between");
  ui.openSearch("restore");
  await settle();
  assert.deepEqual(saved.get("restore")?.ab.a, [7]);
  assert.deepEqual(useUI.getState().session.compare.a, [7]);
  saved.set("race", { ...emptyWorkspace("race"), ab: { a: [10], b: [11], label: ["保存A", "保存B"] } });
  ui.openSearch("race");
  ui.patchSession({ compare: { a: [9], b: null, label: ["編集中", "B"] } });
  await settle();
  assert.deepEqual(useUI.getState().session.compare.a, [9]);
  assert.deepEqual(saved.get("race")?.ab.a, [9]);
  assert.deepEqual(useUI.getState().session.compare.b, [11]);
  assert.deepEqual(saved.get("race")?.ab.b, [11]);
  assert.deepEqual(useUI.getState().session.compare.label, ["編集中", "保存B"]);
  assert.deepEqual(saved.get("race")?.ab.label, ["編集中", "保存B"]);
  stop();
});
