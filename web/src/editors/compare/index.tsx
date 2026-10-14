import { useMemo, useState } from "react";
import { register, run } from "../../app/commands";
import { useAnalysis, useSearch } from "../../app/session";
import { ui, useUI } from "../../app/store";
import type { MatchAnalysis } from "../../engine/analysis";
import { Empty } from "../common/Empty";
import { robotNames } from "../common/labels";
import { sampleAt } from "../score";
import { scoreRangeDelta } from "../score/range";
import { intervalSummary } from "../common/intervalSummary";
import { scoreChangeTimes } from "./navigation";
import { defineEditor } from "../registry";

register({ id: "compare.seekRange", title: "比較区間の端へ移動", category: "比較", hidden: true,
  run: ({ args }) => { const range = useUI.getState().playback.range; if (range) ui.patchPlayback({ time: range[args === "end" ? 1 : 0], playing: false }); } });

function stats(a: MatchAnalysis) {
  const last = a.samples.at(-1)!;
  const count = (k: string, team: number) => a.markers.filter((m) => m.kind === k && m.team === team).length;
  const busy = [0, 1, 2, 3].map((r) =>
    a.intervals.filter((i) => i.robot === r && !["wait", "delay"].includes(i.action.kind)).reduce((s, i) => s + i.end - i.start, 0),
  );
  return { last, count, busy };
}

