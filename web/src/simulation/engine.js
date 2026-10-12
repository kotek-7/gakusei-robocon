import { planMovement } from "./movement.js";
import {
  spots,
  transfer,
  builderTransfer,
  startPosition,
  earthApproach,
  skyApproach,
  mustikaApproach,
  spotApproach,
  side,
  skyLayout,
} from "./field.js";
export function simulate(plan, enemy, settings = {}, record = true) {
  const cfg = {
    speed: 1.1,
    handling: 2.2,
    success: 1,
    seed: 42,
    priority: 0,
    ...settings,
  };
  for (const key of ["speed", "handling"])
    if (!Number.isFinite(cfg[key]) || cfg[key] <= 0)
      throw new RangeError(`${key} must be positive`);
  if (!Number.isFinite(cfg.success) || cfg.success < 0 || cfg.success > 1)
    throw new RangeError("success must be in [0,1]");
  if (![0, 1].includes(cfg.priority) || !Number.isInteger(cfg.seed))
    throw new RangeError("Invalid priority or seed");
  for (const p of [plan, enemy])
    if (
      !p ||
      !Array.isArray(p.zones) ||
      p.zones.length !== 2 ||
      p.zones.some((z) => !["P", "S", "U"].includes(z)) ||
      !["build", "reuse", "flip"].includes(p.mode) ||
      !["balanced", "earth", "sky"].includes(p.supply) ||
      !["expand", "flip", "late"].includes(p.end) ||
      typeof p.mission !== "boolean"
    )
      throw new TypeError("Invalid plan");
  let seed = cfg.seed;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const towers = spots.map((p, i) => ({
    id: i,
    p: p.slice(0, 3),
    zone: p[3],
    private: p[4],
    earth: [],
    sky: null,
  }));
  const teams = [0, 1].map((i) => ({
    earth: 20,
    sky: 0,
    bufferE: 0,
    bufferS: 0,
    transfer: 0,
    mandate: false,
    ever: [],
    mustika: false,
  }));
  let groundSkyIds = skyLayout.map((_, i) => i);
  let groundSky = 12,
    mustika = "ground";
  const robots = [0, 1].flatMap((team) =>
    ["TR", "BR"].map((role) => ({
      id: `${team ? "B" : "R"}-${role}`,
      team,
      role,
      p: startPosition(team, role),
      from: [],
      to: [],
      start: 0,
      finish: 0,
      job: null,
      carry: [],
      state: "待機",
    })),
  );
  const plans = [plan, enemy],
    events = [],
    frames = [],
    intervals = [];
  let time = 0;
  const score = () =>
    teams.map(
      (t, i) =>
        t.transfer +
        towers.reduce(
          (s, w) =>
            s +
            w.earth.reduce(
              (v, o, k) =>
                v + (o === i ? (k ? 20 : 10) * (w.zone === "U" ? 2 : 1) : 0),
              0,
            ) +
            (w.sky === i ? 40 * (w.zone === "U" ? 2 : 1) : 0),
          0,
        ) +
        (mustika === i ? 250 : 0),
    );
  const log = (r, label) =>
    events.push({ t: time, robot: r.id, team: r.team, label });
  const buffer = (i, role) =>
    role === "BR" ? builderTransfer(i) : transfer(i);
  const locked = (id) => robots.some((r) => r.job?.spot === id);
  function task(r, kind, to, data = {}, label = kind) {
    if (time >= 180) return;
    const { route, lengths, distance } = planMovement(r, to);
    r.route = route;
    r.lengths = lengths;
    r.distance = distance;
    r.from = [...r.p];
    r.to = to;
    r.start = time;
    r.arrival = time + distance / cfg.speed;
    r.arrived = false;
    r.finish = r.arrival + (kind === "return" ? 0 : cfg.handling);
    r.job = { kind, ...data };
    r.state = label;
    intervals.push({ robot: r.id, start: time, end: r.finish, label });
  }
  function choose(r) {
    const i = r.team,
      t = teams[i],
      p = plans[i];
    if (r.role === "BR" && r.p[1] < 0.1) {
      task(r, "return", buffer(i, r.role), {}, "階段を登る");
      return;
    }
    if (r.role === "TR") {
      if (r.carry.length) {
        task(r, "deliver", buffer(i, r.role), {}, "搬送・受け渡し");
        return;
      }
      if (p.mission && t.mandate && mustika === "ground") {
        task(r, "takeM", mustikaApproach(i), {}, "ムスティカを回収");
        return;
      }
      const needS = t.bufferS < (p.supply === "sky" ? 4 : 2) && groundSky > 0,
        needE = t.bufferE < (p.supply === "earth" ? 8 : 5) && t.earth > 0;
      if (!needS && !needE) return;
      let kind =
        needS &&
        (!needE ||
          p.supply === "sky" ||
          t.bufferE >= (p.supply === "earth" ? 5 : 2))
          ? "takeS"
          : "takeE";
      task(
        r,
        kind,
        kind === "takeS" ? skyApproach(i) : earthApproach(i),
        {},
        kind === "takeS" ? "上段ブロックを回収" : "土台ブロックを回収",
      );
      return;
    }
    if (p.mission && t.mustika && t.mandate) {
      t.mustika = false;
      r.carry = ["M"];
      task(r, "placeM", [side(i) * 0.55, 0.9, 0], {}, "中央柱にムスティカを設置");
      return;
    }
    const proximity = (w) =>
      spotApproach(w.id, i).reduce((sum, v, k) => sum + (v - r.p[k]) ** 2, 0);
    const allowed = towers.filter(
        (w2) => (w2.private < 0 || w2.private === i) && !locked(w2.id),
      ),
      hasFlips =
        p.mode === "flip" ||
        p.end === "flip" ||
        (p.end === "late" && time >= 120);
    const flip = allowed
      .filter((w2) => w2.sky !== null && w2.sky !== i)
      .sort(
        (a, b) =>
          Number(b.zone === "U") - Number(a.zone === "U") ||
          proximity(a) - proximity(b),
      )[0];
    if (hasFlips && flip) {
      task(
        r,
        "flip",
        spotApproach(flip.id, i),
        { spot: flip.id },
        "上段ブロックを裏返す",
      );
      return;
    }
    const targetZone = p.zones[Math.min(t.ever.length, 1)];
    let candidates = allowed
      .filter((w2) => w2.sky === null)
      .sort(
        (a, b) =>
          (Number(b.zone === targetZone) - Number(a.zone === targetZone)) * 10 +
            (p.mode === "reuse" ? b.earth.length - a.earth.length : 0) ||
          proximity(a) - proximity(b),
      );
    let w = candidates.find(
      (w2) =>
        (w2.earth.length < 2 && t.bufferE > 0) ||
        (w2.earth.length === 2 && t.bufferS > 0),
    );
    if (!w) return;
    if (w.earth.length < 2) {
      let n = Math.min(2 - w.earth.length, t.bufferE);
      t.bufferE -= n;
      r.carry = Array(n).fill("E");
      task(r, "earth", spotApproach(w.id, i), { spot: w.id, n }, "土台を積む");
    } else {
      t.bufferS--;
      r.carry = ["S"];
      task(r, "sky", spotApproach(w.id, i), { spot: w.id }, "上段ブロックを積む");
    }
  }
  function finish(r) {
    let j = r.job,
      t = teams[r.team],
      i = r.team,
      w = towers[j.spot];
    r.job = null;
    if (j.kind !== "return" && rand() >= cfg.success) {
      log(r, "動作を再試行");
      if (r.carry.includes("M")) {
        r.carry = [];
        mustika = "ground";
        task(r, "return", buffer(i, r.role), {}, "受け渡しエリアへ戻る");
      } else task(r, j.kind, r.to, j, r.state);
      return;
    }
    if (j.kind === "takeE") {
      let n = Math.min(3, t.earth);
      t.earth -= n;
      r.carry = Array(n).fill("E");
    }
    if (j.kind === "takeS") {
      let n = Math.min(3, groundSky);
      const near = skyApproach(i);
      groundSkyIds.sort(
        (a, b) =>
          Math.hypot(skyLayout[a].p[0] - near[0], skyLayout[a].p[2] - near[2]) -
          Math.hypot(skyLayout[b].p[0] - near[0], skyLayout[b].p[2] - near[2]),
      );
      groundSkyIds.splice(0, n);
      groundSky -= n;
      r.carry = Array(n).fill("S");
    }
    if (j.kind === "takeM" && mustika === "ground" && t.mandate) {
      mustika = "carry";
      r.carry = ["M"];
    }
    if (j.kind === "deliver") {
      for (let c of r.carry) {
        if (c === "E") {
          t.bufferE++;
          t.transfer += 5;
        }
        if (c === "S") {
          t.bufferS++;
          t.transfer += 5;
        }
        if (c === "M") {
          t.mustika = true;
          mustika = "buffer";
        }
      }
      r.carry = [];
    }
    if (j.kind === "earth") {
      let n = Math.min(j.n, 2 - w.earth.length);
      w.earth.push(...Array(n).fill(i));
      t.bufferE += j.n - n;
      r.carry = [];
    }
    if (j.kind === "sky") {
      if (w.earth.length === 2 && w.sky === null) {
        w.sky = i;
        if (!t.ever.includes(w.id)) t.ever.push(w.id);
      } else t.bufferS++;
      r.carry = [];
    }
    if (j.kind === "flip" && r.carry.includes("S")) {
      r.carry = [];
      w.sky = i;
      if (!t.ever.includes(w.id)) t.ever.push(w.id);
    }
    if (j.kind === "placeM" && t.mandate) {
      mustika = i;
      r.carry = [];
    }
    const emptyPickup =
      ["takeE", "takeS", "takeM"].includes(j.kind) && r.carry.length === 0;
    r.state = emptyPickup ? "回収対象なし" : r.state + " 完了";
    log(r, r.state);
    for (let a = 0; a < 2; a++) {
      let owned = towers.filter((x) => x.sky === a);
      if (
        !teams[a].mandate &&
        owned.length >= 2 &&
        owned.some((x) => x.zone !== "P")
      ) {
        teams[a].mandate = true;
        log(robots[a * 2 + 1], "ムスティカ設置条件を達成");
      }
    }
    if (
      time < 180 &&
      r.role === "BR" &&
      !["deliver", "return"].includes(j.kind)
    )
      task(r, "return", buffer(i, r.role), {}, "受け渡しエリアへ戻る");
  }
  const ordered = [cfg.priority, 1 - cfg.priority].flatMap((t) => [
    robots[t * 2],
    robots[t * 2 + 1],
  ]);
  function dispatch() {
    if (time >= 180) return;
    for (const r of ordered) if (!r.job) choose(r);
  }
  function move(at) {
    for (const r of robots)
      if (r.job) {
        let d = Math.min(r.distance, Math.max(0, (at - r.start) * cfg.speed));
        for (let k = 0; k < r.lengths.length; k++) {
          if (d <= r.lengths[k] || k === r.lengths.length - 1) {
            const f = r.lengths[k] ? Math.min(1, d / r.lengths[k]) : 1;
            r.p = r.route[k].map((v, j) => v + (r.route[k + 1][j] - v) * f);
            break;
          }
          d -= r.lengths[k];
        }
      }
  }
  dispatch();
  for (let sample = 0; sample <= 180; sample += 0.5) {
    while (true) {
      const next = Math.min(
        ...robots
          .filter((r) => r.job)
          .map((r) => (r.arrived ? r.finish : r.arrival)),
      );
      if (next > sample || !Number.isFinite(next)) break;
      time = next;
      move(time);
      for (const r of ordered)
        if (r.job && !r.arrived && r.arrival <= time) {
          r.arrived = true;
          r.p = [...r.to];
          if (r.job.kind === "flip" && !r.carry.length) {
            const w = towers[r.job.spot];
            r.carry = ["S"];
            r.job.oldSky = w.sky;
            w.sky = null;
          }
        }
      for (const r of ordered) if (r.job && r.finish <= time) finish(r);
      dispatch();
    }
    time = sample;
    if (time === 120) dispatch();
    move(time);
    // State samples are right-continuous: completions at exactly 180 count; new actions do not start.
    if (record)
      frames.push({
        t: time,
        scores: score(),
        robots: robots.map((r) => ({
          id: r.id,
          team: r.team,
          role: r.role,
          p: [...r.p],
          state: r.state,
          carry: [...r.carry],
        })),
        towers: towers.map((w) => ({ earth: [...w.earth], sky: w.sky })),
        teams: teams.map((t) => ({ ...t, ever: [...t.ever] })),
        groundSky,
        groundSkyIds: [...groundSkyIds],
        mustika,
      });
  }
  const ranks = teams.map((t, i) => [
    score()[i],
    Number(mustika === i),
    towers.filter((w) => w.sky === i).length,
    ...["U", "L1"].map((level) =>
      towers
        .filter((w) => (level === "U" ? w.zone === "U" : w.zone !== "U"))
        .reduce(
          (n, w) =>
            n + w.earth.filter((o) => o === i).length + Number(w.sky === i),
          0,
        ),
    ),
  ]);
  let winner = null;
  for (let k = 0; k < ranks[0].length; k++)
    if (ranks[0][k] !== ranks[1][k]) {
      winner = ranks[0][k] > ranks[1][k] ? 0 : 1;
      break;
    }
  return {
    modelVersion: "cad-corridor-2",
    plan,
    enemy,
    cfg,
    frames,
    events: record ? events : [],
    intervals: record ? intervals : [],
    scores: score(),
    ranks,
    winner,
    mandates: teams.map((t) => t.mandate),
    mustika,
  };
}
