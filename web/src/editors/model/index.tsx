import { useEffect, useState } from "react";
import { layout, useLayout } from "../../app/layout";
import { helpArticles, resolveHelpTopic } from "../../app/help";
import { useSearch } from "../../app/session";
import { glossary } from "../common/labels";
import { useModel } from "../common/hooks";
import { DetailView } from "../common/DetailView";
import { defineEditor, type EditorProps } from "../registry";
import "./model.css";

function ModelEditor({ area }: EditorProps) {
  const [query, setQuery] = useState("");
  const model = useModel(), search = useSearch();
  const workspaces = useLayout(s => s.workspaces);
  const topic = resolveHelpTopic(String(area.state?.section ?? "model"));
  const article = helpArticles[topic];
  useEffect(() => setQuery(""), [topic]);
  const needle = query.trim().toLowerCase();
  const chapters = Object.entries(helpArticles).filter(([key, a]) => [
    a.title, a.summary, ...a.paragraphs,
    ...(key === "glossary" ? glossary.flat() : []),
    ...(key === "model" ? model?.scope ?? [] : []),
    ...(key === "rules" ? Object.values(model?.rules ?? {}).flatMap(r => [r.label, r.source]) : [])
  ].join(" ").toLowerCase().includes(needle));
  const back = String(area.state?.returnWorkspace ?? "conditions");
  return <div className="documentation">
    <nav className="documentation-index" aria-label="ドキュメントの章">
      <input type="search" aria-label="ドキュメントを検索" placeholder="用語・操作を検索" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="documentation-chapters">
        {chapters.map(([key, a]) => <button className="tool" key={key} aria-current={topic === key ? "page" : undefined} onClick={() => layout.setAreaState(area.id, { section: key })}>{a.title}</button>)}
      </div>
      {needle && <p role="status">{chapters.length ? `${chapters.length}章が一致` : "一致する章がありません"}</p>}
    </nav>
    <article className="editor-scroll model-document">
      <div className="documentation-heading"><h2>{article.title}</h2><button className="tool" onClick={() => layout.activate(workspaces.some(w => w.id === back) ? back : "conditions")}>作業に戻る</button></div>
      <p>{article.summary}</p>
      {article.paragraphs.map(p => <p key={p}>{p}</p>)}
      {topic === "model" && model && <section><h3>モデル {model.version} の範囲</h3><ul>{model.scope.map(s => <li key={s}>{s}</li>)}</ul></section>}
      {topic === "glossary" && <dl>{glossary.map(([term, description]) => <div key={term}><dt>{term}</dt><dd>{description}</dd></div>)}</dl>}
      {topic === "rules" && model && <section><h3>{search ? "探索に適用した値" : "新規探索の既定値"}</h3><table><thead><tr><th>項目</th><th>値</th><th>参照</th></tr></thead><tbody>{Object.entries(model.rules).map(([k, r]) => <tr key={k}><th>{r.label}</th><td>{ruleValue(search?.config.rules[k] ?? model.defaults.rules[k])}</td><td>{r.source}</td></tr>)}</tbody></table></section>}
      {search && (topic === "conditions" || topic === "rules") && <DetailView label="適用した条件をJSONで確認"><pre>{JSON.stringify(search.config, null, 2)}</pre></DetailView>}
    </article>
  </div>;
}
const ruleValue = (value: string | boolean) => ({ true: "許可", false: "不許可", retain: "保持して再開", return: "初期位置へ戻す", branch: "両結果を分岐", red: "赤優先", blue: "青優先", simultaneous: "同時保有", historical: "保有履歴の累積" }[String(value)] ?? String(value));
defineEditor({ type: "model", title: "ドキュメント", group: "設定", Component: ModelEditor });
