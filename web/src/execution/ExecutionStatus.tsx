import type { RunQueue } from "./queue";
export function ExecutionStatus({
  queue,
  ready,
}: {
  queue: RunQueue;
  ready: boolean;
}) {
  const counts = { queued: 0, running: 0, completed: 0, failed: 0 };
  for (const job of queue.jobs) counts[job.status]++;
  return (
    <details className="execution-status">
      <summary>
        {!ready
          ? "保存結果を読込中"
          : queue.busy
            ? `計算中 · 完了 ${counts.completed} · 残り ${counts.queued + counts.running}`
            : `実行一覧 · 完了 ${counts.completed}${counts.queued ? ` · 中断 ${counts.queued}` : ""}${counts.failed ? ` · 失敗 ${counts.failed}` : ""}`}
      </summary>
      <div className="toolbar">
        {queue.busy ? (
          <button onClick={() => queue.pause()}>一時停止</button>
        ) : (
          <button
            disabled={!ready || !counts.queued}
            onClick={() => void queue.resume()}
          >
            続きから計算
          </button>
        )}
        <button
          disabled={queue.busy || !counts.failed}
          onClick={() => void queue.retry()}
        >
          失敗した試合を再実行
        </button>
      </div>
      <div className="event-list">
        <table>
          <caption>実行時の作戦・条件</caption>
          <thead>
            <tr>
              <th>条件・対戦</th>
              <th>優先側</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {queue.jobs.map((j) => (
              <tr key={j.key}>
                <td>
                  {j.input.conditionName} · {j.input.red.name} 対{" "}
                  {j.input.blue.name}
                  {j.error && <small>{j.error}</small>}
                </td>
                <td>{j.input.priority === "red" ? "赤" : "青"}</td>
                <td>
                  {
                    {
                      queued: "待機",
                      running: "計算中",
                      completed: "完了",
                      failed: "失敗",
                    }[j.status]
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!queue.jobs.length && (
          <p>比較を始めると、進み具合をここで確認できます。</p>
        )}
      </div>
    </details>
  );
}
