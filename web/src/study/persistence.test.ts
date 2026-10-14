import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { createStudy } from "./state";
import { saveMatch, loadMatches, matchKey } from "./persistence";
import type { Match } from "./match";
test("saved completed matches restore only for identical study conditions", async () => {
  const study = createStudy();
  const match: Match = {
    red: study.policies[0].id,
    blue: study.opponents[0].id,
    priority: "red",
    scores: [10, 20],
    events: [],
    frames: [],
  };
  await saveMatch(study, match);
  assert.deepEqual(
    (await loadMatches(study))[matchKey(match.red, match.blue, match.priority)],
    match,
  );
  const changed = structuredClone(study);
  changed.config.teams[0].speeds.move = [0];
  assert.deepEqual(await loadMatches(changed), {});
  changed.config = study.config;
  changed.policies[0].targets.reverse();
  assert.deepEqual(await loadMatches(changed), {});
});
