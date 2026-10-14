import { useState } from "react";
import { MODEL } from "../engine/model";
import type { Config } from "../engine/types";
import { activeCondition, type Study, validateStudyConfig } from "./state";
import { type Parameter } from "../conditions/values";
import { ParameterGroups } from "../conditions/ParameterGroups";
import { Sweep } from "../conditions/Sweep";
import "../conditions/conditions.css";
const parameters: Parameter[] = [
  ...Object.entries(MODEL.caps)
    .filter(([key]) => !["direct", "reposition"].includes(key))
    .map(([key, label]) => ({
      kind: "caps" as const,
      key,
      label,
      unit: key.startsWith("capacity") ? "個" : "",
    })),
  ...Object.entries(MODEL.profiles).map(([key, label]) => ({
    kind: "profiles" as const,
    key,
    label: label.replace(/ (m\/s|秒)$/, ""),
    unit: key === "move" ? "m/s" : "秒",
  })),
];
const ruleLabel = (value: string | boolean) =>
  ({
    true: "あり",
    false: "なし",
    retain: "保持",
    return: "戻す",
    simultaneous: "同時に所有",
    historical: "過去の完成を含む",
  })[String(value)] || String(value);
export function Conditions({
  study,
  busy,
  update,
  onSweep,
}: {
  study: Study;
  busy: boolean;
  update: (s: Study) => void;
  onSweep: (cases: { name: string; config: Config }[]) => void;
}) {
  const current = activeCondition(study),
    config = current.config;
  const baseline = study.baselineConfig;
  const [changedOnly, setChangedOnly] = useState(false);
  const [sweep, setSweep] = useState<Parameter | null>(null);
  const [error, setError] = useState("");
  function saveConfig(next: Config) {
    try {
      validateStudyConfig(next);
      update({
        ...study,
        conditions: study.conditions.map((c) =>
          c.id === current.id ? { ...c, config: next } : c,
        ),
      });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  function patch(patch: Partial<typeof current>) {
    update({
      ...study,
      conditions: study.conditions.map((c) =>
        c.id === current.id ? { ...c, ...patch } : c,
      ),
    });
  }
  return (
    <section className="conditions-editor">
      <h2>機体条件</h2>
      <p className="muted">
        操作時間は実測に合わせて編集できます。各チームのTR・BRに共通の時間を適用します。
      </p>
      <fieldset disabled={busy}>
        <div className="toolbar condition-selector">
          <label>
            条件{" "}
            <select
              value={current.id}
              onChange={(e) => {
                update({ ...study, activeConditionId: e.target.value });
                setSweep(null);
              }}
            >
              {study.conditions.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                  {c.id === study.baselineConditionId ? "（基準）" : ""}
                </option>
              ))}
            </select>
          </label>
          <details>
            <summary>条件の操作</summary>
            <div className="condition-actions">
              <label>
                名前{" "}
                <input
                  key={current.id + current.name}
                  defaultValue={current.name}
                  maxLength={100}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== current.name) patch({ name });
                    else e.target.value = current.name;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
              </label>
              <button
                onClick={() => {
                  const copy = {
                    ...structuredClone(current),
                    id: crypto.randomUUID(),
                    name: `${current.name} のコピー`,
                  };
                  update({
                    ...study,
                    conditions: [...study.conditions, copy],
                    activeConditionId: copy.id,
                  });
                }}
              >
                複製
              </button>
              <button
                disabled={
                  current.id === study.baselineConditionId &&
                  JSON.stringify(current.config) === JSON.stringify(baseline)
                }
                onClick={() =>
                  update({
                    ...study,
                    baselineConditionId: current.id,
                    baselineConfig: structuredClone(current.config),
                  })
                }
              >
                基準にする
              </button>
              <button
                disabled={study.conditions.length === 1}
                onClick={() => {
                  const conditions = study.conditions.filter(
                    (c) => c.id !== current.id,
                  );
                  update({
                    ...study,
                    conditions,
                    activeConditionId: conditions[0].id,
                    baselineConfig:
                      study.baselineConditionId === current.id
                        ? structuredClone(conditions[0].config)
                        : study.baselineConfig,
                    baselineConditionId:
                      study.baselineConditionId === current.id
                        ? conditions[0].id
                        : study.baselineConditionId,
                  });
                }}
              >
                削除
              </button>
            </div>
          </details>
          <label>
            <input
              type="checkbox"
              checked={changedOnly}
              onChange={(e) => setChangedOnly(e.target.checked)}
            />{" "}
            基準からの変更だけ
          </label>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <ParameterGroups
          config={config}
          baseline={baseline}
          parameters={parameters}
          changedOnly={changedOnly}
          conditionId={current.id}
          saveConfig={saveConfig}
          onSweep={setSweep}
        />
        {sweep && (
          <Sweep
            key={current.id + sweep.key}
            config={config}
            parameter={sweep}
            onClose={() => setSweep(null)}
            onRun={(cases) => {
              onSweep(cases);
              setSweep(null);
            }}
          />
        )}
        <details>
          <summary>ルール解釈</summary>
          <p className="muted">
            出典：ABUロボコン2027 Rulebook v1.1。各項目に節番号を示します。
          </p>
          {Object.entries(MODEL.rules)
            .filter(([key]) => key !== "conflict")
            .map(([key, rule]) => (
              <label className="field" key={key}>
                <span>
                  {rule.label}
                  <small>{rule.source}</small>
                </span>
                <select
                  value={String(config.rules[key])}
                  onChange={(e) => {
                    const next = structuredClone(config);
                    next.rules[key] = rule.options.find(
                      (v) => String(v) === e.target.value,
                    )!;
                    saveConfig(next);
                  }}
                >
                  {rule.options.map((v) => (
                    <option key={String(v)} value={String(v)}>
                      {ruleLabel(v)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
        </details>
        <details>
          <summary>条件のメモ</summary>
          <textarea
            key={current.id + current.notes}
            aria-label="条件のメモ"
            defaultValue={current.notes}
            onBlur={(e) => {
              if (e.target.value !== current.notes)
                patch({ notes: e.target.value });
            }}
          />
        </details>
      </fieldset>
    </section>
  );
}
