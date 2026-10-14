import { Help } from "../common/Help";
import type { Config, Model } from "../../engine/types";
import { countConfigs, dimensions } from "../../engine/model";
import { profileNames } from "../common/labels";

export function SearchAxes({
  config,
  model,
  change,
}: {
  config: Config;
  model: Model;
  change: (edit: (config: Config) => void) => void;
}) {
  const axes = dimensions(config).filter(([, , , values]) => values.length > 1);
  const count = countConfigs(config);
  return (
    <section className="condition-axes">
      <h3>
        構成の組合せ {count.toLocaleString()} · 複数候補の項目 {axes.length}
      <Help topic="conditions" text="各項目の候補数を掛け合わせた構成数です。試合展開や計算時間の見積りではありません。" /></h3>
      {!axes.length ? (
        <p>すべての項目が1つの値に固定されています。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>対象・項目</th>
              <th>候補数</th>
              <th>1候補に固定した構成数</th>
              <th>固定する値</th>
            </tr>
          </thead>
          <tbody>
            {axes.map(([team, kind, key, values]) => (
              <tr key={`${team}-${kind}-${key}`}>
                <th scope="row">
                  {team < 0 ? "共通" : team ? "青" : "赤"} ·{" "}
                  {kind === "caps"
                    ? model.caps[key]
                    : kind === "speeds"
                      ? model.profiles[key]
                      : key === "start"
                        ? "スタートゾーン"
                        : "アース初期配置"}
                </th>
                <td>{values.length}</td>
                <td>{(count / BigInt(values.length)).toLocaleString()}</td>
                <td className="condition-axis-values">
                  {values.map((value) => (
                    <button
                      type="button"
                      key={String(value)}
                      onClick={() =>
                        change((next) => {
                          if (team < 0) {
                            if (key === "start") next.starts = [Number(value)];
                            else next.layouts = [String(value)];
                          } else if (kind === "caps")
                            next.teams[team].caps[key] = [
                              value as boolean | number,
                            ];
                          else next.teams[team].speeds[key] = [Number(value)];
                        })
                      }
                    >
                      {kind === "speeds"
                        ? profileNames[Number(value)]
                        : typeof value === "boolean"
                          ? value
                            ? "可能"
                            : "不可"
                          : key === "layout"
                            ? value === "stacked"
                              ? "2段積み"
                              : "1段配置"
                            : key === "start"
                              ? [
                                  "両側 標準",
                                  "赤側 入替",
                                  "青側 入替",
                                  "両側 入替",
                                ][Number(value)]
                              : `${value}個`}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
