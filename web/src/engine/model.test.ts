import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { Action } from "../engine/types";
import type { Outcome } from "./transition";
const reference = JSON.parse(
  gunzipSync(
    readFileSync(new URL("./reference.json.gz", import.meta.url)),
  ).toString(),
) as {
  s: State;
  c: Config;
  v: Variant;
  red: Action[];
  blue: Action[];
  legal: Action[][];
  outs: Outcome[];
  scores: number[][];
  frames: unknown[];
}[];
import type { Config, State, Variant } from "../engine/types";
import {
  configAt,
  countConfigs,
  defaults,
  legal,
  scores,
  validateConfig,
  initial,
} from "./model";
import { successors } from "./transition";
import { frame } from "./presentation";
import { key } from "./util";
const rounded = (x: unknown) =>
  JSON.parse(
    JSON.stringify(x, (_, v) =>
      typeof v === "number" ? Math.round(v * 1e9) / 1e9 : v,
    ),
  );
test("129 reference transitions: actions, conflict outcomes, scores and replay match the Python model", () => {
  for (const [i, raw] of reference.entries()) {
    const s = raw.s as State,
      c = raw.c as Config,
      v = raw.v as Variant;
    assert.deepEqual(
      [0, 1, 2, 3].map((r) => legal(s, r, c, v)),
      raw.legal,
      `legal ${i}`,
    );
    const outs = successors(s, raw.red, raw.blue, c, v);
    assert.equal(key(outs), key(raw.outs), `outcomes ${i}`);
    assert.deepEqual(
      outs.map((o) => scores(o.state)),
      raw.scores,
      `scores ${i}`,
    );
    assert.deepEqual(
      rounded(outs.map((o) => frame(o.state))),
      rounded(raw.frames),
      `frames ${i}`,
    );
  }
});
test("configuration and state validation reject malformed imports", () => {
  const c = defaults();
  c.teams[0].speeds.move = [0, 1, 2];
  c.teams[0].speeds.pick = [0, 1, 2];
  assert.equal(countConfigs(c), 9n);
  assert.equal(configAt(c, 8).teams[0].speeds.move, 2);
  c.profiles.move[0] = NaN;
  assert.throws(() => validateConfig(c));
  const custom = defaults();
  custom.scenario = "custom";
  custom.root = initial(defaults(), configAt(defaults(), 0));
  custom.root.objects[1].loc = "robot0";
  custom.teams[0].caps.earth = [true, false];
  assert.throws(() => validateConfig(custom), /積載物/);
});
