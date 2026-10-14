/// <reference lib="webworker" />
import { Runtime } from "./runtime";
import { initSolver } from "./linear";
import wasmURL from "highs/runtime?url";
import { QUERY_METHODS, type RequestMessage, type WorkerMessage } from "./protocol";
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
let subscribed = false;
const post = (message: WorkerMessage) => worker.postMessage(message);
// Queries run as they arrive; commands are serialized so writes keep their order.
// Compute jobs yield independently, so pause and reads stay responsive.
let commands = Promise.resolve();
worker.onmessage = ({ data }: { data: RequestMessage }) => {
  const run = async () => {
    try {
      const app = await initialize();
      if (!subscribed) {
        subscribed = true;
        app.subscribe((event) => post({ event }));
      }
      if (data.method === "job.start" && (data.params as { kind: string }).kind === "evaluation")
        await initSolver(wasmURL);
      const result = await app.call(data.method, data.params as never);
      post({ id: data.id, result });
    } catch (e) {
      post({ id: data.id, error: e instanceof Error ? e.message : String(e) });
    }
  };
  if (QUERY_METHODS.has(data.method)) void run();
  else commands = commands.then(run);
};
