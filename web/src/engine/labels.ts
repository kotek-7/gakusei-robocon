const names: Record<string, string> = {
  move: "移動",
  pick: "取得",
  drop: "受け渡しエリアの床に置く",
  give: "直接渡す",
  receive: "直接受け取る",
  place: "設置",
  take: "持ち直す",
  flip: "スカイブロックを裏返す",
  placeM: "ムスティカを設置",
  takeM: "ムスティカを持ち直す",
  retry: "リトライ",
  wait: "待機",
  delay: "時刻を指定して待機",
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
    a.spot !== undefined && "建設スポット " + a.spot,
    a.objects && "物体 " + a.objects.join(", "),
    a.seconds !== undefined &&
      (a.kind === "delay"
        ? `${a.seconds}秒`
        : `次の動作完了まで（最長${a.seconds}秒）`),
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
    groundSky: "グラウンド共有エリア（スカイブロック）",
    groundBall: "ムスティカ柱",
    pillar: "中央柱",
  };
  if (special[id]) return special[id];
  if (/^robot[0-3]$/.test(id))
    return robotNames[Number(id.slice(5))] + "が保持";
  if (/^tower[0-9]+$/.test(id)) return "建設スポット " + id.slice(5);
  const match = id.match(/^(.*)([01])$/);
  if (!match) return id;
  const names: Record<string, string> = {
    startA: "スタートゾーンA",
    startB: "スタートゾーンB",
    south: "グラウンド・スカイブロック側",
    north: "グラウンド・アースブロック側",
    store: "保管エリア",
    sky: "スカイブロック取得位置",
    ball: "ムスティカ柱の取得位置",
    transfer: "受け渡しエリア",
    buffer: "受け渡しエリアの床",
    lane: "L1・受け渡しエリア側",
    middle: "L1・階段前",
    upper: "L2",
    pillar: "中央柱の設置位置",
    "lane0-": "L1・アースブロック側",
    "lane1-": "L1・スカイブロック側",
  };
  const site = match[1].match(/^spot(\d+)-$/);
  return `${match[2] === "0" ? "赤" : "青"}・${site ? "建設スポット " + site[1] : names[match[1]] || match[1]}`;
}
