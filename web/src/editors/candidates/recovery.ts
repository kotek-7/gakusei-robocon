import type { CandidateCollectionRow } from "./collection";
import { candidateKey, type CandidateReview } from "./review";

export function decisionDirty(draft: CandidateReview["decisions"][string] | undefined, saved: CandidateReview["decisions"][string] | undefined): boolean {
  return !!draft && (draft.note !== (saved?.note ?? "") || draft.status !== (saved?.status ?? "open"));
}
/** Only existing candidates can be revealed. Hidden shortlist members and all real drafts stay reachable. */
export function recoveryEntries(rows: CandidateCollectionRow[], visibleKeys: string[], review: CandidateReview, drafts: CandidateReview["decisions"]) {
  const visible = new Set(visibleKeys), shortlist = new Set(review.shortlist);
  return rows.flatMap(row => {
    const key = candidateKey(row.run, row.candidate.id);
    const dirty = decisionDirty(drafts[key], review.decisions[key]);
    const hidden = !visible.has(key);
    if (!dirty && !(hidden && shortlist.has(key))) return [];
    return [{key, row, dirty, hidden, compared: shortlist.has(key), note: drafts[key]?.note ?? review.decisions[key]?.note ?? ""}];
  }).sort((a,b) => Number(b.dirty) - Number(a.dirty));
}
