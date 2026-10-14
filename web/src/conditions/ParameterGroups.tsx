import type { Config } from "../engine/types";
import { ValueInput } from "./ValueInput";
import { valueAt, withValue, type Parameter } from "./values";
export function ParameterGroups({
  config,
  baseline,
  parameters,
  changedOnly,
  conditionId,
  saveConfig,
  onSweep,
}: {
  config: Config;
  baseline: Config;
  parameters: Parameter[];
  changedOnly: boolean;
  conditionId: string;
  saveConfig: (config: Config) => void;
  onSweep: (p: Parameter) => void;
}) {
  function transfer(
    rows: Parameter[],
    from: number,
    to: number,
    reset = false,
  ) {
    let next = config;
    for (const p of rows)
      next = withValue(
        next,
        p,
        to,
        valueAt(reset ? baseline : config, p, reset ? to : from),
      );
    saveConfig(next);
  }
  return (
    <>
      {(["caps", "profiles"] as const).map((kind) => {
        const all = parameters.filter((p) => p.kind === kind),
          rows = all.filter(
            (p) =>
              !changedOnly ||
              [0, 1].some(
                (side) =>
                  valueAt(config, p, side) !== valueAt(baseline, p, side),
              ),
          );
        return (
          <section className="condition-group" key={kind}>
            <div className="toolbar">
              <h3>{kind === "caps" ? "能力・容量" : "速度・操作時間"}</h3>
              <details>
                <summary>まとめて操作</summary>
                <div className="condition-actions">
                  <button onClick={() => transfer(all, 0, 1)}>
                    自分から相手へコピー
                  </button>
                  <button onClick={() => transfer(all, 1, 0)}>
                    相手から自分へコピー
                  </button>
                  <button
                    onClick={() => {
                      let next = config;
                      for (const p of all)
                        for (const side of [0, 1])
                          next = withValue(
                            next,
                            p,
                            side,
                            valueAt(baseline, p, side),
                          );
                      saveConfig(next);
                    }}
                  >
                    両側を基準に戻す
                  </button>
                </div>
              </details>
            </div>
            {!rows.length ? (
              <p className="muted">変更した項目はありません。</p>
            ) : (
              <table className="condition-table">
                <thead>
                  <tr>
                    <th>項目</th>
                    <th>自分・赤</th>
                    <th>相手・青</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.key}>
                      <th scope="row">
                        {p.label}
                        {p.unit && <small>{p.unit}</small>}
                      </th>
                      {[0, 1].map((side) => {
                        const value = valueAt(config, p, side);
                        return (
                          <td key={side}>
                            {typeof value === "boolean" ? (
                              <input
                                aria-label={`${side ? "相手" : "自分"} ${p.label}`}
                                type="checkbox"
                                checked={value}
                                onChange={(e) =>
                                  saveConfig(
                                    withValue(
                                      config,
                                      p,
                                      side,
                                      e.target.checked,
                                    ),
                                  )
                                }
                              />
                            ) : (
                              <ValueInput
                                key={conditionId + p.key + side}
                                label={`${side ? "相手" : "自分"} ${p.label}`}
                                value={value}
                                min={kind === "caps" ? 0 : 0.001}
                                max={
                                  kind === "caps"
                                    ? p.key === "capacity_tr"
                                      ? 3
                                      : 2
                                    : 300
                                }
                                integer={kind === "caps"}
                                onCommit={(n) =>
                                  saveConfig(withValue(config, p, side, n))
                                }
                              />
                            )}
                          </td>
                        );
                      })}
                      <td>
                        <details>
                          <summary aria-label={`${p.label}の操作`}>
                            操作
                          </summary>
                          <div className="condition-actions">
                            <button onClick={() => transfer([p], 0, 1)}>
                              自分から相手へコピー
                            </button>
                            <button onClick={() => transfer([p], 1, 0)}>
                              相手から自分へコピー
                            </button>
                            <button onClick={() => transfer([p], 0, 0, true)}>
                              自分を基準に戻す
                            </button>
                            <button onClick={() => transfer([p], 1, 1, true)}>
                              相手を基準に戻す
                            </button>
                            <button onClick={() => onSweep(p)}>
                              この値を変えて比べる
                            </button>
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </>
  );
}
