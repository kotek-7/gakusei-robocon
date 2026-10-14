import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "./store";
import { defaults, scores } from "./model";
import { DiscoveryEngine } from "./discovery";
import { scoreParts } from "./analysis";

test("match analysis splits scores exactly and derives consistent robot intervals", () => {
  const st = Store.create(defaults()),
    engine = new DiscoveryEngine(st);
  for (let i = 0; i < 4000 && !st.summary().discovery?.runs[0]?.candidates.length; i++)
    engine.tick();
  const candidate = st.summary().discovery!.runs[0].candidates[0];
  assert.ok(candidate, "no candidate found");
  const path = candidate.baseline.path,
    a = st.analysis(path);
  const last = st.node(st.edge(path.at(-1)!).dst).state;
  assert.equal(a.end, last.t);
  for (const sample of a.samples) {
    const node = sample.edge ? st.node(st.edge(sample.edge).dst).state : null;
    if (node)
      assert.deepEqual(
        sample.parts.map((p) => p.total),
        scores(node),
      );
  }
  assert.deepEqual(scoreParts(last).map((p) => p.total), candidate.baseline.scores);
  for (const r of [0, 1, 2, 3]) {
    const own = a.intervals.filter((x) => x.robot === r);
    own.forEach((x, i) => {
      assert.ok(x.start <= x.end && x.end <= a.end);
      if (i) assert.ok(own[i - 1].end <= x.start, "intervals overlap");
    });
  }
  assert.ok(a.markers.some((m) => m.kind === "place"));
  assert.ok(a.markers.every((m, i) => !i || a.markers[i - 1].t <= m.t));
  assert.equal(a.spots.length, 10);
  assert.ok(a.spots.some((s) => s.history.at(-1)!.stack.length > 0));
});
