import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import init from "occt-import-js";
const source = new URL("../../rulebook/field-2027.step", import.meta.url);
const bytes = await fs.readFile(source);
const occt = await init();
const result = occt.ReadStepFile(bytes, null);
if (!result.success) throw new Error("STEP import failed");
// STEP: millimetres, Z up. Viewer: metres, Y up. Rotation preserves winding.
const point = ([x, y, z]) => [x / 1000, (z - 1) / 1000, -y / 1000];
const meshes = result.meshes.map((m) => {
  const positions = [];
  for (let i = 0; i < m.attributes.position.array.length; i += 3)
    positions.push(...point(m.attributes.position.array.slice(i, i + 3)));
  return {
    positions,
    indices: m.index.array,
    color: m.color,
    faces: m.brep_faces.map((f) => ({
      first: f.first,
      last: f.last,
      color: f.color || m.color,
    })),
  };
});
const output = {
  source: "field-2027.step",
  sha256: createHash("sha256").update(bytes).digest("hex"),
  coordinates: "metres; x=X, y=Z-1mm, z=-Y",
  meshes,
};
await fs.mkdir(new URL("../src/viewport/generated/", import.meta.url), {
  recursive: true,
});
await fs.writeFile(
  new URL("../src/viewport/generated/field.json", import.meta.url),
  JSON.stringify(output),
);
console.log(
  `Imported ${meshes.length} mesh, ${meshes.reduce((n, m) => n + m.faces.length, 0)} faces. SHA256 ${output.sha256}`,
);
