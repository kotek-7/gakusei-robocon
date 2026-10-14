import type { Workspace } from "../../engine/protocol";

export type CandidateReview = NonNullable<Workspace["candidateReview"]>;
export const emptyCandidateReview = (): CandidateReview => ({ shortlist: [], decisions: {} });
export const candidateKey = (run: number, id: string) => `${run}/${id}`;
export function toggleShortlist(review: CandidateReview, key: string): CandidateReview {
  return { ...review, shortlist: review.shortlist.includes(key)
    ? review.shortlist.filter(k => k !== key)
    : [...review.shortlist, key] };
}
