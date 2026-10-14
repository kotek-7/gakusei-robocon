import { useEffect, useMemo, useRef, useState } from "react";
import { Comparison, type Pair } from "../comparison/Comparison";
import { Conditions } from "./Conditions";
import { StrategyEditor } from "./StrategyEditor";
import { activeCondition, type Study } from "./state";
import { useNotebook } from "../notebook/useNotebook";
import { NotebookMenu } from "../notebook/NotebookMenu";
import { useExecution } from "../execution/useExecution";
import { useRunData } from "../execution/useRunData";
import { ExecutionStatus } from "../execution/ExecutionStatus";
import { runKey } from "../execution/identity";
import type { Priority, RunInput } from "../execution/types";
import { ReplayWorkspace } from "../replay/ReplayWorkspace";
import { configAt, initial } from "../engine/model";
import { frame } from "../engine/presentation";
import type { Config } from "../engine/types";
import { defaults, usePreferences } from "../ui/preferences";
import "./workspace.css";
export function App() {
  const notebook = useNotebook(),
    { study } = notebook,
    execution = useExecution(),
    { queue, summaries, ready } = execution;
  const [selected, setSelected] = useState(study.policies[0].id),
    [opponent, setOpponent] = useState(study.opponents[0].id),
    [priority, setPriority] = useState<Priority>("red"),
    [tab, setTab] = useState("compare"),
    [baseline, setBaseline] = useState(""),
    [settings, setSettings] = useState(false),
    [layoutReset, setLayoutReset] = useState(0),
    [prefs, setPrefs] = usePreferences();
  const replayHost = useRef<HTMLDivElement>(null),
    container = useRef<HTMLDivElement>(null);
  const policy =
      study.policies.find((p) => p.id === selected) || study.policies[0],
    other =
      study.opponents.find((p) => p.id === opponent) || study.opponents[0],
    condition = activeCondition(study);
  const input: RunInput = {
    config: condition.config,
    conditionName: condition.name,
    red: policy,
    blue: other,
    priority,
  };
  const key = runKey(input),
    base = study.policies.find((p) => p.id === baseline),
    baseKey = base ? runKey({ ...input, red: base }) : "";
  const loaded = useRunData(key, summaries[key]?.completedAt),
    baseLoaded = useRunData(
      baseKey,
      baseKey && baseKey !== key ? summaries[baseKey]?.completedAt : undefined,
    );
  const initialFrame = useMemo(
    () => frame(initial(condition.config, configAt(condition.config, 0))),
    [condition.config],
  );
  const error =
    notebook.error || execution.error || loaded.error || baseLoaded.error;
  function update(next: Study) {
    if (!queue.busy) notebook.update(next);
  }
  function run(pairs: Pair[], force = false) {
    if (!ready || queue.busy) return;
    const inputs = pairs
      .flatMap((pair) => {
        const red = study.policies.find((p) => p.id === pair.red),
          blue = study.opponents.find((p) => p.id === pair.blue);
        return red && blue
          ? (["red", "blue"] as const).map((priority) => ({
              config: condition.config,
              conditionName: condition.name,
              red,
              blue,
              priority,
            }))
          : [];
      })
      .filter((j) => force || !summaries[runKey(j)]);
    void queue.enqueue(inputs, force);
  }
  const allPairs = useMemo(
    () =>
      study.policies.flatMap((p) =>
        study.opponents.map((o) => ({ red: p.id, blue: o.id })),
      ),
    [study.policies, study.opponents],
  );
  const allKeys = useMemo(
    () =>
      study.policies.flatMap((red) =>
        study.opponents.flatMap((blue) =>
          (["red", "blue"] as const).map((priority) =>
            runKey({
              config: condition.config,
              conditionName: condition.name,
              red,
              blue,
              priority,
            }),
          ),
        ),
      ),
    [condition, study.policies, study.opponents],
  );
  const done = allKeys.reduce((n, key) => n + Number(!!summaries[key]), 0);
  function sweep(cases: { name: string; config: Config }[]) {
    if (!ready || queue.busy || !cases.length) return;
    const conditions = cases.map((c) => ({
      ...c,
      id: crypto.randomUUID(),
      notes: "",
    }));
    update({
      ...study,
      conditions: [...study.conditions, ...conditions],
      activeConditionId: conditions[0].id,
    });
    void queue.enqueue(
      conditions.flatMap((c) =>
        (["red", "blue"] as const).map((priority) => ({
          config: c.config,
          conditionName: c.name,
          red: policy,
          blue: other,
          priority,
        })),
      ),
    );
    setTab("compare");
  }
  function select(red: string, blue: string) {
    setSelected(red);
    setOpponent(blue);
    if (innerWidth < 1100)
      replayHost.current?.scrollIntoView({ block: "start" });
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        !queue.busy
      ) {
        e.preventDefault();
        e.shiftKey ? notebook.redo() : notebook.undo();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [notebook, queue.busy]);
  return (
    <div className={`app-shell ${prefs.compact ? "compact" : ""}`}>
      <header>
        <div>
          <h1>作戦ノート</h1>
          <span className="competition-name">NHK学生ロボコン2027</span>
        </div>
        <NotebookMenu
          {...notebook}
          busy={queue.busy}
          onError={notebook.setError}
          update={update}
        >
          <button onClick={() => setSettings((v) => !v)}>
            表示と再生の設定
          </button>
          <button
            onClick={() => {
              setPrefs({ ...prefs, paneWidth: defaults.paneWidth });
              setLayoutReset((n) => n + 1);
            }}
          >
            レイアウトを戻す
          </button>
        </NotebookMenu>
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
      {settings && (
        <section className="settings-panel" aria-label="表示と再生の設定">
          <div className="toolbar">
            <label>
              <input
                type="checkbox"
                checked={prefs.compact}
                onChange={(e) =>
                  setPrefs({ ...prefs, compact: e.target.checked })
                }
              />
              表示を詰める
            </label>
            <label>
              再生速度
              <select
                value={prefs.speed}
                onChange={(e) =>
                  setPrefs({ ...prefs, speed: Number(e.target.value) })
                }
              >
                {[0.5, 1, 2, 5, 10].map((v) => (
                  <option key={v} value={v}>
                    {v}倍
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={prefs.labels}
                onChange={(e) =>
                  setPrefs({ ...prefs, labels: e.target.checked })
                }
              />
              名前を表示
            </label>
            <label>
              <input
                type="checkbox"
                checked={prefs.trails}
                onChange={(e) =>
                  setPrefs({ ...prefs, trails: e.target.checked })
                }
              />
              移動履歴を表示
            </label>
            <button onClick={() => setPrefs(defaults)}>設定を戻す</button>
            <button onClick={() => setSettings(false)}>閉じる</button>
          </div>
        </section>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <main>
        <div hidden={tab !== "conditions"}>
          <Conditions
            study={study}
            busy={queue.busy || !ready}
            update={update}
            onSweep={sweep}
          />
        </div>
        <div hidden={tab === "conditions"}>
          <div className="section-heading">
            <div>
              <h2>{tab === "strategy" ? "作戦編集" : "作戦比較"}</h2>
              <p>
                {study.policies.length}作戦・{study.opponents.length}
                種類の相手・180秒
              </p>
            </div>
            <div className="toolbar">
              <label>
                条件
                <select
                  disabled={queue.busy}
                  value={condition.id}
                  onChange={(e) =>
                    update({ ...study, activeConditionId: e.target.value })
                  }
                >
                  {study.conditions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <span role="status">
                {ready
                  ? `${done} / ${allPairs.length * 2} 試合`
                  : "保存結果を読込中"}
              </span>
              {queue.busy ? (
                <button onClick={() => queue.pause()}>一時停止</button>
              ) : (
                <button
                  className="primary"
                  disabled={!ready || done === allPairs.length * 2}
                  onClick={() => run(allPairs)}
                >
                  {done === allPairs.length * 2
                    ? "比較完了"
                    : done
                      ? "未計算を比較"
                      : "全作戦を比較"}
                </button>
              )}
            </div>
          </div>
          <div
            className="study-workspace"
            ref={container}
            style={
              {
                "--replay-width": `${prefs.paneWidth}px`,
              } as React.CSSProperties
            }
          >
            <div className="work-pane">
              <div hidden={tab !== "compare"}>
                <Comparison
                  study={study}
                  results={summaries}
                  jobs={[...queue.jobs]}
                  selected={policy.id}
                  opponent={other.id}
                  priority={priority}
                  onPriority={setPriority}
                  onSelect={select}
                  baseline={baseline}
                  onBaseline={setBaseline}
                  onRun={run}
                  busy={queue.busy || !ready}
                />
              </div>
              <div hidden={tab !== "strategy"}>
                <StrategyEditor
                  study={study}
                  busy={queue.busy}
                  update={update}
                  selected={policy.id}
                  onSelect={setSelected}
                />
              </div>
            </div>
            <div
              className="pane-divider"
              role="separator"
              aria-label="3Dパネルの幅"
              aria-orientation="vertical"
              aria-valuenow={prefs.paneWidth}
              aria-valuemin={360}
              aria-valuemax={850}
              tabIndex={0}
              onKeyDown={(e) => {
                if (["ArrowLeft", "ArrowRight", "Home"].includes(e.key)) {
                  e.preventDefault();
                  setPrefs({
                    ...prefs,
                    paneWidth:
                      e.key === "Home"
                        ? 480
                        : Math.max(
                            360,
                            Math.min(
                              850,
                              prefs.paneWidth +
                                (e.key === "ArrowLeft" ? 20 : -20),
                            ),
                          ),
                  });
                }
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  const right =
                    container.current!.getBoundingClientRect().right;
                  setPrefs({
                    ...prefs,
                    paneWidth: Math.max(360, Math.min(850, right - e.clientX)),
                  });
                }
              }}
            />
            <section ref={replayHost} className="replay-host">
              <div className="match-title">
                <h3>{policy.name}</h3>
                <button
                  onClick={() =>
                    setTab(tab === "compare" ? "strategy" : "compare")
                  }
                >
                  {tab === "compare" ? "作戦を編集" : "比較に戻る"}
                </button>
              </div>
              <div className="toolbar match-selectors">
                <label>
                  相手
                  <select
                    value={other.id}
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
                  競合
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                  >
                    <option value="red">赤優先</option>
                    <option value="blue">青優先</option>
                  </select>
                </label>
              </div>
              {!loaded.match && (
                <p className="table-note">
                  {summaries[key]
                    ? "再生データを読込中。"
                    : "この対戦は未計算です。"}
                  {!summaries[key] && (
                    <button
                      disabled={!ready || queue.busy}
                      onClick={() => run([{ red: policy.id, blue: other.id }])}
                    >
                      この対戦を計算
                    </button>
                  )}
                </p>
              )}
              <ReplayWorkspace
                layoutReset={layoutReset}
                match={loaded.match}
                baselineMatch={baseLoaded.match}
                runKey={key}
                label={`${condition.name} · ${policy.name} 対 ${other.name} · ${priority === "red" ? "赤" : "青"}優先`}
                baselineLabel={
                  base
                    ? `${condition.name} · ${base.name} 対 ${other.name} · ${priority === "red" ? "赤" : "青"}優先`
                    : undefined
                }
                initialFrame={initialFrame}
                notes={study.notes}
                onNotes={(notes) => notebook.update({ ...study, notes })}
                preferences={prefs}
                active={tab !== "conditions"}
              />
            </section>
          </div>
        </div>
      </main>
      <ExecutionStatus queue={queue} ready={ready} />
      <footer>
        <details>
          <summary>この検討で扱う範囲</summary>
          <p>
            ABUロボコン2027 Rulebook
            v1.1を前提に、180秒の搬送・建設・反転・ムスティカを比較します。移動は定めた経路、操作は指定時間で成功するモデルです。
          </p>
          <p>
            衝突回避、姿勢制御、通信、重量、成功率と製作工数は評価しません。作戦は目標順と条件による方策で、すべての行動列や相手戦術を網羅するものではありません。
          </p>
          <p>
            ノートと計算結果はこの端末に保存します。ファイルには作戦・条件・場面メモを保存し、再生結果は再計算できます。
          </p>
        </details>
      </footer>
    </div>
  );
}
