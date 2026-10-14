import { layout } from "../../app/layout";
import { useAnalysis, useSearch } from "../../app/session";
import { ui, useUI } from "../../app/store";
import type { MatchAnalysis, SpotTrack, StackItem } from "../../engine/analysis";
import { Empty } from "../common/Empty";
import { defineEditor, type EditorProps } from "../registry";
import model from "../../engine/model-data.json";

const at = (track: SpotTrack, t: number) => {
  let h = track.history[0];
  for (const x of track.history) if (x.t <= t + 1e-9) h = x;
  return h?.stack ?? [];
};
const stockAt = (a: MatchAnalysis, t: number) => {
  let s = a.stock[0];
  for (const x of a.stock) if (x.t <= t + 1e-9) s = x;
  return s;
};
const ownerName = (o: number) => (o === 0 ? "赤専用" : o === 1 ? "青専用" : "共有");
const itemTeam = (i: StackItem) => (i.kind === "E" ? i.owner : i.kind === "S" ? i.face : i.owner);

function Stack({ stack }: { stack: StackItem[] }) {
  return (
    <div className="stack" aria-label={stack.length ? stack.map((i) => `${i.kind === "E" ? "アース" : "スカイ"}${itemTeam(i) ? "青" : "赤"}`).join("、") : "空"}>
      {[...stack].reverse().map((i) => (
        <span key={i.id} className={`stack-item k-${i.kind} team${itemTeam(i)}`} title={`物体 ${i.id}`}>
          {i.kind === "E" ? "E" : "S"}
        </span>
      ))}
      {!stack.length && <span className="stack-empty">空</span>}
    </div>
  );
}

function Header({ area }: EditorProps) {
  const mode = (area.state?.mode as string) ?? "map";
  return (
    <div className="area-tools segmented">
      {[
        ["map", "配置図"],
        ["list", "一覧"],
      ].map(([v, l]) => (
        <button key={v} className="tool" aria-pressed={mode === v} onClick={() => layout.setAreaState(area.id, { mode: v })}>
          {l}
        </button>
      ))}
    </div>
  );
}

function SpotsEditor({ area }: EditorProps) {
  const a = useAnalysis().data;
  const search = useSearch();
  const time = useUI((s) => s.playback.time);
  const selection = useUI((s) => s.session.selection);
  const mode = (area.state?.mode as string) ?? "map";
  if (!search) return <Empty title="探索がありません" />;
  if (!a) return <Empty title="局面を選択すると建設スポットの状態を表示します" />;
  const sel = selection?.startsWith("spot:") ? Number(selection.slice(5)) : null;
  const selectedTrack = a.spots.find((track) => track.spot === sel);
  const previous = selectedTrack?.history.slice(1).findLast((entry) => entry.t < time - 1e-6);
  const next = selectedTrack?.history.slice(1).find((entry) => entry.t > time + 1e-6);
  const stock = stockAt(a, time);
  const spots = model.spots as number[][];
  const flips = a.markers.filter((m) => m.kind === "flip" && m.t <= time);
  return (
    <div className="editor-scroll spots-editor">
      <div className="stock-line">
        <span className="tabular">{time.toFixed(1)}秒時点</span>
        <span>共有スカイ残り <b className="tabular">{stock.groundSky}</b>/12</span>
        <span>
          保管 <b className="red-text tabular">{stock.store[0]}</b> / <b className="blue-text tabular">{stock.store[1]}</b>
        </span>
        <span>
          受け渡し床 <b className="red-text tabular">{stock.buffer[0]}</b> / <b className="blue-text tabular">{stock.buffer[1]}</b>
        </span>
        <span>反転 {flips.length}回</span>
      </div>
      {mode === "map" ? (
        <div className="spot-map" role="group" aria-label="建設スポットの配置（上から見た図、左が赤）">
          <div className="spot-map-l2" />
          {a.spots.map((track) => {
            const s = spots[track.spot];
            const stack = at(track, time);
            return (
              <button
                key={track.spot}
                className={`spot-cell owner${track.owner}${sel === track.spot ? " selected" : ""}`}
                style={{ left: `${50 + (s[0] / 7) * 50}%`, top: `${50 + (s[2] / 7) * 50}%` }}
                onClick={() => ui.select(`spot:${track.spot}`)}
                onPointerEnter={() => ui.hover(`spot:${track.spot}`)}
                onPointerLeave={() => ui.hover(null)}
                title={`スポット ${track.spot}・L${track.level}・${ownerName(track.owner)}`}
              >
                <span className="spot-name">S{track.spot}{track.level === 2 ? " L2" : ""}</span>
                <Stack stack={stack} />
              </button>
            );
          })}
        </div>
      ) : (
        <table className="spot-table">
          <thead>
            <tr>
              <th>スポット</th>
              <th>種類</th>
              <th>現在</th>
              <th>現在までの変化</th>
            </tr>
          </thead>
          <tbody>
            {a.spots.map((track) => (
              <tr key={track.spot} aria-selected={sel === track.spot} onClick={() => ui.select(`spot:${track.spot}`)}>
                <th>S{track.spot}</th>
                <td>L{track.level}・{ownerName(track.owner)}</td>
                <td><Stack stack={at(track, time)} /></td>
                <td className="tabular">{Math.max(0, track.history.filter((h) => h.t <= time).length - 1)}回</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {selectedTrack && (
        <section className="spot-history">
          <h3>S{sel} の履歴</h3>
          <div className="area-tools">
            <button className="tool" disabled={!previous} onClick={() => previous && ui.patchPlayback({ time: previous.t, playing: false })}>前の変化</button>
            <button className="tool" disabled={!next} onClick={() => next && ui.patchPlayback({ time: next.t, playing: false })}>次の変化</button>
          </div>
          <ol>
            {selectedTrack.history.map((h, i) => (
              <li key={i}>
                <button className="link tabular" onClick={() => ui.patchPlayback({ time: h.t, playing: false })}>
                  {h.t}秒
                </button>
                <Stack stack={h.stack} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
defineEditor({ type: "spots", title: "建設スポット", group: "解析", Component: SpotsEditor, Header });
