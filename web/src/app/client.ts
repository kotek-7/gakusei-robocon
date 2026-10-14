/** Typed RPC to the computation Worker plus its pushed events. No network. */
import type {
  EngineEvent,
  Method,
  Params,
  Result,
  WorkerMessage,
} from "../engine/protocol";

let worker: Worker | undefined,
  serial = 0;
const pending = new Map<
  number,
  { resolve: (v: unknown) => void; reject: (e: Error) => void }
>();
const listeners = new Set<(e: EngineEvent) => void>();

function connection() {
  if (worker) return worker;
  worker = new Worker(new URL("../engine/worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = ({ data }: { data: WorkerMessage }) => {
    if ("event" in data) {
      for (const l of listeners) l(data.event);
      return;
    }
    const p = pending.get(data.id);
    if (!p) return;
    pending.delete(data.id);
    if ("error" in data) p.reject(new Error(data.error));
    else p.resolve(data.result);
  };
  worker.onerror = () => {
    for (const p of pending.values())
      p.reject(
        new Error(
          "計算処理が停止しました。再読み込みすると最後の保存地点から再開できます。",
        ),
      );
    pending.clear();
    worker?.terminate();
    worker = undefined;
  };
  return worker;
}

export function call<M extends Method>(
  method: M,
  ...[params, signal]: Params<M> extends void
    ? [params?: undefined, signal?: AbortSignal]
    : [params: Params<M>, signal?: AbortSignal]
): Promise<Result<M>> {
  if (signal?.aborted)
    return Promise.reject(new DOMException("中断しました", "AbortError"));
  return new Promise<Result<M>>((resolve, reject) => {
    const id = ++serial;
    pending.set(id, { resolve: (v) => resolve(v as Result<M>), reject });
    signal?.addEventListener(
      "abort",
      () => {
        if (pending.delete(id))
          reject(new DOMException("中断しました", "AbortError"));
      },
      { once: true },
    );
    connection().postMessage({ id, method, params });
  });
}

export function onEngineEvent(listener: (e: EngineEvent) => void) {
  connection();
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
