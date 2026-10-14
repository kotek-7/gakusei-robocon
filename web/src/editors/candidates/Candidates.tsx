import "./candidates.css";
import { Help } from "../common/Help";
import { useEffect, useState } from "react";
import { run as command } from "../../app/commands";
import "./commands";
import { responseIdentity, worstCommonResponse } from "./evidence";
import { navigateRow } from "./rowSelection";
import { milestoneCells } from "./milestones";
import { profileNames } from "../common/labels";
import type { CandidateEvidence, Goal, Search, Model, Variant } from "../../engine/types";

function goalLabel(g: Goal) {
  if (g.kind === "mustika") return "ムスティカ設置";
  if (g.kind === "deliver") return "受け渡し";
  return `${g.kind === "flip" ? "反転" : "建設"} ${g.spot}${g.height === 2 ? "（アース2段）" : ""}${g.at !== undefined ? `（${g.at}秒開始）` : ""}`;
}
const margin = (x: CandidateEvidence) => x.scores[0] - x.scores[1];
const score = (x: CandidateEvidence) => `${x.scores[0]} 対 ${x.scores[1]}`;

export type CandidateView = {
  selected: string; responseKey: string; run: string; query: string; sort: string; status: string; opponent: string; requestHandled?: number;
};

export function Candidates({
  search,
  model,
  onOpen,
  requestedRun,
  runRequest,
  initialView,
  onViewChange,
}: {
  initialView?: Partial<CandidateView>;
  onViewChange?: (view: CandidateView) => void;
  requestedRun?: string;
  runRequest?: number;
  search: Search;
  model: Model;
  onOpen: (run: number, evidence: CandidateEvidence) => void;
}) {
  const [selected, setSelected] = useState(initialView?.selected ?? "");
  const [responseKey, setResponseKey] = useState(initialView?.responseKey ?? "worst");
  const [run, setRun] = useState(initialView?.run ?? requestedRun ?? "all");
  const [requestHandled, setRequestHandled] = useState(initialView?.requestHandled);
  useEffect(() => { if (requestedRun !== undefined && (runRequest !== requestHandled || !initialView)) { setRun(requestedRun); setOpponent(""); setQuery(""); setStatus("all"); setRequestHandled(runRequest); } }, [requestedRun, runRequest]);
  const [query, setQuery] = useState(initialView?.query ?? "");
  const [sort, setSort] = useState(initialView?.sort ?? "discovery");
  const [status, setStatus] = useState(initialView?.status ?? "all");
  const [opponent, setOpponent] = useState(initialView?.opponent ?? "");
  useEffect(() => { onViewChange?.({ selected, responseKey, run, query, sort, status, opponent, requestHandled }); }, [selected, responseKey, run, query, sort, status, opponent, requestHandled]);
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
  const visibleRows = rows
    .filter(({ run: r, candidate: c }) =>
      (run === "all" || String(r) === run) &&
      `C${r} ${c.id} ${c.baseline.strategy} ${c.plan.map(goalLabel).join(" ")}`
        .toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    )
    .map((row) => {
      const worst = worstCommonResponse(row.candidate, row.common, opponent);
      return { ...row, worst };
    })
    .filter((row) => (!opponent || row.worst !== null) &&
      (status !== "pending" || row.candidate.pending > 0) &&
      (status !== "comparable" || row.worst !== null) &&
      (status !== "blocked" || row.candidate.responses.some((x) => (!opponent || x.opponent === opponent) && !!x.blocked?.length)))
    .sort((a, b) => {
      if (sort === "baseline") return margin(b.candidate.baseline) - margin(a.candidate.baseline);
      if (sort === "pending") return b.candidate.pending - a.candidate.pending;
      if (sort === "worst") {
        if (!a.worst) return b.worst ? 1 : 0;
        if (!b.worst) return -1;
        return margin(b.worst) - margin(a.worst);
      }
      return 0;
    });
  const active = visibleRows.find(row => `${row.run}/${row.candidate.id}` === selected) ?? visibleRows[0];
  const responses = active?.candidate.responses.filter(response => (!opponent || response.opponent === opponent) && (status !== "blocked" || !!response.blocked?.length)) ?? [];
  const evidenceOptions = active ? [
    ...(active.worst ? [{ key: "worst", label: "共通手順で最小点差", evidence: active.worst }] : []),
    { key: "baseline", label: "相手待機", evidence: active.candidate.baseline },
    ...responses.map((evidence, index) => ({ key: responseIdentity(active.run, active.candidate.id, evidence), label: `対応${index + 1} · ${evidence.opponent?.slice(0, 14) ?? "相手手順"}`, evidence })),
  ] : [];
  const chosen = evidenceOptions.find(option => option.key === responseKey) ?? evidenceOptions[0];
  return (
    <section className="evaluation candidates">

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
              <input type="search" value={query} placeholder="手順・作戦ID" onChange={(e) => setQuery(e.target.value)} />
            </label>
            <span className="candidate-count">{visibleRows.length} / {rows.length}候補</span>
            <details className="candidate-display-options" onKeyDown={event => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
              <summary>表示・出力{sort !== "discovery" || status !== "all" || opponent ? " •" : ""}</summary>
              <div className="candidate-option-fields">
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
            {(query || run !== "all" || sort !== "discovery" || status !== "all" || opponent) && <button onClick={() => { setQuery(""); setRun("all"); setSort("discovery"); setStatus("all"); setOpponent(""); }}>表示を戻す</button>}
            <button className="action-button" disabled={!visibleRows.length} onClick={() => command("candidate.exportVisible", {
              version: 1, search: { id: search.id, name: search.name, config: search.config },
              scope: "発見済み候補。全対応への保証なし", filters: { run, query, sort, status, opponent },
              candidates: visibleRows.map(({ run, common, candidate, worst }) => ({ run, variant: report?.runs.find((r) => r.run === run)?.variant, commonOpponents: common, candidate, selectedWorst: worst })),
            })}>表示候補を書き出す</button>

              </div>
            </details>
          </div>
          {(sort !== "discovery" || status !== "all" || opponent) && <div className="candidate-active-filters" aria-label="適用中の表示条件">
            {sort !== "discovery" && <button onClick={() => setSort("discovery")} title="発見順に戻す">{({ worst: "最小点差順", baseline: "相手待機の点差順", pending: "未比較順" } as Record<string, string>)[sort]} ×</button>}
            {status !== "all" && <button onClick={() => setStatus("all")} title="検査状況の絞り込みを解除">{({ comparable: "共通比較あり", pending: "未比較あり", blocked: "実行不可あり" } as Record<string, string>)[status]} ×</button>}
            {opponent && <button onClick={() => setOpponent("")} title={`相手手順 ${opponent} の固定を解除`}>相手 {opponent.slice(0, 12)} ×</button>}
          </div>}
          {selectedRun && <p>{configuration(selectedRun.variant)}</p>}
          {opponent && <p className="candidate-caveat">相手手順 {opponent} に固定 · 同一構成内で比較 <Help topic="results" text="指定した相手手順について、全裁定分岐を検査済みの結果だけを表示しています。" /></p>}
          <p className="candidate-caveat">確認済み手順の結果 · 全対応への保証なし <Help topic="results" text="点差は確認済みの相手手順での結果です。同じ構成・共通の相手手順で比較してください。" /></p>
          <div className="candidate-workbench">
          <div
            className="candidate-table"
            role="region"
            aria-label="作戦候補の比較表"
          >
            <table role="grid" aria-label="作戦候補。上下キーで選択、Enterで3Dに表示">
              <thead>
                <tr>
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
                {!visibleRows.length && <tr><td colSpan={5}>一致する候補がありません。検索語や構成を変更してください。</td></tr>}
                {visibleRows.map(({ run: r, common, candidate: c, worst }) => {
                    return (
                      <tr key={`${r}/${c.id}`} data-selectable-row aria-selected={active?.candidate.id === c.id && active.run === r} tabIndex={active?.candidate.id === c.id && active.run === r ? 0 : -1}
                        onFocus={() => { if (active?.candidate.id !== c.id || active.run !== r) { setSelected(`${r}/${c.id}`); setResponseKey("worst"); } }}
                        onClick={event => event.currentTarget.focus()}
                        onKeyDown={event => navigateRow(event, () => { const evidence = worst ?? c.baseline; if (evidence.path.length) onOpen(r, evidence); })}
                        onDoubleClick={() => { const evidence = worst ?? c.baseline; if (evidence.path.length) onOpen(r, evidence); }}>
                        <td><span>{c.plan.map(goalLabel).join(" → ") || "建設・反転なし"}</span><small className="candidate-identity" title={`作戦 ${c.baseline.strategy} / 展開 ${c.id}`}>{c.baseline.strategy.slice(0, 14)} · 展開 {c.id.slice(0, 14)}</small></td>
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
          {active && chosen && <aside className="candidate-inspector" aria-label="選択候補の検査">
            <header><strong>C{active.run} · {active.candidate.id.slice(0, 14)}</strong></header>
            <div className="candidate-evidence-list"><table role="grid" aria-label="検査した展開。上下キーで選択、Enterで3Dに表示"><thead><tr><th>相手の展開</th><th>赤 対 青</th></tr></thead><tbody>{evidenceOptions.map(option => <tr key={option.key} data-selectable-row aria-selected={chosen.key === option.key} tabIndex={chosen.key === option.key ? 0 : -1} onFocus={() => setResponseKey(option.key)} onClick={event => event.currentTarget.focus()} onKeyDown={event => navigateRow(event, () => { if (option.evidence.path.length) onOpen(active.run, option.evidence); })} onDoubleClick={() => { if (option.evidence.path.length) onOpen(active.run, option.evidence); }}><td>{option.label}{!!option.evidence.blocked?.length && <small>実行不可 {option.evidence.blocked.length}件</small>}</td><td>{score(option.evidence)}</td></tr>)}</tbody></table></div>
            {chosen.key !== "worst" && chosen.key !== "baseline" && <span className="muted">{"shared" in chosen.evidence && chosen.evidence.shared ? "共有手順での検査" : "この候補への対抗手探索"}</span>}
            <div className="candidate-target-tools" role="group" aria-label="選択展開の操作">
              <button className="primary" disabled={!chosen.evidence.path.length} onClick={() => onOpen(active.run, chosen.evidence)}>3Dに表示</button>
              {(["A", "B"] as const).map(side => <button className="candidate-slot-action" key={side} disabled={!chosen.evidence.path.length} onClick={() => command(`candidate.compare${side}`, { path: chosen.evidence.path, node: chosen.evidence.node, label: `C${active.run} · ${active.candidate.id.slice(0, 8)} · ${chosen.label}` })}>比較 {side} に割当</button>)}
            </div>
            <button className="candidate-text-action" onClick={() => command("compare.open")}>A/B比較へ</button>
            <dl><div><dt>赤 対 青</dt><dd>{score(chosen.evidence)}</dd></div><div><dt>点差</dt><dd>{margin(chosen.evidence)}点</dd></div></dl>
            <div className="candidate-milestones"><table aria-label="選択展開の動作順。組番号が同じ動作は同時刻"><thead><tr><th>組</th><th>機体</th><th>動作</th><th>場所</th><th>物体</th></tr></thead>{chosen.evidence.milestones.map((events, groupIndex) => <tbody key={groupIndex}>{events.map((event, eventIndex) => { const cells = milestoneCells(event); return <tr key={eventIndex} title={cells.full}>{eventIndex === 0 && <th scope="rowgroup" rowSpan={events.length}>{groupIndex + 1}</th>}<td>{cells.actor}</td><td>{cells.action}<small>{cells.phase}</small></td><td>{cells.location}</td><td>{cells.objects}</td></tr>; })}</tbody>)}</table></div>
            {!!chosen.evidence.blocked?.length && <div className="candidate-blocked"><strong>実行不可 {chosen.evidence.blocked.length}件</strong><ul>{chosen.evidence.blocked.map((block, index) => <li key={index}>{block.t}秒 · {['赤TR', '赤BR', '青TR', '青BR'][block.robot] ?? block.robot} · 手順{block.instruction + 1}：{block.reason}</li>)}</ul></div>}
          </aside>}
          </div>
          <footer className="candidate-status">未探索 {report.runs.filter(r => run === "all" || String(r.run) === run).reduce((n, r) => n + r.frontier, 0).toLocaleString()}局面 · 未計算 {report.runs.filter(r => run === "all" || String(r.run) === run).reduce((n, r) => n + r.remainingChoices, 0).toLocaleString()}組 <Help topic="search" text={report.scope} /></footer>
        </>
      )}
    </section>
  );
}
