import type {
  Action,
  Config,
  Model,
  Obj,
  State,
  Variant,
} from "../explorer/types";
import data from "./model-data.json";
import { assert, clone, combinations, equal, key } from "./util";
export const MODEL = data.model as Model;
export const VERSION = MODEL.version;
export const NODES = data.model.field.nodes;
export const EDGES = data.model.field.edges;
export const SPOTS = data.spots;
export const ROBOT_NAMES = ["赤TR", "赤BR", "青TR", "青BR"];
export const defaults = (): Config => clone(MODEL.defaults);
export const payload = (s: State, r: number) =>
  s.objects.filter((o) => o.loc === `robot${r}`);
export const tower = (s: State, i: number) =>
  s.objects
    .filter((o) => o.loc === `tower${i}`)
    .sort((a, b) => a.layer - b.layer);
export const nodeAt = (pos: string) => NODES[pos as keyof typeof NODES];
export function dimensions(
  c: Config,
): [number, string, string, (number | boolean | string)[]][] {
  const dims: [number, string, string, (number | boolean | string)[]][] = [];
  for (let t = 0; t < 2; t++) {
    for (const k of Object.keys(MODEL.caps))
      dims.push([t, "caps", k, c.teams[t].caps[k]]);
    for (const k of Object.keys(MODEL.profiles))
      dims.push([t, "speeds", k, c.teams[t].speeds[k]]);
  }
  return [...dims, [-1, "", "start", c.starts], [-1, "", "layout", c.layouts]];
}
export const countConfigs = (c: Config): bigint =>
  dimensions(c).reduce((n, d) => n * BigInt(d[3].length), 1n);
