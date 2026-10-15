import type { Candidate } from "../../engine/types";
export type Response = Candidate["responses"][number];
export const margin = (e: Response) => e.scores[0] - e.scores[1];
/** One row per saved opponent script; arbitration paths are observations, not samples of a probability. */
export function opponentAnalysis(candidate: Candidate, common: string[]) {
  const grouped = new Map<string, Response[]>();
  for (const [index,e] of candidate.responses.entries()) {
    const key = e.opponent ? `opponent:${e.opponent}` : `unknown:${index}`;
    const records = grouped.get(key);
    if (records) records.push(e); else grouped.set(key, [e]);
  }
  return [...grouped].map(([key, evidence]) => {
    const opponent = evidence[0].opponent ?? "";
    const ordered = [...evidence].sort((a,b) => margin(a)-margin(b));
    const redMin = evidence.reduce((min,e)=>Math.min(min,e.scores[0]),Infinity);
    const redMax = evidence.reduce((max,e)=>Math.max(max,e.scores[0]),-Infinity);
    return {key, opponent, evidence, worst: ordered[0], best: ordered.at(-1)!,
      min: margin(ordered[0]), max: margin(ordered.at(-1)!),
      redLoss: candidate.baseline.scores[0] - redMin,
      redMinDelta: redMin - candidate.baseline.scores[0],
      redMaxDelta: redMax - candidate.baseline.scores[0],
      redBlocked: evidence.filter(e=>e.blocked?.some(b=>b.robot<2)).length,
      common: !!opponent && common.includes(opponent) && evidence.some(e=>e.shared),
    };
  }).sort((a,b)=>a.min-b.min || a.opponent.localeCompare(b.opponent));
}
export function instructionFailures(candidate: Candidate) {
  const groups = new Map<string,{robot:number; instruction:number; reason:string; evidence:Response[]; first:number; last:number}>();
  for (const e of candidate.responses) {
   const recorded = new Set<string>();
   for (const b of e.blocked ?? []) {
    if (b.robot >= 2) continue;
    const key=JSON.stringify([b.robot,b.instruction,b.reason]);
    const row=groups.get(key) ?? {robot:b.robot,instruction:b.instruction,reason:b.reason,evidence:[],first:b.t,last:b.t};
    if (!recorded.has(key)) { row.evidence.push(e); recorded.add(key); }
    row.first=Math.min(row.first,b.t);row.last=Math.max(row.last,b.t);groups.set(key,row);
  }
  }
  return [...groups.values()].sort((a,b)=>b.evidence.length-a.evidence.length || a.first-b.first);
}
