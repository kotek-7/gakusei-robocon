export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "読み込みに失敗しました");
  return data as T;
}
export function saveJSON(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const names: Record<string, string> = {
  move: "移動",
  pick: "取得",
  drop: "床へ受渡し",
  give: "直接受渡し",
  receive: "直接受取",
  place: "設置",
  take: "再把持",
  flip: "反転",
  placeM: "Mustika設置",
  takeM: "Mustika再把持",
  retry: "リトライ",
  wait: "待機",
  continue: "継続",
};
export function actionName(a: {
  kind: string;
  dest?: string;
  spot?: number;
  objects?: number[];
  seconds?: number;
}) {
  return [
    names[a.kind] || a.kind,
    a.dest && "→ " + locationName(a.dest),
    a.spot !== undefined && "地点" + a.spot,
    a.objects && "物体 " + a.objects.join(", "),
    a.seconds !== undefined && a.seconds + "秒",
  ]
    .filter(Boolean)
    .join(" ");
}
export const robotNames = ["赤TR", "赤BR", "青TR", "青BR"];
export const statusName: Record<string, string> = {
  running: "探索中",
  evaluating: "集計中",
  paused: "一時停止",
  complete: "探索完了",
  error: "エラー",
};

export function locationName(id: string) {
  const special: Record<string, string> = {
    groundSky: "Sky置場",
    groundBall: "Mustika置場",
    pillar: "Mustika奉納先",
  };
  if (special[id]) return special[id];
  if (/^robot[0-3]$/.test(id))
    return robotNames[Number(id.slice(5))] + "が保持";
  if (/^tower[0-9]+$/.test(id)) return "設置地点 " + id.slice(5);
  const match = id.match(/^(.*)([01])$/);
  if (!match) return id;
  const names: Record<string, string> = {
    startA: "スタートA",
    startB: "スタートB",
    south: "GND・Sky側",
    north: "GND・Earth側",
    store: "Earth置場",
    sky: "Sky取得位置",
    ball: "Mustika取得位置",
    transfer: "受渡し位置",
    buffer: "受渡し床",
    lane: "L1・受渡し側",
    middle: "L1・階段前",
    upper: "L2",
    pillar: "奉納位置",
    "lane0-": "L1・Earth側",
    "lane1-": "L1・Sky側",
  };
  const site = match[1].match(/^spot(\d+)-$/);
  return `${match[2] === "0" ? "赤" : "青"}・${site ? "設置地点 " + site[1] : names[match[1]] || match[1]}`;
}
