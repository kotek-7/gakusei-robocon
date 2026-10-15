import { IconButton } from "../common/IconButton";
import { Icon } from "../../shell/icons";
import { run } from "../../app/commands";
import { layout } from "../../app/layout";
import { useFrame } from "../../app/session";
import { ui, useUI } from "../../app/store";
import { actionName, locationName, objectNames, robotNames } from "../common/labels";

/** The inspector follows the object selected in the work surface, at the playhead. */
export function SelectionInspector() {
  const selection = useUI(s => s.session.selection);
  const frame = useFrame();
  if (!frame || !selection) return null;
  const robot = selection.startsWith("robot:") ? frame.robots[Number(selection.slice(6))] : null;
  const object = selection.startsWith("obj:") ? frame.objects.find(o => o.id === Number(selection.slice(4))) : null;
  const spot = selection.startsWith("spot:") ? Number(selection.slice(5)) : null;
  const stack = spot === null ? [] : frame.objects.filter(o => o.loc === `tower${spot}`).sort((a, b) => b.layer - a.layer);
  const carried = robot ? frame.objects.filter(o => o.loc === `robot${selection.slice(6)}`) : [];
  const name = robot ? robotNames[Number(selection.slice(6))] : object ? `${objectNames[object.kind] || object.kind} ${object.id}` : spot !== null ? `建設スポット S${spot}` : selection;
  return <div className="selection-inspector">
    <div className="selection-breadcrumb"><button className="entity-reference" onClick={() => ui.select(null)}>局面</button><span aria-hidden="true">/</span><strong>{name}</strong></div>
    <div className="selection-context"><span className="tabular">{frame.t.toFixed(1)}秒時点</span><button className="tool icon-only" title="選択対象を3D中央に表示" aria-label="選択対象を3D中央に表示" onClick={() => { layout.reveal("viewport"); run("viewport.frameSelected"); }}><Icon name="focus" /></button></div>
    {robot && <>
      <dl className="property-grid">
        <dt>位置</dt><dd>{locationName(robot.location)}</dd>
        <dt>動作</dt><dd>{robot.action ? actionName(robot.action) : "待機"}</dd>
        <dt>運搬中</dt><dd>{robot.carry.length}個</dd>
        <dt>座標（m）</dt><dd className="tabular">{robot.p.map(v => v.toFixed(2)).join(" / ")}</dd>
      </dl>
      <div className="selection-actions"><IconButton icon="history" label="動作履歴を開く" onClick={() => layout.reveal("events")} /><IconButton icon="range" label="区間解析を開く" onClick={() => layout.reveal("interval-analysis")} /></div>
      {!!robot.carry.length && <table><thead><tr><th>運搬中の物体</th></tr></thead><tbody>{carried.map(o => <tr key={o.id}><td><button className="entity-reference" onClick={() => ui.select(`obj:${o.id}`)}>{objectNames[o.kind] || o.kind} {o.id}</button></td></tr>)}</tbody></table>}
    </>}
    {object && <dl className="property-grid">
      <dt>種類</dt><dd>{objectNames[object.kind] || object.kind}</dd>
      <dt>所在</dt><dd>{locationName(object.loc)}</dd>
      <dt>所有</dt><dd>{object.owner === 0 ? "赤" : object.owner === 1 ? "青" : "共有"}</dd>
      {object.kind === "S" && <><dt>上面</dt><dd>{object.face === 0 ? "赤" : "青"}</dd></>}
      {object.loc.startsWith("tower") && <><dt>段</dt><dd>{object.layer + 1}</dd></>}
      <dt>搬送加点済み</dt><dd>赤 {object.delivered[0] ? "有" : "無"} / 青 {object.delivered[1] ? "有" : "無"}</dd>
    </dl>}
    {spot !== null && <><table><thead><tr><th>段</th><th>物体</th><th>上面</th></tr></thead><tbody>{stack.map(o => <tr key={o.id}><td>{o.layer + 1}</td><td><button className="entity-reference" onClick={() => ui.select(`obj:${o.id}`)}>{objectNames[o.kind] || o.kind} {o.id}</button></td><td>{o.kind === "S" ? o.face ? "青" : "赤" : "—"}</td></tr>)}{!stack.length && <tr><td colSpan={3}>空き</td></tr>}</tbody></table><IconButton icon="history" label="選択スポットの履歴を開く" onClick={() => layout.reveal("spots")} /></>}
  </div>;
}
