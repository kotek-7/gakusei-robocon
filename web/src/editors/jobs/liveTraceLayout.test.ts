import assert from "node:assert/strict";
import test from "node:test";
import { tracePoint, traceTime, TRACE_WIDTH } from "./liveTraceLayout";

test("trace coordinates keep model time on a fixed axis and retained nodes stable", () => {
  const node = { id: "d:1:42", node: 42, run: 1, time: 177 };
  assert.equal(tracePoint(node, 174, 180).x, TRACE_WIDTH / 2);
  assert.deepEqual(tracePoint(node, 174, 180), tracePoint({ ...node }, 174, 180));
  assert.equal(tracePoint({ ...node, time: 174 }, 174, 180).x, 20);
  assert.equal(tracePoint({ ...node, time: 180 }, 174, 180).x, TRACE_WIDTH - 20);
  const y = tracePoint(node, 174, 180).y;
  assert.ok(y >= 20 && y <= 126);
});

test("zero range and out-of-range states remain bounded without NaN", () => {
  const node = { id: "e:0:1", node: 1, run: 0, time: 180 };
  assert.equal(tracePoint(node, 180, 180).x, 20);
  assert.equal(tracePoint({ ...node, time: 999 }, 0, 180).x, TRACE_WIDTH - 20);
  assert.equal(tracePoint({ ...node, time: -10 }, 0, 180).x, 20);
  assert.equal(traceTime(177), "177");
  assert.equal(traceTime(177.125), "177.1");
});

test("narrow panel keeps the same time domain without scaling the labels", () => {
  const node = { id: "d:1:42", node: 42, run: 1, time: 177 };
  assert.equal(tracePoint(node, 174, 180, 280).x, 140);
  assert.equal(tracePoint({ ...node, time: 180 }, 174, 180, 280).x, 260);
  assert.equal(tracePoint(node, 174, 180, 280).y, tracePoint(node, 174, 180, 640).y);
});
