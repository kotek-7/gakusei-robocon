import { profileNames } from "../common/labels";
import { useReducer, useState } from "react";
import { conditionHistory, selectProfile } from "./history";
import { countConfigs } from "../../engine/model";
import { Differences } from "./Differences";
import { SearchAxes } from "./SearchAxes";
import "./conditions.css";
import type { Model, Config } from "../../engine/types";
import { call } from "../../app/client";
import { saveJSON } from "../../app/coreCommands";

export function Conditions({
  model,
  initial,
  onCreate,
  busy,
}: {
  model: Model;
  initial: Config;
  onCreate: (c: Config) => void;
  busy: boolean;
}) {
  const [history, dispatch] = useReducer(
    conditionHistory,
    initial,
    (config) => ({
      past: [],
      present: structuredClone(config),
      future: [],
    }),
  );
  const c = history.present;
  const [team, setTeam] = useState(0);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [changedOnly, setChangedOnly] = useState(false);
  const [differentOnly, setDifferentOnly] = useState(false);
  const sameValues = (a: (number | boolean)[], b: (number | boolean)[]) =>
    a.length === b.length && a.every((value) => b.includes(value));
  const capChanged = (key: string) =>
    !sameValues(c.teams[team].caps[key], initial.teams[team].caps[key]);
  const profileChanged = (key: string) =>
    !sameValues(c.teams[team].speeds[key], initial.teams[team].speeds[key]) ||
    c.profiles[key].some((value, i) => value !== initial.profiles[key][i]);
  const matches = (key: string, label: string, changed: boolean) =>
    (!changedOnly || changed) &&
    `${key} ${label}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase());
  const caps = Object.entries(model.caps).filter(
    ([key, label]) =>
      matches(key, label, capChanged(key)) &&
      (!differentOnly ||
        !sameValues(c.teams[0].caps[key], c.teams[1].caps[key])),
  );
  const profiles = Object.entries(model.profiles).filter(
    ([key, label]) =>
      matches(key, label, profileChanged(key)) &&
      (!differentOnly ||
        !sameValues(c.teams[0].speeds[key], c.teams[1].speeds[key])),
  );
  const changedCount =
    Object.keys(model.caps).filter(capChanged).length +
    Object.keys(model.profiles).filter(profileChanged).length;
  const change = (edit: (x: Config) => void) =>
    dispatch({ type: "change", edit });
  function toggle(
    kind: "caps" | "speeds",
    key: string,
    value: boolean | number,
  ) {
    change((x) => {
      const values = x.teams[team][kind][key] as (boolean | number)[];
      const next = values.includes(value)
        ? values.filter((v) => v !== value)
        : [...values, value];
      if (next.length)
        (x.teams[team][kind] as Record<string, (boolean | number)[]>)[key] =
          next;
    });
  }
  const combinations = countConfigs(c);
  return (
    <form
      className="conditions"
      onKeyDown={(e) => {
        const target = e.target as HTMLElement;
        if (
          target.matches(
            'input:not([type="checkbox"]):not([type="radio"]), textarea, select',
          ) ||
          !(e.ctrlKey || e.metaKey)
        )
          return;
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          e.stopPropagation();
          dispatch({ type: e.shiftKey ? "redo" : "undo" });
        }
      }}
      onSubmit={(e) => {
        e.preventDefault();
        onCreate(c);
      }}
    >
      <div className="section-title">
        <h2>探索条件</h2>
        <div className="condition-history" aria-label="条件の編集履歴">
          <button
            type="button"
            disabled={!history.past.length}
            onClick={() => dispatch({ type: "undo" })}
            title="条件の編集を取り消す（Ctrl / ⌘ Z、入力欄の外）"
          >
            取り消す
          </button>
          <button
            type="button"
            disabled={!history.future.length}
            onClick={() => dispatch({ type: "redo" })}
            title="条件の編集をやり直す（Ctrl / ⌘ Shift Z、入力欄の外）"
          >
            やり直す
          </button>
        </div>
        <button type="button" onClick={() => saveJSON(c, "conditions.json")}>
          条件を書き出す
        </button>
      </div>
      <Differences initial={initial} current={c} model={model} change={change} />
      <p>
        選択した能力・数値の組合せから生成します。値は仮定で、編集できます。
      </p>
      <div className="form-row">
        <label>
          探索名
          <input
            required
            value={c.name}
            maxLength={100}
            onChange={(e) =>
              change((x) => {
                x.name = e.target.value;
              })
            }
          />
        </label>
        <label>
          初期局面
          <select
            value={c.scenario}
            onChange={(e) =>
              change((x) => {
                x.scenario = e.target.value;
                x.horizon = 180;
              })
            }
          >
            <option value="start">試合開始（0秒）</option>
            <option value="endgame">終盤の検証局面（174秒）</option>
            {c.root && <option value="custom">指定局面（{c.root.t}秒）</option>}
          </select>
        </label>
        <label>
          探索終了 秒
          <input
            type="number"
            min={
              c.scenario === "endgame"
                ? 174
                : c.scenario === "custom"
                  ? c.root?.t || 1
                  : 1
            }
            max={180}
            value={c.horizon}
            onChange={(e) =>
              change((x) => {
                x.horizon = Number(e.target.value);
              })
            }
          />
        </label>
      </div>
      {c.horizon < 180 && (
        <p className="notice">
          {c.horizon}秒での局面評価です。180秒の最終勝敗ではありません。
        </p>
      )}
      <SearchAxes config={c} model={model} change={change} />
      <div className="team-tabs" aria-label="編集するチーム">
        {["赤チーム", "青チーム"].map((name, i) => (
          <button
            type="button"
            key={i}
            aria-pressed={team === i}
            onClick={() => setTeam(i)}
          >
            {name}
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            change((x) => {
              x.teams[1 - team] = structuredClone(x.teams[team]);
            })
          }
        >
          反対側にコピー
        </button>
      </div>
      <div className="condition-filter">
        <input
          type="search"
          aria-label="能力・数値スペックを検索"
          placeholder="能力・数値スペックを検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={changedOnly}
            onChange={(e) => setChangedOnly(e.target.checked)}
          />
          変更した項目のみ ({changedCount})
        </label>
        <label>
          <input
            type="checkbox"
            checked={differentOnly}
            onChange={(e) => setDifferentOnly(e.target.checked)}
          />
          赤青で候補が異なる項目
        </label>
        {(query || changedOnly || differentOnly) && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setChangedOnly(false);
              setDifferentOnly(false);
            }}
          >
            絞り込みを解除
          </button>
        )}
      </div>
      {!caps.length && !profiles.length && (
        <p role="status">該当する項目はありません。</p>
      )}
      <table className="config-table">
        <caption>{team ? "青" : "赤"}チームの能力候補</caption>
        <thead>
          <tr>
            <th>能力・制約</th>
            <th>探索に含める値</th>
          </tr>
        </thead>
        <tbody>
          {caps.map(([k, label]) => (
            <tr key={k}>
              <th scope="row">
                <span className="condition-row-label">
                  {label}
                  {!sameValues(
                    c.teams[team].caps[k],
                    c.teams[1 - team].caps[k],
                  ) && (
                    <button
                      type="button"
                      className="condition-revert"
                      title="この項目の候補を反対側からコピー"
                      onClick={() =>
                        change((x) => {
                          x.teams[team].caps[k] = [
                            ...x.teams[1 - team].caps[k],
                          ];
                        })
                      }
                    >
                      {team ? "赤" : "青"}に揃える
                    </button>
                  )}
                  {capChanged(k) && (
                    <button
                      type="button"
                      className="condition-revert"
                      aria-label={`${label}の能力候補を編集開始時に戻す`}
                      title="この項目を編集開始時に戻す"
                      onClick={() =>
                        change((x) => {
                          x.teams[team].caps[k] = [
                            ...initial.teams[team].caps[k],
                          ];
                        })
                      }
                    >
                      戻す
                    </button>
                  )}
                </span>
              </th>
              <td>
                {(k.startsWith("capacity")
                  ? Array.from(
                      { length: k === "capacity_tr" ? 4 : 3 },
                      (_, i) => i,
                    )
                  : [false, true]
                ).map((v) => (
                  <label className="check" key={String(v)}>
                    <input
                      type="checkbox"
                      aria-label={`${label} ${typeof v === "boolean" ? (v ? "可能" : "不可") : v + "個"}`}
                      title={
                        c.teams[team].caps[k].length === 1 &&
                        c.teams[team].caps[k].includes(v)
                          ? "各項目で1つ以上の候補が必要です"
                          : undefined
                      }
                      disabled={
                        c.teams[team].caps[k].length === 1 &&
                        c.teams[team].caps[k].includes(v)
                      }
                      checked={c.teams[team].caps[k].includes(v)}
                      onChange={() => toggle("caps", k, v)}
                    />
                    {typeof v === "boolean" ? (v ? "可能" : "不可") : v + "個"}
                  </label>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="config-table">
        <caption>
          数値スペック
          <span className="condition-shared-note">
            数値は両チーム共通・候補の選択は{team ? "青" : "赤"}チーム
          </span>
        </caption>
        <thead>
          <tr>
            <th>項目</th>
            {profileNames.map((n) => (
              <th key={n}>{n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="condition-bulk-row">
            <th scope="row">
              <button
                type="button"
                onClick={() =>
                  change((x) =>
                    selectProfile(
                      x,
                      team,
                      "all",
                      profiles.map(([key]) => key),
                    ),
                  )
                }
              >
                表示項目を3段階に
              </button>
            </th>
            {profileNames.map((name, i) => (
              <td key={name}>
                <button
                  type="button"
                  title={`${team ? "青" : "赤"}チームの表示項目を${name}だけにする`}
                  onClick={() =>
                    change((x) =>
                      selectProfile(
                        x,
                        team,
                        i,
                        profiles.map(([key]) => key),
                      ),
                    )
                  }
                >
                  {name}のみ
                </button>
              </td>
            ))}
          </tr>
          {profiles.map(([k, label]) => (
            <tr key={k}>
              <th scope="row">
                <span className="condition-row-label">
                  {label}
                  {!sameValues(
                    c.teams[team].speeds[k],
                    c.teams[1 - team].speeds[k],
                  ) && (
                    <button
                      type="button"
                      className="condition-revert"
                      title="この項目の候補を反対側からコピー"
                      onClick={() =>
                        change((x) => {
                          x.teams[team].speeds[k] = [
                            ...x.teams[1 - team].speeds[k],
                          ];
                        })
                      }
                    >
                      {team ? "赤" : "青"}に揃える
                    </button>
                  )}
                  {profileChanged(k) && (
                    <button
                      type="button"
                      className="condition-revert"
                      aria-label={`${label}の数値と候補を編集開始時に戻す`}
                      title="両チーム共通の数値と、このチームの候補を編集開始時に戻す"
                      onClick={() =>
                        change((x) => {
                          x.teams[team].speeds[k] = [
                            ...initial.teams[team].speeds[k],
                          ];
                          x.profiles[k] = [...initial.profiles[k]];
                        })
                      }
                    >
                      戻す
                    </button>
                  )}
                </span>
              </th>
              {[0, 1, 2].map((i) => (
                <td key={i}>
                  <label className="profile">
                    <input
                      aria-label={label + " " + profileNames[i] + "を探索"}
                      type="checkbox"
                      title={
                        c.teams[team].speeds[k].length === 1 &&
                        c.teams[team].speeds[k].includes(i)
                          ? "各項目で1つ以上の候補が必要です"
                          : undefined
                      }
                      disabled={
                        c.teams[team].speeds[k].length === 1 &&
                        c.teams[team].speeds[k].includes(i)
                      }
                      checked={c.teams[team].speeds[k].includes(i)}
                      onChange={() => toggle("speeds", k, i)}
                    />
                    <input
                      aria-label={label + " " + profileNames[i] + "の値"}
                      type="number"
                      min={0.01}
                      max={300}
                      step="any"
                      required
                      value={c.profiles[k][i]}
                      onChange={(e) =>
                        change((x) => {
                          x.profiles[k][i] = Number(e.target.value);
                        })
                      }
                    />
                  </label>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <details>
        <summary>初期配置とルール解釈</summary>
        <p>未確定の解釈を設定します。公式裁定を意味しません。</p>
        <label>
          スタートゾーンの割当
          <select
            value={c.starts.length === 4 ? "all" : c.starts[0]}
            onChange={(e) =>
              change((x) => {
                x.starts =
                  e.target.value === "all"
                    ? [0, 1, 2, 3]
                    : [Number(e.target.value)];
              })
            }
          >
            <option value="0">両側 標準</option>
            <option value="1">赤側 入替</option>
            <option value="2">青側 入替</option>
            <option value="3">両側 入替</option>
            <option value="all">全4通り</option>
          </select>
        </label>
        <label>
          アースブロック初期配置
          <select
            value={c.layouts.length === 2 ? "both" : c.layouts[0]}
            onChange={(e) =>
              change((x) => {
                x.layouts =
                  e.target.value === "both"
                    ? ["stacked", "single"]
                    : [e.target.value];
              })
            }
          >
            <option value="stacked">2段積み</option>
            <option value="single">1段配置</option>
            <option value="both">両方</option>
          </select>
        </label>
        {Object.entries(model.rules).map(([k, r]) => (
          <label key={k}>
            {r.label}
            <small>{r.source}</small>
            <select
              value={String(c.rules[k])}
              onChange={(e) =>
                change((x) => {
                  x.rules[k] = r.options.find(
                    (o) => String(o) === e.target.value,
                  )!;
                })
              }
            >
              {r.options.map((v) => (
                <option key={String(v)} value={String(v)}>
                  {
                    (
                      {
                        true: "許可",
                        false: "不許可",
                        retain: "保持して再開",
                        return: "初期位置へ戻す",
                        branch: "両結果を分岐",
                        red: "赤優先",
                        blue: "青優先",
                        simultaneous: "同時保有",
                        historical: "保有履歴の累積",
                      } as Record<string, string>
                    )[String(v)]
                  }
                </option>
              ))}
            </select>
          </label>
        ))}
      </details>
      <div className="form-row">
        <label>
          初期局面JSONを読み込む
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              try {
                const f = e.target.files?.[0];
                if (!f) return;
                const root = JSON.parse(await f.text());
                if (
                  !Array.isArray(root.robots) ||
                  !Array.isArray(root.objects) ||
                  typeof root.t !== "number"
                )
                  throw Error("局面JSONではありません");
                change((x) => {
                  x.root = root;
                  x.scenario = "custom";
                  x.horizon = 180;
                });
                setError("");
              } catch (e) {
                setError(String(e));
              }
            }}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          条件JSONを読み込む
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              try {
                const file = e.target.files?.[0];
                if (!file) return;
                const parsed = JSON.parse(await file.text());
                if (
                  parsed.version !== model.version ||
                  !parsed.teams ||
                  !parsed.rules
                )
                  throw Error("このモデルの条件JSONではありません");
                dispatch({
                  type: "replace",
                  config: await call("config.validate", { config: parsed }),
                });
                setError("");
              } catch (e) {
                setError(String(e));
              }
            }}
          />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <footer className="condition-footer">
        <span>
          構成の組合せ <strong>{combinations.toLocaleString()}</strong>
        </span>
        <button className="primary" disabled={busy}>
          この条件で探索を作成
        </button>
      </footer>
    </form>
  );
}
