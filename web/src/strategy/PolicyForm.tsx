import { useState } from "react";
import type { StrategyPolicy, Config } from "../engine/types";
import { MODEL } from "../engine/model";
import { requirements, spotNames } from "../study/state";
import { CommitInput } from "./CommitInput";
import { moveTarget, fieldNames, type PolicyField } from "./operations";
export function PolicyForm({
  policy,
  config,
  team,
  busy,
  onChange,
}: {
  policy: StrategyPolicy;
  config: Config;
  team: number;
  busy: boolean;
  onChange: (p: StrategyPolicy) => void;
}) {
  const [baseline, setBaseline] = useState(() => structuredClone(policy));
  const patch = (p: Partial<StrategyPolicy>) => onChange({ ...policy, ...p });
  const restore = (key: PolicyField) => (
    <button
      type="button"
      disabled={JSON.stringify(policy[key]) === JSON.stringify(baseline[key])}
      onClick={() => patch({ [key]: structuredClone(baseline[key]) })}
      aria-label={`${fieldNames[key]}を基準に戻す`}
    >
      戻す
    </button>
  );
  const missing = requirements(policy).filter(
    (k) => !config.teams[team].caps[k]?.[0],
  );
  return (
    <fieldset disabled={busy} className="policy-form">
      <label className="field">
        作戦名
        <CommitInput
          value={policy.name}
          label="作戦名"
          onCommit={(name) => patch({ name })}
        />
      </label>
      <details className="policy-reference">
        <summary>復元の基準</summary>
        <p>この作戦を開いたときの設定に戻せます。</p>
        <button onClick={() => setBaseline(structuredClone(policy))}>
          現在の設定を基準にする
        </button>
      </details>
      {missing.length > 0 && (
        <p className="policy-warning" role="status">
          選択中の機体条件で不足：
          {missing.map((k) => MODEL.caps[k] || k).join("、")}
        </p>
      )}
      <div className="policy-section-heading">
        <h4>建設する順序</h4>
        {restore("targets")}
      </div>
      {policy.targets.length === 0 && (
        <p className="muted">建設目標はありません。資材を搬送します。</p>
      )}
      <ol className="policy-targets">
        {policy.targets.map((spot, i) => (
          <li key={spot}>
            <span>
              {spotNames[spot]}
              {spot >= 6 && missing.includes("stairs2") && (
                <small className="policy-inline-warning">
                  　2段目への昇降が未設定
                </small>
              )}
            </span>
            <details>
              <summary aria-label={`${spotNames[spot]}の操作`}>操作</summary>
              <div className="policy-actions">
                {[
                  ["先頭へ", 0],
                  ["上へ", i - 1],
                  ["下へ", i + 1],
                  ["末尾へ", policy.targets.length - 1],
                ].map(([label, index]) => (
                  <button
                    key={label}
                    disabled={
                      index === i ||
                      Number(index) < 0 ||
                      Number(index) >= policy.targets.length
                    }
                    onClick={() =>
                      patch({
                        targets: moveTarget(policy.targets, i, Number(index)),
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() =>
                    patch({ targets: policy.targets.filter((t) => t !== spot) })
                  }
                >
                  削除
                </button>
              </div>
            </details>
          </li>
        ))}
      </ol>
      <select
        aria-label="建設目標を追加"
        value=""
        onChange={(e) =>
          patch({ targets: [...policy.targets, Number(e.target.value)] })
        }
      >
        <option value="">建設目標を追加</option>
        {Object.entries(spotNames)
          .filter(([id]) => !policy.targets.includes(Number(id)))
          .map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
      </select>
      <div className="policy-field">
        <label className="field">
          各塔の目標
          <select
            value={policy.height}
            onChange={(e) => patch({ height: Number(e.target.value) })}
          >
            <option value={1}>アース1段</option>
            <option value={2}>アース2段</option>
            <option value={3}>スカイまで完成</option>
          </select>
        </label>
        {restore("height")}
      </div>
      <h4>状況に応じた切替</h4>
      {(
        [
          ["mustika", "取得権と残り時間があればムスティカへ"],
          ["opportunistic", "空荷のBRで相手の完成塔を反転"],
          ["lateFlip", "残り30秒で相手塔の反転を優先"],
        ] as const
      ).map(([key, label]) => (
        <div className="policy-field" key={key}>
          <label className="field">
            {label}
            <input
              type="checkbox"
              checked={policy[key]}
              onChange={(e) => patch({ [key]: e.target.checked })}
            />
          </label>
          {restore(key)}
        </div>
      ))}
      <div className="policy-field">
        <label className="field">
          建設前に確保するスカイ
          <CommitInput
            numeric
            label="建設前に確保するスカイ"
            value={policy.skyFirst}
            onCommit={(v) => patch({ skyFirst: Number(v) })}
          />
        </label>
        {restore("skyFirst")}
      </div>
      <details>
        <summary>判断の順序と必要な機能</summary>
        <p>
          ムスティカ、反転、スカイ確保、建設、搬送の順に判断します。目標を達成した場合や資材が不足する場合は次へ進みます。
        </p>
        <p>
          必要な機能：
          {requirements(policy)
            .map((k) => MODEL.caps[k] || k)
            .join("、")}
          。移動には対象階層への経路も必要です。
        </p>
      </details>
    </fieldset>
  );
}
