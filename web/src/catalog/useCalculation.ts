import { useEffect, useState, useSyncExternalStore } from "react";
import { createCalculation } from "./calculation";
import type { WorkerPort } from "./protocol";
export function useCalculation(createWorker: () => WorkerPort) {
  const [calculation] = useState(() => createCalculation(createWorker));
  const state = useSyncExternalStore(
    calculation.subscribe,
    calculation.getSnapshot,
  );
  useEffect(() => () => calculation.dispose(), [calculation]);
  return { calculation, state };
}
