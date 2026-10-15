import { IconButton } from "../common/IconButton";
import { Icon } from "../../shell/icons";
import { useEffect, useState } from "react";
import "./jobs.css";
import { Coverage } from "./Coverage";
import { isEnabled, run } from "../../app/commands";
import { usePref, setPref } from "../../app/prefs";
import { useSearch } from "../../app/session";
import { Empty } from "../common/Empty";
import { defineEditor } from "../registry";
import { CurrentJob } from "./CurrentJob";
import { DiscoveryProgress } from "./SearchProgress";
import { EvaluationProgress } from "./EvaluationProgress";

function JobsEditor() {
  const search = useSearch();
  const [mode, setMode] = useState("discovery");
  useEffect(() => {
    if (search?.status === "evaluating" || (search?.status === "running" && search.job === "exact")) setMode("exact");
    else if (search?.status === "running" && search.job === "discovery") setMode("discovery");
  }, [search?.status, search?.job]);
  const seconds = usePref<string>("job.discoverySeconds");
  const budget = usePref<number>("job.exactBudget");
  if (!search) return <Empty title="探索がありません" />;
  const busy = search.status === "running" || search.status === "evaluating";
  return (
    <div className="editor-scroll jobs">
      <div className="job-controls" role="group" aria-label="計算の設定と実行">
        <select aria-label="計算の種類" value={mode} onChange={event => setMode(event.target.value)}>
          <option value="discovery">候補探索</option><option value="exact">全探索・評価</option>
        </select>
        {mode === "discovery" ? <>
          <label title="今回の制限時間"><Icon name="clock" /><select aria-label="今回の制限時間" disabled={busy} value={seconds} onChange={event => setPref("job.discoverySeconds", event.target.value)}>{[["10", "10秒"], ["60", "1分"], ["300", "5分"], ["1800", "30分"], ["3600", "1時間"], ["21600", "6時間"], ["86400", "24時間"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button className="action-button primary" disabled={!isEnabled("job.discover")} onClick={() => run("job.discover")}><Icon name="play" />{search.discovery ? "探索を再開" : "探索を開始"}</button>
        </> : <>
          <label>行動組数<input disabled={busy} type="number" value={budget} min={1} max={1000000} onChange={event => setPref("job.exactBudget", Math.max(1, Math.min(1000000, Number(event.target.value) || 1)))} /></label>
          <button className="action-button primary" disabled={!isEnabled("job.exact")} onClick={() => run("job.exact")}><Icon name="play" />全探索を続ける</button>
          <IconButton icon="chart" label="評価を計算" className="job-evaluate-action" disabled={!isEnabled("job.evaluate")} onClick={() => run("job.evaluate")}>評価</IconButton>
        </>}
      </div>
      {search.error && <p className="error-banner" role="alert">{search.error}</p>}
      <CurrentJob search={search} />
      {search.discovery?.activeTarget && <div className="job-target">
        <span>追加探索 · C{search.discovery.activeTarget.run} · {search.discovery.activeTarget.mode === "counter" ? "相手探索" : "既知の相手で検査"}</span>
        <IconButton icon="inspect" label="対象候補の進捗へ" className="job-result-link" onClick={() => run("strategy.exploration.open", {search:search.id,...search.discovery!.activeTarget,evidence:"baseline"})} />
      </div>}
      <div hidden={mode !== "discovery"}>
        <DiscoveryProgress key={search.id} search={search} onDefinitions={() => run("docs.open", "search")} />
        <Coverage search={search} />
      </div>
      <div hidden={mode !== "exact"}>
        <section className="job-exact-results" aria-label="探索範囲の集計">
          <header className="job-result-heading"><strong>探索範囲の集計</strong><span>{search.complete ? "対象範囲を探索済み" : search.expanded > 0 ? "未探索の分岐あり" : "未展開"}</span></header>
          <div className="progress-table" role="region" aria-label="探索範囲の集計" tabIndex={0}>
            <table><thead><tr><th>局面</th><th>遷移</th><th>展開済み局面</th><th>探索済み構成</th></tr></thead>
              <tbody><tr><td>{search.nodes.toLocaleString()}</td><td>{search.edges.toLocaleString()}</td><td>{search.expanded.toLocaleString()}</td><td>{search.completeRuns.toLocaleString()} / {BigInt(search.totalRuns).toLocaleString()}</td></tr></tbody>
            </table>
          </div>
        </section>
        {search.jobProgress?.kind !== "evaluation" && search.status !== "evaluating" && search.evaluationProgress && <EvaluationProgress search={search} />}
      </div>
    </div>
  );
}
defineEditor({ type: "jobs", title: "計算と進捗", group: "探索", Component: JobsEditor });
