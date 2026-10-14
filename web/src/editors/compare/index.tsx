import { run } from "../../app/commands";
import { useAnalysis, useSearch } from "../../app/session";
import { useUI } from "../../app/store";
import type { MatchAnalysis } from "../../engine/analysis";
import { Empty } from "../common/Empty";
import { robotNames } from "../common/labels";
import { sampleAt } from "../score";
import { defineEditor } from "../registry";

function stats(a: MatchAnalysis) {
  const last = a.samples.at(-1)!;
  const count = (k: string, team: number) => a.markers.filter((m) => m.kind === k && m.team === team).length;
  const busy = [0, 1, 2, 3].map((r) =>
    a.intervals.filter((i) => i.robot === r && !["wait", "delay"].includes(i.action.kind)).reduce((s, i) => s + i.end - i.start, 0),
  );
  return { last, count, busy };
}

function CompareEditor() {
  const compare = useUI((s) => s.session.compare);
  const time = useUI((s) => s.playback.time);
  const search = useSearch();
  const A = useAnalysis(compare.a).data,
    B = useAnalysis(compare.b).data;
  if (!search) return <Empty title="探索がありません" />;
  if (!compare.a && !compare.b)
    return (
      <Empty title="比較する経路が未設定です">
        <p>局面を選んでから「探索 → 現在の経路をA（B）に設定」、またはアウトライナーの右クリックで設定します。</p>
        <button className="tool" onClick={() => run("compare.setA")}>現在の経路をAに設定</button>
      </Empty>
    );
  const sa = A && stats(A),
    sb = B && stats(B);
  const nowA = A && sampleAt(A, time),
    nowB = B && sampleAt(B, time);
  const row = (label: string, a: React.ReactNode, b: React.ReactNode, diff?: number | null) => (
    <tr>
      <th>{label}</th>
      <td className="tabular">{a ?? "—"}</td>
      <td className="tabular">{b ?? "—"}</td>
      <td className={`tabular ${diff && diff > 0 ? "pos" : diff && diff < 0 ? "neg" : ""}`}>{diff === null || diff === undefined ? "" : diff > 0 ? `+${diff}` : diff}</td>
    </tr>
  );
  const d = (x?: number, y?: number) => (x === undefined || y === undefined ? null : y - x);
  return (
    <div className="editor-scroll compare-editor">
      <table className="compare-table">
        <thead>
          <tr>
            <th />
            <th>A {compare.label[0]}</th>
            <th>B {compare.label[1]}</th>
            <th>B−A</th>
          </tr>
        </thead>
        <tbody>
          {row(`${time.toFixed(1)}秒の点差`, nowA && nowA.parts[0].total - nowA.parts[1].total, nowB && nowB.parts[0].total - nowB.parts[1].total, d(nowA ? nowA.parts[0].total - nowA.parts[1].total : undefined, nowB ? nowB.parts[0].total - nowB.parts[1].total : undefined))}
          {row("末尾の得点", sa && `${sa.last.parts[0].total} 対 ${sa.last.parts[1].total}`, sb && `${sb.last.parts[0].total} 対 ${sb.last.parts[1].total}`)}
          {row("末尾の点差", sa && sa.last.parts[0].total - sa.last.parts[1].total, sb && sb.last.parts[0].total - sb.last.parts[1].total, d(sa ? sa.last.parts[0].total - sa.last.parts[1].total : undefined, sb ? sb.last.parts[0].total - sb.last.parts[1].total : undefined))}
          {row("末尾の時刻", A?.end, B?.end, d(A?.end, B?.end))}
          {row("赤の取得条件", A?.mandate[0] ?? "未成立", B?.mandate[0] ?? "未成立")}
          {row("青の取得条件", A?.mandate[1] ?? "未成立", B?.mandate[1] ?? "未成立")}
          {(["place", "flip", "transfer", "retry", "blocked"] as const).map((k) =>
            [0, 1].map((t) =>
              row(
                `${t ? "青" : "赤"} ${{ place: "設置", flip: "反転", transfer: "搬送", retry: "リトライ", blocked: "実行不可" }[k]}`,
                sa?.count(k, t),
                sb?.count(k, t),
                d(sa?.count(k, t), sb?.count(k, t)),
              ),
            ),
          )}
          {robotNames.map((n, r) => row(`${n} 稼働秒`, sa?.busy[r], sb?.busy[r], d(sa?.busy[r], sb?.busy[r])))}
        </tbody>
      </table>
      <div className="row">
        <button className="tool" onClick={() => run("compare.setA")}>現在の経路をAに</button>
        <button className="tool" onClick={() => run("compare.setB")}>現在の経路をBに</button>
        <button className="tool" onClick={() => run("compare.swap")}>入れ替え</button>
      </div>
    </div>
  );
}
defineEditor({ type: "compare", title: "A/B比較", group: "解析", Component: CompareEditor });
