import { title, modes, ends, supplies } from "./plans.js";
import { capabilities, defaultEstimates, requirements, effort, rankedPlans, filterRows } from "./effort.js";
import { families, familyOf, technicalGroups, predecessors } from "./structure.js";
const describe = p => `${p.id} ${title(p)} ${modes[p.mode]} ${p.mission ? "ムスティカ設置あり" : "ムスティカ設置なし"} ${ends[p.end]} ${supplies[p.supply]} ${requirements(p).map(c => c.name).join(" ")}`;
const signed = n => `${n >= 0 ? "+" : ""}${Math.round(n * 10) / 10}`;
export function createCatalogPanel(root, plans, onSelect) {
  const q = s => root.querySelector(s), list = q("#list");
  let selectedId = plans[0].id, results = new Map(), estimates = defaultEstimates(), compared = [], expanded = true, family = "";
  const openGroups = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem("strata-effort-v1"));
    for (const c of capabilities) if (Number.isFinite(saved?.[c.id]) && saved[c.id] >= 0 && saved[c.id] <= 999) estimates[c.id] = saved[c.id];
  } catch { /* Storage is optional. */ }
  function setExpanded(value) {
    expanded = value;
    q("main").classList.toggle("catalog-expanded", value);
    q("#catalog-toggle").textContent = value ? "3D・計算条件へ" : "工数と得点を比較";
    q("#catalog-toggle").setAttribute("aria-expanded", String(value));
  }
  q("#catalog-toggle").onclick = () => setExpanded(!expanded);
  function renderEstimates() {
    q("#effort-inputs").innerHTML = capabilities.map(c => `<label>${c.name}<span><input type="number" min="0" max="999" step="0.5" data-effort="${c.id}" value="${estimates[c.id]}" aria-label="${c.name}の人日"> 人日</span></label>`).join("");
  }
  q("#effort-inputs").onchange = e => {
    const id = e.target.dataset.effort;
    if (!id) return;
    if (!e.target.value || !e.target.checkValidity()) { e.target.value = estimates[id]; return; }
    estimates[id] = Number(e.target.value);
    try { localStorage.setItem("strata-effort-v1", JSON.stringify(estimates)); } catch { /* Session still works. */ }
    render();
  };
  q("#reset-estimates").onclick = () => {
    estimates = defaultEstimates();
    try { localStorage.removeItem("strata-effort-v1"); } catch { /* Optional. */ }
    renderEstimates(); render();
  };
  function chart(rows) {
    const measured = rows.filter(r => r.scores);
    if (!measured.length) return '<p class="chart-empty">「全案を計算」で得点を比較できます。<br>先に工数の上限や必要な技術で絞り込めます。</p>';
    const maxDays = Math.max(1, ...measured.map(r => r.days)), maxScore = Math.max(1, ...measured.map(r => r.scores[0]));
    const x = r => 50 + r.days / maxDays * 440, y = r => 200 - r.scores[0] / maxScore * 166;
    // Equal outcomes occupy one point; the list retains every variant.
    const groups = new Map();
    for (const r of measured) {
      const key = `${r.days}:${r.scores[0]}`, old = groups.get(key);
      if (!old || r.plan.id === selectedId) groups.set(key, r);
    }
    return `<svg viewBox="0 0 530 240" role="img" aria-label="横軸は開発工数、人日。縦軸は赤の最終得点。左上ほど少ない工数で高得点。作戦は一覧から選択できます。">
      ${[0, .5, 1].map(t => `<path class="chart-grid" d="M50 ${200 - t * 166}H490"/><text x="42" y="${204 - t * 166}" text-anchor="end">${Math.round(maxScore * t)}</text><text x="${50 + t * 440}" y="218" text-anchor="middle">${Math.round(maxDays * t * 10) / 10}</text>`).join("")}
      <text x="50" y="18">赤の最終得点</text><text x="490" y="237" text-anchor="end">開発工数（人日・仮見積もり）</text>
      ${[...groups.values()].sort((a,b) => Number(a.plan.id === selectedId) - Number(b.plan.id === selectedId)).map(r => `<circle cx="${x(r)}" cy="${y(r)}" r="${r.plan.id === selectedId ? 7 : 4}" class="${r.frontier ? "frontier" : ""} ${r.plan.id === selectedId ? "picked" : ""}"><title>作戦 ${r.plan.id}：${r.days}人日 / ${r.scores[0]}点</title></circle>`).join("")}</svg>`;
  }
  function render() {
    const focus = list.contains(document.activeElement) ? { id: document.activeElement.dataset.id, action: document.activeElement.dataset.action, group: document.activeElement.closest("[data-group]")?.dataset.group } : null;
    const focusedFamily = q("#family-nav").contains(document.activeElement) ? document.activeElement.dataset.family : null;
    const rows = rankedPlans(plans, results, estimates);
    const filtered = filterRows(rows, { query: q("#search").value, mode: q("#mode").value, mission: q("#mission").value, budget: q("#budget").value, frontier: q("#frontier-only").checked, sort: q("#catalog-sort").value }, describe);
    const items = filtered.filter(r => !family || familyOf(r.plan) === family);
    const groups = technicalGroups(items), allGroups = technicalGroups(rows);
    q("#family-nav").innerHTML = [{ id: "", name: "すべて", description: "技術構成から選ぶ" }, ...families].map(f => `<button data-family="${f.id}" aria-pressed="${family === f.id}"><b>${f.name}</b><span>${filtered.filter(r => !f.id || familyOf(r.plan) === f.id).length}案</span><small>${f.description}</small></button>`).join("");
    q("#count").textContent = `${groups.length}構成 / ${items.length}案`;
    q("#catalog-status").textContent = `${results.size} / ${plans.length}案を計算済み${results.size < plans.length ? " · 得点・効率候補は計算済みの範囲" : " · 現在の相手・性能・乱数での結果"}`;
    const recipe = ({ plan: p, days, scores, frontier }) => `<article class="recipe ${p.id === selectedId ? "selected" : ""}">
      <button class="recipe-select" data-id="${p.id}" data-action="select" aria-pressed="${p.id === selectedId}"><span class="recipe-title"><span class="index">#${String(p.id).padStart(3,"0")}</span><b>${title(p)}</b></span><span class="recipe-description">${modes[p.mode]} · ${p.mission ? "ムスティカ設置あり" : "ムスティカ設置なし"}</span><small>${supplies[p.supply]} · ${ends[p.end]}</small><span class="recipe-metrics"><strong>${days}<small> 人日</small></strong><span>${scores ? `赤 ${scores[0]} / 青 ${scores[1]}` : "得点未計算"}</span>${frontier ? '<span class="frontier-label">効率候補</span>' : ""}</span></button>
      <button class="compare-add" data-id="${p.id}" data-action="compare" aria-label="作戦 ${p.id}を比較${compared.includes(p.id) ? "から外す" : "に追加"}" aria-pressed="${compared.includes(p.id)}" ${compared.length >= 3 && !compared.includes(p.id) ? "disabled" : ""}>${compared.includes(p.id) ? "比較中" : "比較に追加"}</button></article>`;
    list.innerHTML = groups.map(g => `<details class="technical-group" data-group="${g.key}" ${openGroups.has(g.key) ? "open" : ""}><summary><span class="group-title">${families.find(f => f.id === g.family).name}<small>${g.name}</small></span><span class="group-stats"><b>${g.days} 人日</b><span>${g.best ? `最高 ${g.maxScore}点` : "得点未計算"}</span><small>${g.rows.length}案${g.frontier ? " · 効率候補あり" : ""}</small></span></summary><div class="group-content"><p>${families.find(f => f.id === g.family).flow}</p><p>同じ技術構成で、積み上げ場所・供給・裏返し時期を変更。${g.best ? `計算済み${g.scored}案の赤得点は ${g.minScore}〜${g.maxScore}点。` : "全案を計算すると有力な運用案を確認できます。"}</p>${g.best ? `<button class="group-best" data-action="select" data-id="${g.best.plan.id}">この構成の最高得点案 #${g.best.plan.id}を確認</button>` : ""}${g.rows.map(recipe).join("")}</div></details>`).join("") || '<p class="empty">該当する作戦がありません。条件を解除するか、得点が必要な場合は全案を計算してください。</p>';
    if (focus) list.querySelector(focus.id ? `[data-id="${focus.id}"][data-action="${focus.action}"]` : `[data-group="${focus.group}"] > summary`)?.focus({ preventScroll: true });
    if (focusedFamily !== null) q(`#family-nav [data-family="${focusedFamily}"]`)?.focus({ preventScroll: true });
    q("#tradeoff-chart").innerHTML = chart(items);
    const p = plans.find(p => p.id === selectedId), row = rows.find(r => r.plan.id === selectedId);
    const group = allGroups.find(g => g.rows.some(r => r.plan.id === selectedId));
    const parents = predecessors(group, allGroups);
    q("#plan-detail").innerHTML = `<div class="detail-heading"><h2>作戦 #${p.id} · ${title(p)}</h2><button id="preview-plan">3Dで確認</button></div><p class="plan-flow">${families.find(f => f.id === familyOf(p)).flow}</p><p>積み上げ場所の優先順：${title(p)}<br>${modes[p.mode]} / ${p.mission ? "ムスティカ設置あり" : "ムスティカ設置なし"}<br>${supplies[p.supply]} / ${ends[p.end]}</p><div class="detail-total"><b>${row.days} 人日</b><span>${row.scores ? `赤 ${row.scores[0]}点 / 青 ${row.scores[1]}点` : "全案計算後に得点を表示"}</span></div><section class="investment-path"><h3>技術を追加する前の構成と比べる</h3><p>必要技術が包含関係にある直前の構成です。各構成の最高得点案と、この選択案の差を確認できます。</p>${parents.length ? parents.map(g => `<button data-parent="${g.key}" ${g.best ? "" : "disabled"}><span>${families.find(f => f.id === g.family).name} · ${g.name}</span><small>追加 ${signed(row.days - g.days)} 人日${g.best && row.scores ? ` / 赤の得点 ${signed(row.scores[0] - g.best.scores[0])}点` : " / 全案計算後に比較"}</small></button>`).join("") : "<p>このカタログの最小構成です。</p>"}</section><h3>必要な技術と工数</h3><dl>${requirements(p).map(c => `<div><dt>${c.name}<small>${c.reason}</small></dt><dd>${estimates[c.id]} 人日</dd></div>`).join("")}</dl><p class="effort-note">優先する場所・行動から見積もっています。優先する場所が使えない場合は、ほかの場所でも積み上げます。実機の対応範囲は別途確認してください。</p>`;
    q("#plan-detail").querySelectorAll("[data-parent]").forEach(button => { button.onclick = () => { const parent = allGroups.find(g => g.key === button.dataset.parent); compared = [parent.best.plan.id, selectedId]; render(); q("#comparison").scrollIntoView({ block: "center" }); }; });
    q("#preview-plan").onclick = () => setExpanded(false);
    const chosen = compared.map(id => rows.find(r => r.plan.id === id));
    const first = chosen[0];
    q("#comparison").innerHTML = !chosen.length ? '<p>気になる作戦を最大3案追加すると、工数・得点・必要な技術の差を横並びで確認できます。</p>' : `<div class="comparison-scroll"><table><caption>先頭の作戦 #${first.plan.id}を基準に比較</caption><thead><tr><th scope="col">比較項目</th>${chosen.map(r => `<th scope="col">#${r.plan.id} ${title(r.plan)}<button data-remove="${r.plan.id}" aria-label="作戦 ${r.plan.id}を比較から外す">外す</button></th>`).join("")}</tr></thead><tbody>${[
      ["方針", r => `${modes[r.plan.mode]}・${r.plan.mission ? "ムスティカ設置あり" : "ムスティカ設置なし"}<br>${supplies[r.plan.supply]}・${ends[r.plan.end]}`],
      ["開発工数", r => `${r.days} 人日（${signed(r.days - first.days)}）`],
      ["赤の最終得点", r => r.scores ? `${r.scores[0]} 点${first.scores ? `（${signed(r.scores[0] - first.scores[0])}）` : ""}` : "未計算"],
      ["赤 − 青の得点差", r => r.scores ? `${signed(r.scores[0] - r.scores[1])} 点` : "未計算"],
      ["追加する技術", r => requirements(r.plan).filter(c => !requirements(first.plan).includes(c)).map(c => c.name).join("、") || "なし"],
      ["省ける技術", r => requirements(first.plan).filter(c => !requirements(r.plan).includes(c)).map(c => c.name).join("、") || "なし"],
    ].map(([name, value]) => `<tr><th scope="row">${name}</th>${chosen.map(r => `<td>${value(r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  list.addEventListener("toggle", e => { const key = e.target.dataset.group; if (key) { if (e.target.open) openGroups.add(key); else if (list.contains(e.target)) openGroups.delete(key); } }, true);
  q("#family-nav").onclick = e => { const button = e.target.closest("[data-family]"); if (button) { family = button.dataset.family; list.scrollTop = 0; render(); } };
  list.onclick = e => {
    const button = e.target.closest("button[data-id]");
    if (!button) return;
    const id = Number(button.dataset.id);
    if (button.dataset.action === "select") onSelect(id);
    else { compared = compared.includes(id) ? compared.filter(x => x !== id) : compared.length < 3 ? [...compared, id] : compared; render(); }
  };
  q("#comparison").onclick = e => { const button = e.target.closest("[data-remove]"); if (button) { compared = compared.filter(id => id !== Number(button.dataset.remove)); render(); } };
  for (const name of ["search", "mode", "mission", "budget", "frontier-only", "catalog-sort"]) q(`#${name}`).oninput = () => { list.scrollTop = 0; render(); };
  q("#clear-filters").onclick = () => { for (const name of ["search", "mode", "mission", "budget"]) q(`#${name}`).value = ""; q("#frontier-only").checked = false; family = ""; list.scrollTop = 0; render(); };
  renderEstimates(); setExpanded(true);
  return { exportAnalysis() { return { effortUnit: "person-days", effortBasis: "editable planning assumptions, not measured", estimates: { ...estimates }, compared: compared.map(id => ({ plan: plans.find(p => p.id === id), days: effort(plans.find(p => p.id === id), estimates), scores: results.get(id) ?? null })), calculatedPlans: results.size }; }, update(id, nextResults) { selectedId = id; results = nextResults; render(); } };
}
export function catalogMarkup(count) {
  return `<aside class="catalog">
    <div class="paneltitle"><h1>作戦カタログ</h1><span id="count"></span></div>
    <button id="catalog-toggle" aria-expanded="true">3D・計算条件へ</button>
    <div class="cataloghead">
      <p class="catalog-intro">得点の狙い → 技術構成 → 運用案の順に検討。<small>工数は編集可能な仮見積もりです。各構成を開くと、同じ技術で実行できる案を比較できます。</small></p>
      <input id="search" placeholder="番号・場所・技術で検索" aria-label="作戦を検索">
      <div class="filters"><select id="mode" aria-label="作戦方式"><option value="">すべての方式</option><option value="build">一から積み上げる</option><option value="reuse">土台を利用</option><option value="flip">上段ブロックを裏返す</option></select><select id="mission" aria-label="ムスティカ設置の有無"><option value="">ムスティカ設置の有無</option><option value="yes">ムスティカを設置する</option><option value="no">ムスティカを設置しない</option></select></div>
      <div class="filters"><label>工数上限<input id="budget" type="number" min="0" step="0.5" placeholder="指定なし" aria-label="工数上限（人日）"></label><label>並べ替え<select id="catalog-sort"><option value="effort">工数が少ない順</option><option value="score">赤の得点順</option><option value="margin">赤−青の得点差順</option><option value="id">番号順</option></select></label></div>
      <div class="filter-actions"><label><input id="frontier-only" type="checkbox"> 効率候補のみ</label><button id="clear-filters">条件を解除</button></div>
    </div>
    <nav id="family-nav" aria-label="得点の狙いで作戦を分類"></nav><div class="catalog-body"><section class="catalog-results" aria-label="作戦一覧"><p id="catalog-status" role="status"></p><div id="list"></div></section>
      <section class="catalog-analysis" aria-label="工数と得点の分析"><h2>工数と得点のトレードオフ</h2><p class="chart-caption">左上ほど少ない工数で高得点。緑は「効率候補」。工数が同等以下・得点が同等以上で、どちらかがより良い案がない候補です。</p><div id="tradeoff-chart"></div><p class="effort-note">得点は現在の条件での単一試合の簡略計算です。勝率ではありません。同じ工数・得点の点は重ねています。</p><div id="plan-detail"></div>
      <details id="effort-settings"><summary>工数の仮見積もりを編集</summary><p>初期値は比較のための仮置きです。設計・製作・調整を含む人日をチームの見積もりに変更してください。共通技術は1回だけ加算します。日程や人数による短縮は計算しません。</p><div id="effort-inputs"></div><button id="reset-estimates">初期値に戻す</button><p>見積もりはこのブラウザに保存されます。得点の計算条件には影響しません。</p></details></section>
    </div>
    <section class="catalog-comparison"><h2>候補を比較 <small>最大3案</small></h2><div id="comparison"></div></section>
    <div class="explore"><div><span id="explorelabel">同じ条件で全案を計算</span><b id="progress">0 / ${count}</b></div><progress aria-label="作戦の計算進捗" max="${count}" value="0"></progress><button id="explore">全案を計算</button></div>
  </aside>`;
}
