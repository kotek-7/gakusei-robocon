import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: {
    app: "src/app.js",
    worker: "src/exploration/worker.js",
    style: "src/style.css",
  },
  bundle: true,
  format: "esm",
  outdir: "dist",
  minify: true,
});
await copyFile("index.html", "dist/index.html");
