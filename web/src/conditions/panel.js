import { title, modes, ends, supplies } from "../catalog/plans.js";
export function createConditionsPanel(root, { onPerformance, onOpponent }) {
  const q = (s) => root.querySelector(s);
  for (const [id, key] of [
    ["velocity", "speed"],
    ["handling", "handling"],
    ["success", "success"],
  ])
    q("#" + id).oninput = (e) => onPerformance(key, +e.target.value);
  q("#priority").onchange = (e) =>
    onPerformance("priority", Number(e.target.value));
  q("#opponent").onchange = (e) => onOpponent(e.target.value);
  return {
    update({ plan, cfg }) {
      q("#strategyid").textContent = `作戦 ${String(plan.id).padStart(3, "0")}`;
      q("#strategyname").textContent = title(plan);
      q("#tags").innerHTML =
        `<span>${modes[plan.mode]}</span><span>${plan.mission ? "ムスティカ設置あり" : "ムスティカ設置なし"}</span>`;
      q("#description").textContent =
        `搬送：${supplies[plan.supply]}。終盤：${ends[plan.end]}。${plan.mission ? "設置条件を満たしたら、ムスティカを中央柱へ運びます。" : "ムスティカは設置しません。"}`;
      q("#speedvalue").textContent = cfg.speed.toFixed(1) + " m/s";
      q("#handlingvalue").textContent = cfg.handling.toFixed(1) + " s";
      q("#successvalue").textContent = Math.round(cfg.success * 100) + " %";
    },
  };
}
export const inspectorMarkup = `<aside class="inspector">
<div class="paneltitle">作戦と性能 <span>赤チーム</span>
</div>
<section class="selection">
<h2><span id="strategyname"></span> <small id="strategyid"></small></h2>
<div id="tags">
</div>
<p id="description">
</p>
</section>
<section>
<h3>実行条件</h3>
<label>相手の作戦<select id="opponent">
<option value="upper">L2 → L1自陣・ムスティカ設置</option>
<option value="shared">L1共有 → L1自陣・ムスティカ設置</option>
<option value="flip">L1共有 → L2・裏返しとムスティカ設置</option>
</select>
</label>
<label>移動速度 <output id="speedvalue">
</output>
<input id="velocity" type="range" min=".3" max="2.5" step=".1" value="1.1">
</label>
<label>把持・設置などの動作時間 <output id="handlingvalue">
</output>
<input id="handling" type="range" min=".5" max="6" step=".1" value="2.2">
</label>
<label>動作成功率 <output id="successvalue">
</output>
<input id="success" type="range" min=".5" max="1" step=".05" value="1">
</label>
<label>同時競合の優先順<select id="priority"><option value="0">赤を先に処理</option><option value="1">青を先に処理</option></select></label>
<p class="note">両チームに同じ性能を適用。変更すると再計算します。</p>
</section>
<section>
<h3>現在の状態</h3>
<div id="robotstates">
</div>
<div id="inventory">
</div>
</section>
<section class="eventsection">
<h3>イベント <span id="eventcount">
</span>
</h3>
<div id="events">
</div>
</section>
</aside>`;
