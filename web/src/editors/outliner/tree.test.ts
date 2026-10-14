import assert from "node:assert/strict";
import test from "node:test";
import { visibleRows } from "./tree";

const rows = [
  { id: "root", label: "作戦候補", depth: 0, open: false },
  { id: "run", label: "構成 C1", depth: 1, open: true },
  { id: "a", label: "Alpha", depth: 2, open: false, pinned: true },
  { id: "a1", label: "対応1", hint: "50:20", depth: 3 },
  { id: "b", label: "Beta", depth: 2, open: true },
  { id: "b1", label: "対応2", depth: 3 },
  { id: "markers", label: "マーカー", depth: 0, open: true },
];
const ids = (q: string, pins = false) => visibleRows(rows, q, pins).map((r) => r.id);
test("search finds folded descendants and preserves ancestor context", () => {
  assert.deepEqual(ids("ALPHA 50"), ["root", "run", "a", "a1"]);
  assert.deepEqual(ids(""), ["root", "markers"]);
});
test("pin filtering includes only pinned subtrees and their ancestors", () => {
  assert.deepEqual(ids("", true), ["root", "run", "a", "a1"]);
  assert.deepEqual(ids("Beta", true), []);
});
test("matching candidates in different runs preserve both branches", () => {
  const duplicateLabels = [
    { id: "root", label: "作戦候補", depth: 0 },
    { id: "run:0", label: "構成 C0", depth: 1 },
    { id: "cand:0:same", label: "Alpha", depth: 2, pinned: true },
    { id: "run:1", label: "構成 C1", depth: 1 },
    { id: "cand:1:same", label: "Alpha", depth: 2 },
  ];
  assert.deepEqual(visibleRows(duplicateLabels, "alpha", false).map((r) => r.id), duplicateLabels.map((r) => r.id));
  assert.deepEqual(visibleRows(duplicateLabels, "", true).map((r) => r.id), ["root", "run:0", "cand:0:same"]);
});
