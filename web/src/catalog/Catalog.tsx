import {
  Fragment,
  memo,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type Ref,
} from "react";
import type { Plan, Run } from "../simulation/types";
import {
  candidates,
  canonicalPlans,
  encode,
  initialHardware,
  type Classification,
  type Dimension,
} from "./navigation";
import { defaultEstimates } from "./effort";
import { createCatalogWorker, loadEstimates, saveEstimates } from "./browser";
import { useCalculation } from "./useCalculation";
import { label } from "./labels";
import { CatalogTree } from "./CatalogTree";
import { Filters } from "./Filters";
import { Outlook } from "./Outlook";
import { PlanDetail } from "./PlanDetail";
import { StrategyList } from "./StrategyList";
const plans = canonicalPlans();
export interface CatalogHandle {
  exportAnalysis(): object;
}
export const Catalog = memo(function Catalog({
  run,
  expanded,
  onExpanded,
  onSelect,
  ref,
}: {
  run: Run;
  expanded: boolean;
  onExpanded(value: boolean): void;
  onSelect(plan: Plan): void;
  ref: Ref<CatalogHandle>;
}) {
  const [classification, setClassification] = useState<Classification>({});
  const [hardware, setHardware] = useState(initialHardware);
  const [estimates, setEstimates] = useState(() => {
    try {
      return loadEstimates(localStorage);
    } catch {
      return defaultEstimates();
    }
  });
  const [budget, setBudget] = useState(""),
    [selectedId, setSelectedId] = useState<number | null>(null);
  const [openGroups, setOpenGroups] = useState(
    new Set(["mission=no", "mission=yes"]),
  );
  const catalog = useCalculation(createCatalogWorker),
    responses = useCalculation(createCatalogWorker);
  const rows = useMemo(
    () => candidates(plans, classification, hardware, estimates, budget),
    [classification, hardware, estimates, budget],
  );
  const selected = rows.find((p) => p.id === selectedId);
  // Explicit dependencies: classification and effort filters reuse scores, hardware and match conditions do not.
  const input = useMemo(
    () => ({
      type: "catalog" as const,
      plans: candidates(plans, {}, hardware, defaultEstimates()),
      enemy: run.enemy,
      cfg: run.cfg,
    }),
    [
      hardware,
      run.enemy,
      run.cfg.speed,
      run.cfg.handling,
      run.cfg.success,
      run.cfg.seed,
      run.cfg.priority,
    ],
  );
  useEffect(() => {
    if (!expanded) return;
    catalog.calculation.start(input);
    return () => catalog.calculation.reset();
  }, [input, expanded, catalog.calculation]);
  useEffect(() => {
    responses.calculation.reset();
  }, [selected?.id, input, responses.calculation]);
  useEffect(() => {
    if (selectedId !== null && !selected) setSelectedId(null);
  }, [selectedId, selected]);
  useImperativeHandle(ref, () => ({
    exportAnalysis: () => ({
      classification,
      hardware,
      estimates,
      budget,
      remaining: rows.map((p) => p.id),
      results: [...catalog.state.results],
      responses: responses.state.matches,
    }),
  }));
  function changeHardware(value: typeof hardware) {
    setHardware(value);
    setSelectedId(null);
  }
  return (
    <aside className="catalog">
      <div className="catalog-heading">
        <h1>{expanded ? "作戦の分析" : "作戦一覧"}</h1>
        <button
          id="catalog-toggle"
          aria-expanded={expanded}
          onClick={() => onExpanded(!expanded)}
        >
          {expanded ? "一覧と3Dに戻る" : "条件・分析"}
        </button>
      </div>
      {!expanded && <StrategyList plans={candidates(plans, {}, hardware, estimates)} current={run.plan} onSelect={onSelect} />}
      <div className="catalog-workspace">
        <Filters
          hardware={hardware}
          estimates={estimates}
          budget={budget}
          onHardware={changeHardware}
          onBudget={setBudget}
          onEstimate={(id, value) => {
            const next = { ...estimates, [id]: value };
            setEstimates(next);
            try {
              saveEstimates(localStorage, next);
            } catch {}
          }}
        />
        <section id="selection-area" aria-label="階層カタログ">
          <div className="catalog-breadcrumb">
            <button data-scope="" onClick={() => setClassification({})}>
              すべての作戦
            </button>
            {Object.entries(classification).map(([id, v], i) => (
              <Fragment key={id}>
                <span>›</span>
                <button
                  data-scope={encode(
                    Object.fromEntries(
                      Object.entries(classification).slice(0, i + 1),
                    ),
                  )}
                  onClick={() =>
                    setClassification(
                      Object.fromEntries(
                        Object.entries(classification).slice(0, i + 1),
                      ),
                    )
                  }
                >
                  {label(id as Dimension, v!)}
                </button>
              </Fragment>
            ))}
          </div>
          <div className="catalog-intro">
            <h2>{rows.length}作戦</h2>
            <p>
              分類を開いて閲覧できます。「この分類に絞る」で表示範囲とグラフを絞り込みます。
            </p>
          </div>
          <div id="catalog-tree">
            {rows.length ? (
              <CatalogTree
                rows={rows}
                classification={classification}
                estimates={estimates}
                results={catalog.state.results}
                openGroups={openGroups}
                onToggle={(key, open) =>
                  setOpenGroups((previous) => {
                    if (previous.has(key) === open) return previous;
                    const next = new Set(previous);
                    if (open) next.add(key);
                    else next.delete(key);
                    return next;
                  })
                }
                onScope={setClassification}
                onSelect={(p) => setSelectedId(p.id)}
              />
            ) : (
              <p className="empty">
                この分類と工数・機体条件に合う作戦がありません。分類を戻すか、左の条件を変更してください。
              </p>
            )}
          </div>
          {selected && (
            <PlanDetail
              plan={selected}
              hardware={hardware}
              estimates={estimates}
              calculation={responses.state}
              onClose={() => setSelectedId(null)}
              onPlay={() => {
                onSelect(selected);
                onExpanded(false);
              }}
              onCalculate={() => {
                if (responses.state.status === "running")
                  responses.calculation.stop();
                else
                  responses.calculation.start({
                    type: "responses",
                    plan: selected,
                    cfg: run.cfg,
                  });
              }}
            />
          )}
        </section>
        <Outlook
          rows={rows}
          estimates={estimates}
          calculation={catalog.state}
          enemy={run.enemy}
          onCalculate={() => {
            if (catalog.state.status === "running") catalog.calculation.stop();
            else catalog.calculation.start(input);
          }}
        />
      </div>
    </aside>
  );
});
