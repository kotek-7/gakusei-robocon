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

export const competitionName = "NHK学生ロボコン2027";
export const ruleAssumption = "競技ルールはABUロボコン2027と同一と仮定";
export const profileNames = ["速い", "標準", "遅い"];
export const objectNames: Record<string, string> = {
  E: "アースブロック",
  S: "スカイブロック",
  M: "ムスティカ",
};
export const evaluationMeaning =
  "展開グループを等重みとし、各グループ内の試合展開も等重みで集計します。実大会の勝率ではありません。未完了の値は発見済みの範囲です。";
export const guaranteeMeaning =
  "モデル内で相手が最善の行動を選ぶ場合の勝利確率です。同時操作の競合は不利な結果も考慮します。点差は勝利確率の保証を維持する保守的な下限です。";
export const glossary = [
  ["TR", "運搬ロボット。競技物体を取得し、受け渡しエリアへ運びます。"],
  [
    "BR",
    "建設ロボット。ブロックを受け取り、タワーの建設や中央柱へのムスティカ設置を行います。",
  ],
  ["GND／L1／L2", "グラウンドエリア／レベル1エリア／レベル2エリア。"],
  [
    "ムスティカ柱／中央柱",
    "ムスティカ柱は試合開始時のムスティカの置き場所、中央柱は設置先です。",
  ],
  [
    "ムスティカ取得条件",
    "サンクチュアリ・マンデート。完成タワーの条件を満たすと成立します。",
  ],
  [
    "局面／遷移",
    "局面はある時刻の機体・競技物体・得点などの状態、遷移は両チームの行動による状態の変化です。",
  ],
  [
    "展開グループ",
    "正確な時刻を除き、動作の順序と同時性が一致する試合展開のまとまりです。",
  ],
  [
    "作戦",
    "試合展開を動作の構造で分類したものです。IDは構造から決まり、得点や意味的な名前では分類しません。",
  ],
  [
    "試合展開数（時刻を区別）",
    "待機以外の動作と正確な時刻が一致する履歴を1つと数えます。待機の分け方だけが違う履歴は重複して数えません。",
  ],
];

export const phaseNames: Record<string, string> = {
  start: "開始",
  finish: "完了",
  blocked: "競合で不成立",
};

export function structuralEventName(raw: string) {
  const [robot, phase, kind, dest, spot, objects] = JSON.parse(raw);
  const resources: Record<string, string> = {
    E0: "赤のアースブロック",
    E1: "青のアースブロック",
    S: "スカイブロック",
    M: "ムスティカ",
  };
  const counts = new Map<string, number>();
  for (const object of objects || [])
    counts.set(object, (counts.get(object) || 0) + 1);
  const description = [...counts]
    .map(([kind, count]) => `${resources[kind] || kind} ×${count}`)
    .join("、");
  return `${robotNames[robot]} ${actionName({ kind, dest: dest ?? undefined, spot: spot ?? undefined })} ${description} ${phaseNames[phase] || phase}`;
}
