import type { CandidateCollectionRow } from "./collection";
import { candidateKey } from "./review";

/** Keep filtered-out comparison candidates reachable; ignore removed candidates. */
export function recoveryEntries(rows: CandidateCollectionRow[], visibleKeys: string[], shortlistKeys: string[]) {
  const visible = new Set(visibleKeys), shortlist = new Set(shortlistKeys);
  return rows.flatMap(row => {
    const key = candidateKey(row.run, row.candidate.id);
    return !visible.has(key) && shortlist.has(key) ? [{key, row}] : [];
  });
}
