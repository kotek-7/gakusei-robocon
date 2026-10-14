import { useState } from "react";
import type { StrategyPolicy } from "../engine/types";
import { alternatives, spotNames } from "../study/state";
import {
  changes,
  fieldNames,
  acceptVariants,
  type PolicyField,
} from "./operations";
function value(p: StrategyPolicy, k: PolicyField) {
  if (k === "targets")
    return p.targets.map((t) => spotNames[t]).join(" → ") || "なし";
  if (typeof p[k] === "boolean") return p[k] ? "使う" : "使わない";
  return String(p[k]);
}
export function Variants({
  policy,
  existing,
  onAccept,
  busy,
}: {
  policy: StrategyPolicy;
  existing: StrategyPolicy[];
  onAccept: (items: StrategyPolicy[]) => void;
  busy: boolean;
}) {
  const [candidates, setCandidates] = useState<StrategyPolicy[]>([]);
  const [generated, setGenerated] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const result = acceptVariants(
    existing,
    candidates.filter((p) => selected.includes(p.id)),
  );
  const added = result.length - existing.length;
  return (
    <details className="policy-variants">
      <summary>派生案を試す</summary>
      <button
        disabled={busy}
        onClick={() => {
          setCandidates(alternatives(policy, existing));
          setGenerated(true);
          setSelected([]);
        }}
      >
        変更案を作る
      </button>
      {generated && candidates.length === 0 && (
        <p role="status">追加できる変更案はありません。</p>
      )}
      {candidates.length > 0 && (
        <>
          <ul>
            {candidates.map((p) => (
              <li key={p.id}>
                <label>
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={selected.includes(p.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, p.id]
                          : selected.filter((id) => id !== p.id),
                      )
                    }
                  />
                  {p.name}
                </label>
                <p>
                  {changes(policy, p)
                    .map(
                      (k) =>
                        `${fieldNames[k]}：${value(policy, k)} → ${value(p, k)}`,
                    )
                    .join("、")}
                </p>
              </li>
            ))}
          </ul>
          <button
            disabled={busy || !added}
            onClick={() => {
              onAccept(result);
              setGenerated(false);
              setCandidates([]);
              setSelected([]);
            }}
          >
            選択した案を追加（{added}件）
          </button>
          {selected.length > added && (
            <p className="muted">
              同じ内容の作戦は追加しません。保存できる作戦は100件までです。
            </p>
          )}
        </>
      )}
    </details>
  );
}
