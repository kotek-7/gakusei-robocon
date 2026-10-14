import { useEffect, useState } from "react";
import { layout } from "../../app/layout";
import type { EditorProps } from "../registry";
import "./model.css";
import { useSearch } from "../../app/session";
import { competitionName, glossary, ruleAssumption } from "../common/labels";
import { useModel } from "../common/hooks";
import { defineEditor } from "../registry";

const historyDefinitions = [
  [
    "候補探索",
    "限定した経路・待機時刻が対象。範囲内で完了しても、全作戦の網羅や最適性は保証しない。"
  ],
  [
    "探索待ち",
    "発見済みの未探索分岐。計算中にも増えるため、残り総数と完了時刻は未確定。"
  ],
  [
    "比較待ち",
    "共有した相手手順のうち、未検査の組合せ。"
  ],
  [
    "種類",
    "設置・反転などの完了順序による分類。"
  ],
  [
    "得点更新",
    "相手待機時の、同じ構成の過去最高点との差。初回発見は除外。"
  ]
];
const resultNotes = [
  "ノードは局面、エッジは双方の行動と競合結果。同じ局面への経路は合流するが、入る遷移は保持する。",
  "未探索は到達不能や0勝ではない。途中の分布は発見済みの範囲に限る。",
  "勝敗割合は展開の集計で、実大会の勝率ではない。勝利確率の保証値は探索完了時だけ、相手の同時選択と不利な競合を含めて計算する。"
];

function ModelEditor({ area }: EditorProps) {
  const [query, setQuery] = useState("");
  const section = String(area.state?.section ?? "all");
  useEffect(() => setQuery(""), [section]);
  const matches = (...text: string[]) => text.join(" ").toLowerCase().includes(query.trim().toLowerCase());
  const show = (id: string) => section === "all" || section === id;
  const model = useModel();
  const search = useSearch();
  if (!model) return null;
  const terms = glossary.filter(([a, b]) => matches(a, b));
  const scope = model.scope.filter((s) => matches(s));
  const history = historyDefinitions.filter(([a, b]) => matches(a, b));
  const results = resultNotes.filter((s) => matches(s));
  const rules = Object.entries(model.rules).filter(([k, r]) => matches(k, r.label, r.source, ruleValue(search?.config.rules[k] ?? model.defaults.rules[k])));
  const count = (show("glossary") ? terms.length : 0) + (show("scope") ? scope.length : 0) + (show("history") ? history.length : 0) + (show("results") ? results.length : 0) + (show("rules") ? rules.length : 0);
  return (
    <div className="editor-scroll model-document">
      <div className="model-lookup">
        <input type="search" aria-label="用語・前提を検索" placeholder="用語・前提を検索" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select aria-label="参照する項目" value={section} onChange={(e) => layout.setAreaState(area.id, { section: e.target.value })}>
          <option value="all">すべて</option><option value="glossary">用語</option><option value="scope">モデルの範囲</option><option value="history">探索・履歴の定義</option><option value="results">結果の読み方</option><option value="rules">ルール解釈</option>
        </select>
        {(query || section !== "all") && <button className="tool" onClick={() => { setQuery(""); layout.setAreaState(area.id, { section: "all" }); }}>解除</button>}
      </div>
      {query && <p className="muted" role="status">{count ? `${count}項目` : "一致する用語・前提がありません"}</p>}
      {!query && section === "all" && <><h2>モデルと探索範囲</h2>
      <p>
        {competitionName}の作戦検討用。{ruleAssumption}。用語は手元の日本語参考訳（非公式）に合わせている。
      </p>
      </>}
      {show("glossary") && terms.length > 0 && <section><h3>用語</h3>
      <dl>
        {terms.map(([term, description]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
      </section>}
      {show("scope") && scope.length > 0 && <section><h3>モデル {model.version} の範囲</h3>
      <ul>
        {scope.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      </section>}
      {show("history") && history.length > 0 && <section><h3>候補探索・履歴の定義</h3>
        <dl>{history.map(([term, description]) => <div key={term}><dt>{term}</dt><dd>{description}</dd></div>)}</dl>
      </section>}
      {show("results") && results.length > 0 && <section><h3>結果の読み方</h3>
        {results.map((text) => <p key={text}>{text}</p>)}
      </section>}
      {show("rules") && rules.length > 0 && <section><h3>ルール解釈</h3>
      <p className="muted">{search ? "保存済みの探索に適用した値" : "新しい探索の既定値"}</p>
      <table>
        <tbody>
          {rules.map(([k, r]) => (
            <tr key={k}>
              <th>{r.label}</th>
              <td>{ruleValue(search?.config.rules[k] ?? model.defaults.rules[k])}</td>
              <td className="muted">{r.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </section>}
      {search && !query && section === "all" && (
        <details>
          <summary>適用した条件（JSON）</summary>
          <pre>{JSON.stringify(search.config, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
const ruleValue = (value: string | boolean) => ({ true: "許可", false: "不許可", retain: "保持して再開", return: "初期位置へ戻す", branch: "両結果を分岐", red: "赤優先", blue: "青優先", simultaneous: "同時保有", historical: "保有履歴の累積" }[String(value)] ?? String(value));

defineEditor({ type: "model", title: "モデル・前提", group: "設定", Component: ModelEditor });
