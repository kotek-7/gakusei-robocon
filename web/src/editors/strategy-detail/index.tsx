import { useRef } from "react";
import { useQuery } from "../../app/data";
import { useSearch } from "../../app/session";
import { layout, useLayout } from "../../app/layout";
import { ui, useUI } from "../../app/store";
import { useModel } from "../common/hooks";
import { Help } from "../common/Help";
import { Empty } from "../common/Empty";
import { defineEditor, type EditorProps } from "../registry";
import { candidatePlanLabel } from "../candidates/collection";
import { EvidenceDiagnostics } from "../candidates/EvidenceDiagnostics";
import { StrategyPlan, StrategyConfiguration } from "./StrategyPlan";
import { StrategyScore } from "./StrategyScore";
import { StrategyExecution } from "./StrategyExecution";
import { resolveStrategy, type StrategySelection } from "./selection";
import { inspectStrategyTime } from "./commands";
import "./detail.css";

function StrategyDetail({ area }: EditorProps) {
  const search = useSearch(), model = useModel();
  const root = useRef<HTMLDivElement>(null);
  const selection = area.state?.strategySelection as StrategySelection | undefined;
  const resolved = search && resolveStrategy(search, selection);
  const evidence = resolved?.chosen?.evidence;
  const analysis = useQuery("analysis.match", search && evidence?.path.length ? {search:search.id, edges:evidence.path} : null);
  const opponent = evidence && "opponent" in evidence ? String(evidence.opponent ?? "") : "";
  const instructions = useQuery("candidate.instructions", search && resolved ? {search: search.id, run:resolved.run.run, candidate:resolved.candidate.id, ...(opponent ? {opponent} : {})} : null);
  const currentPath = useUI(s => s.session.path);
  const pathMatches = evidence && currentPath?.join() === evidence.path.join();
  const section = (id: string) => {
    const target = root.current?.querySelector<HTMLElement>(`[data-section="${id}"]`);
    target?.focus({preventScroll:true}); target?.scrollIntoView({block:"start"});
  };
  function update(next: StrategySelection) {
    layout.setAreaState(area.id, {strategySelection: next});
    void inspectStrategyTime(next, undefined).catch(ui.error);
    ui.patchPlayback({playing:false, range:null});
  }
  function back() {
    const source = area.state?.sourceWorkspace as string | undefined;
    if (source && useLayout.getState().workspaces.some(w => w.id === source)) layout.activate(source);
    else layout.reveal("candidates");
  }
  if (!search || !model) return <Empty title="探索がありません" />;
  if (!resolved || !selection) return <div className="editor-scroll"><Empty title="作戦候補から「作戦を詳しく見る」を選んでください" /><button onClick={() => layout.reveal("candidates")}>作戦候補へ</button></div>;
  const {candidate, run: configRun, options} = resolved;
  const ordinal = configRun.candidates.indexOf(candidate) + 1;
  const seek = (t: number, robot?: number) => { void inspectStrategyTime(selection,t,robot).catch(ui.error); };
  return <div ref={root} className="editor-scroll strategy-detail">
    <header className="strategy-detail-heading">
      <div><h2>候補 {ordinal} · 構成 C{configRun.run}</h2><p><span className="muted">相手待機時の完了結果：</span>{candidatePlanLabel(candidate.plan)}</p></div>
      <button onClick={back}>候補一覧へ戻る</button>
    </header>
    <div className="strategy-detail-selectors">
      <label>作戦候補<select aria-label="詳しく見る作戦候補" value={candidate.id} onChange={e => update({...selection,candidate:e.target.value,evidence:"baseline"})}>{configRun.candidates.map((c,i) => <option key={c.id} value={c.id}>候補 {i+1} · {candidatePlanLabel(c.plan)}</option>)}</select></label>
      <label>展開<select aria-label="詳しく見る展開" value={resolved.chosen?.key ?? ""} onChange={e => update({...selection,evidence:e.target.value})}>{!resolved.chosen && <option value="">展開が見つかりません</option>}{options.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
      <Help topic="results" text="作戦候補は赤TR・赤BRの固定指示です。相手の手順や競合の裁定により実行結果が変わります。候補番号はこの構成内の発見順です。" />
    </div>
    <nav className="strategy-detail-nav" aria-label="作戦詳細の内容">
      <span className="strategy-sticky-identity">C{configRun.run} · 候補 {ordinal} · {resolved.chosen?.label ?? "展開未選択"}</span>
      <button onClick={() => section("instructions")}>作戦の指示</button>
      <button onClick={() => section("execution")} disabled={!analysis.data}>動作・時間</button>
      <button onClick={() => section("score")} disabled={!analysis.data}>得点の変化</button>
      <button onClick={() => section("diagnostics")} disabled={!evidence}>実行不可</button>
      <button onClick={() => section("configuration")}>機体構成</button>
    </nav>
    {evidence && <div className="strategy-evidence-status"><span>選択展開：赤 {evidence.scores[0]} 対 青 {evidence.scores[1]}</span><span>{analysis.data ? `${analysis.data.start}〜${analysis.data.end}秒` : ""}</span><button onClick={() => { void inspectStrategyTime(selection, undefined).catch(ui.error); }}>{pathMatches ? "終局を3D表示" : "この展開を3Dに表示"}</button></div>}
    <section data-section="instructions" tabIndex={-1}>
      {instructions.error && <p role="alert">固定指示を読み込めません：{instructions.error}</p>}
      {instructions.loading && !instructions.data && <p role="status">作戦の指示を読み込み中…</p>}
      <StrategyPlan key={`${search.id}/${candidate.id}`} candidate={candidate} variant={configRun.variant} model={model} instructions={instructions.data} blocked={evidence?.blocked} onSeek={seek} onSpot={spot => { void inspectStrategyTime(selection, undefined, undefined, `spot:${spot}`).catch(ui.error); }} />
    </section>
    <section data-section="execution" tabIndex={-1}>
      {analysis.error && <p role="alert">実行記録を読み込めません：{analysis.error}</p>}
      {analysis.loading && !analysis.data && <p role="status">実行記録を読み込み中…</p>}
      {evidence && !evidence.path.length && <p>この展開には動作の記録がありません。</p>}
      {analysis.data && <StrategyExecution analysis={analysis.data} onSeek={seek} />}
    </section>
    <section data-section="score" tabIndex={-1}>{analysis.data && <StrategyScore analysis={analysis.data} onSeek={seek} />}</section>
    <section data-section="diagnostics" tabIndex={-1}>{evidence && <EvidenceDiagnostics evidence={evidence} onOpenAt={issue => seek(issue.t,issue.robot)} />}</section>
    <section data-section="configuration" tabIndex={-1}><StrategyConfiguration variant={configRun.variant} model={model} /></section>
    <footer className="strategy-provenance">構成 C{configRun.run} · 候補 {candidate.id} · 展開 N{evidence?.node ?? "未選択"}</footer>
  </div>;
}

defineEditor({type:"strategy-detail",title:"作戦詳細",group:"探索",Component:StrategyDetail});
