import test from "node:test";
import assert from "node:assert/strict";
import { loadEstimates, saveEstimates } from "./browser";
import { defaultEstimates } from "./effort";
test("existing estimates format survives loading; invalid fields use defaults", () => {
  const saved = loadEstimates({
    getItem: (key) => {
      assert.equal(key, "strata-effort-v1");
      return JSON.stringify({ base: 0, flip: 12.5, upper: -1, mission: "4" });
    },
  });
  assert.equal(saved.base, 0);
  assert.equal(saved.flip, 12.5);
  assert.equal(saved.upper, defaultEstimates().upper);
  assert.equal(saved.mission, defaultEstimates().mission);
  saveEstimates(
    {
      setItem: (key, value) => {
        assert.equal(key, "strata-effort-v1");
        assert.deepEqual(JSON.parse(value), saved);
      },
    },
    saved,
  );
  assert.deepEqual(
    loadEstimates({ getItem: () => "{broken" }),
    defaultEstimates(),
  );
  assert.doesNotThrow(() =>
    saveEstimates(
      {
        setItem: () => {
          throw Error("quota");
        },
      },
      saved,
    ),
  );
});
