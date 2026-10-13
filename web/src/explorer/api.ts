/** Local RPC to the computation Worker. No HTTP API or server process. */
let worker: Worker | undefined,
  serial = 0;
const pending = new Map<
  number,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    cleanup: () => void;
  }
>();
function connection() {
  if (worker) return worker;
  worker = new Worker(new URL("../engine/worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = ({
    data,
  }: {
    data: { id: number; result?: unknown; error?: string };
  }) => {
    const p = pending.get(data.id);
    if (!p) return;
    pending.delete(data.id);
    p.cleanup();
    if (data.error) p.reject(new Error(data.error));
    else p.resolve(data.result);
  };
  worker.onerror = () => {
    for (const p of pending.values()) {
      p.cleanup();
      p.reject(
        new Error(
          "計算処理が停止しました。再読み込みすると最後の保存地点から再開できます。",
        ),
      );
    }
    pending.clear();
    worker?.terminate();
    worker = undefined;
  };
  return worker;
}
export function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted)
    return Promise.reject(new DOMException("中断しました", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const id = ++serial;
    const abort = () => {
      pending.delete(id);
      reject(new DOMException("中断しました", "AbortError"));
    };
    const w = connection();
    pending.set(id, {
      resolve: (value) => resolve(value as T),
      reject,
      cleanup: () => signal?.removeEventListener("abort", abort),
    });
    signal?.addEventListener("abort", abort, { once: true });
    w.postMessage({ id, path, body });
  });
}
export function saveJSON(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
