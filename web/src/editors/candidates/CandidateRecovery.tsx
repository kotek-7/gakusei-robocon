import { useState } from "react";
import type { CandidateCollectionRow, QueryField } from "./collection";
import { recoveryEntries } from "./recovery";
import "./recovery.css";

export function CandidateRecovery({rows, visibleKeys, shortlist, onReveal}: {
  rows: CandidateCollectionRow[]; visibleKeys: string[]; shortlist: string[];
  onReveal: (key: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const hidden = recoveryEntries(rows, visibleKeys, shortlist);
  if (!hidden.length) return null;
  const selectedKey = hidden.some(entry => entry.key === selected)
    ? selected : hidden[0].key;
  return <div className="candidate-recovery">
    <label>一覧外の比較 {hidden.length}件
      <select value={selectedKey} onChange={event => setSelected(event.target.value)}>
        {hidden.map(({key, row}) => <option key={key} value={key}>
          C{row.run} · {row.candidate.id}
        </option>)}
      </select>
    </label>
    <button type="button" onClick={() => onReveal(selectedKey)}>候補を表示</button>
  </div>;
}

const fieldLabels: Record<QueryField,string> = {id:"ID", plan:"手順", issue:"実行不可の理由"};
export function CandidateQueryMatch({fields}: {fields: QueryField[]}) {
  const labels = fields.map(field => fieldLabels[field]).filter(Boolean);
  if (!labels.length) return null;
  return <small className="candidate-query-match">一致：{labels.join("・")}</small>;
}
