import type { CandidateEvidence } from "../../engine/types";

export function evidenceScoreDelta(evidence: CandidateEvidence, baseline: CandidateEvidence) {
  const red = evidence.scores[0] - baseline.scores[0];
  const blue = evidence.scores[1] - baseline.scores[1];
  return { red, blue, margin: red - blue };
}
const signed = (value: number) => `${value > 0 ? "+" : ""}${value}点`;
/** Baseline is a concrete waiting-opponent witness, not an optimum or a causal control. */
export function EvidenceScoreDelta({ evidence, baseline }: { evidence: CandidateEvidence; baseline: CandidateEvidence }) {
  const delta = evidenceScoreDelta(evidence, baseline);
  const same = evidence.node === baseline.node && evidence.path.join() === baseline.path.join();
  return <dl aria-label="選択展開の得点と相手待機との差">
    <div><dt>赤 対 青</dt><dd>{evidence.scores[0]} 対 {evidence.scores[1]}</dd></div>
    <div><dt>点差</dt><dd>{signed(evidence.scores[0] - evidence.scores[1])}</dd></div>
    {!same && <>
      <div><dt>赤の増減（相手待機比）</dt><dd>{signed(delta.red)}</dd></div>
      <div><dt>青の増減（相手待機比）</dt><dd>{signed(delta.blue)}</dd></div>
      <div><dt>点差の増減（相手待機比）</dt><dd>{signed(delta.margin)}</dd></div>
    </>}
  </dl>;
}
