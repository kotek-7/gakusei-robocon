import { useSearch } from "../../app/session";
import { competitionName, glossary, ruleAssumption } from "../common/labels";
import { useModel } from "../common/hooks";
import { defineEditor } from "../registry";

function ModelEditor() {
  const model = useModel();
  const search = useSearch();
  if (!model) return null;
  return (
    <div className="editor-scroll model-document">
      <h2>モデルと探索範囲</h2>
      <p>
        {competitionName}の作戦検討用。{ruleAssumption}。用語は手元の日本語参考訳（非公式）に合わせている。
      </p>
      <h3>用語</h3>
      <dl>
        {glossary.map(([term, description]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
      <h3>モデル {model.version} の範囲</h3>
      <ul>
        {model.scope.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <h3>候補探索・履歴の定義</h3>
      <dl>
        <div><dt>候補探索</dt><dd>限定した経路・待機時刻が対象。範囲内で完了しても、全作戦の網羅や最適性は保証しない。</dd></div>
        <div><dt>探索待ち</dt><dd>発見済みの未探索分岐。計算中にも増えるため、残り総数と完了時刻は未確定。</dd></div>
        <div><dt>比較待ち</dt><dd>共有した相手手順のうち、未検査の組合せ。</dd></div>
        <div><dt>種類</dt><dd>設置・反転などの完了順序による分類。</dd></div>
        <div><dt>得点更新</dt><dd>相手待機時の、同じ構成の過去最高点との差。初回発見は除外。</dd></div>
      </dl>
      <h3>結果の読み方</h3>
      <p>ノードは局面、エッジは双方の行動と競合結果。同じ局面への経路は合流するが、入る遷移は保持する。</p>
      <p>未探索は到達不能や0勝ではない。途中の分布は発見済みの範囲に限る。</p>
      <p>勝敗割合は展開の集計で、実大会の勝率ではない。勝利確率の保証値は探索完了時だけ、相手の同時選択と不利な競合を含めて計算する。</p>
      <h3>ルール解釈</h3>
      <table>
        <tbody>
          {Object.entries(model.rules).map(([k, r]) => (
            <tr key={k}>
              <th>{r.label}</th>
              <td>{String(search?.config.rules[k] ?? model.defaults.rules[k])}</td>
              <td className="muted">{r.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {search && (
        <details>
          <summary>適用した条件（JSON）</summary>
          <pre>{JSON.stringify(search.config, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
defineEditor({ type: "model", title: "モデル・前提", group: "設定", Component: ModelEditor });
