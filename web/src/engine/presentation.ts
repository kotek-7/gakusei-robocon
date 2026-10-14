import type { Frame, State } from "../engine/types";
import { EDGES, nodeAt, payload, ROBOT_NAMES, scores, SPOTS } from "./model";
const interpolate = (a: number[], b: number[], f: number) =>
  a.map((x, i) => x + (b[i] - x) * f);
const distance = (a: number[], b: number[]) =>
  Math.hypot(...a.map((x, i) => b[i] - x));
export function frame(s: State, time = s.t): Frame {
  const robots = s.robots.map((rob, r) => {
    let p = [...nodeAt(rob.pos).p];
    const job = rob.job;
    if (job && ["move", "retry"].includes(job.action.kind)) {
      const f = Math.max(
          0,
          Math.min(1, (time - job.start) / (job.end - job.start)),
        ),
        to = nodeAt(job.action.dest!).p;
      if (job.action.kind === "move") {
        const e = EDGES[job.action.edge!],
          route = e.a === job.from ? e.route : [...e.route].reverse();
        let left = e.distance * f;
        for (let i = 0; i < route.length - 1; i++) {
          const a = route[i],
            b = route[i + 1],
            len = distance(a, b);
          if (left <= len || i === route.length - 2) {
            p = interpolate(a, b, len ? Math.min(1, left / len) : 1);
            break;
          }
          left -= len;
        }
      } else p = interpolate(p, to, f);
    }
    return {
      id: ROBOT_NAMES[r],
      team: r >> 1,
      role: r % 2 ? "BR" : "TR",
      p,
      state: job?.action.kind || "idle",
      location: rob.pos,
      action: job?.action || null,
      carry: payload(s, r).map((o) => o.kind),
    };
  });
  const objects = s.objects.map((o) => {
    const loc = o.loc;
    let p = [0, 0, 0];
    if (loc.startsWith("robot")) {
      const r = Number(loc.slice(5));
      p = [...robots[r].p];
      p[1] += 0.7 + payload(s, r).findIndex((x) => x.id === o.id) * 0.35;
    } else if (loc.startsWith("tower")) {
      p = SPOTS[Number(loc.slice(5))].slice(0, 3);
      p[1] += (o.kind === "E" ? 0.175 : 0.1) + o.layer * 0.35;
    } else if (loc.startsWith("store")) {
      const side = loc.at(-1) === "0" ? -1 : 1,
        slot = o.slot % 20;
      p = [
        side * (3.7 + (slot % 5) * 0.375),
        0.175 + o.layer * 0.35,
        -4.7 + Math.floor(slot / 5) * 0.36,
      ];
    } else if (loc.startsWith("buffer")) {
      p = [...nodeAt("transfer" + loc.at(-1)).p];
      const slot = s.objects
        .filter((x) => x.loc === loc)
        .map((x) => x.id)
        .sort((a, b) => a - b)
        .indexOf(o.id);
      p[0] += ((slot % 2) - 0.5) * 0.36;
      p[2] += ((Math.floor(slot / 2) % 2) - 0.5) * 0.36;
      p[1] += 0.175 + Math.floor(slot / 4) * 0.35;
    } else if (loc === "groundSky") {
      const [row, col] = [
        [0, 0],
        [0, 2],
        [0, 4],
        [1, 1],
        [1, 3],
        [2, 0],
        [2, 4],
        [3, 1],
        [3, 3],
        [4, 0],
        [4, 2],
        [4, 4],
      ][(o.id - 40) % 12];
      p = [(col - 2) * 0.2, 0.1, 4.6073 + (row - 2) * 0.2];
    } else if (loc === "groundBall") p = [0, 0.555, -3.8856];
    else if (loc === "pillar") p = [0, 1.755, -0.002];
    return { ...o, p };
  });
  return { t: time, scores: scores(s), robots, objects, mandate: s.mandate };
}
