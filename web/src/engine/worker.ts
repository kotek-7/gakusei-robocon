/// <reference lib="webworker" />
import { Runtime } from "./runtime";
import { initSolver } from "./linear";
import wasmURL from "highs/runtime?url";
const worker = self as unknown as DedicatedWorkerGlobalScope;
let runtime: Promise<Runtime> | undefined;
function initialize(): Promise<Runtime> {
  return (runtime ??= new Promise<Runtime>((resolve, reject) => {
    if (!navigator.locks) {
      reject(
        new Error(
          "このブラウザでは安全に保存できません。HTTPSで最新版のブラウザを使用してください。",
        ),
      );
      return;
    }
    // One owner prevents different tabs from overwriting the same continuation.
    navigator.locks
      .request(
        "robocon-browser-engine",
        { ifAvailable: true },
        async (lock) => {
          if (!lock)
            throw new Error(
              "別のタブで作戦探索を開いています。そのタブを閉じてから再読み込みしてください。",
            );
          const app = new Runtime();
          await app.initialize();
          resolve(app);
          await new Promise(() => {});
        },
      )
      .catch(reject);
  }).catch((e) => {
    runtime = undefined;
    throw e;
  }));
}
// Serialize commands; compute jobs yield independently so pause stays responsive.
let commands = Promise.resolve();
worker.onmessage = ({
  data,
}: {
  data: { id: number; path: string; body?: unknown };
}) => {
  commands = commands.then(async () => {
    try {
      const app = await initialize();
      if (data.path.endsWith("/evaluate")) await initSolver(wasmURL);
      const result = await app.request(data.path, data.body);
      worker.postMessage({ id: data.id, result });
    } catch (e) {
      worker.postMessage({
        id: data.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });
};
