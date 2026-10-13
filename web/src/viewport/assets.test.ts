import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
test("field mesh provenance and physical scale remain intact", () => {
  const cad = JSON.parse(
    fs.readFileSync(new URL("./generated/field.json", import.meta.url), "utf8"),
  );
  const step = fs.readFileSync(
    new URL("../../../rulebook/field-2027.step", import.meta.url),
  );
  assert.equal(cad.sha256, createHash("sha256").update(step).digest("hex"));
  const positions = cad.meshes.flatMap(
    (m: { positions: number[] }) => m.positions,
  );
  for (const axis of [0, 2]) {
    const a = positions.filter((_: number, i: number) => i % 3 === axis);
    assert.equal(Math.max(...a) - Math.min(...a), 11);
  }
});
