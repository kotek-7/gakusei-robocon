import { catalogMarkup } from "../catalog/panel.js";
import { inspectorMarkup } from "../conditions/panel.js";
import { playbackMarkup } from "../replay/panel.js";
import { helpContent } from "../help/content.js";
export function mountLayout(root, count) {
  root.innerHTML = `<header>
<div class="brand">
STRATA <small>ABU ROBOCON 2027</small>
</div>
<nav>
<span class="workspace-title">作戦ワークスペース</span>
<button id="help">使い方・計算条件</button>
</nav>
<div class="topright">
 <button id="export">結果を保存</button>
</div>
</header>
<main>
${catalogMarkup(count)}
<section class="center">
<div class="viewportbar">
<span><b id="replay-plan-title">シミュレーション</b>
<small>提供CAD</small>
</span>
<div>
<button data-view="iso" class="active" aria-pressed="true">斜視</button>
<button data-view="top" aria-pressed="false">上面</button>
<button data-view="red" aria-pressed="false">赤陣</button>
</div>
</div>
<div id="viewport">
<div class="scoreboard">
<div class="red">
<span>RED</span>
<b id="redscore">0</b>
</div>
<div class="matchclock">
<span>試合経過</span>
<b id="clock">00:00.0</b>
</div>
<div class="blue">
<b id="bluescore">0</b>
<span>BLUE</span>
</div>
</div>
<div class="viewhint">ドラッグ：回転　右ドラッグ：移動　スクロール：拡大</div>
<div id="qualifications">
</div>
</div>
<p class="model-note">CADに基づく経路・得点の簡略計算。機体同士の衝突・把持・転倒は未計算。</p>
${playbackMarkup}
</section>
${inspectorMarkup}
</main>
<footer>
<span>ABU ROBOCON 2027 · 作戦比較</span>
<span>SPACE 再生　← → 5秒移動</span>
</footer>${helpContent}`;
}
