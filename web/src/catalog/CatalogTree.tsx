import {
  dimensions,
  encode,
  groupBy,
  scoreRange,
  type CanonicalPlan,
  type Classification,
} from "./navigation";
import { effort, type Estimates } from "./effort";
import type { CatalogResult } from "./protocol";
import { label, span } from "./labels";
interface Props {
  rows: CanonicalPlan[];
  classification: Classification;
  estimates: Estimates;
  results: Map<number, CatalogResult>;
  openGroups: Set<string>;
  onToggle(key: string, open: boolean): void;
  onScope(path: Classification): void;
  onSelect(plan: CanonicalPlan): void;
  depth?: number;
  path?: Classification;
}
function Score({
  rows,
  results,
}: {
  rows: CanonicalPlan[];
  results: Map<number, CatalogResult>;
}) {
  const range = scoreRange(rows, results),
    n = rows.filter((p) => results.has(p.id)).length;
  return (
    <>
      {range
        ? `${span(range)}点${n < rows.length ? ` (${n}/${rows.length}計算済)` : ""}`
        : "得点未計算"}
    </>
  );
}
export function CatalogTree({ depth = 0, path = {}, ...props }: Props) {
  const {
    rows,
    classification,
    estimates,
    results,
    openGroups,
    onToggle,
    onScope,
    onSelect,
  } = props;
  if (depth === dimensions.length)
    return (
      <>
        {rows.map((p) => (
          <div className="catalog-leaf" key={p.id}>
            <button data-plan={p.id} onClick={() => onSelect(p)}>
              #{p.id} {label("supply", p.supply)}
            </button>
            <span>
              <Score rows={[p]} results={results} />
            </span>
          </div>
        ))}
      </>
    );
  const dim = dimensions[depth];
  return (
    <>
      {groupBy(rows, dim.id).map(([v, items]) => {
        const next = { ...path, [dim.id]: v },
          key = encode(next),
          child = (
            <CatalogTree
              {...props}
              rows={items}
              depth={depth + 1}
              path={next}
            />
          );
        if (classification[dim.id] || dim.id === "supply")
          return (
            <div className="catalog-level" key={key}>
              {child}
            </div>
          );
        const days = items.map((p) => effort(p, estimates));
        return (
          <details
            className="catalog-group"
            data-group={key}
            key={key}
            open={openGroups.has(key)}
            onToggle={(e) => onToggle(key, e.currentTarget.open)}
          >
            <summary>
              <strong>{label(dim.id, v)}</strong>
              <span className="group-stats">
                {items.length}作戦 ·{" "}
                {span([Math.min(...days), Math.max(...days)])}人日
                <small>
                  <Score rows={items} results={results} />
                </small>
              </span>
            </summary>
            <div className="group-contents">
              <div className="group-tools">
                <span>{dim.label}</span>
                <button data-scope={key} onClick={() => onScope(next)}>
                  この分類に絞る
                </button>
              </div>
              {child}
            </div>
          </details>
        );
      })}
    </>
  );
}
