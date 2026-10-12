import { catalog } from "./catalog/plans.js";
import { createCatalogPanel } from "./catalog/panel.js";
import { createConditionsPanel } from "./conditions/panel.js";
import { createScene } from "./viewport/scene.js";
import { createPlayback, frameAt } from "./replay/playback.js";
import { createReplayPanel } from "./replay/panel.js";
import {
  createExploration,
  renderExploration,
} from "./exploration/controller.js";
import { mountLayout } from "./workspace/layout.js";
import { createSession } from "./workspace/session.js";
import { downloadResult } from "./workspace/export.js";
const root = document.querySelector("#app"),
  plans = catalog(),
  session = createSession(plans),
  playback = createPlayback();
mountLayout(root, plans.length);
let scene;
try {
  scene = createScene(root.querySelector("#viewport"));
} catch (error) {
  const note = document.createElement("p");
  note.className = "render-error";
  note.setAttribute("role", "alert");
  note.textContent =
    "3D表示を開始できません。ブラウザのWebGL設定を確認してください。得点と再生時刻は引き続き確認できます。";
  root.querySelector("#viewport").append(note);
  scene = { update() {}, view() {}, dispose() {} };
}
const catalogPanel = createCatalogPanel(root, plans, (id) => {
  session.select(id);
  refreshRun();
});
const conditions = createConditionsPanel(root, {
  onPerformance(key, value) {
    session.changePerformance(key, value);
    exploration.invalidate();
    refreshRun();
  },
  onOpponent(key) {
    session.changeOpponent(key);
    exploration.invalidate();
    refreshRun();
  },
});
const replay = createReplayPanel(root, {
  onSeek(value) {
    playback.seek(value);
    draw();
  },
  onToggle() {
    playback.toggle();
    draw();
  },
  onReset() {
    playback.seek(0);
    draw();
  },
  onSpeed(value) {
    playback.setSpeed(value);
  },
  onPin() {
    session.pin();
    draw();
  },
});
const exploration = createExploration({
  createWorker: () => new Worker("/worker.js", { type: "module" }),
  onChange(state) {
    renderExploration(root, state, plans.length);
    if (state.results.size % 20 === 0 || state.status !== "running")
      catalogPanel.update(session.run.plan.id, state.results);
  },
});
function draw() {
  const frame = frameAt(session.run, playback.time);
  scene.update(frame);
  replay.update(
    frame,
    playback.time,
    session.run.events,
    session.baseline,
    playback.playing,
  );
}
function refreshRun() {
  conditions.update(session.run);
  replay.setRun(session.run);
  catalogPanel.update(session.run.plan.id, exploration.results);
  draw();
}
root.querySelector("#explore").onclick = () =>
  exploration.toggle(session.run.enemy, session.run.cfg);
root.querySelector("#export").onclick = () =>
  downloadResult({ ...session.exportResult(), catalogAnalysis: catalogPanel.exportAnalysis() });
root.querySelector("#help").onclick = () =>
  root.querySelector("#modal").showModal();
root.querySelector("#close").onclick = () =>
  root.querySelector("#modal").close();
root.querySelectorAll("[data-view]").forEach(
  (button) =>
    (button.onclick = () => {
      scene.view(button.dataset.view);
      root.querySelectorAll("[data-view]").forEach((other) => {
        other.classList.toggle("active", other === button);
        other.setAttribute("aria-pressed", String(other === button));
      });
    }),
);
let previous = performance.now(),
  lastDraw = 0,
  animation;
function tick(now) {
  const wasPlaying = playback.playing;
  playback.tick((now - previous) / 1e3);
  if (wasPlaying && (now - lastDraw > 70 || !playback.playing)) {
    draw();
    lastDraw = now;
  }
  previous = now;
  animation = requestAnimationFrame(tick);
}
exploration.invalidate();
refreshRun();
animation = requestAnimationFrame(tick);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  cancelAnimationFrame(animation);
  exploration.dispose();
  replay.dispose();
  scene.dispose();
});
