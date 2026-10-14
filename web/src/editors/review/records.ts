import type { ReviewRecord } from "../../engine/protocol";

export const reviewStatusNames = { open: "未確認", keep: "採用候補", dismiss: "見送り" } as const;
export function filterRecords(records: ReviewRecord[], query: string, status: string) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return records.filter(r => (status === "all" || r.status === status) && words.every(word =>
    `${r.title} ${r.note} ${r.node}`.toLocaleLowerCase().includes(word)));
}
export function reviewText(records: ReviewRecord[]) {
  return records.map(r => `${r.title}\n判断: ${reviewStatusNames[r.status]}\n局面: ${r.node} / ${r.time}秒${r.range ? ` / 範囲: ${r.range[0]}〜${r.range[1]}秒` : ""}\n${r.note}`).join("\n\n");
}

export function sortRecords(records: ReviewRecord[], order: string) {
  const rank = { open: 0, keep: 1, dismiss: 2 };
  return [...records].sort((a, b) => (order === "time" ? a.time - b.time : order === "status" ? rank[a.status] - rank[b.status] : 0) || b.created - a.created || a.id.localeCompare(b.id));
}
