import { capabilities, defaultEstimates, type Estimates } from "./effort";
import type { WorkerPort } from "./protocol";
export function createCatalogWorker(): WorkerPort {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });
  const port: WorkerPort = {
    onmessage: null,
    onerror: null,
    postMessage: (data) => worker.postMessage(data),
    terminate: () => worker.terminate(),
  };
  worker.onmessage = (event) => port.onmessage?.(event);
  worker.onerror = (event) => port.onerror?.(event);
  return port;
}
const key = "strata-effort-v1";
export function loadEstimates(storage: Pick<Storage, "getItem">): Estimates {
  const estimates = defaultEstimates();
  try {
    const saved = JSON.parse(storage.getItem(key) ?? "null");
    for (const c of capabilities)
      if (
        Number.isFinite(saved?.[c.id]) &&
        saved[c.id] >= 0 &&
        saved[c.id] <= 999
      )
        estimates[c.id] = saved[c.id];
  } catch {}
  return estimates;
}
export function saveEstimates(
  storage: Pick<Storage, "setItem">,
  estimates: Estimates,
) {
  try {
    storage.setItem(key, JSON.stringify(estimates));
  } catch {}
}