function CompareEditor() {
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [group, setGroup] = useState("all");
  const [query, setQuery] = useState("");
  const compare = useUI((s) => s.session.compare);
  const time = useUI((s) => s.playback.time);
  const range = useUI((s) => s.playback.range);
  const search = useSearch();
  const A = useAnalysis(compare.a).data,
    B = useAnalysis(compare.b).data;
  const changeTimes = useMemo(() => A && B ? scoreChangeTimes(A, B) : [], [A, B]);
  if (!search) return <Empty title="探索がありません" />;
  if (!compare.a && !compare.b)
    return (
      <Empty title="比較する経路が未設定です">
        <p>候補の「得点と経路」で比較A・Bに設定します。</p>
        <button className="tool" onClick={() => run("compare.setA")}>現在の経路をAに設定</button>
      </Empty>
    );
  const sa = A && stats(A),
    sb = B && stats(B);
  const nowA = A && time >= A.start && time <= A.end ? sampleAt(A, time) : undefined,
    nowB = B && time >= B.start && time <= B.end ? sampleAt(B, time) : undefined;
  const rangeA = A && range ? scoreRangeDelta(A, range) : null;
  const rangeB = B && range ? scoreRangeDelta(B, range) : null;
  const previous = changeTimes.findLast((t) => t < time - 0.001);
  const next = changeTimes.find((t) => t > time + 0.001);
  const seek = (t: number | undefined) => { if (t !== undefined) { ui.patchPlayback({ playing: false }); ui.seek(t); } };
  const row = (label: string, a: React.ReactNode, b: React.ReactNode, diff?: number | null, category = "score") => (group !== "all" && group !== category) || !label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) || (differencesOnly && A && B && a === b) ? null : (
    <tr key={label}>
      <th>{label}</th>
      <td className="tabular">{a ?? "—"}</td>
      <td className="tabular">{b ?? "—"}</td>
      <td className={`tabular ${diff && diff > 0 ? "pos" : diff && diff < 0 ? "neg" : ""}`}>{diff === null || diff === undefined ? "" : diff > 0 ? `+${diff}` : diff}</td>
    </tr>
  );
  const d = (x?: number, y?: number) => (x === undefined || y === undefined ? null : y - x);
  const rows = [
    row(`${time.toFixed(1)}秒の点差`, nowA && nowA.parts[0].total - nowA.parts[1].total, nowB && nowB.parts[0].total - nowB.parts[1].total, d(nowA ? nowA.parts[0].total - nowA.parts[1].total : undefined, nowB ? nowB.parts[0].total - nowB.parts[1].total : undefined)),
    ...(range ? [
      ...[0, 1].map((team) => row(`${team ? "青" : "赤"} 区間の得点増減`, rangeA?.[team].total, rangeB?.[team].total, d(rangeA?.[team].total, rangeB?.[team].total))),
      ...robotNames.map((name, robot) => {
        const a = A && rangeA ? intervalSummary(A.intervals, range, robot).waiting : undefined;
        const b = B && rangeB ? intervalSummary(B.intervals, range, robot).waiting : undefined;
        return row(`${name} 区間の待機秒`, a, b, d(a, b), "robots");
      }),
    ] : []),
    row("末尾の得点", sa && `${sa.last.parts[0].total} 対 ${sa.last.parts[1].total}`, sb && `${sb.last.parts[0].total} 対 ${sb.last.parts[1].total}`),
    row("末尾の点差", sa && sa.last.parts[0].total - sa.last.parts[1].total, sb && sb.last.parts[0].total - sb.last.parts[1].total, d(sa ? sa.last.parts[0].total - sa.last.parts[1].total : undefined, sb ? sb.last.parts[0].total - sb.last.parts[1].total : undefined)),
    row("末尾の時刻", A?.end, B?.end, d(A?.end, B?.end)),
    row("赤の取得条件", A ? (A.mandate[0] === null ? "未成立" : `${A.mandate[0]}秒`) : compare.a ? "読込中" : "未設定", B ? (B.mandate[0] === null ? "未成立" : `${B.mandate[0]}秒`) : compare.b ? "読込中" : "未設定"),
    row("青の取得条件", A ? (A.mandate[1] === null ? "未成立" : `${A.mandate[1]}秒`) : compare.a ? "読込中" : "未設定", B ? (B.mandate[1] === null ? "未成立" : `${B.mandate[1]}秒`) : compare.b ? "読込中" : "未設定"),
    (["place", "flip", "transfer", "retry", "blocked"] as const).map((k) =>
      [0, 1].map((t) =>
        row(
          `${t ? "青" : "赤"} ${{ place: "設置", flip: "反転", transfer: "搬送", retry: "リトライ", blocked: "実行不可" }[k]}`,
          sa?.count(k, t),
          sb?.count(k, t),
          d(sa?.count(k, t), sb?.count(k, t)), "actions",
        ),
      ),
    ),
    robotNames.map((n, r) => row(`${n} 稼働秒`, sa?.busy[r], sb?.busy[r], d(sa?.busy[r], sb?.busy[r]), "robots")),
  ].flat(2).filter(Boolean);
  return (
    <div className="editor-scroll compare-editor">
      <p className="candidate-caveat">選んだ2経路の比較。構成・相手手順は各列の見出しで確認してください。</p>
      <div className="row">
        <label>比較項目 <select value={group} onChange={(e) => setGroup(e.target.value)}><option value="all">すべて</option><option value="score">得点・取得条件</option><option value="actions">行動回数</option><option value="robots">機体の稼働時間</option></select></label>
        <input type="search" aria-label="比較項目を検索" placeholder="比較項目を検索" value={query} onChange={(e) => setQuery(e.target.value)} />
        {(group !== "all" || query || differencesOnly) && <button className="tool" onClick={() => { setGroup("all"); setQuery(""); setDifferencesOnly(false); }}>表示を戻す</button>}
        <label><input type="checkbox" checked={differencesOnly} disabled={!A || !B} onChange={(e) => setDifferencesOnly(e.target.checked)} /> 差がある項目だけ</label>
        <button className="tool" disabled={previous === undefined} onClick={() => seek(previous)}>前の点差変化</button>
        <button className="tool" disabled={next === undefined} onClick={() => seek(next)}>次の点差変化</button>
        <span className="muted">B−Aの変化 {changeTimes.length}か所</span>
      </div>
      {A && B && <p className="muted">共通の再生範囲：{Math.max(A.start, B.start) <= Math.min(A.end, B.end) ? `${Math.max(A.start, B.start)}–${Math.min(A.end, B.end)}秒` : "なし"}。各経路の範囲外の得点は「—」で表示します。</p>}
      {range && <div className="row"><span className="tabular">解析区間 {range[0]}〜{range[1]}秒</span><button className="tool" onClick={() => run("compare.seekRange", "start")}>開始へ</button><button className="tool" onClick={() => run("compare.seekRange", "end")}>終了へ</button><span className="muted">得点は終了値−開始値。経路外は「—」。</span></div>}
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
          {rows.length ? rows : <tr><td colSpan={4}>条件に合う比較項目はありません。検索語・比較項目・差分表示を変更してください。</td></tr>}
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
