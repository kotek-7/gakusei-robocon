export function createReplayPanel(
  root,
  { onSeek, onToggle, onReset, onSpeed, onPin },
) {
  const q = (s) => root.querySelector(s);
  q("#play").onclick = onToggle;
  q("#reset").onclick = onReset;
  q("#seek").oninput = (e) => onSeek(+e.target.value);
  q("#speed").onchange = (e) => onSpeed(parseFloat(e.target.value));
  for (const id of ["events", "lanes"])
    q("#" + id).onclick = (e) => {
      const button = e.target.closest("[data-time]");
      if (button) onSeek(+button.dataset.time);
    };
  function keyboard(e) {
    if (
      ["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(e.target.tagName) ||
      q("#modal").open ||
      root.querySelector("main").classList.contains("catalog-expanded")
    )
      return;
    if (e.code === "Space") {
      e.preventDefault();
      onToggle();
    }
    if (e.code === "ArrowRight") {
      e.preventDefault();
      onSeek(+q("#seek").value + 5);
    }
    if (e.code === "ArrowLeft") {
      e.preventDefault();
      onSeek(+q("#seek").value - 5);
    }
  }
  document.addEventListener("keydown", keyboard);
  return {
    dispose() {
      document.removeEventListener("keydown", keyboard);
    },
    setRun(run) {
      q("#lanes").innerHTML = ["R-TR", "R-BR", "B-TR", "B-BR"]
        .map(
          (id, i) =>
            `<div class="lane"><span>${id}</span><div>${run.intervals
              .filter((v) => v.robot === id)
              .map(
                (v) =>
                  `<button title="${v.label} / ${v.start.toFixed(1)}秒" data-time="${v.start}" style="left:${v.start / 1.8}%;width:${Math.min(v.end - v.start, 180 - v.start) / 1.8}%;background:${i < 2 ? "#b96960" : "#567fae"}"></button>`,
              )
              .join("")}</div></div>`,
        )
        .join("");
    },
    update(frame, time, events, baseline, playing) {
      q("#play").textContent = playing ? "一時停止" : "再生";
      q("#redscore").textContent = frame.scores[0];
      q("#bluescore").textContent = frame.scores[1];
      q("#clock").textContent =
        `${String(Math.floor(time / 60)).padStart(2, "0")}:${(time % 60).toFixed(1).padStart(4, "0")}`;
      q("#timecode").textContent =
        `${time.toFixed(1).padStart(5, "0")} / 180.0 s`;
      q("#seek").value = time;
      q("#qualifications").innerHTML = frame.teams
        .map(
          (t, i) =>
            `<span class="${i ? "blue" : "red"}">${i ? "BLUE" : "RED"}　${t.mandate ? "ムスティカ設置可" : "ムスティカ設置条件未達成"}</span>`,
        )
        .join("");
      q("#robotstates").innerHTML = frame.robots
        .map(
          (r) =>
            `<div class="robotstate"><b class="${r.team ? "blue" : "red"}">${r.id}</b><span>${r.state}</span><small>積載 ${r.carry.length} / ${r.role === "TR" ? 3 : 2}</small></div>`,
        )
        .join("");
      q("#inventory").innerHTML =
        `<div class="inventory"><span>赤チーム・受け渡しエリアの在庫</span><b>土台 ${frame.teams[0].bufferE}　上段ブロック ${frame.teams[0].bufferS}</b></div>`;
      const past = events.filter((e) => e.t <= time);
      q("#eventcount").textContent = `${past.length}件`;
      q("#events").innerHTML =
        past
          .slice(-8)
          .reverse()
          .map(
            (e) =>
              `<button data-time="${e.t}"><time>${e.t.toFixed(1)}</time><span><b class="${e.team ? "blue" : "red"}">${e.robot}</b> ${e.label}</span></button>`,
          )
          .join("") ||
        '<p class="empty">この時刻までのイベントはありません。</p>';

    },
  };
}
export const playbackMarkup = `<div class="playbar">
<button id="reset" title="最初に戻る">最初へ</button>
<button id="play" class="primary">再生</button>
<select id="speed" aria-label="再生速度">
<option value=".5">0.5×</option>
<option selected>1×</option>
<option value="2">2×</option>
<option value="4">4×</option>
<option value="8">8×</option>
</select>
<span id="timecode">000.0 / 180.0 s</span>
<div class="spacer">
</div>

<span id="delta">
</span>
</div>
<div class="timeline">
<div class="timelineheading">
<span>タイムライン</span>
<span>0 s</span>
<span>60 s</span>
<span>120 s</span>
<span>180 s</span>
</div>
<input id="seek" type="range" min="0" max="180" step=".5" value="0" aria-label="試合経過時間">
<div id="lanes">
</div>
</div>
`;
