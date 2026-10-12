import { capabilities, type Estimates } from "./effort";
import type { Hardware } from "./navigation";
interface Props {
  hardware: Hardware;
  estimates: Estimates;
  budget: string;
  onHardware(h: Hardware): void;
  onBudget(b: string): void;
  onEstimate(id: string, value: number): void;
}
export function Filters({
  hardware,
  estimates,
  budget,
  onHardware,
  onBudget,
  onEstimate,
}: Props) {
  return (
    <nav id="decision-path" aria-label="分類と工数の絞り込み">
      <h2>絞り込み</h2>
      <label className="budget-label">
        開発工数の上限
        <span>
          <input
            id="budget"
            type="number"
            min="0"
            max="9999"
            step="0.5"
            value={budget}
            placeholder="指定なし"
            onChange={(e) => {
              if (e.currentTarget.checkValidity())
                onBudget(e.currentTarget.value);
            }}
          />{" "}
          人日
        </span>
      </label>
      <button
        id="clear-budget"
        className="text-button"
        onClick={() => onBudget("")}
      >
        上限を外す
      </button>
      <label>
        BRの活動範囲
        <select
          id="activity"
          value={hardware.level}
          onChange={(e) =>
            onHardware({
              ...hardware,
              level: e.target.value as Hardware["level"],
            })
          }
        >
          <option value="upper">L2まで対応</option>
          <option value="lower">L1のみ</option>
        </select>
      </label>
      <p className="small-note">建設の代替先・反転先にも適用。</p>
      <fieldset>
        <legend>L1への登り方</legend>
        <div className="route-inputs">
          {(["BR", "TR"] as const).map((role) => (
            <label key={role}>
              {role}
              <select
                id={`access-${role}`}
                value={hardware[role]}
                onChange={(e) =>
                  onHardware({ ...hardware, [role]: e.target.value })
                }
              >
                <option value="stairs">階段</option>
                <option value="ramp">スロープ</option>
              </select>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="route-note">
        {hardware.BR === "ramp"
          ? "BRのスロープ利用はルール4.3.2との整合確認が必要な仮説です。"
          : "L2への移動は階段です。"}
      </p>
      <details className="effort-settings">
        <summary>技術ごとの工数を編集</summary>
        <p>設計・製作・調整の仮見積もり。共通技術は1回だけ加算。</p>
        {capabilities.map((c) => (
          <label key={c.id}>
            {c.name}
            <span>
              <input
                data-estimate={c.id}
                type="number"
                min="0"
                max="999"
                step="0.5"
                value={estimates[c.id]}
                aria-label={`${c.name}の人日`}
                onChange={(e) => {
                  if (e.target.value && e.target.checkValidity())
                    onEstimate(c.id, Number(e.target.value));
                }}
              />{" "}
              人日
            </span>
          </label>
        ))}
      </details>
    </nav>
  );
}
