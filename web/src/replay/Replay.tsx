import type { Run } from "../simulation/types";
export function Replay({
  run,
  time,
  playing,
  onSeek,
  onToggle,
  onSpeed,
}: {
  run: Run;
  time: number;
  playing: boolean;
  onSeek(t: number): void;
  onToggle(): void;
  onSpeed(value: number): void;
}) {
  return (
    <>
      <div className="playbar">
        <button id="reset" title="最初に戻る" onClick={() => onSeek(0)}>
          最初へ
        </button>
        <button id="play" className="primary" onClick={onToggle}>
          {playing ? "一時停止" : "再生"}
        </button>
        <select
          id="speed"
          aria-label="再生速度"
          defaultValue="1"
          onChange={(e) => onSpeed(Number(e.target.value))}
        >
          {[0.5, 1, 2, 4, 8].map((v) => (
            <option key={v} value={v}>
              {v}×
            </option>
          ))}
        </select>
        <span id="timecode">{time.toFixed(1).padStart(5, "0")} / 180.0 s</span>
        <div className="spacer" />
      </div>
      <div className="timeline">
        <div className="timelineheading">
          <span>タイムライン</span>
          <span>0 s</span>
          <span>60 s</span>
          <span>120 s</span>
          <span>180 s</span>
        </div>
        <input
          id="seek"
          type="range"
          min="0"
          max="180"
          step=".5"
          value={time}
          aria-label="試合経過時間"
          onChange={(e) => onSeek(Number(e.target.value))}
        />
        <div id="lanes">
          {["R-TR", "R-BR", "B-TR", "B-BR"].map((id, i) => (
            <div className="lane" key={id}>
              <span>{id}</span>
              <div>
                {run.intervals
                  .filter((v) => v.robot === id)
                  .map((v, n) => (
                    <button
                      key={n}
                      title={`${v.label} / ${v.start.toFixed(1)}秒`}
                      data-time={v.start}
                      onClick={() => onSeek(v.start)}
                      style={{
                        left: `${v.start / 1.8}%`,
                        width: `${Math.min(v.end - v.start, 180 - v.start) / 1.8}%`,
                        background: i < 2 ? "#b96960" : "#567fae",
                      }}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
