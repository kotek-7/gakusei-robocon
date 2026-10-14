import { MODEL } from "../engine/model";
import type { StrategyPolicy } from "../engine/types";
import { requirements, spotNames, type Study } from "./state";
export function StrategyEditor({
  study,
  policy,
  busy,
  edit,
  update,
  setSelected,
}: {
  study: Study;
  policy: StrategyPolicy;
  busy: boolean;
  edit: (p: Partial<StrategyPolicy>) => void;
  update: (s: Study) => void;
  setSelected: (id: string) => void;
}) {
  return (
    <>
      <h3>{policy.name}</h3>
      <p className="muted">
        必要な機能：
        {requirements(policy)
          .map(
            (k) =>
              `${MODEL.caps[k]}${study.config.teams[0].caps[k][0] ? "" : "（未設定）"}`,
          )
          .join("、")}
        。移動には対象階層への経路も必要です。
      </p>
      <fieldset disabled={busy}>
        <label className="field">
          作戦名
          <input
            maxLength={80}
            value={policy.name}
            onChange={(e) => edit({ name: e.target.value })}
          />
        </label>
        <h4>建設する順序</h4>
        <ol className="targets">
          {policy.targets.map((spot, i) => (
            <li key={`${spot}-${i}`}>
              <span>{spotNames[spot]}</span>
              <button
                aria-label={`${spotNames[spot]}を前へ`}
                disabled={!i}
                onClick={() => {
                  const targets = [...policy.targets];
                  [targets[i - 1], targets[i]] = [targets[i], targets[i - 1]];
                  edit({ targets });
                }}
              >
                ↑
              </button>
              <button
                aria-label={`${spotNames[spot]}を削除`}
                onClick={() =>
                  edit({
                    targets: policy.targets.filter((_, j) => i !== j),
                  })
                }
              >
                削除
              </button>
            </li>
          ))}
        </ol>
        <select
          aria-label="建設目標を追加"
          value=""
          onChange={(e) =>
            edit({
              targets: [...policy.targets, Number(e.target.value)],
            })
          }
        >
          <option value="">建設目標を追加</option>
          {Object.entries(spotNames)
            .filter(([i]) => !policy.targets.includes(Number(i)))
            .map(([i, name]) => (
              <option key={i} value={i}>
                {name}
              </option>
            ))}
        </select>
        <label className="field">
          各塔の目標
          <select
            value={policy.height}
            onChange={(e) => edit({ height: Number(e.target.value) })}
          >
            <option value="1">アース1段</option>
            <option value="2">アース2段</option>
            <option value="3">スカイまで完成</option>
          </select>
        </label>
        <h4>状況に応じた切替</h4>
        {(
          [
            ["mustika", "取得権と残り時間があればムスティカへ"],
            ["opportunistic", "空荷のBRで相手の完成塔を反転"],
            ["lateFlip", "残り30秒で相手塔の反転を優先"],
          ] as const
        ).map(([key, label]) => (
          <label className="field" key={key}>
            {label}
            <input
              type="checkbox"
              checked={policy[key]}
              onChange={(e) => edit({ [key]: e.target.checked })}
            />
          </label>
        ))}
        <label className="field">
          建設前に確保するスカイ
          <input
            type="number"
            min="0"
            max="12"
            value={policy.skyFirst}
            onChange={(e) =>
              edit({
                skyFirst: Math.max(
                  0,
                  Math.min(12, Math.floor(Number(e.target.value))),
                ),
              })
            }
          />
        </label>
        <p>
          判断の優先順：ムスティカ → 反転 → スカイ確保 → 建設 →
          搬送。目標を達成した場合や資材が不足する場合は次の目標へ進みます。
        </p>
        <button
          disabled={study.policies.length === 1}
          onClick={() => {
            const policies = study.policies.filter((p) => p.id !== policy.id);
            update({ ...study, policies });
            setSelected(policies[0].id);
          }}
        >
          この作戦を削除
        </button>
      </fieldset>
    </>
  );
}
