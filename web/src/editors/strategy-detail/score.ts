import type { MatchAnalysis, ScoreParts } from "../../engine/analysis";

export const scoreItems = [
  ["transfer", "搬送"], ["earthL1", "アース L1"], ["earthL2", "アース L2"],
  ["skyL1", "スカイ L1"], ["skyL2", "スカイ L2"], ["mustika", "ムスティカ"],
] as const;
export type ScoreItem = typeof scoreItems[number][0];
export function scoreChanges(analysis: MatchAnalysis) {
  return analysis.samples.slice(1).flatMap((sample, index) => {
    const before = analysis.samples[index];
    const changes = sample.parts.map((parts, team) => Object.fromEntries(
      [...scoreItems.map(([key]) => key), "total" as const].map(key => [key, parts[key] - before.parts[team][key]]),
    ) as ScoreParts);
    if (!changes.some(parts => scoreItems.some(([key]) => parts[key] !== 0))) return [];
    return [{ key: `${index}/${sample.edge}`, time: sample.t, edge: sample.edge, before: before.parts, after: sample.parts, changes,
      // An edge may include concurrent completions. They are context, not causal attribution.
      actions: analysis.markers.filter(marker => marker.edge === sample.edge && marker.t === sample.t && marker.action && marker.kind !== "blocked" && marker.kind !== "branch" && marker.kind !== "mandate"),
    }];
  });
}
export function scoreSummary(analysis: MatchAnalysis, team: number) {
  const changes = scoreChanges(analysis);
  return scoreItems.map(([key, label]) => ({ key, label,
    start: analysis.samples[0]?.parts[team][key] ?? 0,
    end: analysis.samples.at(-1)?.parts[team][key] ?? 0,
    gained: changes.reduce((sum, row) => sum + Math.max(0, row.changes[team][key]), 0),
    lost: changes.reduce((sum, row) => sum + Math.min(0, row.changes[team][key]), 0),
  }));
}
