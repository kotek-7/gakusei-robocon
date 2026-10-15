import { Icon } from "../../shell/icons";
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
      <button className="tool" title="動作履歴の対象を選ぶ" aria-label="動作履歴の対象を選ぶ" aria-haspopup="menu" onClick={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        useUI.setState({ menu: { x: rect.left, y: rect.bottom + 2, items: [
          ...robotNames.map((name, i) => ({ label: name, checked: robots[i], run: () => layout.setAreaState(area.id, { robots: robots.map((v, j) => j === i ? !v : v) }) })),
          { separator: true },
          { label: "選択機体のみ", checked: area.state?.scope === "selected", run: () => layout.setAreaState(area.id, { scope: area.state?.scope === "selected" ? "all" : "selected" }) },
          { label: "再生範囲のみ", checked: !!area.state?.rangeOnly, disabled: !useUI.getState().playback.range, run: () => layout.setAreaState(area.id, { rangeOnly: !area.state?.rangeOnly }) },
          { separator: true },
          { label: "絞り込みを解除", run: () => layout.setAreaState(area.id, { robots: [true, true, true, true], scope: "all", rangeOnly: false }) },
        ] } });
      }}><Icon name="filter" />{area.state?.scope === "selected" ? "選択機体" : `${robots.filter(Boolean).length}機体`}{area.state?.rangeOnly ? "・区間内" : ""}</button>
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
  const scope = area.state?.scope ?? "all";
  const rangeOnly = !!area.state?.rangeOnly;
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
      <div className="event-navigation event-filterbar">
      <input className="filter" placeholder="絞り込み（例: 設置、赤BR）" value={q} onChange={(e) => setQ(e.target.value)} aria-label="動作履歴を絞り込み" />
        <button className="tool icon-only" title="表示中の履歴をCSVでコピー" aria-label="表示中の履歴をCSVでコピー" disabled={!rows.length} onClick={() => {
          const csv = [["秒", "機体", "段階", "行動"], ...rows.map((e) => [e.t, robotNames[e.robot], phaseNames[e.phase] || e.phase, actionName(e.action)])]
            .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
          navigator.clipboard.writeText(csv).then(() => ui.toast("表示中の動作履歴をコピーしました")).catch(ui.error);
        }}><Icon name="copy" /></button>
        <button className="tool icon-only" title="前の動作へ" aria-label="前の動作へ" disabled={!previous} onClick={() => previous && run("events.seek", previous)}><Icon name="prevEvent" /></button>
        <button className="tool icon-only" title="次の動作へ" aria-label="次の動作へ" disabled={!next} onClick={() => next && run("events.seek", next)}><Icon name="nextEvent" /></button>
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
