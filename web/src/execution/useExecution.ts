import { useEffect, useRef, useState } from "react";
import {
  loadJobs,
  loadSummaries,
  migrateResults,
  saveJobs,
  saveResult,
} from "../study/persistence";
import { RunQueue } from "./queue";
import { workerExecutor } from "./worker-client";
import type { ResultSummary } from "./types";
export function useExecution() {
  const [summaries, setSummaries] = useState<Record<string, ResultSummary>>({}),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [, render] = useState(0),
    ref = useRef<RunQueue | null>(null);
  if (!ref.current)
    ref.current = new RunQueue({
      executor: workerExecutor(),
      saveJobs,
      saveResult,
      changed: () => render((n) => n + 1),
      result: (s) => setSummaries((v) => ({ ...v, [s.key]: s })),
      error: setError,
    });
  const queue = ref.current;
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        await migrateResults();
        const [s, j] = await Promise.all([loadSummaries(), loadJobs()]);
        if (live) {
          setSummaries(s);
          queue.restore(j);
        }
      } catch {
        if (live) setError("保存結果を読み込めません。再計算はできます。");
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => {
      live = false;
      queue.pause();
    };
  }, [queue]);
  return { summaries, ready, error, queue };
}
