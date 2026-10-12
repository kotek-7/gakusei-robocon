import type { Run, Frame, Performance } from "../simulation/types";
import { title, modes, ends, supplies } from "../catalog/plans";
export function Conditions({
  run,
  frame,
  time,
  onPerformance,
  onOpponent,
  onSeek,
}: {
  run: Run;
  frame: Frame;
  time: number;
  onPerformance(key: keyof Performance, value: number): void;
  onOpponent(key: string): void;
  onSeek(value: number): void;
}) {
  const { plan, cfg } = run,
    past = run.events.filter((e) => e.t <= time);
  return (
    <aside className="inspector">
      <div className="paneltitle">
        作戦と性能 <span>赤チーム</span>
      </div>
      <section className="selection">
        <h2>
          <span id="strategyname">{title(plan)}</span>{" "}
          <small id="strategyid">作戦 {String(plan.id).padStart(3, "0")}</small>
        </h2>
        <div id="tags">
          <span>{modes[plan.mode]}</span>
          <span>
            {plan.mission ? "ムスティカ設置あり" : "ムスティカ設置なし"}
          </span>
        </div>
        <p id="description">
          搬送：{supplies[plan.supply]}。終盤：{ends[plan.end]}。
          {plan.mission
            ? "設置条件を満たしたら、ムスティカを中央柱へ運びます。"
            : "ムスティカは設置しません。"}
        </p>
      </section>
      <section>
        <h3>実行条件</h3>
        <label>
          相手の作戦
          <select
            id="opponent"
            defaultValue="upper"
            onChange={(e) => onOpponent(e.target.value)}
          >
            <option value="upper">L2 → L1自陣・ムスティカ設置</option>
            <option value="shared">L1共有 → L1自陣・ムスティカ設置</option>
            <option value="flip">L1共有 → L2・裏返しとムスティカ設置</option>
          </select>
        </label>
        <label>
          移動速度 <output id="speedvalue">{cfg.speed.toFixed(1)} m/s</output>
          <input
            id="velocity"
            type="range"
            min=".3"
            max="2.5"
            step=".1"
            value={cfg.speed}
            onChange={(e) => onPerformance("speed", Number(e.target.value))}
          />
        </label>
        <label>
          把持・設置などの動作時間{" "}
          <output id="handlingvalue">{cfg.handling.toFixed(1)} s</output>
          <input
            id="handling"
            type="range"
            min=".5"
            max="6"
            step=".1"
            value={cfg.handling}
            onChange={(e) => onPerformance("handling", Number(e.target.value))}
          />
        </label>
        <label>
          動作成功率{" "}
          <output id="successvalue">{Math.round(cfg.success * 100)} %</output>
          <input
            id="success"
            type="range"
            min=".5"
            max="1"
            step=".05"
            value={cfg.success}
            onChange={(e) => onPerformance("success", Number(e.target.value))}
          />
        </label>
        <label>
          同時競合の優先順
          <select
            id="priority"
            value={cfg.priority}
            onChange={(e) => onPerformance("priority", Number(e.target.value))}
          >
            <option value="0">赤を先に処理</option>
            <option value="1">青を先に処理</option>
          </select>
        </label>
        <p className="note">
          両チームに同じ性能を適用。変更すると再計算します。
        </p>
      </section>
      <section>
        <h3>現在の状態</h3>
        <div id="robotstates">
          {frame.robots.map((r) => (
            <div className="robotstate" key={r.id}>
              <b className={r.team ? "blue" : "red"}>{r.id}</b>
              <span>{r.state}</span>
              <small>
                積載 {r.carry.length} / {r.role === "TR" ? 3 : 2}
              </small>
            </div>
          ))}
        </div>
        <div id="inventory">
          <div className="inventory">
            <span>赤チーム・受け渡しエリアの在庫</span>
            <b>
              土台 {frame.teams[0].bufferE}　上段ブロック{" "}
              {frame.teams[0].bufferS}
            </b>
          </div>
        </div>
      </section>
      <section className="eventsection">
        <h3>
          イベント <span id="eventcount">{past.length}件</span>
        </h3>
        <div id="events">
          {past.length ? (
            past
              .slice(-8)
              .reverse()
              .map((e, i) => (
                <button
                  key={`${e.t}/${i}`}
                  data-time={e.t}
                  onClick={() => onSeek(e.t)}
                >
                  <time>{e.t.toFixed(1)}</time>
                  <span>
                    <b className={e.team ? "blue" : "red"}>{e.robot}</b>{" "}
                    {e.label}
                  </span>
                </button>
              ))
          ) : (
            <p className="empty">この時刻までのイベントはありません。</p>
          )}
        </div>
      </section>
    </aside>
  );
}
