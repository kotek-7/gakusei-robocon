import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const root = fileURLToPath(new URL("./dist/", import.meta.url));
export function resolveRequest(url) {
  let name;
  try {
    name = decodeURIComponent(url.split("?")[0]);
  } catch {
    return null;
  }
  if (name.includes("\0")) return null;
  const file = path.resolve(
    root,
    "." + name + (name.endsWith("/") ? "index.html" : ""),
  );
  return file.startsWith(root) ? file : null;
}
export function createServer() {
  return http.createServer(async (req, res) => {
    const file = resolveRequest(req.url);
    if (!file) {
      res.writeHead(400);
      res.end("Bad request");
      return;
    }
    try {
      const data = await fs.readFile(file);
      const type =
        {
          ".js": "application/javascript",
          ".css": "text/css",
          ".html": "text/html",
          ".json": "application/json",
          ".png": "image/png",
        }[path.extname(file)] || "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": type,
        "X-Content-Type-Options": "nosniff",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  createServer().listen(Number(process.env.PORT || 4173), "127.0.0.1");
