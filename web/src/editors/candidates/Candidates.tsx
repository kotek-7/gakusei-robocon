import "./candidates.css";
import { buildCandidateIndex, candidatePlanLabel, parseCandidateQuery, matchCandidateQuery, sortCandidateRows, mergeShortlistScope, type CandidateFilterView } from "./collection";
import { CandidateQueryHelp, SavedCandidateViews } from "./SavedCandidateViews";
import { CandidateRecovery, CandidateQueryMatch } from "./CandidateRecovery";
import { EvidenceScoreDelta } from "./EvidenceScoreDelta";
import { ResponseBrowser } from "./ResponseBrowser";
import { candidateKey, toggleShortlist, type CandidateReview } from "./review";
import { ui } from "../../app/store";
import { ComparisonMatrix } from "./ComparisonMatrix";
import { candidateComparisonLabel } from "./comparisonLabel";
import { EvidenceDiagnostics } from "./EvidenceDiagnostics";
import { Help } from "../common/Help";
import { useEffect, useRef, useState } from "react";
import { run as command } from "../../app/commands";
import "./commands";
import { responseIdentity, worstCommonResponse } from "./evidence";
import { navigateRow } from "./rowSelection";
import { MilestoneInspector } from "./MilestoneInspector";
import { profileNames } from "../common/labels";
import type { CandidateEvidence, Search, Model, Variant } from "../../engine/types";

const margin = (x: CandidateEvidence) => x.scores[0] - x.scores[1];
const score = (x: CandidateEvidence) => `${x.scores[0]} 対 ${x.scores[1]}`;

export type CandidateView = {
  selected: string; responseKey: string; run: string; query: string; sort: string; status: string; opponent: string; shortlistOnly?: boolean; requestHandled?: number;
};

