import { useState } from "react";
import type { Match } from "../study/match";
import type { RunNote } from "../study/state";
import type { Event } from "../engine/transition";
import { actionName, robotNames } from "../engine/labels";
import { csv, download } from "../ui/files";
import { frameAt, phaseName } from "./analysis";

export function EventPanel({
  label,
  events,
  allEvents,
  selection,
  onlySelected,
  setOnlySelected,
  kind,
  setKind,
  onEvent,
  onClip,
  clear,
  range,
}: {
  label: string;
  events: Event[];
  allEvents: Event[];
  selection: string | null;
  onlySelected: boolean;
  setOnlySelected: (v: boolean) => void;
  kind: string;
  setKind: (v: string) => void;
  onEvent: (event: Event) => void;
  onClip: (event: Event) => void;
  clear: () => void;
  range: [number, number] | null;
}) {
  return (
    <section className="replay-panel" aria-label="操作履歴">
      <div className="replay-panel-tools">
        <label>
          対象
          <select
            value={onlySelected ? "selected" : "all"}
            onChange={(e) => setOnlySelected(e.target.value === "selected")}
          >
            <option value="all">すべて</option>
            <option value="selected" disabled={!selection}>
              選択対象だけ
            </option>
          </select>
        </label>
        <label>
          動作
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">すべて</option>
            {[...new Set(allEvents.map((e) => e.action.kind))].map((k) => (
              <option key={k} value={k}>
                {actionName({ kind: k })}
              </option>
            ))}
          </select>
        </label>
        <button onClick={clear} disabled={!onlySelected && !kind}>
          絞り込みを解除
        </button>
        <button
          onClick={() =>
            download(
              "操作履歴.csv",
              csv([
                ["試合・条件", "時刻（秒）", "機体", "状態", "動作"],
                ...events.map((e) => [
                  label,
                  e.t,
                  robotNames[e.robot],
                  phaseName(e.phase),
                  actionName(e.action),
                ]),
              ]),
              "text/csv;charset=utf-8",
            )
          }
        >
          CSVを保存
        </button>
        <span>
          {events.length}件{range ? ` · ${range[0]}–${range[1]}秒` : ""}
        </span>
      </div>
      <div className="replay-event-list" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>時刻</th>
              <th>機体</th>
              <th>動作</th>
              <th>状態</th>
              <th>
                <span className="sr-only">周辺再生</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={`${e.t}-${e.robot}-${i}`}>
                <td>
                  <button onClick={() => onEvent(e)}>{e.t}秒</button>
                </td>
                <td>{robotNames[e.robot]}</td>
                <td>{actionName(e.action)}</td>
                <td>{phaseName(e.phase)}</td>
                <td>
                  <button
                    onClick={() => onClip(e)}
                    aria-label={`${e.t}秒の前後5秒を再生`}
                  >
                    前後5秒
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!events.length && (
          <p className="replay-empty">該当する動作はありません。</p>
        )}
      </div>
    </section>
  );
}