export function configAt(c: Config, index: number): Variant {
  assert(
    Number.isSafeInteger(index) &&
      index >= 0 &&
      BigInt(index) < countConfigs(c),
    "構成番号が範囲外です",
  );
  const v: Variant = {
    teams: [
      { caps: {}, speeds: {} },
      { caps: {}, speeds: {} },
    ],
    start: 0,
    layout: "stacked",
  };
  for (const [t, kind, k, values] of dimensions(c).reverse()) {
    const value = values[index % values.length];
    index = Math.floor(index / values.length);
    if (t < 0) {
      if (k === "start") v.start = value as number;
      else v.layout = value as string;
    } else if (kind === "caps") v.teams[t].caps[k] = value as boolean | number;
    else v.teams[t].speeds[k] = value as number;
  }
  return v;
}
export function fits(
  objects: Obj[],
  caps: Variant["teams"][number]["caps"],
  role: number,
): boolean {
  if (objects.some((o) => o.kind === "M"))
    return !!caps.mustika && objects.length === 1;
  if (objects.length > Number(caps[role === 0 ? "capacity_tr" : "capacity_br"]))
    return false;
  if (objects.some((o) => !caps[o.kind === "E" ? "earth" : "sky"]))
    return false;
  return !!caps.mixed || new Set(objects.map((o) => o.kind)).size <= 1;
}
export function validateConfig(input: unknown): Config {
  assert(
    input && typeof input === "object",
    "条件JSONはオブジェクトで指定してください",
  );
  const c = input as Config;
  assert(c.version === VERSION, "モデルの版が一致しません");
  assert(
    ["start", "endgame", "custom"].includes(c.scenario),
    "初期局面が不正です",
  );
  assert(
    Number.isInteger(c.horizon) && c.horizon >= 1 && c.horizon <= 180,
    "終了時刻は1〜180秒です",
  );
  assert(
    typeof c.name === "string" && c.name.length >= 1 && c.name.length <= 100,
    "探索名は1〜100文字です",
  );
  const sameKeys = (x: unknown, y: object) =>
    x &&
    typeof x === "object" &&
    equal(Object.keys(x).sort(), Object.keys(y).sort());
  assert(sameKeys(c.rules, MODEL.rules), "規則設定が不足しています");
  for (const [k, r] of Object.entries(MODEL.rules))
    assert(r.options.includes(c.rules[k]), `不正なルール設定: ${r.label}`);
  assert(
    sameKeys(c.profiles, MODEL.profiles),
    "数値プロファイルが不足しています",
  );
  for (const [k, vals] of Object.entries(c.profiles))
    assert(
      Array.isArray(vals) &&
        vals.length === 3 &&
        vals.every(
          (v) =>
            typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 300,
        ),
      `正の3段階値が必要です: ${MODEL.profiles[k]}`,
    );
  assert(
    Array.isArray(c.teams) && c.teams.length === 2,
    "赤青の2構成が必要です",
  );
  const selection = (vs: unknown, allowed: unknown[]) =>
    Array.isArray(vs) &&
    vs.length > 0 &&
    new Set(vs).size === vs.length &&
    vs.every((v) => allowed.includes(v));
  for (const t of c.teams) {
    assert(
      t && sameKeys(t.caps, MODEL.caps) && sameKeys(t.speeds, MODEL.profiles),
      "構成項目が不足しています",
    );
    for (const [k, vals] of Object.entries(t.caps))
      assert(
        selection(
          vals,
          k === "capacity_tr"
            ? [0, 1, 2, 3]
            : k === "capacity_br"
              ? [0, 1, 2]
              : [false, true],
        ),
        `不正な能力設定: ${MODEL.caps[k]}`,
      );
    for (const [k, vals] of Object.entries(t.speeds))
      assert(
        selection(vals, [0, 1, 2]),
        `不正な段階設定: ${MODEL.profiles[k]}`,
      );
  }
  assert(
    selection(c.starts, [0, 1, 2, 3]) &&
      selection(c.layouts, ["stacked", "single"]),
    "不正な初期配置です",
  );
  if (c.scenario === "endgame")
    assert(c.horizon >= 174, "終盤局面は174秒からです");
  if (c.scenario === "custom") {
    validateState(c.root);
    const root = c.root!;
    assert(
      root.robots.every((r) => !r.job),
      "指定初期局面は全機体の動作終了時にしてください",
    );
    assert(root.t <= c.horizon, "初期局面が終了時刻を超えています");
    for (let r = 0; r < 4; r++) {
      const caps = Object.fromEntries(
        Object.entries(c.teams[r >> 1].caps).map(([k, v]) => [
          k,
          Math.min(...v.map(Number)),
        ]),
      );
      assert(
        fits(payload(root, r), caps, r % 2),
        "指定局面の積載物を扱えない構成が含まれています",
      );
    }
  }
  return c;
}
export function initial(c: Config, v: Variant): State {
  if (c.scenario === "custom") {
    validateState(c.root);
    return clone(c.root!);
  }
  const s: State = {
    t: 0,
    robots: [],
    objects: [],
    mandate: [false, false],
    ever: [[], []],
    transfer: [0, 0],
  };
  for (let r = 0; r < 4; r++)
    s.robots.push({
      pos: `start${(r % 2) ^ ((v.start >> (r >> 1)) & 1) ? "B" : "A"}${r >> 1}`,
      job: null,
      entered: false,
      waited: false,
    });
  for (let i = 0; i < 53; i++) {
    const team = Math.floor(i / 20),
      j = i % 20;
    s.objects.push({
      id: i,
      kind: i < 40 ? "E" : i < 52 ? "S" : "M",
      owner: i < 40 ? team : -1,
      loc: i < 40 ? `store${team}` : i < 52 ? "groundSky" : "groundBall",
      slot:
        i < 40
          ? v.layout === "stacked"
            ? Math.floor(j / 2)
            : j
          : i < 52
            ? i - 40
            : 0,
      layer: i < 40 && v.layout === "stacked" ? j % 2 : 0,
      face: i < 40 ? team : -1,
      delivered: [false, false],
    });
  }
  if (c.scenario === "endgame") {
    s.t = 174;
    for (let r = 0; r < 4; r++) {
      s.robots[r].pos = `${r % 2 ? "spot4-" : "transfer"}${r >> 1}`;
      s.robots[r].entered = !!(r % 2);
    }
    for (const [ids, spot, owner] of [
      [[0, 1, 40], 0, 0],
      [[20, 21, 41], 4, 1],
    ] as [number[], number, number][]) {
      ids.forEach((id, layer) =>
        Object.assign(s.objects[id], {
          loc: `tower${spot}`,
          layer,
          face: owner,
          delivered: [owner === 0, owner === 1],
        }),
      );
      s.transfer[owner] += 3;
    }
    qualify(s, c.rules);
  }
  return s;
}
export function qualify(s: State, rules: Config["rules"]) {
  for (let t = 0; t < 2; t++) {
    const owned = SPOTS.map((_, i) => i).filter((i) => {
      const ts = tower(s, i);
      return ts.length === 3 && ts[2].face === t;
    });
    s.ever[t] = [...new Set([...s.ever[t], ...owned])].sort((a, b) => a - b);
    const considered = rules.mandate === "historical" ? s.ever[t] : owned;
    if (considered.length >= 2 && considered.some((i) => SPOTS[i][4] === -1))
      s.mandate[t] = true;
  }
}
export function scores(s: State): number[] {
  const pts = s.transfer.map((n) => 5 * n);
  for (let i = 0; i < 10; i++)
    for (const o of tower(s, i)) {
      if (o.kind === "E") pts[o.owner] += [10, 20][o.layer] * SPOTS[i][3];
      else if (o.face === 0 || o.face === 1) pts[o.face] += 40 * SPOTS[i][3];
    }
  const m = s.objects[52];
  if (m.loc === "pillar") pts[m.owner] += 250;
  return pts;
}
export function ranks(s: State) {
  return [0, 1].map((t) => {
    const counts = [0, 0];
    let caps = 0;
    for (let i = 0; i < 10; i++)
      for (const o of tower(s, i)) {
        counts[SPOTS[i][3] - 1] += Number(
          (o.kind === "E" ? o.owner : o.face) === t,
        );
        caps += Number(o.kind === "S" && o.face === t);
      }
    return [
      scores(s)[t],
      Number(s.objects[52].loc === "pillar" && s.objects[52].owner === t),
      caps,
      counts[1],
      counts[0],
    ];
  });
}
export function winner(s: State) {
  const [a, b] = ranks(s);
  for (let i = 0; i < a.length; i++)
    if (a[i] !== b[i]) return Math.sign(a[i] - b[i]);
  return 0;
}
export const snapshot = (s: State) => ({
  state: s,
  scores: scores(s),
  ranks: ranks(s),
  winner: winner(s),
});
export function validateState(input: unknown): asserts input is State {
  assert(input && typeof input === "object", "局面データの項目が不正です");
  const s = input as State;
  assert(
    equal(
      Object.keys(s).sort(),
      ["t", "robots", "objects", "mandate", "ever", "transfer"].sort(),
    ),
    "局面データの項目が不正です",
  );
  assert(
    Number.isInteger(s.t) && s.t >= 0 && s.t <= 180,
    "局面の時刻が不正です",
  );
  assert(
    Array.isArray(s.objects) &&
      s.objects.length === 53 &&
      s.objects.every((o, i) => o?.id === i),
    "競技物体の個数またはIDが不正です",
  );
  assert(
    Array.isArray(s.robots) && s.robots.length === 4,
    "両チーム合わせて4台の機体が必要です",
  );
  assert(
    Array.isArray(s.mandate) &&
      s.mandate.length === 2 &&
      s.mandate.every((v) => typeof v === "boolean"),
    "ムスティカ取得条件の成立状態が不正です",
  );
  assert(
    Array.isArray(s.transfer) &&
      s.transfer.length === 2 &&
      s.transfer.every((v) => Number.isInteger(v) && v >= 0),
    "受け渡し得点が不正です",
  );
  assert(
    Array.isArray(s.ever) &&
      s.ever.length === 2 &&
      s.ever.every(
        (a) =>
          Array.isArray(a) &&
          a.every((i) => Number.isInteger(i) && i >= 0 && i < 10),
      ),
    "タワーの完成履歴が不正です",
  );
  s.robots.forEach((r, i) => {
    const n = nodeAt(r.pos);
    assert(
      n &&
        [-1, i >> 1].includes(n.team) &&
        n.roles.includes(i % 2 ? "BR" : "TR"),
      "機体の位置が不正です",
    );
    assert(
      typeof r.entered === "boolean" && typeof r.waited === "boolean",
      "機体の進入・待機状態が不正です",
    );
    if (r.job)
      assert(
        Number.isInteger(r.job.end) &&
          r.job.end > s.t &&
          Number.isInteger(r.job.start) &&
          r.job.start >= 0 &&
          r.job.start <= s.t,
        "実行中の動作の時刻が不正です",
      );
  });
  const places = new Set([
    "groundSky",
    "groundBall",
    "pillar",
    "store0",
    "store1",
    "buffer0",
    "buffer1",
    ...s.robots.map((_, i) => `robot${i}`),
    ...SPOTS.map((_, i) => `tower${i}`),
  ]);
  for (const o of s.objects) {
    assert(
      o.kind === (o.id < 40 ? "E" : o.id < 52 ? "S" : "M") && places.has(o.loc),
      "競技物体の種類または所在が不正です",
    );
    assert(
      [-1, 0, 1].includes(o.owner) && [-1, 0, 1].includes(o.face),
      "競技物体の所属または色が不正です",
    );
    assert(
      o.kind !== "E" || o.owner === Math.floor(o.id / 20),
      "アースブロックの所属が元のチームと一致しません",
    );
    assert(
      Array.isArray(o.delivered) &&
        o.delivered.length === 2 &&
        o.delivered.every((v) => typeof v === "boolean"),
      "受け渡し得点の加点履歴が不正です",
    );
    assert(
      Number.isInteger(o.layer) &&
        o.layer >= 0 &&
        Number.isInteger(o.slot) &&
        o.slot >= 0,
      "競技物体の段数または配置番号が不正です",
    );
    assert(
      o.loc !== "pillar" ||
        (o.kind === "M" && [0, 1].includes(o.owner) && s.mandate[o.owner]),
      "中央柱へのムスティカの設置状態が不正です",
    );
    assert(
      o.kind !== "M" ||
        [
          "groundBall",
          "pillar",
          "buffer0",
          "buffer1",
          "robot0",
          "robot1",
          "robot2",
          "robot3",
        ].includes(o.loc),
      "ムスティカの所在が不正です",
    );
  }
  for (let i = 0; i < 10; i++) {
    const ts = tower(s, i);
    assert(
      ts.length <= 3 &&
        ts.every((o, k) => o.layer === k && o.kind === (k === 2 ? "S" : "E")),
      "タワーの積み順が不正です",
    );
  }
  for (let r = 0; r < 4; r++) {
    const ps = payload(s, r);
    assert(
      ps.filter((o) => o.kind !== "M").length <= (r % 2 ? 2 : 3) &&
        (!ps.some((o) => o.kind === "M") || ps.length === 1),
      "積載数の上限または混載条件を満たしていません",
    );
  }
}
export function routes(
  pos: string,
  team: number,
  role: string,
  caps: Variant["teams"][number]["caps"],
  rules: Config["rules"],
): [number, string, (typeof EDGES)[number]][] {
  const out: [number, string, (typeof EDGES)[number]][] = [];
  EDGES.forEach((e, i) => {
    if (!e.roles.includes(role) || ![e.a, e.b].includes(pos)) return;
    const dest = pos === e.a ? e.b : e.a,
      n = nodeAt(dest);
    if (
      ![-1, team].includes(n.team) ||
      !n.roles.includes(role) ||
      (e.ability !== "walk" && !caps[e.ability])
    )
      return;
    if (
      role === "BR" &&
      ((e.ability === "ramp" && !rules.br_ramp) ||
        ([`south${team}`, `north${team}`].includes(pos) &&
          [`south${team}`, `north${team}`].includes(dest) &&
          !(rules.br_ramp && caps.ramp)) ||
        (n.p[1] === 0 && nodeAt(pos).p[1] > 0))
    )
      return;
    out.push([i, dest, e]);
  });
  return out;
}
export const action = (
  kind: string,
  fields: Omit<Action, "kind"> = {},
): Action => ({ kind, ...fields });
export function duration(a: Action, c: Config, v: Variant, r: number): number {
  const p = (k: string) => c.profiles[k][v.teams[r >> 1].speeds[k]];
  if (a.kind === "move")
    return Math.max(1, Math.ceil(EDGES[a.edge!].distance / p("move")));
  if (["wait", "delay"].includes(a.kind)) return a.seconds!;
  const k = ["pick", "take", "takeM"].includes(a.kind)
    ? "pick"
    : a.kind === "flip"
      ? "flip"
      : a.kind === "retry"
        ? "retry"
        : ["drop", "give", "receive"].includes(a.kind)
          ? "handover"
          : "place";
  return Math.max(1, Math.ceil(p(k)));
}
const attributes = (o: Obj) => [o.kind, o.owner, o.face, o.delivered];
export function demand(s: State, a: Action): string {
  const ids = new Set(a.objects || []),
    stacks = new Map<string, Obj[]>(),
    selected: unknown[] = [];
  for (const o of s.objects) {
    if (o.loc.startsWith("store")) {
      const k = key([o.loc, o.slot]);
      stacks.set(k, [...(stacks.get(k) || []), o]);
    } else if (ids.has(o.id)) selected.push([o.loc, attributes(o)]);
  }
  const shapes: unknown[] = [];
  for (const st of stacks.values()) {
    st.sort((a, b) => a.layer - b.layer);
    const positions = st.flatMap((o, i) => (ids.has(o.id) ? [i] : []));
    if (positions.length)
      shapes.push([st[0].loc, st.map(attributes), positions]);
  }
  return key([selected.map(key).sort(), shapes.map(key).sort()]);
}
export function signature(s: State, a: Action) {
  const { objects: _, ...rest } = a;
  return key(rest) + demand(s, a);
}
export function outcomeKey(s: State): string {
  const robots = s.robots.map((r) =>
    r.job
      ? {
          ...r,
          job: {
            ...r.job,
            action: {
              ...r.job.action,
              ...(r.job.action.objects
                ? {
                    objects: r.job.action.objects
                      .map((i) =>
                        key([s.objects[i].loc, attributes(s.objects[i])]),
                      )
                      .sort(),
                  }
                : {}),
            },
          },
        }
      : r,
  );
  const stacks = new Map<string, Obj[]>(),
    objects: string[] = [];
  for (const o of s.objects) {
    if (o.loc.startsWith("store")) {
      const k = key([o.loc, o.slot]);
      stacks.set(k, [...(stacks.get(k) || []), o]);
    } else
      objects.push(
        key([o.loc, o.loc.startsWith("tower") ? o.layer : 0, attributes(o)]),
      );
  }
  return key({
    ...s,
    robots,
    objects: objects.sort(),
    stacks: [...stacks.values()]
      .map((st) =>
        key([st[0].loc, st.sort((a, b) => a.layer - b.layer).map(attributes)]),
      )
      .sort(),
  });
}
export function concreteLegal(
  s: State,
  r: number,
  c: Config,
  v: Variant,
): Action[] {
  const robot = s.robots[r],
    team = r >> 1,
    role = r % 2,
    caps = v.teams[team].caps,
    rules = c.rules,
    pos = robot.pos;
  if (s.t >= c.horizon) return [];
  if (robot.job) return [action("continue")];
  const opts = [action("wait", { seconds: c.horizon - s.t })];
  if (c.horizon - s.t > 1) opts.push(action("delay", { seconds: 1 }));
  opts.push(
    action("retry", {
      dest: `start${role ^ ((v.start >> team) & 1) ? "B" : "A"}${team}`,
    }),
  );
  if (role && robot.entered)
    opts.push(action("retry", { dest: `transfer${team}` }));
  const held = payload(s, r);
  for (const [edge, dest] of routes(pos, team, role ? "BR" : "TR", caps, rules))
    opts.push(action("move", { edge, dest }));
  let available: Obj[] = [];
  if (!role) {
    if (pos === `store${team}`)
      available = s.objects.filter((o) => o.loc === pos);
    if (pos === `sky${team}`)
      available = s.objects.filter((o) => o.loc === "groundSky");
    if (
      pos === `ball${team}` &&
      s.mandate[team] &&
      s.objects[52].loc === "groundBall"
    )
      available = [s.objects[52]];
  }
  if (pos === `transfer${team}`) {
    available = s.objects.filter((o) => o.loc === `buffer${team}`);
    for (const o of held) opts.push(action("drop", { objects: [o.id] }));
    const partner = role ? r - 1 : r + 1;
    if (
      caps.direct &&
      s.robots[partner].pos === pos &&
      !s.robots[partner].job
    ) {
      for (const o of role ? payload(s, partner) : held)
        if (fits([...(role ? held : payload(s, partner)), o], caps, 1))
          opts.push(
            action(role ? "receive" : "give", { objects: [o.id], partner }),
          );
    }
  }
  let room = Math.max(
    0,
    Number(caps[role ? "capacity_br" : "capacity_tr"]) - held.length,
  );
  if (!held.length && available.some((o) => o.kind === "M"))
    room = Math.max(room, 1);
  for (let size = 1; size <= Math.min(room, available.length); size++)
    for (const subset of combinations(available, size)) {
      if (!fits([...held, ...subset], caps, role)) continue;
      const ids = subset.map((o) => o.id);
      if (
        subset.some(
          (o) =>
            o.kind === "E" &&
            available.some(
              (x) =>
                x.slot === o.slot && x.layer > o.layer && !ids.includes(x.id),
            ),
        )
      )
        continue;
      opts.push(action("pick", { objects: ids.sort((a, b) => a - b) }));
    }
  const spot = pos.startsWith("spot")
    ? Number(pos.split("-")[0].slice(4))
    : null;
  if (
    role &&
    spot !== null &&
    !s.robots.some((rr) => rr.job?.action.spot === spot)
  ) {
    const ts = tower(s, spot);
    for (const o of held)
      if (
        (o.kind === "E" && ts.length < 2 && caps.earth) ||
        (o.kind === "S" && ts.length === 2 && caps.sky)
      )
        opts.push(action("place", { objects: [o.id], spot }));
    if (ts.length) {
      const top = ts.at(-1)!;
      if (top.kind === "S" && caps.flip && !held.length)
        opts.push(action("flip", { objects: [top.id], spot }));
      if (
        caps.reposition &&
        fits([...held, top], caps, 1) &&
        ((top.kind === "E" && top.owner === team) ||
          (top.kind === "S" && rules.sky_relocate))
      )
        opts.push(action("take", { objects: [top.id], spot }));
    }
  }
  if (role && pos === `pillar${team}` && caps.mustika) {
    if (held.some((o) => o.kind === "M") && s.mandate[team])
      opts.push(action("placeM", { objects: [52] }));
    if (!held.length && rules.placed_mustika && s.objects[52].loc === "pillar")
      opts.push(action("takeM", { objects: [52] }));
  }
  return opts;
}
export function legal(s: State, r: number, c: Config, v: Variant): Action[] {
  if (s.t >= c.horizon) return [];
  if (s.robots[r].job) return [action("continue")];
  const seen = new Set<string>(),
    choices: Action[] = [],
    held = payload(s, r);
  for (const a of concreteLegal(s, r, c, v)) {
    const returns =
      a.kind === "retry" &&
      held.some((o) => o.kind === "M" || c.rules.retry_payload === "return");
    if (
      ["move", "retry"].includes(a.kind) &&
      duration(a, c, v, r) > c.horizon - s.t &&
      !returns
    )
      continue;
    if (
      a.kind === "retry" &&
      a.dest === s.robots[r].pos &&
      (!held.length ||
        (c.rules.retry_payload === "retain" &&
          !held.some((o) => o.kind === "M")))
    )
      continue;
    const sig = signature(s, a);
    if (!seen.has(sig)) {
      seen.add(sig);
      choices.push(a);
    }
  }
  return choices;
}
export function matched(acts: Action[]): boolean {
  for (let r = 0; r < acts.length; r += 2) {
    const [a, b] = acts.slice(r, r + 2);
    if (
      (a.kind === "give" || b.kind === "receive") &&
      !(
        a.kind === "give" &&
        b.kind === "receive" &&
        equal(a.objects, b.objects)
      )
    )
      return false;
  }
  return true;
}
export function teamChoices(
  s: State,
  team: number,
  c: Config,
  v: Variant,
): Action[][] {
  const out: Action[][] = [];
  for (const a of legal(s, team * 2, c, v))
    for (const b of legal(s, team * 2 + 1, c, v))
      if (matched([a, b])) out.push([a, b]);
  return out;
}
