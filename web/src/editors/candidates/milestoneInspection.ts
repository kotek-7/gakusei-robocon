import { milestoneCells } from "./milestones";
export type MilestoneRow = ReturnType<typeof milestoneCells> & { key: string; group: number; robot: number; kind: string; raw: string };
export function inspectMilestones(groups: string[][]): MilestoneRow[] {
  return groups.flatMap((group, index) => group.map((raw, event) => {
    const [robot, , kind] = JSON.parse(raw) as [number, string, string];
    return { ...milestoneCells(raw), key: `${index}/${event}`, group: index + 1, robot, kind, raw };
  }));
}
/** Ignore blue-only groups while preserving simultaneity of red completions. */
export function firstRedDifference(baseline: string[][], current: string[][]): { baselineGroup: number | null; currentGroup: number | null } | null {
  const red = (groups: string[][]) => groups.map((group, index) => ({ group: index + 1, events: group.filter(raw => JSON.parse(raw)[0] < 2).sort() })).filter(group => group.events.length);
  const a = red(baseline), b = red(current);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    if (JSON.stringify(a[index]?.events) !== JSON.stringify(b[index]?.events)) return { baselineGroup: a[index]?.group ?? null, currentGroup: b[index]?.group ?? null };
  }
  return null;
}
export function filterMilestones(rows: MilestoneRow[], robot: string, kind: string, query: string): MilestoneRow[] {
  const needle = query.trim().toLocaleLowerCase();
  return rows.filter(row => (!robot || String(row.robot) === robot) && (!kind || row.kind === kind) && (!needle || `${row.actor} ${row.action} ${row.location} ${row.objects}`.toLocaleLowerCase().includes(needle)));
}
