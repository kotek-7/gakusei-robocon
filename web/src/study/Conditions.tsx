import { MODEL } from "../engine/model";
import type { Study } from "./state";
export function Conditions({
  study,
  busy,
  update,
}: {
  study: Study;
  busy: boolean;
  update: (s: Study) => void;
}) {
  return (
    <section>
      <h2>同じ機体条件で比較する</h2>
      <p>
        操作時間は設計時の仮定です。実測に合わせて値を編集してください。各チームのTR・BRには共通の時間を適用します。
      </p>
      <fieldset disabled={busy}>
        <div className="two-column">
          {study.config.teams.map((team, t) => (
            <section key={t}>
              <h3>{t ? "相手・青" : "自分・赤"}の機体</h3>
              {Object.entries(MODEL.caps)
                .filter(([key]) => !["direct", "reposition"].includes(key))
                .map(([key, label]) => (
                  <label className="field" key={key}>
                    {label}
                    {typeof team.caps[key][0] === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={Boolean(team.caps[key][0])}
                        onChange={(e) => {
                          const next = structuredClone(study);
                          next.config.teams[t].caps[key] = [e.target.checked];
                          update(next);
                        }}
                      />
                    ) : (
                      <input
                        type="number"
                        min="0"
                        max={key === "capacity_tr" ? 3 : 2}
                        value={Number(team.caps[key][0])}
                        onChange={(e) => {
                          const next = structuredClone(study);
                          next.config.teams[t].caps[key] = [
                            Math.max(
                              0,
                              Math.min(
                                key === "capacity_tr" ? 3 : 2,
                                Math.floor(Number(e.target.value)),
                              ),
                            ),
                          ];
                          update(next);
                        }}
                      />
                    )}
                  </label>
                ))}
              {Object.entries(MODEL.profiles).map(([key, label]) => (
                <label className="field" key={key}>
                  {label}
                  <select
                    value={team.speeds[key][0]}
                    onChange={(e) => {
                      const next = structuredClone(study);
                      next.config.teams[t].speeds[key] = [
                        Number(e.target.value),
                      ];
                      update(next);
                    }}
                  >
                    {study.config.profiles[key].map((v, i) => (
                      <option key={i} value={i}>
                        {v} {key === "move" ? "m/s" : "秒"}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </section>
          ))}
        </div>
        <h3>操作時間の候補</h3>
        {Object.entries(study.config.profiles).map(([key, values]) => (
          <label className="field" key={key}>
            {MODEL.profiles[key]}
            <span className="toolbar">
              {values.map((v, i) => (
                <input
                  key={i}
                  aria-label={`${MODEL.profiles[key]} 候補${i + 1}`}
                  type="number"
                  min="0.1"
                  max="60"
                  step="0.1"
                  value={v}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (n <= 0 || n > 60) return;
                    const next = structuredClone(study);
                    next.config.profiles[key][i] = n;
                    update(next);
                  }}
                />
              ))}
            </span>
          </label>
        ))}
        <details>
          <summary>ルール解釈</summary>
          {Object.entries(MODEL.rules)
            .filter(([k]) => k !== "conflict")
            .map(([key, rule]) => (
              <label className="field" key={key}>
                {rule.label}
                <select
                  value={String(study.config.rules[key])}
                  onChange={(e) => {
                    const next = structuredClone(study);
                    next.config.rules[key] = rule.options.find(
                      (x) => String(x) === e.target.value,
                    )!;
                    update(next);
                  }}
                >
                  {rule.options.map((v) => (
                    <option key={String(v)} value={String(v)}>
                      {String(v) === "true"
                        ? "あり"
                        : String(v) === "false"
                          ? "なし"
                          : (
                              {
                                retain: "保持",
                                return: "戻す",
                                simultaneous: "同時に所有",
                                historical: "過去の完成を含む",
                              } as Record<string, string>
                            )[String(v)] || String(v)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
        </details>
      </fieldset>
    </section>
  );
}