export function ScorePanel({
  match,
  baseline,
  time,
  range,
  seek,
}: {
  match: Match;
  baseline?: Match;
  time: number;
  range: [number, number] | null;
  seek: (t: number) => void;
}) {
  const frames = match.frames,
    end = frames.at(-1)!.t,
    max = Math.max(
      1,
      ...frames.flatMap((f) => f.scores),
      ...(baseline?.frames.flatMap((f) => f.scores) ?? []),
    );
  const path = (data: Match, team: number) =>
    data.frames
      .map(
        (f, i) =>
          `${i ? "L" : "M"}${36 + (f.t / end) * 624},${180 - (f.scores[team] / max) * 156}`,
      )
      .join(" ");
  const a = frameAt(frames, range?.[0] ?? 0, frames[0]),
    b = frameAt(frames, range?.[1] ?? time, frames[0]);
  const value = frameAt(frames, time, frames[0]),
    base = baseline && frameAt(baseline.frames, time, baseline.frames[0]);
  return (
    <section className="replay-panel" aria-label="得点推移">
      <p className="replay-chart-legend">
        <span className="red-text">赤 {value.scores[0]}</span>
        <span className="blue-text">青 {value.scores[1]}</span>
        {base && (
          <span>
            基準との差{" "}
            {value.scores[0] -
              value.scores[1] -
              (base.scores[0] - base.scores[1])}
            点 · 破線は基準
          </span>
        )}
      </p>
      <svg
        className="replay-score-chart"
        viewBox="0 0 680 210"
        role="img"
        aria-label={`得点推移。${time}秒、赤${value.scores[0]}点、青${value.scores[1]}点。横軸は秒、縦軸は得点。`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          seek(((((e.clientX - r.left) / r.width) * 680 - 36) / 624) * end);
        }}
      >
        <line
          x1="36"
          x2="660"
          y1="180"
          y2="180"
          stroke="currentColor"
          opacity=".3"
        />
        <line
          x1="36"
          x2="36"
          y1="24"
          y2="180"
          stroke="currentColor"
          opacity=".3"
        />
        <text x="8" y="30">
          {max}
        </text>
        <text x="20" y="184">
          0
        </text>
        <text x="36" y="203">
          0秒
        </text>
        <text x="620" y="203">
          {end}秒
        </text>
        {range && (
          <rect
            x={36 + (range[0] / end) * 624}
            y="24"
            width={((range[1] - range[0]) / end) * 624}
            height="156"
            fill="currentColor"
            opacity=".06"
          />
        )}
        {baseline &&
          [0, 1].map((team) => (
            <path
              key={`b${team}`}
              d={path(baseline, team)}
              stroke={team === 0 ? "#b94035" : "#315cb5"}
              strokeDasharray="5 4"
              fill="none"
              opacity=".5"
            />
          ))}
        {[0, 1].map((team) => (
          <path
            key={team}
            d={path(match, team)}
            stroke={team === 0 ? "#b94035" : "#315cb5"}
            strokeWidth="2"
            fill="none"
          />
        ))}
        <line
          x1={36 + (time / end) * 624}
          x2={36 + (time / end) * 624}
          y1="20"
          y2="184"
          stroke="currentColor"
          strokeWidth="1"
        />
      </svg>
      <p className="replay-chart-legend">
        {a.t}–{b.t}秒の増減：赤 {b.scores[0] - a.scores[0]}点、青{" "}
        {b.scores[1] - a.scores[1]}点
      </p>
    </section>
  );
}

export function NotesPanel({
  notes,
  runKey,
  label,
  time,
  onNotes,
  seek,
}: {
  notes: RunNote[];
  runKey: string;
  label: string;
  time: number;
  onNotes: (notes: RunNote[]) => void;
  seek: (t: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const selected = notes
    .filter((n) => n.runKey === runKey)
    .sort((a, b) => a.t - b.t);
  return (
    <section className="replay-panel" aria-label="場面メモ">
      <form
        className="replay-note-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onNotes([
            ...notes,
            {
              id: crypto.randomUUID(),
              runKey,
              label,
              t: time,
              text: draft.trim(),
            },
          ]);
          setDraft("");
        }}
      >
        <label>
          {time}秒のメモ
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            placeholder="気づいたこと"
          />
        </label>
        <button disabled={!draft.trim()}>追加</button>
      </form>
      {selected.length === 0 && (
        <p className="replay-empty">この試合のメモはありません。</p>
      )}
      {selected.map((note) => (
        <div className="replay-note" key={note.id}>
          <button onClick={() => seek(note.t)}>{note.t}秒</button>
          <input
            key={`${note.id}:${note.text}`}
            aria-label={`${note.t}秒のメモを編集`}
            defaultValue={note.text}
            maxLength={2000}
            onBlur={(e) => {
              const text = e.target.value.trim();
              if (text && text !== note.text)
                onNotes(
                  notes.map((n) => (n.id === note.id ? { ...n, text } : n)),
                );
              else e.target.value = note.text;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          <button
            onClick={() => onNotes(notes.filter((n) => n.id !== note.id))}
          >
            削除
          </button>
        </div>
      ))}
    </section>
  );
}
