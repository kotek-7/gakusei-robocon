/** Turn construction and transport goals into legal robot commands. */
import type { Action, Config, Goal, State, Variant } from "../engine/types";
import { action, duration, payload, routes, SPOTS, tower } from "./model";
import { compare, equal } from "./util";
export class Planner {
  paths = new Map<string, [number, Action[]] | null>();
  destinations = new Map<number, string>();
  constructor(
    public c: Config,
    public v: Variant,
  ) {}
  route(pos: string, dest: string, r: number): [number, Action[]] | null {
    const k = `${pos}:${dest}:${r}`;
    if (this.paths.has(k)) return this.paths.get(k)!;
    const queue: [number, string, Action[]][] = [[0, pos, []]],
      seen = new Set<string>();
    let answer: [number, Action[]] | null = null;
    while (queue.length) {
      queue.sort((a, b) => a[0] - b[0]);
      const [cost, loc, path] = queue.shift()!;
      if (seen.has(loc)) continue;
      seen.add(loc);
      if (loc === dest) {
        answer = [cost, path];
        break;
      }
      for (const [edge, next] of routes(
        loc,
        r >> 1,
        r % 2 ? "BR" : "TR",
        this.v.teams[r >> 1].caps,
        this.c.rules,
      )) {
        const a = action("move", { edge, dest: next });
        queue.push([cost + duration(a, this.c, this.v, r), next, [...path, a]]);
      }
    }
    this.paths.set(k, answer);
    return answer;
  }
  goals(s: State, team: number): Goal[] {
    const br = team * 2 + 1,
      caps = this.v.teams[team].caps,
      result: Goal[] = [];
    if (
      caps.mustika &&
      s.mandate[team] &&
      s.objects[52].loc !== "pillar" &&
      this.route(s.robots[br].pos, `pillar${team}`, br)
    )
      result.push({ kind: "mustika" });
    SPOTS.forEach((spot, i) => {
      const route = this.route(s.robots[br].pos, `spot${i}-${team}`, br);
      if (![-1, team].includes(spot[4]) || !route) return;
      const ts = tower(s, i);
      if (ts.length === 3) {
        if (caps.flip && ts[2].face !== team) {
          result.push({ kind: "flip", spot: i });
          const at =
            this.c.horizon - duration(action("flip"), this.c, this.v, br);
          if (at > s.t + route[0]) result.push({ kind: "flip", spot: i, at });
        }
      } else if (caps.capacity_br && (ts.length >= 2 || caps.earth)) {
        const height = caps.sky ? 3 : 2;
        if (ts.length < height) result.push({ kind: "build", spot: i, height });
      }
    });
    if (!result.length && caps.capacity_tr && (caps.earth || caps.sky))
      result.push({ kind: "deliver", count: s.transfer[team] + 1 });
    const priority = (g: Goal) =>
      g.kind === "mustika"
        ? -1000
        : g.kind === "deliver"
          ? 0
          : (-(g.kind === "flip" ? 80 : 70) * SPOTS[g.spot!][3]) /
            (1 +
              this.route(s.robots[br].pos, `spot${g.spot}-${team}`, br)![0] +
              (3 - tower(s, g.spot!).length) * 12) **
              3;
    return result.sort((a, b) => priority(a) - priority(b) || compare(a, b));
  }
  choose(
    s: State,
    r: number,
    opts: Action[],
    dest: string,
    kind?: string,
    resource?: string,
    amount = 1,
  ): Action | undefined {
    this.destinations.set(r, dest);
    if (s.robots[r].pos !== dest) {
      const a = this.route(s.robots[r].pos, dest, r)?.[1][0];
      return a && opts.some((x) => equal(x, a)) ? a : undefined;
    }
    return opts
      .filter(
        (a) =>
          a.kind === kind &&
          (resource === undefined ||
            (a.objects || []).every((i) => s.objects[i].kind === resource)) &&
          (a.objects || []).length <= amount,
      )
      .sort((a, b) => (b.objects?.length || 0) - (a.objects?.length || 0))[0];
  }
  command(s: State, r: number, g: Goal | null, opts: Action[]): Action {
    if (s.robots[r].job) return action("continue");
    const wait = action("wait", { seconds: this.c.horizon - s.t });
    if (!g) return wait;
    const team = r >> 1,
      role = r % 2,
      br = team * 2 + 1,
      held = payload(s, r),
      transfer = `transfer${team}`;
    if (g.kind === "flip") {
      if (!role) return wait;
      if (held.length)
        return this.choose(s, r, opts, transfer, "drop", held[0].kind) || wait;
      if (s.robots[r].pos === `spot${g.spot}-${team}` && s.t < (g.at || 0))
        return opts.find((a) => a.kind === "delay") || wait;
      return this.choose(s, r, opts, `spot${g.spot}-${team}`, "flip") || wait;
    }
    let need: Record<string, number>, target: string;
    if (g.kind === "mustika") {
      need = { M: 1 };
      target = `pillar${team}`;
    } else if (g.kind === "deliver") {
      const resource =
        g.resource ||
        ["E", "S"].find(
          (k) =>
            this.v.teams[team].caps[k === "E" ? "earth" : "sky"] &&
            s.objects.some(
              (o) =>
                o.kind === k &&
                [
                  k === "E" ? `store${team}` : "groundSky",
                  `robot${r}`,
                ].includes(o.loc) &&
                !o.delivered[team],
            ),
        );
      if (!resource && !held.length) return wait;
      need = {
        [resource || held[0].kind]:
          g.amount ?? Number(this.v.teams[team].caps.capacity_tr),
      };
      target = transfer;
    } else {
      const len = tower(s, g.spot!).length;
      need = {
        E: Math.max(0, Math.min(2, g.height ?? 3) - len),
        S: Number((g.height ?? 3) === 3 && len < 3),
      };
      target = `spot${g.spot}-${team}`;
    }
    if (role) {
      if (g.kind === "deliver") return wait;
      const phase = ["M", "E", "S"].find((k) => need[k] > 0)!;
      if (held.length)
        return held.some((o) => o.kind === phase)
          ? this.choose(
              s,
              r,
              opts,
              target,
              phase === "M" ? "placeM" : "place",
              phase,
            ) || wait
          : this.choose(s, r, opts, transfer, "drop", held[0].kind) || wait;
      const amount = Math.min(
        need[phase],
        Math.max(1, Number(this.v.teams[team].caps.capacity_br)),
      );
      if (
        s.robots[r].pos === transfer &&
        s.objects.filter((o) => o.kind === phase && o.loc === `buffer${team}`)
          .length < amount
      )
        return wait;
      return this.choose(s, r, opts, transfer, "pick", phase, amount) || wait;
    }
    if (held.length)
      return this.choose(s, r, opts, transfer, "drop", held[0].kind) || wait;
    const needed = { ...need };
    if (g.kind !== "deliver")
      for (const o of s.objects)
        if ([`buffer${team}`, `robot${br}`].includes(o.loc))
          needed[o.kind] = (needed[o.kind] || 0) - 1;
    const kind = ["M", "E", "S"].find((k) => needed[k] > 0);
    if (kind)
      return (
        this.choose(
          s,
          r,
          opts,
          `${kind === "M" ? "ball" : kind === "E" ? "store" : "sky"}${team}`,
          "pick",
          kind,
          needed[kind],
        ) || wait
      );
    const completed = SPOTS.map((_, i) => i).filter((i) => {
      const ts = tower(s, i);
      return ts.length === 3 && ts[2].face === team;
    });
    if (
      g.kind === "build" &&
      completed.length &&
      [...completed, g.spot!].some((i) => SPOTS[i][4] === -1)
    )
      return this.choose(s, r, opts, `ball${team}`) || wait;
    return wait;
  }
}