export function Candidates({
  search,
  model,
  review, reviewReady, onReviewChange,
  onOpen,
  requestedRun,
  runRequest,
  initialView,
  onViewChange,
}: {
  review: CandidateReview;
  reviewReady: boolean;
  onReviewChange: (edit: (value: CandidateReview) => CandidateReview) => Promise<void>;
  initialView?: Partial<CandidateView>;
  onViewChange?: (view: CandidateView) => void;
  requestedRun?: string;
  runRequest?: number;
  search: Search;
  model: Model;
  onOpen: (run: number, evidence: CandidateEvidence) => void;
}) {
  const root = useRef<HTMLElement>(null);
  const [shortlistOnly, setShortlistOnly] = useState(initialView?.shortlistOnly ?? false);
  const saveReview = (edit: (value: CandidateReview) => CandidateReview) => onReviewChange(edit).catch(ui.error);
  const [selected, setSelected] = useState(initialView?.selected ?? "");
  const [responseKey, setResponseKey] = useState(initialView?.responseKey ?? "worst");
  const [run, setRun] = useState(initialView?.run ?? requestedRun ?? "all");
  const [requestHandled, setRequestHandled] = useState(initialView?.requestHandled);
  useEffect(() => { if (requestedRun !== undefined && (runRequest !== requestHandled || !initialView)) { setRun(requestedRun); setOpponent(""); setQuery(""); setStatus("all"); setShortlistOnly(false); setRequestHandled(runRequest); } }, [requestedRun, runRequest]);
  const [query, setQuery] = useState(initialView?.query ?? "");
  const [sort, setSort] = useState(initialView?.sort ?? "discovery");
  const [status, setStatus] = useState(initialView?.status ?? "all");
  const [opponent, setOpponent] = useState(initialView?.opponent ?? "");
  useEffect(() => { onViewChange?.({ selected, responseKey, run, query, sort, status, opponent, requestHandled, shortlistOnly }); }, [selected, responseKey, run, query, sort, status, opponent, requestHandled, shortlistOnly]);
  const report = search.discovery;
  const selectedRun = report?.runs.find((r) => String(r.run) === run);
  function configuration(v: Variant) {
    return v.teams
      .flatMap((team, t) => [
        ...Object.entries(team.caps)
          .filter(([k]) => search.config.teams[t].caps[k].length > 1)
          .map(
            ([k, value]) =>
              `${t ? "青" : "赤"} ${model.caps[k]}：${typeof value === "boolean" ? (value ? "可能" : "不可") : value}`,
          ),
        ...Object.entries(team.speeds)
          .filter(([k]) => search.config.teams[t].speeds[k].length > 1)
          .map(
            ([k, value]) =>
              `${t ? "青" : "赤"} ${model.profiles[k]}：${profileNames[value]}`,
          ),
      ])
      .join(" ／ ");
  }
  const rows =
    report?.runs.flatMap((r) =>
      r.candidates.map((c) => ({
        run: r.run,
        common: r.commonOpponents,
        candidate: c,
      })),
    ) || [];
  const opponents = [...new Set(rows.filter((r) => run === "all" || String(r.run) === run).flatMap((r) => r.common))].sort();
  const filters = {run, query, sort, status, opponent, shortlistOnly};
  function applyFilters(value: CandidateFilterView) {
    setRun(value.run); setQuery(value.query); setSort(value.sort); setStatus(value.status); setOpponent(value.opponent); setShortlistOnly(value.shortlistOnly);
  }
  const terms = parseCandidateQuery(query);
  const visibleRows = sortCandidateRows(rows
    .filter(row => { const {run: r, candidate: c} = row; return (run === "all" || String(r) === run) &&
      (!shortlistOnly || review.shortlist.includes(candidateKey(r, c.id))) &&
      (terms.length === 0 || matchCandidateQuery(buildCandidateIndex(row), terms).matches);
    })
    .map((row) => {
      const worst = worstCommonResponse(row.candidate, row.common, opponent);
      return { ...row, worst };
    })
    .filter((row) => (!opponent || row.worst !== null) &&
      (status !== "pending" || row.candidate.pending > 0) &&
      (status !== "comparable" || row.worst !== null) &&
      (status !== "blocked" || row.candidate.responses.some((x) => (!opponent || x.opponent === opponent) && !!x.blocked?.length)))
, sort, opponent);
  const visibleKeys = visibleRows.map(row => candidateKey(row.run,row.candidate.id));
  const visibleSet = new Set(visibleKeys);
  const hiddenComparisons = review.shortlist.filter(key => !visibleSet.has(key)).length;
  const selectedVisibleCount = visibleKeys.filter(key => review.shortlist.includes(key)).length;
  const active = visibleRows.find(row => `${row.run}/${row.candidate.id}` === selected) ?? visibleRows[0];
  const responses = active?.candidate.responses.filter(response => (!opponent || response.opponent === opponent) && (status !== "blocked" || !!response.blocked?.length)) ?? [];
  const evidenceOptions = active ? [
    ...(active.worst ? [{ key: "worst", label: "共通手順で最小点差", evidence: active.worst }] : []),
    { key: "baseline", label: "相手待機", evidence: active.candidate.baseline },
    ...responses.map((evidence, index) => ({ key: responseIdentity(active.run, active.candidate.id, evidence), label: `対応${index + 1} · ${evidence.opponent?.slice(0, 14) ?? "相手手順"}`, evidence })),
  ] : [];
  const chosen = evidenceOptions.find(option => option.key === responseKey) ?? evidenceOptions[0];
  function revealCandidate(key: string) {
    if (!visibleSet.has(key)) applyFilters({...filters, run:"all", query:"", status:"all", opponent:"", shortlistOnly:false});
    if (!active || candidateKey(active.run,active.candidate.id) !== key) setResponseKey("worst");
    setSelected(key);
    requestAnimationFrame(() => {
      const row = [...(root.current?.querySelectorAll<HTMLTableRowElement>("tr[data-candidate-key]") ?? [])].find(row => row.dataset.candidateKey === key);
      row?.focus(); row?.scrollIntoView({block:"nearest"});
    });
  }
  function focusRegion(region: "list" | "comparison" | "inspector") {
    const target = root.current?.querySelector<HTMLElement>(region === "list"
      ? (active ? '.candidate-table tr[aria-selected="true"]' : '.candidate-table')
      : region === "comparison" ? ".candidate-comparison-region" : ".candidate-inspector");
    if (!target) return;
    if (region === "inspector") target.scrollTop = 0;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
    // Keep the region's entry visible beneath the local sticky navigation.
    if (region === "list") {
      const table = root.current?.querySelector<HTMLElement>(".candidate-table");
      const headers = table?.querySelectorAll("thead th");
      if (table && headers?.length && target !== table) {
        const headerBottom = Math.max(...Array.from(headers, header => header.getBoundingClientRect().bottom));
        const overlap = headerBottom - target.getBoundingClientRect().top;
        if (overlap > 0) table.scrollTop -= overlap;
      }
      table?.scrollIntoView({ block: "start", inline: "nearest" });
    }
    else target.scrollIntoView({ block: "start", inline: "nearest" });
  }
  return (
    <section ref={root} className="evaluation candidates">

      {!report || !rows.length ? (
        <div className="empty">
          <h3>
            {search.status === "running"
              ? "最初の候補を計算しています"
              : "候補はまだありません"}
          </h3>
          <p>「候補を探す」で計算を開始できます。</p>
        </div>
      ) : (
        <>
          <div className="candidate-controls">
            <label>
              構成{" "}
              <select value={run} onChange={(e) => { setRun(e.target.value); setOpponent(""); }}>
                <option value="all">すべて</option>
                {report.runs.map((r) => (
                  <option key={r.run} value={r.run}>
                    C{r.run} · {r.candidates.length}候補
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>候補を検索</span>
              <input type="search" value={query} placeholder="手順・L1/L2・ID" onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label><input type="checkbox" checked={shortlistOnly} onChange={e => setShortlistOnly(e.target.checked)} />比較中のみ ({review.shortlist.length})</label>
            <CandidateQueryHelp />
            <span className="candidate-count">{visibleRows.length} / {rows.length}候補</span>
          </div>
          <div className="candidate-option-fields" role="group" aria-label="候補の表示条件">
            <label>
              並び順{" "}
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="discovery">発見順</option>
                <option value="worst">共通手順での最小点差が大きい順</option>
                <option value="baseline">相手待機での点差が大きい順</option>
                <option value="pending">未比較が多い順</option>
              </select>
            </label>
            <label>検査状況 <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">すべて</option><option value="comparable">共通比較あり</option><option value="pending">未比較あり</option><option value="blocked">実行不可あり</option>
            </select></label>
            <label>共通の相手手順 <select value={opponent} onChange={(e) => setOpponent(e.target.value)}>
              <option value="">すべての共通手順</option>
              {opponents.map((id) => <option value={id} key={id}>{id}</option>)}
            </select></label>
            {(query || run !== "all" || sort !== "discovery" || status !== "all" || opponent || shortlistOnly) && <button onClick={() => { setQuery(""); setRun("all"); setSort("discovery"); setStatus("all"); setOpponent(""); setShortlistOnly(false); }}>表示を戻す</button>}
          </div>
          <div className="candidate-view-tools">
            <button className="action-button" disabled={!visibleRows.length} onClick={() => command("candidate.exportVisible", {
              version: 1, search: { id: search.id, name: search.name, config: search.config },
              scope: "発見済み候補。全対応への保証なし", filters: { run, query, sort, status, opponent, shortlistOnly }, review,
              candidates: visibleRows.map(({ run, common, candidate, worst }) => ({ run, variant: report?.runs.find((r) => r.run === run)?.variant, commonOpponents: common, candidate, selectedWorst: worst })),
            })}>表示候補を書き出す</button>
            <SavedCandidateViews views={review.views ?? []} value={filters} disabled={!reviewReady} onApply={applyFilters}
              onSave={view => onReviewChange(current => ({...current, views: [...(current.views ?? []).filter(v => v.id !== view.id), view]}))}
              onDelete={id => onReviewChange(current => ({...current, views: (current.views ?? []).filter(v => v.id !== id)}))} />

          </div>
          {(sort !== "discovery" || status !== "all" || opponent) && <div className="candidate-active-filters" aria-label="適用中の表示条件">
            {sort !== "discovery" && <button onClick={() => setSort("discovery")} title="発見順に戻す">{({ worst: "最小点差順", baseline: "相手待機の点差順", pending: "未比較順" } as Record<string, string>)[sort]} ×</button>}
            {status !== "all" && <button onClick={() => setStatus("all")} title="検査状況の絞り込みを解除">{({ comparable: "共通比較あり", pending: "未比較あり", blocked: "実行不可あり" } as Record<string, string>)[status]} ×</button>}
            {opponent && <button onClick={() => setOpponent("")} title={`相手手順 ${opponent} の固定を解除`}>相手 {opponent.slice(0, 12)} ×</button>}
          </div>}
          <div className="candidate-scope-tools" aria-label="表示候補の一括比較">
            <span>比較中 {review.shortlist.length}件{hiddenComparisons > 0 ? `（一覧外 ${hiddenComparisons}件）` : ""}</span>
            <button disabled={!reviewReady || !visibleKeys.length || selectedVisibleCount === visibleKeys.length} onClick={() => saveReview(value => ({...value, shortlist: mergeShortlistScope(value.shortlist, visibleKeys, "add")}))}>表示中{visibleKeys.length}件を比較に追加</button>
            <button disabled={!reviewReady || !selectedVisibleCount} onClick={() => saveReview(value => ({...value, shortlist: mergeShortlistScope(value.shortlist, visibleKeys, "remove")}))}>表示中の比較を解除</button>
          </div>
          <CandidateRecovery rows={rows} visibleKeys={visibleKeys} shortlist={review.shortlist} onReveal={revealCandidate} />
          {run === "all" && ["worst", "baseline"].includes(sort) && <p className="candidate-caveat">構成ごとに点差順で表示</p>}
          {selectedRun && <p>{configuration(selectedRun.variant)}</p>}
          <nav className="candidate-region-nav" aria-label="作戦候補の領域へ移動">
            <button onClick={() => focusRegion("list")}>候補一覧</button>
            <Help topic="results" title="候補一覧" text="候補一覧は、探索で見つかった作戦を選んで比較する表です。同じ機体構成・相手手順での結果を確認できます。" />
            <button disabled={!review.shortlist.length} onClick={() => focusRegion("comparison")}>横比較{review.shortlist.length ? ` · ${review.shortlist.length}` : ""}</button>
            <button disabled={!active || !chosen} onClick={() => focusRegion("inspector")}>選択候補の検査</button>
          </nav>
          <div className={`candidate-workbench${review.shortlist.length ? " has-comparison" : ""}${active && chosen ? " has-inspector" : ""}`}>
          <div className="candidate-collection">
          <div
            className="candidate-table"
            tabIndex={-1}
            role="region"
            aria-label="作戦候補の比較表"
          >
            <table role="grid" aria-label="作戦候補。上下キーで選択、Enterで3Dに表示">
              <thead>
                <tr>
                  <th>比較</th>
                  <th>完了した建設・反転の順序</th>
                  <th>構成</th>
                  <th>
                    相手待機
                    <br />赤 対 青
                  </th>
                  <th>相手の対応</th>
                  <th>{opponent ? "指定した共通手順での最小点差" : "共通の相手手順での最小点差"}</th>

                </tr>
              </thead>
              <tbody>
                {!visibleRows.length && <tr><td colSpan={6}>一致する候補がありません。
                  <div className="candidate-target-tools">
                    {query && <button onClick={() => setQuery("")}>検索語を解除</button>}
                    {shortlistOnly && <button onClick={() => setShortlistOnly(false)}>比較中のみを解除</button>}
                    <button onClick={() => applyFilters({run:"all", query:"", sort:"discovery", status:"all", opponent:"", shortlistOnly:false})}>すべての候補を表示</button>
                  </div></td></tr>}
                {visibleRows.map(({ run: r, common, candidate: c, worst }) => {
                    return (
                      <tr key={`${r}/${c.id}`} data-candidate-key={candidateKey(r,c.id)} data-selectable-row aria-selected={active?.candidate.id === c.id && active.run === r} tabIndex={active?.candidate.id === c.id && active.run === r ? 0 : -1}
                        onFocus={event => { if (event.target !== event.currentTarget) return; if (active?.candidate.id !== c.id || active.run !== r) { setSelected(`${r}/${c.id}`); setResponseKey("worst"); } }}
                        onClick={event => event.currentTarget.focus()}
                        onKeyDown={event => navigateRow(event, () => { const evidence = worst ?? c.baseline; if (evidence.path.length) onOpen(r, evidence); })}
                        onDoubleClick={() => { const evidence = worst ?? c.baseline; if (evidence.path.length) onOpen(r, evidence); }}>
                        <td><input type="checkbox" aria-label={`C${r} ${c.id} を横比較`} checked={review.shortlist.includes(candidateKey(r,c.id))} disabled={!reviewReady} onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()} onChange={() => saveReview(value => toggleShortlist(value, candidateKey(r,c.id)))} /></td>
                        <td><span>{candidatePlanLabel(c.plan)}</span><small className="candidate-identity" title={`作戦 ${c.baseline.strategy} / 展開 ${c.id}`}>{c.baseline.strategy.slice(0, 14)} · 展開 {c.id.slice(0, 14)}</small>{terms.length > 0 && <CandidateQueryMatch fields={matchCandidateQuery(buildCandidateIndex({run:r, common, candidate:c}),terms).fields} />}</td>
                        <td className="candidate-config-id">C{r}</td>
                        <td>{score(c.baseline)}</td>
                        <td>
                          {c.responses.length}展開確認
                          <small className="candidate-secondary">共通 {common.length}手順 · 未比較 {c.pending}手順</small>
                        </td>
                        <td>
                          {worst === null
                            ? "共通比較待ち"
                            : `${margin(worst) > 0 ? "+" : ""}${margin(worst)}点`}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {!!review.shortlist.length && <div className="candidate-comparison-region" tabIndex={-1}><ComparisonMatrix rows={rows.filter(row => review.shortlist.includes(candidateKey(row.run,row.candidate.id)))} onOpen={onOpen} onInspect={(run, id, evidence) => {
            revealCandidate(candidateKey(run,id));
            setStatus("all"); setOpponent("");
            const row = rows.find(row => row.run === run && row.candidate.id === id);
            setResponseKey(row?.candidate.baseline === evidence ? "baseline" : responseIdentity(run,id,evidence));
            requestAnimationFrame(() => focusRegion("inspector"));
          }} onRemove={key => saveReview(value => ({...value, shortlist: value.shortlist.filter(k => k !== key)}))} onClear={() => saveReview(value => ({...value, shortlist: []}))} /></div>}
          </div>
          {active && chosen && <aside className="candidate-inspector" aria-label="選択候補の検査" tabIndex={-1}>
            <header><strong>C{active.run} · {active.candidate.id.slice(0, 14)}</strong><button className="candidate-text-action" onClick={() => focusRegion("list")}>一覧へ戻る</button></header>
            <ResponseBrowser key={`${active.run}/${active.candidate.id}`} options={evidenceOptions} selectedKey={chosen.key} commonOpponents={active.common} onSelect={setResponseKey} onOpen={option => onOpen(active.run, option.evidence)} />
            <div className="candidate-target-tools" role="group" aria-label="選択展開の操作">
              <button className="primary" disabled={!chosen.evidence.path.length} onClick={() => onOpen(active.run, chosen.evidence)}>3Dに表示</button>
              {(["A", "B"] as const).map(side => <button className="candidate-slot-action" key={side} disabled={!chosen.evidence.path.length} onClick={() => command(`candidate.compare${side}`, { path: chosen.evidence.path, node: chosen.evidence.node, label: candidateComparisonLabel(`C${active.run} · ${active.candidate.id.slice(0, 8)} · ${chosen.label}`, chosen.evidence) })}>比較 {side} に割当</button>)}
            </div>
            <button className="candidate-text-action" onClick={() => command("compare.open")}>A/B比較へ</button>
            <EvidenceScoreDelta evidence={chosen.evidence} baseline={active.candidate.baseline} />
            <MilestoneInspector evidence={chosen.evidence} baseline={active.candidate.baseline} />
            <EvidenceDiagnostics key={responseIdentity(active.run,active.candidate.id,chosen.evidence)} evidence={chosen.evidence} onOpenAt={issue => command("candidate.inspectIssue", { evidence: chosen.evidence, issue })} />
          </aside>}
          </div>
          <footer className="candidate-status">未探索 {report.runs.filter(r => run === "all" || String(r.run) === run).reduce((n, r) => n + r.frontier, 0).toLocaleString()}局面 · 未計算 {report.runs.filter(r => run === "all" || String(r.run) === run).reduce((n, r) => n + r.remainingChoices, 0).toLocaleString()}組 <Help topic="search" title="未探索・未計算" text="未探索は、見つかった局面のうち、まだ先の行動を調べていない件数です。未計算は、まだ結果を求めていない行動の組合せ数です。" /></footer>
        </>
      )}
    </section>
  );
}
