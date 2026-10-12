import { useEffect, useRef } from "react";
import {
  dimensions,
  valueOf,
  type CanonicalPlan,
  type Hardware,
} from "./navigation";
import { requirements, type Estimates } from "./effort";
import { responseGroup } from "./decisions";
import type { CalculationState } from "./calculation";
import type { Match } from "./protocol";
import { title } from "./plans";
import { label, route, span } from "./labels";
export function PlanDetail({
  plan,
  hardware,
  estimates,
  calculation,
  onClose,
  onPlay,
  onCalculate,
}: {
  plan: CanonicalPlan;
  hardware: Hardware;
  estimates: Estimates;
  calculation: CalculationState;
  onClose(): void;
  onPlay(): void;
  onCalculate(): void;
}) {
  const host = useRef<HTMLElement>(null);
  useEffect(() => {
    host.current?.scrollIntoView({ block: "nearest" });
  }, [plan.id]);
  const groups = new Map<string, { label: string; matches: Match[] }>();
  for (const m of calculation.matches ?? []) {
    const g = responseGroup(m.enemy);
    if (!groups.has(g.key)) groups.set(g.key, { ...g, matches: [] });
    groups.get(g.key)!.matches.push(m);
  }
  const status = calculation.status;
  const message =
    status === "running"
      ? `相手の対応を計算中 ${calculation.count} / ${calculation.total}作戦`
      : status === "complete"
        ? "297相手作戦・競合優先順2通りの結果"
        : status === "error"
          ? "計算できませんでした。再試行してください。"
          : status === "stopped"
            ? "計算を中止しました。"
            : "相手の奉納・反転・土台利用の条件で分類します。";
  return (
    <section id="plan-detail" ref={host}>
      <div className="detail-heading">
        <h2>作戦 #{plan.id}</h2>
        <button id="close-detail" onClick={onClose}>
          詳細を閉じる
        </button>
      </div>
      <dl className="plan-facts">
        {dimensions.map((s) => (
          <div key={s.id}>
            <dt>{s.label}</dt>
            <dd>{label(s.id, valueOf(plan, s.id))}</dd>
          </div>
        ))}
      </dl>
      <p>
        {hardware.level === "upper" ? "L2まで対応" : "L1のみ"} / BR{" "}
        {route(hardware.BR)} / TR {route(hardware.TR)}
      </p>
      <button id="play-plan" className="primary" onClick={onPlay}>
        3Dで再生
      </button>
      <details className="plan-internals">
        <summary>必要な技術・元の設定</summary>
        <ul>
          {requirements(plan).map((c) => (
            <li key={c.id}>
              {c.name}：{estimates[c.id]}人日
            </li>
          ))}
        </ul>
        <p>元の設定 #{plan.sourceIds.join("、#")} は行動条件が同じです。</p>
      </details>
      <section id="opponent-responses">
        <h3>この作戦への相手の対応</h3>
        <p role="status">{message}</p>
        <button
          id={status === "running" ? "stop-responses" : "load-responses"}
          onClick={onCalculate}
        >
          {status === "running" ? "計算を中止" : "相手への得点範囲を計算"}
        </button>
        {[...groups].map(([key, g]) => {
          const scores = g.matches.map((m) => m.scores[0]),
            margins = g.matches.map((m) => m.scores[0] - m.scores[1]);
          return (
            <details key={key} className="response-group">
              <summary>
                <span>{g.label}</span>
                <b>{span([Math.min(...scores), Math.max(...scores)])}点</b>
              </summary>
              <p>
                自分 − 相手：
                {span([Math.min(...margins), Math.max(...margins)])}点 /{" "}
                {g.matches.length}ケース
              </p>
              <div className="response-cases">
                {g.matches.map((m) => (
                  <p key={`${m.enemy.id}/${m.priority}`}>
                    相手 #{m.enemy.id} {title(m.enemy)} / 優先：
                    {m.priority ? "相手" : "自分"}
                    <br />
                    自分 {m.scores[0]}点、相手 {m.scores[1]}点
                  </p>
                ))}
              </div>
            </details>
          );
        })}
        <p className="small-note">
          群内でも建設場所と搬送方針は異なります。相手の登り方はBR階段・TRスロープです。
        </p>
      </section>
    </section>
  );
}
