import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { Store } from "../src/engine/store";
import { DiscoveryEngine, publicDiscovery } from "../src/engine/discovery";
import { defaults } from "../src/engine/model";
const c = defaults();
c.teams[0].speeds.move = [0];
const st = Store.create(c),
  e = new DiscoveryEngine(st);
const start = performance.now();
for (let i = 0; i < 30000; i++) {
  e.tick();
  if (i % 1000 === 0)
    console.log(i, e.d.runs[0].candidates.length, st.data.nodes.length);
  if (i % 100 === 0 && publicDiscovery(st)?.runs[0].policyComparisonComplete)
    break;
}
assert.ok(
  publicDiscovery(st)?.runs[0].policyComparisonComplete,
  "主要作戦の比較が予算内に完了しませんでした",
);
for (const candidate of e.d.runs[0].candidates) {
  if (!candidate.policy) continue;
  for (const evidence of [candidate.baseline, ...candidate.responses])
    assert.deepEqual(
      st.replay(evidence.path).frames.at(-1)!.scores,
      evidence.scores,
    );
}
const result = {
  config: c,
  discoveryVersion: e.d.version,
  seconds: (performance.now() - start) / 1000,
  complete: publicDiscovery(st)?.runs[0].policyComparisonComplete,
  candidates: e.d.runs[0].candidates
    .filter((a) => a.policy)
    .map((a) => ({
      id: a.id,
      score: a.baseline.scores,
      plan: a.plan,
      responses: a.responses
        .filter((x) => x.opponent?.startsWith("QO-"))
        .map((x) => ({ opponent: x.opponent, score: x.scores })),
    })),
};
writeFileSync(
  "../results/policy-comparison-2026-10-14.json",
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify({
    seconds: result.seconds,
    complete: result.complete,
    candidates: result.candidates.length,
  }),
);
