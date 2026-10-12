import test from "node:test";
import assert from "node:assert/strict";
import { resolveRequest, root } from "../../serve.mjs";
test("preview server confines all requests to dist", () => {
  assert.equal(resolveRequest("/"), root + "index.html");
  for (const url of [
    "/../package.json",
    "/%2e%2e/package.json",
    "/%ZZ",
    "/%00",
  ])
    assert.equal(resolveRequest(url), null);
  assert.equal(resolveRequest("/app.js?v=1"), root + "app.js");
});
