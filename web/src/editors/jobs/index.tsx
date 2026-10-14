import { isEnabled, run } from "../../app/commands";
import { layout } from "../../app/layout";
import { usePref, setPref } from "../../app/prefs";
import { useSearch } from "../../app/session";
import { Empty } from "../common/Empty";
import { defineEditor } from "../registry";
import { DiscoveryProgress, EvaluationProgress } from "./SearchProgress";

function JobsEditor() {
  const search = useSearch();
  const budget = usePref<number>("job.exactBudget");
  if (!search) return <Empty title="探索がありません" />;
  return (
    <div className="editor-scroll jobs">
      {search.error && (
        <p className="error-banner" role="alert">
          {search.error}
        </p>
      )}
      <DiscoveryProgress key={search.id} search={search} onDefinitions={() => layout.reveal("model", { section: "history" })} />
      <EvaluationProgress search={search} />
      <section className="exact-panel" aria-label="詳細な全探索">
        <h3>詳細な全探索</h3>
        <p className="muted">
          {search.job === "exact" && search.status === "running"
            ? "探索中"
            : search.complete
              ? "対象範囲を探索済み"
              : "未探索の分岐あり"}
        </p>
        <div className="row">
          <label>
            1回の行動数
            <input
              type="number"
              value={budget}
              min={1}
              max={1000000}
              onChange={(e) => setPref("job.exactBudget", Math.max(1, Math.min(1000000, Number(e.target.value) || 1)))}
            />
          </label>
          <button className="tool" disabled={!isEnabled("job.exact")} onClick={() => run("job.exact")}>
            全探索を続ける
          </button>
          <button className="tool" disabled={!isEnabled("job.evaluate")} onClick={() => run("job.evaluate")}>
            評価を計算
          </button>
        </div>
        <dl className="search-metrics">
          <div><dt>局面</dt><dd>{search.nodes.toLocaleString()}</dd></div>
          <div><dt>遷移</dt><dd>{search.edges.toLocaleString()}</dd></div>
          <div><dt>展開済み局面</dt><dd>{search.expanded.toLocaleString()}</dd></div>
          <div><dt>探索済み構成</dt><dd>{search.completeRuns} / {search.totalRuns}</dd></div>
        </dl>
      </section>
    </div>
  );
}
defineEditor({ type: "jobs", title: "計算と進捗", group: "探索", Component: JobsEditor });
