import { actionName, locationName, phaseNames, robotNames, structuralEventName } from "../common/labels";

const compactActions: Record<string, string> = {
  drop: "床置き", give: "渡す", receive: "受取", take: "持ち直し", flip: "反転",
  placeM: "ムスティカ設置", takeM: "ムスティカ持直", delay: "時刻待機",
};
const resources: Record<string, string> = { E0: "赤アース", E1: "青アース", S: "スカイ", M: "ムスティカ" };

export function milestoneCells(raw: string) {
  const [robot, phase, kind, dest, spot, objects] = JSON.parse(raw) as [number, string, string, string | null, number | null, string[] | null];
  const counts = new Map<string, number>();
  for (const object of objects ?? []) counts.set(object, (counts.get(object) ?? 0) + 1);
  return {
    actor: robotNames[robot] ?? String(robot),
    action: compactActions[kind] ?? actionName({ kind }),
    phase: phaseNames[phase] ?? phase,
    location: [dest ? locationName(dest).replaceAll("建設スポット ", "スポット ") : "", spot != null ? `スポット ${spot}` : ""].filter(Boolean).join(" / ") || "—",
    objects: [...counts].map(([kind, count]) => `${resources[kind] ?? kind}×${count}`).join("・") || "—",
    full: structuralEventName(raw),
  };
}
