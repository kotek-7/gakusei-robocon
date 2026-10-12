export function createExploration({ createWorker, onChange }) {
  let worker = null,
    results = /* @__PURE__ */ new Map(),
    status = "idle";
  function notify() {
    onChange({ results, status });
  }
  function stop() {
    if (worker) worker.terminate();
    worker = null;
  }
  return {
    get results() {
      return results;
    },
    invalidate() {
      stop();
      results = /* @__PURE__ */ new Map();
      status = "idle";
      notify();
    },
    toggle(enemy, cfg) {
      if (worker) {
        stop();
        status = "stopped";
        notify();
        return;
      }
      results = /* @__PURE__ */ new Map();
      try {
        worker = createWorker();
      } catch {
        status = "error";
        notify();
        return;
      }
      const active = worker;
      status = "running";
      notify();
      worker.onmessage = ({ data }) => {
        if (worker !== active) return;
        results.set(data.id, data.scores);
        if (data.count === data.total) {
          stop();
          status = "complete";
        }
        notify();
      };
      worker.onerror = () => {
        if (worker !== active) return;
        stop();
        status = "error";
        notify();
      };
      worker.postMessage({ enemy, cfg });
    },
    dispose: stop,
  };
}
export function renderExploration(root, { results, status }, total) {
  root.querySelector("#progress").textContent = `${results.size} / ${total}`;
  root.querySelector("progress").value = results.size;
  root.querySelector("#explore").textContent = {
    idle: "全案を計算",
    running: "計算を中止",
    stopped: "全案を再計算",
    complete: "再計算する",
    error: "計算をやり直す",
  }[status];
  root.querySelector("#explorelabel").textContent = {
    idle: "全案を同じ条件で比較",
    running: "全案を計算中",
    stopped: "計算を中止しました",
    complete: "最終得点を表示（赤：青）",
    error: "計算できませんでした",
  }[status];
}
