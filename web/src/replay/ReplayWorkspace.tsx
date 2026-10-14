import { useEffect, useMemo, useRef, useState } from "react";
import type { Frame } from "../engine/types";
import type { Event } from "../engine/transition";
import type { Match } from "../study/match";
import type { RunNote } from "../study/state";
import { Viewport, type CameraState } from "../viewport/Viewport";
import { Menu } from "../ui/Menu";
import {
  adjacentTime,
  filteredEvents,
  frameAt,
  scoreTimes,
  uniqueTimes,
} from "./analysis";
import { usePlayback } from "./usePlayback";
import { useReplayLayout } from "./useReplayLayout";
import { Inspector } from "./Inspector";
import { EventPanel, NotesPanel, ScorePanel } from "./Panels";
import "./replay.css";
export type ReplayWorkspaceProps = {
  layoutReset?: number;
  match?: Match;
  baselineMatch?: Match;
  runKey: string;
  label: string;
  baselineLabel?: string;
  initialFrame: Frame;
  notes: RunNote[];
  onNotes: (notes: RunNote[]) => void;
  preferences: { speed: number; labels: boolean; trails: boolean };
  active: boolean;
};
export function ReplayWorkspace({
  layoutReset = 0,
  match,
  baselineMatch,
  runKey,
  label,
  baselineLabel = "基準",
  initialFrame,
  notes,
  onNotes,
  preferences,
  active,
}: ReplayWorkspaceProps) {
  const root = useRef<HTMLElement>(null),
    expandButton = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false),
    [selection, setSelection] = useState<string | null>(null);
  const [camera, setCamera] = useState<CameraState>(),
    [baselineCamera, setBaselineCamera] = useState<CameraState>();
  const [sync, setSync] = useState(true),
    [sideBySide, setSideBySide] = useState(false),
    [source, setSource] = useState<"selected" | "baseline">("selected");
  const { inspector, setInspector, panel, setPanel, width, setWidth } =
    useReplayLayout(layoutReset);
  const resizeStart = useRef<{ x: number; width: number } | null>(null);
  const [onlySelected, setOnlySelected] = useState(false),
    [kind, setKind] = useState("");
  const shown = source === "baseline" && baselineMatch ? baselineMatch : match;
  const end = match?.frames.at(-1)?.t ?? 180;
  const playback = usePlayback(runKey, active, end, preferences.speed);
  const {
    time,
    playing,
    setPlaying,
    speed,
    setSpeed,
    range,
    setRange,
    loop,
    setLoop,
    zoom,
    setZoom,
    seek,
    play,
    clearRange,
  } = playback;
  useEffect(() => {
    setSelection(null);
    setOnlySelected(false);
    setKind("");
    setSource("selected");
  }, [runKey]);
  useEffect(() => {
    if (!baselineMatch) {
      setSource("selected");
      setSideBySide(false);
    }
  }, [baselineMatch]);
  useEffect(() => {
    if (!active) setExpanded(false);
  }, [active]);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.focus();
    const keyboard = (e: KeyboardEvent) => {
      const menu = document.querySelector<HTMLElement>(".command-menu");
      if (e.key === "Escape" && !menu) {
        e.preventDefault();
        setExpanded(false);
        return;
      }
      if (e.key !== "Tab") return;
      const selector =
        'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]';
      const elements = [
        ...Array.from(
          root.current?.querySelectorAll<HTMLElement>(selector) ?? [],
        ),
        ...Array.from(menu?.querySelectorAll<HTMLElement>(selector) ?? []),
      ].filter((el) => el.getClientRects().length > 0);
      const first = elements[0],
        last = elements.at(-1),
        current = document.activeElement;
      if (!first) {
        e.preventDefault();
        return;
      }
      if (
        e.shiftKey &&
        (current === first ||
          current === root.current ||
          !elements.includes(current as HTMLElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (current === last || !elements.includes(current as HTMLElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keyboard);
      queueMicrotask(() => expandButton.current?.focus());
    };
  }, [expanded]);
  const current = frameAt(shown?.frames ?? [], time, initialFrame);
  const baselineFrame =
    baselineMatch && frameAt(baselineMatch.frames, time, initialFrame);
  const allEvents = shown?.events ?? [];
  const events = useMemo(
    () =>
      filteredEvents(allEvents, onlySelected ? selection : null, kind, range),
    [allEvents, onlySelected, selection, kind, range],
  );
  const eventTimes = uniqueTimes(
    filteredEvents(allEvents, selection, kind, range),
  );
  const changes = shown ? scoreTimes(shown) : [],
    differenceChanges =
      match && baselineMatch ? scoreTimes(match, baselineMatch) : [];
  const select = (id: string | null) => {
    setSelection(id);
    setPlaying(false);
    if (!id) setOnlySelected(false);
    else setInspector(true);
  };
  const jump = (times: number[], direction: -1 | 1) => {
    const t = adjacentTime(times, time, direction);
    if (t !== undefined) seek(t);
  };
  const clip = (event: Event) => {
    const from = Math.max(0, event.t - 5),
      to = Math.min(end, event.t + 5);
    seek(from);
    setRange([from, to]);
    setZoom(true);
    setPlaying(true);
    setSelection(`robot:${event.robot}`);
  };
  const setStart = () => {
    const last = range?.[1] ?? end;
    if (time < last) setRange([time, last]);
  };
  const setEnd = () => {
    const first = range?.[0] ?? 0;
    if (time > first) setRange([first, time]);
  };
  const viewportProps = {
    selection,
    onSelect: select,
    range,
    onRelated: () => {
      setPanel("events");
      setOnlySelected(true);
    },
    defaultLabels: preferences.labels,
    defaultTrails: preferences.trails,
  };
  const lower = zoom && range ? range[0] : 0,
    upper = zoom && range ? range[1] : end;
  return (
    <section
      ref={root}
      tabIndex={-1}
      className={`replay-workspace${expanded ? " replay-expanded" : ""}`}
      aria-label="試合再生"
      onKeyDown={(e) => {
        if (
          (e.target as HTMLElement).closest(
            "input,select,textarea,button,summary",
          )
        )
          return;
        if (e.code === "Space" && match) {
          e.preventDefault();
          if (playing) setPlaying(false);
          else play();
        }
      }}
    >
      <header className="replay-heading">
        <div>
          <h2>試合再生</h2>
          <p>{source === "baseline" ? baselineLabel : label}</p>
        </div>
        <button
          ref={expandButton}
          onClick={() => setExpanded(!expanded)}
          aria-pressed={expanded}
        >
          {expanded ? "比較表へ戻る" : "広げる"}
        </button>
      </header>
      <div
        className={`replay-stage${inspector ? " has-inspector" : ""}`}
        style={{ "--inspector-width": `${width}px` } as React.CSSProperties}
      >
        <div
          className={`replay-views${sideBySide && baselineMatch ? " is-paired" : ""}`}
        >
          <div className="replay-view">
            <Viewport
              {...viewportProps}
              frame={current}
              frames={shown?.frames}
              camera={camera}
              onCameraChange={setCamera}
              captureLabel={source === "baseline" ? baselineLabel : label}
            />
          </div>
          {sideBySide && baselineMatch && baselineFrame && (
            <div className="replay-view">
              <p className="replay-pair-label">基準：{baselineLabel}</p>
              <Viewport
                {...viewportProps}
                frame={baselineFrame}
                frames={baselineMatch.frames}
                camera={sync ? camera : baselineCamera}
                onCameraChange={sync ? setCamera : setBaselineCamera}
                captureLabel={baselineLabel}
              />
            </div>
          )}
        </div>
        {inspector && (
          <div
            className="replay-resize"
            role="separator"
            tabIndex={0}
            aria-label="対象の状態の幅"
            aria-orientation="vertical"
            aria-valuemin={180}
            aria-valuemax={400}
            aria-valuenow={width}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                setWidth(width + (e.key === "ArrowLeft" ? 20 : -20));
              }
            }}
            onPointerDown={(e) => {
              resizeStart.current = { x: e.clientX, width };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (resizeStart.current)
                setWidth(
                  resizeStart.current.width + resizeStart.current.x - e.clientX,
                );
            }}
            onPointerUp={() => {
              resizeStart.current = null;
            }}
            onPointerCancel={() => {
              resizeStart.current = null;
            }}
          />
        )}
        {inspector && (
          <aside className="replay-inspector-panel">
            <header>
              <strong>対象の状態</strong>
              <button
                onClick={() => {
                  setInspector(false);
                  Array.from(root.current?.querySelectorAll("summary") ?? [])
                    .find((el) => el.textContent === "対象")
                    ?.focus();
                }}
              >
                閉じる
              </button>
            </header>
            <Inspector
              frame={current}
              selection={selection}
              events={allEvents}
            />
          </aside>
        )}
      </div>
      <div className="replay-controls">
        <button
          disabled={!match}
          onClick={() => (playing ? setPlaying(false) : play())}
        >
          {playing ? "停止" : "再生"}
        </button>
        <label className="replay-time-label">
          <input
            aria-label="再生時刻"
            type="number"
            min={0}
            max={end}
            value={time}
            onChange={(e) => seek(Number(e.target.value))}
          />
          秒
        </label>
        <input
          className="replay-slider"
          aria-label="再生位置"
          type="range"
          min={lower}
          max={upper}
          step={1}
          value={Math.max(lower, Math.min(upper, time))}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <label className="replay-speed-label">
          <span className="sr-only">再生速度</span>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            {[0.5, 1, 2, 5, 10].map((v) => (
              <option key={v} value={v}>
                {v}倍
              </option>
            ))}
          </select>
        </label>
        <Menu label="移動" disabled={!match}>
          <button onClick={() => seek(0)}>先頭へ</button>
          <button onClick={() => seek(end)}>末尾へ</button>
          <button disabled={time === 0} onClick={() => seek(time - 1)}>
            1秒戻る
          </button>
          <button disabled={time === end} onClick={() => seek(time + 1)}>
            1秒進む
          </button>
          <button
            disabled={adjacentTime(eventTimes, time, -1) === undefined}
            onClick={() => jump(eventTimes, -1)}
          >
            前の関連イベント
          </button>
          <button
            disabled={adjacentTime(eventTimes, time, 1) === undefined}
            onClick={() => jump(eventTimes, 1)}
          >
            次の関連イベント
          </button>
          <button
            disabled={adjacentTime(changes, time, -1) === undefined}
            onClick={() => jump(changes, -1)}
          >
            前の得点変化
          </button>
          <button
            disabled={adjacentTime(changes, time, 1) === undefined}
            onClick={() => jump(changes, 1)}
          >
            次の得点変化
          </button>
          {baselineMatch && (
            <>
              <button
                disabled={
                  adjacentTime(differenceChanges, time, -1) === undefined
                }
                onClick={() => jump(differenceChanges, -1)}
              >
                前の基準差の変化
              </button>
              <button
                disabled={
                  adjacentTime(differenceChanges, time, 1) === undefined
                }
                onClick={() => jump(differenceChanges, 1)}
              >
                次の基準差の変化
              </button>
            </>
          )}
        </Menu>
        <Menu label="区間" disabled={!match}>
          <button disabled={time >= (range?.[1] ?? end)} onClick={setStart}>
            ここを開始にする
          </button>
          <button disabled={time <= (range?.[0] ?? 0)} onClick={setEnd}>
            ここを終了にする
          </button>
          <button disabled={!range} onClick={() => setZoom(!zoom)}>
            {zoom ? "全時間を表示" : "区間に表示を合わせる"}
          </button>
          <button
            disabled={!range}
            aria-pressed={loop}
            onClick={() => setLoop(!loop)}
          >
            {loop ? "ループを解除" : "区間をループ"}
          </button>
          <button disabled={!range} onClick={clearRange}>
            区間を解除
          </button>
        </Menu>
        <Menu label="詳細">
          <button
            aria-pressed={inspector}
            onClick={() => setInspector(!inspector)}
          >
            対象の状態
          </button>
          <button
            disabled={!match}
            aria-pressed={panel === "events"}
            onClick={() => setPanel(panel === "events" ? "" : "events")}
          >
            操作履歴
          </button>
          <button
            disabled={!match}
            aria-pressed={panel === "scores"}
            onClick={() => setPanel(panel === "scores" ? "" : "scores")}
          >
            得点推移
          </button>
          <button
            disabled={!match}
            aria-pressed={panel === "notes"}
            onClick={() => setPanel(panel === "notes" ? "" : "notes")}
          >
            場面メモ
          </button>
        </Menu>
        {baselineMatch && (
          <Menu label="基準と比較">
            <button
              aria-pressed={source === "selected"}
              onClick={() => {
                setSource("selected");
                setSideBySide(false);
              }}
            >
              選択した試合
            </button>
            <button
              aria-pressed={source === "baseline"}
              onClick={() => {
                setSource("baseline");
                setSideBySide(false);
              }}
            >
              基準の試合
            </button>
            <button
              aria-pressed={sideBySide}
              onClick={() => {
                setSource("selected");
                setSideBySide(!sideBySide);
                if (!sideBySide) setExpanded(true);
              }}
            >
              左右に並べる
            </button>
            <button
              disabled={!sideBySide}
              aria-pressed={sync}
              onClick={() => {
                if (sync) setBaselineCamera(camera);
                setSync(!sync);
              }}
            >
              {sync ? "視点の同期を解除" : "視点を同期"}
            </button>
          </Menu>
        )}
      </div>
      {(range || loop || onlySelected || kind) && (
        <div className="replay-status">
          {range && (
            <>
              <span>
                {range[0]}–{range[1]}秒{loop ? " · ループ" : ""}
              </span>
              <button onClick={clearRange}>区間解除</button>
            </>
          )}
          {(onlySelected || kind) && (
            <>
              <span>履歴を絞り込み中</span>
              <button
                onClick={() => {
                  setOnlySelected(false);
                  setKind("");
                }}
              >
                絞り込み解除
              </button>
            </>
          )}
        </div>
      )}
      {panel && (
        <div className="replay-detail">
          <header>
            <strong>
              {
                { events: "操作履歴", scores: "得点推移", notes: "場面メモ" }[
                  panel
                ]
              }
            </strong>
            <button onClick={() => setPanel("")}>閉じる</button>
          </header>
          {panel === "events" && (
            <EventPanel
              label={source === "baseline" ? baselineLabel : label}
              events={events}
              allEvents={allEvents}
              selection={selection}
              onlySelected={onlySelected}
              setOnlySelected={setOnlySelected}
              kind={kind}
              setKind={setKind}
              onEvent={(event) => {
                seek(event.t);
                select(`robot:${event.robot}`);
              }}
              onClip={clip}
              clear={() => {
                setOnlySelected(false);
                setKind("");
              }}
              range={range}
            />
          )}
          {panel === "scores" && shown && (
            <ScorePanel
              match={shown}
              baseline={source === "selected" ? baselineMatch : undefined}
              time={time}
              range={range}
              seek={seek}
            />
          )}
          {panel === "notes" &&
            (source === "selected" ? (
              <NotesPanel
                notes={notes}
                runKey={runKey}
                label={label}
                time={time}
                onNotes={onNotes}
                seek={seek}
              />
            ) : (
              <p className="replay-empty">
                メモを残すには「基準と比較」から選択した試合に戻してください。
              </p>
            ))}
        </div>
      )}
      {!match && (
        <p className="replay-empty">計算すると、この試合を再生できます。</p>
      )}
    </section>
  );
}
