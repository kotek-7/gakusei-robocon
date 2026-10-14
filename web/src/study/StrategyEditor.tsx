import { useState } from "react";
import type { StrategyPolicy } from "../engine/types";
import { activeConfig, type Study } from "./state";
import { PolicyForm } from "../strategy/PolicyForm";
import { Variants } from "../strategy/Variants";
import { copyPolicy } from "../strategy/operations";
import "../strategy/strategy.css";
export function StrategyEditor({
  study,
  busy,
  update,
  selected,
  onSelect,
}: {
  study: Study;
  busy: boolean;
  update: (s: Study) => void;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [side, setSide] = useState<"policies" | "opponents">("policies");
  const [opponent, setOpponent] = useState(study.opponents[0].id);
  const [search, setSearch] = useState("");
  const [feature, setFeature] = useState("all");
  const [notice, setNotice] = useState("");
  const list = study[side];
  const policy =
    list.find((p) => p.id === (side === "policies" ? selected : opponent)) ||
    list[0];
  const select = (id: string) =>
    side === "policies" ? onSelect(id) : setOpponent(id);
  const write = (items: StrategyPolicy[]) =>
    update({ ...study, [side]: items });
  const add = (p: StrategyPolicy) => {
    if (list.length >= 100) return;
    write([...list, p]);
    select(p.id);
    setSearch("");
    setFeature("all");
  };
  const shown = list.filter(
    (p) =>
      p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
      (feature === "all" ||
        (feature === "build" && p.targets.length > 0) ||
        (feature === "flip" && (p.opportunistic || p.lateFlip)) ||
        (feature === "transport" && !p.targets.length)),
  );
  const other = side === "policies" ? "opponents" : "policies";
  return (
    <section className="strategy-workspace" aria-label="作戦編集">
      <aside className="policy-library">
        <label className="field">
          編集する作戦
          <select
            value={side}
            onChange={(e) => {
              setSide(e.target.value as typeof side);
              setSearch("");
              setNotice("");
            }}
          >
            <option value="policies">自分</option>
            <option value="opponents">相手</option>
          </select>
        </label>
        <input
          type="search"
          aria-label="作戦名を検索"
          placeholder="作戦名を検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="作戦の特徴"
          value={feature}
          onChange={(e) => setFeature(e.target.value)}
        >
          <option value="all">すべての作戦</option>
          <option value="build">建設する</option>
          <option value="flip">反転する</option>
          <option value="transport">建設せず搬送する</option>
        </select>
        <div className="policy-list" aria-label="作戦一覧">
          {shown.map((p) => (
            <button
              key={p.id}
              className="strategy-item"
              aria-pressed={p.id === policy.id}
              onClick={() => select(p.id)}
            >
              {p.name}
            </button>
          ))}
          {!shown.length && (
            <p>
              該当する作戦はありません。
              <button
                onClick={() => {
                  setSearch("");
                  setFeature("all");
                }}
              >
                絞り込みを解除
              </button>
            </p>
          )}
        </div>
        <button
          disabled={busy || list.length >= 100}
          onClick={() =>
            add({
              id: crypto.randomUUID(),
              name: "新しい作戦",
              targets: [],
              height: 1,
              mustika: false,
              opportunistic: false,
              lateFlip: false,
              skyFirst: 0,
            })
          }
        >
          作戦を追加
        </button>
        <small>{list.length} / 100件</small>
      </aside>
      <div className="policy-editor">
        <div className="policy-section-heading">
          <h3>{policy.name}</h3>
          <details className="policy-item-menu">
            <summary>作戦の操作</summary>
            <div className="policy-actions">
              <button
                disabled={busy || list.length >= 100}
                onClick={() => add(copyPolicy(policy))}
              >
                複製
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  document
                    .querySelector<HTMLInputElement>(
                      '.policy-editor input[aria-label="作戦名"]',
                    )
                    ?.focus()
                }
              >
                名前を変更
              </button>
              <button
                disabled={busy || study[other].length >= 100}
                onClick={() => {
                  update({
                    ...study,
                    [other]: [...study[other], copyPolicy(policy, policy.name)],
                  });
                  setNotice(
                    `${side === "policies" ? "相手" : "自分"}の作戦に「${policy.name}」をコピーしました。`,
                  );
                }}
              >
                {side === "policies" ? "相手" : "自分"}側へコピー
              </button>
              <button
                disabled={busy || list.length <= 1}
                onClick={() => {
                  const remaining = list.filter((p) => p.id !== policy.id);
                  write(remaining);
                  select(remaining[0].id);
                }}
              >
                削除
              </button>
            </div>
          </details>
        </div>
        {notice && <p role="status">{notice}</p>}
        <PolicyForm
          key={`${side}:${policy.id}`}
          policy={policy}
          config={activeConfig(study)}
          team={side === "policies" ? 0 : 1}
          busy={busy}
          onChange={(next) =>
            write(list.map((p) => (p.id === next.id ? next : p)))
          }
        />
        <Variants
          key={`${side}:${policy.id}:${JSON.stringify(policy)}`}
          policy={policy}
          existing={list}
          onAccept={write}
          busy={busy}
        />
      </div>
    </section>
  );
}
