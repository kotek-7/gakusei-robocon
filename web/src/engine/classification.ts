import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { Event } from "./transition";
import { key } from "./util";
export const digest = (x: unknown) =>
  bytesToHex(sha256(new TextEncoder().encode(key(x))));
export const CLASS_VERSION = "browser-milestones-1";
export function tokens(events: Event[]): string[] {
  return events
    .filter((e) => !["wait", "delay", "continue"].includes(e.action.kind))
    .map((e) =>
      key([
        e.t,
        e.robot,
        e.phase,
        e.action.kind,
        e.action.dest ?? null,
        e.action.spot ?? null,
        e.action.objects ?? null,
      ]),
    );
}
export function sortTrace(trace: string[]): string[] {
  return trace
    .map((raw) => ({ raw, tok: JSON.parse(raw) }))
    .sort(
      (a, b) =>
        a.tok[0] - b.tok[0] ||
        (a.tok[2] < b.tok[2] ? -1 : a.tok[2] > b.tok[2] ? 1 : 0) ||
        a.tok[1] - b.tok[1] ||
        (a.raw < b.raw ? -1 : a.raw > b.raw ? 1 : 0),
    )
    .map((x) => x.raw);
}
export function structural(trace: string[]): string[][] {
  const groups: string[][] = [];
  let old: number | null = null;
  for (const raw of trace) {
    const [t, ...rest] = JSON.parse(raw);
    if (t !== old) {
      groups.push([]);
      old = t;
    }
    groups.at(-1)!.push(key(rest));
  }
  return groups.map((g) => g.sort());
}
export function classification(sig: string[][]): [string, string[][]] {
  const groups = sig
    .map((group) =>
      group
        .flatMap((raw) => {
          const e = JSON.parse(raw);
          if (
            e[1] !== "finish" ||
            !["place", "flip", "take", "placeM", "takeM"].includes(e[2])
          )
            return [];
          e[5] = (e[5] || [])
            .map((id: number) =>
              id < 20 ? "E0" : id < 40 ? "E1" : id < 52 ? "S" : "M",
            )
            .sort();
          return [key(e)];
        })
        .sort(),
    )
    .filter((g) => g.length);
  return ["S-" + digest(groups), groups];
}
