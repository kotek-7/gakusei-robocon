import { useMemo, useState } from "react";
import { register, run } from "../../app/commands";
import "./events.css";
import { layout } from "../../app/layout";
import { useReplay, useSearch } from "../../app/session";
import { ui, useUI } from "../../app/store";
import { Empty } from "../common/Empty";
import { actionName, phaseNames, robotNames } from "../common/labels";
import { defineEditor, type EditorProps } from "../registry";

register({
  id: "events.seek",
  title: "動作の時刻へ移動",
  category: "移動",
  hidden: true,
  run: ({ args }) => {
    const event = args as { t: number; robot: number };
    ui.patchPlayback({ time: event.t, playing: false });
    ui.select(`robot:${event.robot}`);
  },
});

function Header({ area }: EditorProps) {
  const robots = (area.state?.robots as boolean[]) ?? [true, true, true, true];
  const phases = (area.state?.phases as string) ?? "finish";
  return (
    <div className="area-tools">
      <div className="segmented">
        {robotNames.map((n, i) => (
          <button
            key={n}
            className={`tool ${i >> 1 ? "blue-text" : "red-text"}`}
            aria-pressed={robots[i]}
            onClick={() => layout.setAreaState(area.id, { robots: robots.map((v, j) => (j === i ? !v : v)) })}
          >
            {n}
          </button>
        ))}
      </div>
      <select value={phases} aria-label="段階" onChange={(e) => layout.setAreaState(area.id, { phases: e.target.value })}>
        <option value="all">開始・完了・不可</option>
        <option value="finish">完了と不可</option>
        <option value="start">開始のみ</option>
        <option value="blocked">不可のみ</option>
      </select>
    </div>
  );
}

function EventsEditor({ area }: EditorProps) {
  const replay = useReplay().data;
  const search = useSearch();
  const time = useUI((s) => s.playback.time);
  const range = useUI((s) => s.playback.range);
  const selection = useUI((s) => s.session.selection);
  const [scope, setScope] = useState("all");
  const [rangeOnly, setRangeOnly] = useState(false);
  const [q, setQ] = useState("");
  const robots = (area.state?.robots as boolean[]) ?? [true, true, true, true];
  const phases = (area.state?.phases as string) ?? "finish";
  const rows = useMemo(
    () =>
      (replay?.events ?? []).filter(
        (e) =>
          robots[e.robot] &&
          (scope !== "selected" || selection === `robot:${e.robot}`) &&
          (!rangeOnly || !range || (e.t >= range[0] && e.t <= range[1])) &&
          (phases === "all" || e.phase === phases || (phases === "finish" && e.phase === "blocked")) &&
          (!q || actionName(e.action).includes(q) || robotNames[e.robot].includes(q)),
      ),
    [replay, robots, phases, q, scope, selection, rangeOnly, range],
  );
  if (!search) return <Empty title="探索がありません" />;
  if (!replay) return <Empty title="局面を選択すると経路の動作履歴を表示します" />;
  const current = rows.findLastIndex((e) => e.t <= time);
  const previous = rows.findLast((e) => e.t < time - 1e-6);
  const next = rows.find((e) => e.t > time + 1e-6);
  return (
    <div className="editor-scroll events-editor">
      <input className="filter" placeholder="絞り込み（例: 設置、赤BR）" value={q} onChange={(e) => setQ(e.target.value)} aria-label="動作履歴を絞り込み" />
      <div className="event-navigation">
        <button className="tool" aria-pressed={scope === "selected"} onClick={() => setScope(scope === "all" ? "selected" : "all")}>選択機体のみ</button>
        <button className="tool" aria-pressed={rangeOnly} disabled={!range} onClick={() => setRangeOnly(!rangeOnly)}>再生範囲のみ</button>
        <button className="tool" disabled={!rows.length} onClick={() => {
          const csv = [["秒", "機体", "段階", "行動"], ...rows.map((e) => [e.t, robotNames[e.robot], phaseNames[e.phase] || e.phase, actionName(e.action)])]
            .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
          navigator.clipboard.writeText(csv).then(() => ui.toast("表示中の動作履歴をコピーしました")).catch(ui.error);
        }}>CSV</button>
      </div>
      <div className="event-navigation">
        <button className="tool" disabled={!previous} onClick={() => previous && run("events.seek", previous)}>前の動作</button>
        <button className="tool" disabled={!next} onClick={() => next && run("events.seek", next)}>次の動作</button>
        <span className="muted tabular">{rows.length}件</span>
      </div>
      <table className="events-table">
        <thead>
          <tr>
            <th>秒</th>
            <th>機体</th>
            <th>段階</th>
            <th>行動</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => (
            <tr
              key={i}
              className={i === current ? "current" : e.t > time ? "future" : ""}
              onClick={() => {
                run("events.seek", e);
              }}
            >
              <td className="tabular">
                <button
                  className="event-seek"
                  aria-label={`${e.t}秒 ${robotNames[e.robot]} ${actionName(e.action)}へ移動`}
                  onClick={(event) => {
                    event.stopPropagation();
                    run("events.seek", e);
                  }}
                >
                  {e.t}
                </button>
              </td>
              <td className={e.robot >> 1 ? "blue-text" : "red-text"}>{robotNames[e.robot]}</td>
              <td>{phaseNames[e.phase] || e.phase}</td>
              <td>{actionName(e.action)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="muted">{scope === "selected" && !selection?.startsWith("robot:") ? "3Dまたはタイムラインで機体を選択してください" : "該当する動作はありません"}</p>}
    </div>
  );
}
defineEditor({ type: "events", title: "動作履歴", group: "解析", Component: EventsEditor, Header });
