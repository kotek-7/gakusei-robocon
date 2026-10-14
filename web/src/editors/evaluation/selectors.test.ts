import { test } from "node:test";
import assert from "node:assert/strict";
import { configAt, defaults } from "../../engine/model";
import type { Strategy } from "../../engine/types";
import {
  marginRange,
  selectRuns,
  selectStrategies,
  type Result,
} from "./selectors";

const result = (run: number, fields: Partial<Result> = {}): Result => ({
  run,
  variant: configAt(defaults(), 0),
  complete: false,
  statisticsComplete: false,
  historyLimited: false,
  rawGraphPaths: "0",
  paths: "0",
  groups: 0,
  strategies: [],
  windowEnd: 180,
  groupWinFraction: null,
  unresolvedFraction: null,
  distribution: [],
  guarantee: null,
  ...fields,
});
const strategy = (id: string, fields: Partial<Strategy> = {}): Strategy => ({
  id,
  prefix: [],
  groups: 1,
  paths: "1",
  groupWinFraction: 0,
  pathWinFraction: 0,
  unresolvedFraction: 0,
  distribution: [],
  scores: [],
  node: 0,
  ...fields,
});

test("guarantee zero is a result; absent guarantee sorts last and incomplete remains incomplete", () => {
  const rows = [
    result(0),
    result(1, {
      guarantee: {
        winLower: 0,
        winUpper: 0,
        marginLower: -10,
        meaning: "",
        actions: [],
        probabilities: [],
      },
    }),
    result(2, { statisticsComplete: true }),
  ];
  assert.deepEqual(
    selectRuns(rows, "", "all", "guarantee").map((r) => r.run),
    [1, 0, 2],
  );
  assert.deepEqual(
    selectRuns(rows, "", "pending", "id").map((r) => r.run),
    [0, 1],
  );
  assert.deepEqual(
    selectRuns(rows, "C1", "guaranteed", "id").map((r) => r.run),
    [1],
  );
  assert.deepEqual(
    rows.map((r) => r.run),
    [0, 1, 2],
  );
});

test("path sorting preserves exact ordering beyond number precision", () => {
  const rows = [
    strategy("a", { paths: "9007199254740992" }),
    strategy("b", { paths: "9007199254740993" }),
  ];
  assert.deepEqual(
    selectStrategies(rows, "", null, "paths").map((s) => s.id),
    ["b", "a"],
  );
  assert.deepEqual(
    rows.map((s) => s.id),
    ["a", "b"],
  );
});

test("classification, query, and unresolved filters intersect without changing weights", () => {
  const rows = [
    strategy("alpha", { unresolvedFraction: 0.25 }),
    strategy("beta", { unresolvedFraction: 0.5 }),
    strategy("gamma"),
  ];
  assert.deepEqual(
    selectStrategies(rows, "ALP", ["alpha", "gamma"], "id", true),
    [rows[0]],
  );
  assert.deepEqual(selectStrategies(rows, "", [], "id"), []);
  assert.equal(rows[0].unresolvedFraction, 0.25);
});

test("observed margin range ignores zero weight and sorts missing values last", () => {
  assert.deepEqual(
    marginRange([
      [8, 0.4],
      [-9, 0],
      [-3, 0.6],
    ]),
    [-3, 8],
  );
  assert.equal(marginRange([]), null);
  const rows = [
    strategy("empty"),
    strategy("low", { distribution: [[-3, 1]] }),
    strategy("high", { distribution: [[4, 1]] }),
  ];
  assert.deepEqual(
    selectStrategies(rows, "", null, "minimum").map((s) => s.id),
    ["high", "low", "empty"],
  );
});
