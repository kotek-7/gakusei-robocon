import type { Frame } from "../engine/types";
import type { Event } from "../engine/transition";
import { actionName, locationName } from "../engine/labels";
import { actionTiming } from "./analysis";
export function Inspector({
  frame,
  selection,
  events,
}: {
  frame: Frame;
  selection: string | null;
  events: Event[];
}) {
  if (!selection)
    return (
      <p className="replay-empty">3Dまたは対象メニューから選んでください。</p>
    );
  const [kind, value] = selection.split(":"),
    id = Number(value);
  if (kind === "robot") {
    const r = frame.robots[id];
    if (!r) return null;
    const timing = actionTiming(events, id, frame.t);
    return (
      <dl className="replay-inspector">
        <dt>機体</dt>
        <dd>{r.id}</dd>
        <dt>動作</dt>
        <dd>{r.action ? actionName(r.action) : "待機"}</dd>
        <dt>現在地</dt>
        <dd>
          {locationName(r.location)}
          {r.state === "move" ? "から移動中" : ""}
        </dd>
        {r.action?.dest && (
          <>
            <dt>行先</dt>
            <dd>{locationName(r.action.dest)}</dd>
          </>
        )}
        {timing && (
          <>
            <dt>開始・終了</dt>
            <dd>
              {timing.start}秒 →{" "}
              {timing.end === undefined ? "終了未記録" : `${timing.end}秒`}
            </dd>
          </>
        )}
        <dt>保持物</dt>
        <dd>
          {r.carry.length
            ? r.carry
                .map(
                  (k) =>
                    ({ E: "アース", S: "スカイ", M: "ムスティカ" })[k] || k,
                )
                .join("、")
            : "なし"}
        </dd>
      </dl>
    );
  }
  if (kind === "tower") {
    const objects = frame.objects.filter((o) => o.loc === `tower${id}`),
      blocks = objects.filter((o) => o.kind === "E" || o.kind === "S");
    return (
      <dl className="replay-inspector">
        <dt>建設スポット</dt>
        <dd>{locationName(`tower${id}`)}</dd>
        <dt>段数</dt>
        <dd>{blocks.length}</dd>
        <dt>積まれた物</dt>
        <dd>
          {objects.length
            ? objects
                .sort((a, b) => a.layer - b.layer)
                .map(
                  (o) =>
                    `${o.kind === "E" ? "アース" : o.kind === "S" ? "スカイ" : "ムスティカ"} ${o.kind === "M" ? "" : (o.kind === "S" ? o.face : o.owner) === 0 ? "赤" : "青"}`,
                )
                .join("、")
            : "なし"}
        </dd>
      </dl>
    );
  }
  const object = frame.objects.find((o) => o.id === id);
  return object ? (
    <dl className="replay-inspector">
      <dt>資源</dt>
      <dd>
        {id} ·{" "}
        {{ E: "アース", S: "スカイ", M: "ムスティカ" }[object.kind] ||
          object.kind}
      </dd>
      <dt>所在</dt>
      <dd>{locationName(object.loc)}</dd>
      {object.kind !== "M" && (
        <>
          <dt>色</dt>
          <dd>
            {(object.kind === "S" ? object.face : object.owner) === 0
              ? "赤"
              : "青"}
          </dd>
        </>
      )}
    </dl>
  ) : (
    <p>この時刻には表示されていません。</p>
  );
}
