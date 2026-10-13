import { useState } from "react";
import type { Model, Config } from "./types";
import { api, saveJSON } from "./api";
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
  const [c, setC] = useState<Config>(() => structuredClone(initial));
  const [team, setTeam] = useState(0);
  const [error, setError] = useState("");
  const change = (f: (x: Config) => void) =>
    setC((old) => {
      const next = structuredClone(old);
      f(next);
      return next;
    });
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
  const combinations = c.teams.reduce(
    (count, t) =>
      Object.values(t.caps)
        .concat(Object.values(t.speeds))
        .reduce((n, a) => n * BigInt(a.length), count),
    BigInt(c.starts.length * c.layouts.length),
  );
  return (
    <form
      className="conditions"
      onSubmit={(e) => {
        e.preventDefault();
        onCreate(c);
      }}
    >
      <div className="section-title">
        <h2>探索条件</h2>
        <button type="button" onClick={() => saveJSON(c, "conditions.json")}>
          条件を書き出す
        </button>
      </div>
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
      <table className="config-table">
        <caption>{team ? "青" : "赤"}チームの能力候補</caption>
        <thead>
          <tr>
            <th>能力・制約</th>
            <th>探索に含める値</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(model.caps).map(([k, label]) => (
            <tr key={k}>
              <th scope="row">{label}</th>
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
        <caption>数値スペック — 各項目を独立に選択</caption>
        <thead>
          <tr>
            <th>項目</th>
            {["fast", "normal", "slow"].map((n) => (
              <th key={n}>{n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(model.profiles).map(([k, label]) => (
            <tr key={k}>
              <th scope="row">{label}</th>
              {[0, 1, 2].map((i) => (
                <td key={i}>
                  <label className="profile">
                    <input
                      aria-label={
                        label + " " + ["fast", "normal", "slow"][i] + "を探索"
                      }
                      type="checkbox"
                      checked={c.teams[team].speeds[k].includes(i)}
                      onChange={() => toggle("speeds", k, i)}
                    />
                    <input
                      aria-label={
                        label + " " + ["fast", "normal", "slow"][i] + "の値"
                      }
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
          開始枠の割当
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
          Earth初期配置
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
                setC(await api<Config>("validate", parsed));
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
