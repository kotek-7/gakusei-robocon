import { Comparison } from "./Comparison";
import { Conditions } from "./Conditions";
import { StrategyEditor } from "./StrategyEditor";
import { loadMatches, saveMatch, matchKey } from "./persistence";
import { useEffect, useRef, useState } from "react";
import { configAt, initial } from "../engine/model";
import { frame } from "../engine/presentation";
import { actionName } from "../engine/labels";
import { Viewport } from "../viewport/Viewport";
import type { StrategyPolicy } from "../engine/types";
import type { Match } from "./match";
import { alternatives, createStudy, readStudy, type Study } from "./state";

const storageKey = "robocon-strategy-notebook-1";
function load() {
  try {
    const raw = localStorage.getItem(storageKey);
    return {
      study: raw ? readStudy(JSON.parse(raw)) : createStudy(),
      error: "",
    };
  } catch {
    return {
      study: createStudy(),
      error:
        "保存したノートを読み込めませんでした。保存ファイルから読み込めます。",
    };
  }
}
const boot = load();
export function App() {
  const [study, setStudy] = useState<Study>(boot.study),
    [selected, setSelected] = useState(boot.study.policies[0].id),
    [tab, setTab] = useState("compare");
  const [results, setResults] = useState<Record<string, Match>>({}),
    [busy, setBusy] = useState(false),
    [restoring, setRestoring] = useState(true),
    [error, setError] = useState(boot.error);
  const [opponent, setOpponent] = useState(boot.study.opponents[0].id),
    [priority, setPriority] = useState<"red" | "blue">("red"),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setRestoring(true);
    loadMatches(study)
      .then((saved) => {
        if (!cancelled) setResults((current) => ({ ...saved, ...current }));
      })
      .catch(() => {
        if (!cancelled)
          setError("比較結果を端末から読み込めません。再計算はできます。");
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, [study]);
  const matchSection = useRef<HTMLElement | null>(null);
  const worker = useRef<Worker | null>(null),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const policy =
    study.policies.find((p) => p.id === selected) || study.policies[0];
  const match = results[matchKey(policy.id, opponent, priority)];
  useEffect(() => {
    setTime(0);
    setPlaying(false);
  }, [selected, opponent, priority]);
  useEffect(() => {
    if (!playing || !match) return;
    const id = setInterval(
      () =>
        setTime((t) => {
          if (t >= match.frames.length - 1) {
            setPlaying(false);
            return t;
          }
          return t + 1;
        }),
      100,
    );
    return () => clearInterval(id);
  }, [playing, match]);
  function update(next: Study) {
    setStudy(next);
    setResults({});
    setTime(0);
    setPlaying(false);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setError("");
    } catch {
      setError("端末に保存できません。ファイルに保存してください。");
    }
  }
  function edit(patch: Partial<StrategyPolicy>) {
    update({
      ...study,
      policies: study.policies.map((p) =>
        p.id === policy.id ? { ...p, ...patch } : p,
      ),
    });
  }
  function stop() {
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
  }
  function run() {
    setBusy(true);
    setError("");
    const jobs = study.policies
      .flatMap((red) =>
        study.opponents.flatMap((blue) =>
          (["red", "blue"] as const).map((priority) => ({
            config: study.config,
            red,
            blue,
            priority,
          })),
        ),
      )
      .filter((j) => !results[matchKey(j.red.id, j.blue.id, j.priority)]);
    const w = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    const next = () => {
      const job = jobs.shift();
      if (job) w.postMessage(job);
      else stop();
    };
    w.onmessage = ({ data }) => {
      if (data.error) {
        setError(data.error);
        stop();
        return;
      }
      const m = data.result as Match;
      saveMatch(study, m).catch(() =>
        setError(
          "比較結果を端末に保存できませんでした。画面上では引き続き確認できます。",
        ),
      );
      setResults((r) => ({ ...r, [matchKey(m.red, m.blue, m.priority)]: m }));
      next();
    };
    w.onerror = () => {
      setError("計算を中断しました。完了した対戦は確認できます。");
      stop();
    };
    next();
  }
  const total = study.policies.length * study.opponents.length * 2,
    done = Object.keys(results).length;
  function save() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(study, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "作戦ノート.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="app-shell">
      <header>
        <div>
          <h1>作戦ノート</h1>
          <span className="competition-name">NHK学生ロボコン2027</span>
        </div>
        <div className="toolbar">
          <button onClick={save}>ファイルに保存</button>
          <button disabled={busy} onClick={() => input.current?.click()}>
            読み込む
          </button>
          <input
            hidden
            ref={input}
            type="file"
            accept="application/json"
            onChange={async (e) => {
              try {
                const file = e.target.files?.[0];
                if (!file) return;
                const next = readStudy(JSON.parse(await file.text()));
                update(next);
                setSelected(next.policies[0].id);
                setOpponent(next.opponents[0].id);
              } catch (err) {
                setError(String(err));
              }
              e.target.value = "";
            }}
          />
        </div>
      </header>
      <nav aria-label="検討の手順">
        {[
          ["compare", "作戦比較"],
          ["strategy", "作戦編集"],
          ["conditions", "機体条件"],
        ].map(([id, name]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            {name}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <main>
        {tab === "conditions" ? (
          <Conditions study={study} busy={busy} update={update} />
        ) : (
          <>
            <div className="section-heading">
              <div>
                <h2>{tab === "strategy" ? "作戦編集" : "作戦比較"}</h2>
                <p>
                  {tab === "strategy"
                    ? "建設順と、状況に応じた切替を設定します。"
                    : `${study.policies.length}作戦・${study.opponents.length}種類の相手・180秒`}
                </p>
              </div>
              <div className="toolbar">
                <span role="status">
                  {restoring ? "保存結果を読込中" : `${done} / ${total} 試合`}
                </span>
                {busy ? (
                  <button onClick={stop}>一時停止</button>
                ) : (
                  <button
                    className="primary"
                    disabled={restoring || done === total}
                    onClick={run}
                  >
                    {done === total
                      ? "比較完了"
                      : done
                        ? "続きから比較"
                        : "全作戦を比較"}
                  </button>
                )}
              </div>
            </div>
            <div
              className={`workspace ${tab === "compare" ? "compare-workspace" : "edit-workspace"}`}
            >
              {tab === "strategy" && (
                <aside aria-label="作戦一覧">
                  <button
                    disabled={busy || study.policies.length >= 100}
                    onClick={() => {
                      const p = {
                        ...structuredClone(policy),
                        id: crypto.randomUUID(),
                        name: `${policy.name}の別案`,
                      };
                      update({ ...study, policies: [...study.policies, p] });
                      setSelected(p.id);
                      setTab("strategy");
                    }}
                  >
                    複製して編集
                  </button>
                  <button
                    disabled={busy || study.policies.length >= 93}
                    onClick={() => {
                      const variants = alternatives(policy, study.policies);
                      if (!variants.length) {
                        setError("この作戦の比較用の別案は追加済みです。");
                        return;
                      }
                      update({
                        ...study,
                        policies: [...study.policies, ...variants],
                      });
                    }}
                  >
                    条件を変えた別案を追加
                  </button>
                  {study.policies.map((p) => (
                    <button
                      key={p.id}
                      className="strategy-item"
                      aria-pressed={policy.id === p.id}
                      onClick={() => setSelected(p.id)}
                    >
                      <strong>{p.name}</strong>
                      <small>
                        {p.targets.length
                          ? `${p.targets.length}本を${p.height === 3 ? "完成" : `${p.height}段まで建設`}`
                          : "搬送主体"}
                        {p.mustika ? " · ムスティカ" : ""}
                        {p.opportunistic || p.lateFlip ? " · 反転" : ""}
                      </small>
                    </button>
                  ))}
                </aside>
              )}
              <section
                className={`detail ${tab === "compare" ? "compare-detail" : ""}`}
              >
                {tab === "strategy" ? (
                  <StrategyEditor
                    {...{ study, policy, busy, edit, update, setSelected }}
                  />
                ) : (
                  <Comparison
                    study={study}
                    results={results}
                    selected={policy.id}
                    opponent={opponent}
                    priority={priority}
                    onPriority={setPriority}
                    onSelect={(id, other) => {
                      setSelected(id);
                      setOpponent(other);
                      setTime(0);
                      setPlaying(false);
                      if (window.innerWidth < 1100)
                        matchSection.current?.scrollIntoView({
                          block: "start",
                        });
                    }}
                  />
                )}
                <section className="match-section" ref={matchSection}>
                  <div className="match-title">
                    <h3>{policy.name}</h3>
                    <button
                      onClick={() => {
                        setTab(tab === "compare" ? "strategy" : "compare");
                        window.scrollTo({ top: 0 });
                      }}
                    >
                      {tab === "compare" ? "作戦を編集" : "比較に戻る"}
                    </button>
                  </div>
                  <div className="toolbar">
                    <label>
                      相手{" "}
                      <select
                        value={opponent}
                        onChange={(e) => setOpponent(e.target.value)}
                      >
                        {study.opponents.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      競合{" "}
                      <select
                        value={priority}
                        onChange={(e) =>
                          setPriority(e.target.value as "red" | "blue")
                        }
                      >
                        <option value="red">赤優先</option>
                        <option value="blue">青優先</option>
                      </select>
                    </label>
                  </div>
                  {!match && (
                    <p>
                      この対戦は未計算です。上の「全作戦を比較」で計算を始められます。
                    </p>
                  )}
                  <Viewport
                    frame={
                      match?.frames[time] ||
                      frame(initial(study.config, configAt(study.config, 0)))
                    }
                    replaying={Boolean(match)}
                  />
                  {match && (
                    <>
                      <div className="playback">
                        <button
                          onClick={() => {
                            if (time === match.frames.length - 1) setTime(0);
                            setPlaying(!playing);
                          }}
                        >
                          {playing ? "停止" : "再生"}
                        </button>
                        <input
                          aria-label="再生時刻"
                          type="range"
                          min="0"
                          max={match.frames.length - 1}
                          value={time}
                          onChange={(e) => {
                            setPlaying(false);
                            setTime(Number(e.target.value));
                          }}
                        />
                        <span>
                          {time} / {study.config.horizon}秒
                        </span>
                      </div>
                      <details>
                        <summary>得点と競合の履歴</summary>
                        <div className="event-list">
                          {match.events
                            .filter(
                              (e) =>
                                e.phase === "blocked" ||
                                (e.phase === "finish" &&
                                  ["place", "placeM", "flip", "drop"].includes(
                                    e.action.kind,
                                  )),
                            )
                            .map((e, i) => (
                              <p key={i}>
                                <button
                                  onClick={() => {
                                    setTime(e.t);
                                    setPlaying(false);
                                  }}
                                >
                                  {e.t}秒
                                </button>{" "}
                                {["赤TR", "赤BR", "青TR", "青BR"][e.robot]} ·{" "}
                                {actionName(e.action)}
                                {e.phase === "blocked"
                                  ? "（競合で不成立）"
                                  : ""}
                              </p>
                            ))}
                        </div>
                      </details>
                    </>
                  )}
                </section>
              </section>
            </div>
          </>
        )}
      </main>
      <footer>
        <details>
          <summary>この検討で扱う範囲</summary>
          <p>
            ABUロボコン2027 Rulebook
            v1.1を競技ルールの前提とします。180秒、搬送・建設・反転・ムスティカの得点を扱います。移動は定めた経路、操作は指定時間で成功し、受け渡しは床経由で行うモデルです。衝突回避、姿勢制御、通信、重量、成功率と製作工数は評価しません。
          </p>
          <p>
            作戦は目標順と条件による方策です。任意の行動列・待機時刻・相手戦術を網羅しません。必要な機構がないと実行可能な次の目標または搬送へ移ります。機体条件・作戦・完了した比較結果は端末に保存されます。ファイル保存には機体条件と作戦を含みます。
          </p>
        </details>
      </footer>
    </div>
  );
}
