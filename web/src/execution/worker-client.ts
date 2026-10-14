import type { Executor } from "./queue";
import type { Match } from "../study/match";
export function workerExecutor(): Executor {
  let worker: Worker | null = null,
    reject: ((e: Error) => void) | null = null;
  return {
    run(input) {
      return new Promise<Match>((resolve, fail) => {
        reject = fail;
        worker = new Worker(new URL("../study/worker.ts", import.meta.url), {
          type: "module",
        });
        const finish = () => {
          worker?.terminate();
          worker = null;
          reject = null;
        };
        worker.onmessage = ({ data }) => {
          finish();
          if (data.error) fail(Error(data.error));
          else resolve(data.result);
        };
        worker.onerror = () => {
          finish();
          fail(Error("計算に失敗しました。再実行できます。"));
        };
        worker.postMessage(input);
      });
    },
    cancel() {
      worker?.terminate();
      worker = null;
      reject?.(Error("中断"));
      reject = null;
    },
  };
}
