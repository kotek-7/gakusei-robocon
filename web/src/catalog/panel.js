import { title, zoneNames } from "./plans.js";
import {
  capabilities,
  defaultEstimates,
  requirements,
  effort,
} from "./effort.js";
import {
  stages,
  initialHardware,
  canonicalPlans,
  candidates,
  scoreRange,
} from "./navigation.js";
import { responseGroup } from "./decisions.js";
const span = (r) =>
  r ? (r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`) : "未計算";
const route = (r) => (r === "ramp" ? "スロープ" : "階段");
export function catalogMarkup() {
  return `<aside class="catalog"><div class="catalog-heading"><h1>作戦カタログ</h1><button id="catalog-toggle">再生画面へ</button></div><div class="catalog-workspace"><nav id="decision-path" aria-label="分類と工数の絞り込み"></nav><section id="selection-area" aria-label="階層カタログ"></section><aside id="outlook" aria-label="現在の条件での得点と工数"></aside></div></aside>`;
}
export function createCatalogPanel(root, unused, onSelect) {
  const q = (s) => root.querySelector(s),
    plans = canonicalPlans();
  let answers = {},
    selected = null,
    openGroups = new Set(["mission=no", "mission=yes"]),
    hardware = initialHardware(),
    estimates = defaultEstimates(),
    budget = "",
    run = null,
    context = "",
    results = new Map(),
    worker = null,
    responseWorker = null,
    responseMatches = null,
    status = "idle",
    responseStatus = "",
    expanded = true,
    total = 0,
    done = 0;
  try {
    const saved = JSON.parse(localStorage.getItem("strata-effort-v1"));
    for (const c of capabilities)
      if (
        Number.isFinite(saved?.[c.id]) &&
        saved[c.id] >= 0 &&
        saved[c.id] <= 999
      )
        estimates[c.id] = saved[c.id];
  } catch {}
  const current = () => candidates(plans, answers, hardware, estimates, budget);
  function setExpanded(value) {
    expanded = value;
    q("main").classList.toggle("catalog-expanded", value);
    q("#catalog-toggle").textContent = value ? "再生画面へ" : "カタログに戻る";
    q("#catalog-toggle").setAttribute("aria-expanded", String(value));
  }
  q("#catalog-toggle").onclick = () => setExpanded(!expanded);
  function stopResponses() {
    responseWorker?.terminate();
    responseWorker = null;
    responseMatches = null;
    responseStatus = "";
  }
  function stop() {
    worker?.terminate();
    worker = null;
    status = "stopped";
  }
  function calculate() {
    stop();
    results = new Map();
    done = 0;
    const choices = candidates(plans, {}, hardware, estimates);
    total = choices.length;
    if (!total) {
      status = "complete";
      renderMetrics();
      return;
    }
    try {
      worker = new Worker("/catalog-worker.js", { type: "module" });
    } catch {
      status = "error";
      renderMetrics();
      return;
    }
    const active = worker;
    status = "running";
    renderMetrics();
    worker.onmessage = ({ data }) => {
      if (worker !== active) return;
      results.set(data.id, data);
      done = data.count;
      if (done === total) {
        stop();
        status = "complete";
      }
      if (done % 12 === 0 || status === "complete") renderMetrics();
    };
    worker.onerror = () => {
      if (worker !== active) return;
      stop();
      status = "error";
      renderMetrics();
    };
    worker.postMessage({
      type: "catalog",
      plans: choices,
      enemy: run.enemy,
      cfg: run.cfg,
    });
  }
  function responses() {
    stopResponses();

    if (!selected) return;
    try {
      responseWorker = new Worker("/catalog-worker.js", { type: "module" });
    } catch {
      responseStatus = "計算を開始できませんでした。";
      renderResponses();
      return;
    }
    const active = responseWorker;
    responseStatus = "相手の対応を計算中…";
    renderResponses();
    responseWorker.onmessage = ({ data }) => {
      if (responseWorker !== active) return;
      responseStatus = `相手の対応を計算中 ${data.count} / ${data.total}作戦`;
      if (data.matches) {
        responseMatches = data.matches;
        responseWorker.terminate();
        responseWorker = null;
        responseStatus = `297相手作戦・競合優先順2通りの結果`;
      }
      renderResponses();
    };
    responseWorker.onerror = () => {
      if (responseWorker !== active) return;
      stopResponses();
      responseStatus = "計算できませんでした。再試行してください。";
      renderResponses();
    };
    responseWorker.postMessage({
      type: "responses",
      plan: selected,
      cfg: run.cfg,
    });
  }

  const dimensions = stages.filter((s) => s.id !== "hardware");
  const valueOf = (p, id) =>
    id === "mission"
      ? p.mission
        ? "yes"
        : "no"
      : id === "reuse"
        ? p.mode === "reuse"
          ? "yes"
          : "no"
        : id === "flip"
          ? p.mode === "flip" || p.end === "flip"
            ? "always"
            : p.end === "late"
              ? "late"
              : "never"
          : id === "zones"
            ? p.zones.join("")
            : p[id];
  function label(id, value) {
    return id === "zones"
      ? value
          .split("")
          .map((z) => zoneNames[z])
          .join(" → ")
      : (dimensions
          .find((s) => s.id === id)
          ?.options?.find((o) => o[0] === value)?.[1] ?? value);
  }
  const encode = (path) =>
    Object.entries(path)
      .map(([k, v]) => `${k}=${v}`)
      .join("/");
  const decode = (key) =>
    Object.fromEntries(
      key
        .split("/")
        .filter(Boolean)
        .map((x) => x.split("=")),
    );
  const stats = (rows) =>
    `${rows.length}作戦 · ${rows.length ? span([Math.min(...rows.map((p) => effort(p, estimates))), Math.max(...rows.map((p) => effort(p, estimates)))]) + "人日" : "該当なし"}`;
  function tree(rows, depth = 0, path = {}) {
    if (depth === dimensions.length)
      return rows
        .map(
          (p) =>
            `<div class="catalog-leaf"><button data-plan="${p.id}">#${p.id} ${label("supply", p.supply)}</button><span data-score-ids="${p.id}"></span></div>`,
        )
        .join("");
    const dim = dimensions[depth],
      groups = new Map();
    for (const p of rows) {
      const v = valueOf(p, dim.id);
      if (!groups.has(v)) groups.set(v, []);
      groups.get(v).push(p);
    }
    return [...groups]
      .map(([v, items]) => {
        const next = { ...path, [dim.id]: v },
          key = encode(next);
        // A scoped ancestor remains visible as a breadcrumb instead of a redundant level.
        if (answers[dim.id]) return tree(items, depth + 1, next);
        if (dim.id === "supply") return tree(items, depth + 1, next);
        return `<details class="catalog-group" data-group="${key}" ${openGroups.has(key) ? "open" : ""}><summary><strong>${label(dim.id, v)}</strong><span class="group-stats">${stats(items)}<small data-score-ids="${items.map((p) => p.id).join(",")}"></small></span></summary><div class="group-contents"><div class="group-tools"><span>${dim.label}</span><button data-scope="${key}">この分類に絞る</button></div>${tree(items, depth + 1, next)}</div></details>`;
      })
      .join("");
  }
  function renderFilters() {
    q("#decision-path").innerHTML =
      `<h2>絞り込み</h2><label class="budget-label">開発工数の上限<span><input id="budget" type="number" min="0" max="9999" step="0.5" value="${budget}" placeholder="指定なし"> 人日</span></label><button id="clear-budget" class="text-button">上限を外す</button><label>BRの活動範囲<select id="activity"><option value="upper" ${hardware.level === "upper" ? "selected" : ""}>L2まで対応</option><option value="lower" ${hardware.level === "lower" ? "selected" : ""}>L1のみ</option></select></label><p class="small-note">建設の代替先・反転先にも適用。</p><fieldset><legend>L1への登り方</legend><div class="route-inputs">${["BR", "TR"].map((role) => `<label>${role}<select id="access-${role}"><option value="stairs" ${hardware[role] === "stairs" ? "selected" : ""}>階段</option><option value="ramp" ${hardware[role] === "ramp" ? "selected" : ""}>スロープ</option></select></label>`).join("")}</div></fieldset><p class="route-note">${hardware.BR === "ramp" ? "BRのスロープ利用はルール4.3.2との整合確認が必要な仮説です。" : "L2への移動は階段です。"}</p><details class="effort-settings"><summary>技術ごとの工数を編集</summary><p>設計・製作・調整の仮見積もり。共通技術は1回だけ加算。</p>${capabilities.map((c) => `<label>${c.name}<span><input data-estimate="${c.id}" type="number" min="0" max="999" step="0.5" value="${estimates[c.id]}" aria-label="${c.name}の人日"> 人日</span></label>`).join("")}</details>`;
  }
  function render() {
    const rows = current();
    if (selected && !rows.some((p) => p.id === selected.id)) {
      selected = null;
      stopResponses();
    }
    q("#selection-area").innerHTML =
      `<div class="catalog-breadcrumb"><button data-scope="">すべての作戦</button>${Object.entries(
        answers,
      )
        .map(
          ([id, v], i) =>
            `<span>›</span><button data-scope="${encode(Object.fromEntries(Object.entries(answers).slice(0, i + 1)))}">${label(id, v)}</button>`,
        )
        .join(
          "",
        )}</div><div class="catalog-intro"><h2>${rows.length}作戦</h2><p>分類を開いて閲覧できます。「この分類に絞る」で表示範囲とグラフを絞り込みます。</p></div><div id="catalog-tree">${rows.length ? tree(rows) : '<p class="empty">この分類と工数・機体条件に合う作戦がありません。分類を戻すか、左の条件を変更してください。</p>'}</div><section id="plan-detail"></section>`;
    renderDetail();
    renderMetrics();
  }
  function renderDetail() {
    const host = q("#plan-detail");
    if (!host) return;
    if (!selected) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = `<div class="detail-heading"><h2>作戦 #${selected.id}</h2><button id="close-detail">詳細を閉じる</button></div><dl class="plan-facts">${dimensions.map((s) => `<div><dt>${s.label}</dt><dd>${label(s.id, valueOf(selected, s.id))}</dd></div>`).join("")}</dl><p>${hardware.level === "upper" ? "L2まで対応" : "L1のみ"} / BR ${route(hardware.BR)} / TR ${route(hardware.TR)}</p><button id="play-plan" class="primary">3Dで再生</button><details class="plan-internals"><summary>必要な技術・元の設定</summary><ul>${requirements(
      selected,
    )
      .map((c) => `<li>${c.name}：${estimates[c.id]}人日</li>`)
      .join(
        "",
      )}</ul><p>元の設定 #${selected.sourceIds.join("、#")} は行動条件が同じです。</p></details><section id="opponent-responses"></section>`;
    renderResponses();
  }
  function graph(rows) {
    const values = rows.flatMap((p) => results.get(p.id)?.values ?? []);
    if (!values.length)
      return `<p class="graph-empty">${"得点を計算しています。計算を止めた場合は再計算できます。"}</p>`;
    const bins = Array(12).fill(0),
      max = Math.max(600, Math.ceil(Math.max(...values) / 100) * 100),
      peak = () => Math.max(...bins, 1);
    for (const value of values)
      bins[Math.min(11, Math.floor((value / max) * 12))]++;
    return `<svg viewBox="0 0 300 180" role="img" aria-label="残る作戦の得点分布。${values.length}試行、${Math.min(...values)}から${Math.max(...values)}点。"><path d="M24 18V145H285" class="axis"/>${bins.map((n, i) => `<rect x="${27 + i * 21}" y="${145 - (n / peak()) * 105}" width="16" height="${(n / peak()) * 105}" class="distribution"><title>${Math.round((i * max) / 12)}〜${Math.round(((i + 1) * max) / 12)}点：${n}試行</title></rect>`).join("")}<text x="24" y="165">0</text><text x="285" y="165" text-anchor="end">${max}点</text><text x="24" y="12">試行数</text><text x="282" y="28" text-anchor="end">最大 ${peak()}試行 / 区間</text></svg>`;
  }

  function renderMetrics() {
    const rows = current(),
      days = rows.map((p) => effort(p, estimates)),
      scored = rows.filter((p) => results.has(p.id)).length;
    q("#outlook").innerHTML =
      `<h2>表示中の作戦の得点</h2><dl class="outlook-facts"><div><dt>必要工数</dt><dd>${days.length ? span([Math.min(...days), Math.max(...days)]) : "該当なし"}<small> 人日</small></dd></div><div><dt>得点範囲</dt><dd>${span(scoreRange(rows, results))}<small> 点</small></dd></div></dl>${graph(rows)}<p class="chart-context">相手：${run ? title(run.enemy) : ""}<br>${run?.enemy.mission ? "奉納あり" : "奉納なし"} / 競合優先順2通り<br>表示中 ${scored} / ${rows.length}作戦を計算済み</p><p role="status" class="calculation-status">${status === "running" ? `全体を計算中 ${done} / ${total}` : status === "complete" ? "計算完了" : status === "error" ? "計算できませんでした" : "計算を中止しました"}</p><button id="calculate">${worker ? "計算を中止" : "再計算"}</button><details><summary>分類と計算の基準</summary><p>441設定を行動条件の同値性で297作戦に整理。奉納・反転・土台利用の条件から、建設場所・搬送方針へ分類しています。</p><p>得点分布は作戦ごとの試行数で、勝率ではありません。相手と性能は再生画面で変更できます。衝突・転倒・機構別の速度低下は未計算です。</p></details>`;
    for (const el of root.querySelectorAll("[data-score-ids]")) {
      const ids = el.dataset.scoreIds.split(",").map(Number),
        values = ids.flatMap((id) => results.get(id)?.scores ?? []),
        n = ids.filter((id) => results.has(id)).length;
      el.textContent = values.length
        ? `${span([Math.min(...values), Math.max(...values)])}点${n < ids.length ? ` (${n}/${ids.length}計算済)` : ""}`
        : "得点未計算";
    }
  }
  function renderResponses() {
    const host = q("#opponent-responses");
    if (!host) return;
    const groups = new Map();
    for (const m of responseMatches ?? []) {
      const g = responseGroup(m.enemy);
      if (!groups.has(g.key)) groups.set(g.key, { ...g, matches: [] });
      groups.get(g.key).matches.push(m);
    }
    host.innerHTML = `<h3>この作戦への相手の対応</h3><p role="status">${responseStatus || "相手の奉納・反転・土台利用の条件で分類します。"}</p>${!responseWorker ? '<button id="load-responses">相手への得点範囲を計算</button>' : '<button id="stop-responses">計算を中止</button>'}${[
      ...groups.values(),
    ]
      .map((g) => {
        const scores = g.matches.map((m) => m.scores[0]),
          margins = g.matches.map((m) => m.scores[0] - m.scores[1]);
        return `<details class="response-group"><summary><span>${g.label}</span><b>${span([Math.min(...scores), Math.max(...scores)])}点</b></summary><p>自分 − 相手：${span([Math.min(...margins), Math.max(...margins)])}点 / ${g.matches.length}ケース</p><div class="response-cases">${g.matches.map((m) => `<p>相手 #${m.enemy.id} ${title(m.enemy)} / 優先：${m.priority ? "相手" : "自分"}<br>自分 ${m.scores[0]}点、相手 ${m.scores[1]}点</p>`).join("")}</div></details>`;
      })
      .join(
        "",
      )}<p class="small-note">群内でも建設場所と搬送方針は異なります。相手の登り方はBR階段・TRスロープです。</p>`;
  }

  root.addEventListener(
    "toggle",
    (e) => {
      const key = e.target.dataset?.group;
      if (key) {
        if (e.target.open) openGroups.add(key);
        else openGroups.delete(key);
      }
    },
    true,
  );
  root.addEventListener("click", (e) => {
    const el = e.target.closest("button");
    if (!el) return;
    if (el.dataset.scope !== undefined) {
      answers = decode(el.dataset.scope);
      render();
    } else if (el.dataset.plan) {
      stopResponses();
      selected = current().find((p) => p.id === Number(el.dataset.plan));
      renderDetail();
      q("#plan-detail").scrollIntoView({ block: "nearest" });
    } else if (el.id === "close-detail") {
      stopResponses();
      selected = null;
      renderDetail();
    } else if (el.id === "clear-budget") {
      budget = "";
      q("#budget").value = "";
      render();
    } else if (el.id === "calculate") {
      if (worker) {
        stop();
        renderMetrics();
      } else calculate();
    } else if (el.id === "play-plan" && selected) {
      onSelect(selected);
      setExpanded(false);
    } else if (el.id === "load-responses") responses();
    else if (el.id === "stop-responses") {
      stopResponses();
      responseStatus = "計算を中止しました。";
      renderResponses();
    }
  });
  root.addEventListener("input", (e) => {
    if (e.target.id === "budget" && e.target.checkValidity()) {
      budget = e.target.value;
      render();
    }
  });
  root.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.estimate) {
      if (!el.value || !el.checkValidity()) {
        el.value = estimates[el.dataset.estimate];
        return;
      }
      estimates[el.dataset.estimate] = Number(el.value);
      try {
        localStorage.setItem("strata-effort-v1", JSON.stringify(estimates));
      } catch {}
      render();
    } else if (el.id === "activity" || el.id.startsWith("access-")) {
      if (el.id === "activity") hardware.level = el.value;
      else hardware[el.id.slice(7)] = el.value;
      selected = null;
      stopResponses();
      renderFilters();
      render();
      calculate();
    }
  });
  setExpanded(true);
  renderFilters();
  return {
    update(nextRun) {
      run = nextRun;
      const key = JSON.stringify([run.cfg, run.enemy]);
      if (key !== context) {
        context = key;
        stopResponses();
        render();
        calculate();
      } else renderMetrics();
    },
    exportAnalysis() {
      return {
        classification: answers,
        hardware,
        estimates,
        budget,
        remaining: current().map((p) => p.id),
        results: [...results],
        responses: responseMatches,
      };
    },
    dispose() {
      stop();
      stopResponses();
    },
  };
}
