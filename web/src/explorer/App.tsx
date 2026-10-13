import {
  competitionName,
  ruleAssumption,
  glossary,
  phaseNames,
} from "./labels";
import { useEffect, useRef, useState } from "react";
import { api, saveJSON } from "./api";
import { statusName, actionName, robotNames } from "./labels";
import type {
  Action,
  Config,
  Detail,
  Edge,
  Frame,
  Graph as GraphData,
  Model,
  Replay,
  Search,
} from "./types";
import { Candidates } from "./Candidates";
import { Conditions } from "./Conditions";
import { Graph } from "./Graph";
import { Inspector } from "./Inspector";
import { Evaluation } from "./Evaluation";
import { Viewport } from "../viewport/Viewport";
export function App() {
  const [model, setModel] = useState<Model | null>(null),
    [searches, setSearches] = useState<Search[]>([]),
    [id, setId] = useState(""),
    [baseline, setBaseline] = useState("");
  const [tab, setTab] = useState("candidates"),
    [editing, setEditing] = useState(false),
    [run, setRun] = useState(0),
    [offset, setOffset] = useState(0),
    [node, setNode] = useState<number | null>(null);
  const [graph, setGraph] = useState<GraphData | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [trail, setTrail] = useState<number[] | null>(null),
    [replay, setReplay] = useState<Replay | null>(null),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false);
  const [error, setError] = useState(""),
    [request, setRequest] = useState(false),
    [budget, setBudget] = useState(1000),
    [seconds, setSeconds] = useState(10),
    [revision, setRevision] = useState(0);
  const [selectionOwner, setSelectionOwner] = useState(id);
  const chosen = useRef(id);
  chosen.current = id;
  const positioned = useRef("");
  const selectedNode = useRef(node);
  selectedNode.current = node;
  const search = searches.find((s) => s.id === id) || null;
  const busy =
    request || search?.status === "running" || search?.status === "evaluating";
  const rev = `${search?.nodes}/${search?.edges}/${search?.status}/${revision}`;
  async function refresh() {
    const data = await api<Search[]>("searches");
    setSearches(data);
  }
  async function perform(fn: () => Promise<void>) {
    setRequest(true);
    setError("");
    try {
      await fn();
      await refresh();
      setRevision((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRequest(false);
    }
  }
  useEffect(() => {
    const c = new AbortController();
    api<Model>("model", undefined, c.signal)
      .then((data) => setModel(data))
      .catch((e) => {
        if (!c.signal.aborted)
          setError(
            "ローカル計算プロセスに接続できません。python3 -m explorer を起動してください。 " +
              e.message,
          );
      });
    return () => c.abort();
  }, []);
  useEffect(() => {
    let cancelled = false;
    const refreshList = () =>
      api<Search[]>("searches")
        .then((data) => {
          if (!cancelled) setSearches(data);
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        });
    refreshList();
    const timer = setInterval(refreshList, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!id && searches.length) setId(searches[0].id);
  }, [id, searches]);
  useEffect(() => {
    setRun(0);
    setOffset(0);
    setNode(null);
    setTrail(null);
    setReplay(null);
    setPlaying(false);
    setGraph(null);
    setDetail(null);
    setSelectionOwner(id);
  }, [id]);
  useEffect(() => {
    if (!id || selectionOwner !== id) return;
    const c = new AbortController();
    api<GraphData>(
      `searches/${id}/graph?run=${run}&offset=${offset}`,
      undefined,
      c.signal,
    )
      .then((g) => {
        setGraph(g);
        setNode((n) => n ?? g.root);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [id, selectionOwner, run, offset, rev]);
  useEffect(() => {
    if (!id || selectionOwner !== id || node === null) return;
    const c = new AbortController();
    api<Detail>(`searches/${id}/node?id=${node}`, undefined, c.signal)
      .then((d) => {
        setDetail(d);
        if (positioned.current !== `${id}/${d.id}`) {
          setRun(d.run);
          setOffset(d.offset);
          positioned.current = `${id}/${d.id}`;
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [id, selectionOwner, node, rev]);
  useEffect(() => {
    if (!playing || !replay) return;
    const end = replay.frames.at(-1)?.t || 0;
    const interval = setInterval(
      () =>
        setTime((t) => {
          if (t >= end) {
            setPlaying(false);
            return end;
          }
          return Math.min(end, t + 0.25);
        }),
      125,
    );
    return () => clearInterval(interval);
  }, [playing, replay]);
  function select(n: number) {
    setNode(n);
    setTrail(null);
    setReplay(null);
    setPlaying(false);
  }
  function switchRun(r: number) {
    setRun(r);
    setOffset(0);
    setNode(null);
    setDetail(null);
    setTrail(null);
    setReplay(null);
    setPlaying(false);
  }
  async function create(c: Config) {
    await perform(async () => {
      const s = await api<Search>("searches", c);
      setSearches((old) => [s, ...old]);
      setId(s.id);
      setEditing(false);
      setTab("candidates");
    });
  }
  async function edge(e: Edge) {
    if (!detail || !id) return;
    const current = id;
    await perform(async () => {
      let p: number[];
      if (e.src === detail.id) p = [...(trail ?? detail.path), e.id];
      else {
        const d = await api<Detail>(`searches/${id}/node?id=${e.src}`);
        p = [...d.path, e.id];
      }
      if (chosen.current !== current) return;
      setTrail(p);
      setNode(e.dst);
      setReplay(null);
      setPlaying(false);
    });
  }
  async function step(actions: Action[]) {
    if (!detail) return;
    const current = id;
    await perform(async () => {
      const result = await api<{ edges: number[] }>(`searches/${id}/step`, {
        node: detail.id,
        red: actions.slice(0, 2),
        blue: actions.slice(2),
      });
      const d = await api<Detail>(`searches/${id}/node?id=${detail.id}`);
      const e = d.edges.find((e) => e.id === result.edges[0])!;
      if (chosen.current !== current) return;
      setTrail([...(trail ?? detail.path), e.id]);
      setNode(e.dst);
      setReplay(null);
      if (result.edges.length > 1)
        setError(
          "競合の結果が複数あります。出発局面の出る遷移から、各ケースを確認できます。",
        );
    });
  }
  async function play() {
    if (!detail) return;
    const current = id;
    const currentNode = detail.id;
    await perform(async () => {
      const data = await api<Replay>(`searches/${id}/replay`, {
        edges: trail ?? detail.path,
      });
      if (chosen.current !== current || selectedNode.current !== currentNode)
        return;
      setReplay(data);
      setTime(data.frames[0]?.t || 0);
      setPlaying(data.frames.length > 1);
    });
  }
  let frame: Frame | null = detail?.frame || null;
  if (replay?.frames.length) {
    const index = Math.max(
      0,
      replay.frames.findLastIndex((f) => f.t <= time),
    );
    frame = replay.frames[index];
    const next = replay.frames[index + 1];
    if (next && next.t > frame.t) {
      const f = (time - frame.t) / (next.t - frame.t);
      frame = {
        ...frame,
        t: time,
        robots: frame.robots.map((r, i) => ({
          ...r,
          p: r.p.map((x, j) => x + (next.robots[i].p[j] - x) * f),
        })),
        objects: frame.objects.map((o) => {
          if (!o.loc.startsWith("robot")) return o;
          const i = Number(o.loc.slice(5));
          return {
            ...o,
            p: o.p!.map(
              (x, j) =>
                x +
                (next.robots[i].p[j] - replay.frames[index].robots[i].p[j]) * f,
            ),
          };
        }),
      };
    }
  }
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <path
              d="M5 14H14M14 14L23 5M14 14L23 23"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            {[
              [5, 14],
              [14, 14],
              [23, 5],
              [23, 23],
            ].map(([x, y]) => (
              <circle
                key={x + "," + y}
                cx={x}
                cy={y}
                r="3"
                fill="currentColor"
              />
            ))}
          </svg>
          <h1>作戦探索</h1>
        </div>
        <span className="header-context">{competitionName}</span>
        <div className="header-actions">
          <button
            onClick={() => {
              setEditing(!editing);
              setPlaying(false);
            }}
            disabled={!model}
          >
            {editing ? "探索に戻る" : "条件を編集・新規作成"}
          </button>
          <button
            disabled={!search || busy}
            onClick={() =>
              perform(async () =>
                saveJSON(
                  await api(`searches/${id}/export`),
                  `${search!.name}.json`,
                ),
              )
            }
          >
            結果を保存
          </button>
        </div>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")}>閉じる</button>
        </div>
      )}
      {!model ? (
        <main className="empty">
          <h2>計算プロセスに接続しています</h2>
          <p>
            ローカル起動コマンド：<code>python3 -m explorer</code>
          </p>
        </main>
      ) : editing || !search ? (
        <main className="setup">
          <Conditions
            key={editing ? "edit" + id : "new"}
            model={model}
            initial={search?.config || model.defaults}
            onCreate={create}
            busy={!!busy}
          />
        </main>
      ) : (
        <>
          <section className="search-toolbar">
            <label>
              保存済み探索
              <select value={id} onChange={(e) => setId(e.target.value)}>
                {searches.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              比較対象
              <select
                value={baseline}
                onChange={(e) => setBaseline(e.target.value)}
              >
                <option value="">なし</option>
                {searches
                  .filter((s) => s.id !== id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              候補探索の時間
              <select
                value={seconds}
                onChange={(e) => setSeconds(Number(e.target.value))}
              >
                {[10, 30, 60].map((n) => (
                  <option key={n} value={n}>
                    {n}秒
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary"
              disabled={!!busy}
              onClick={() =>
                perform(async () => {
                  await api(`searches/${id}/discover`, { seconds });
                  setTab("candidates");
                })
              }
            >
              候補を探す
            </button>
            <details className="exact-search">
              <summary>詳細な全探索</summary>
              <label>
                計算上限（両チームの行動の組合せ数）
                <input
                  type="number"
                  value={budget}
                  min={1}
                  max={1000000}
                  onChange={(e) => setBudget(Number(e.target.value))}
                />
              </label>
              <button
                disabled={!!busy || search.complete}
                onClick={() =>
                  perform(async () => {
                    await api(`searches/${id}/start`, { budget });
                  })
                }
              >
                全探索を続ける
              </button>
            </details>
            <button
              disabled={!["running", "evaluating"].includes(search.status)}
              onClick={() =>
                perform(async () => {
                  await api(`searches/${id}/pause`, {});
                })
              }
            >
              停止
            </button>
            <button
              disabled={!!busy}
              onClick={() =>
                perform(async () => {
                  await api(`searches/${id}/evaluate`, {});
                  setTab("evaluation");
                })
              }
            >
              評価を計算
            </button>
          </section>
          <div className="statusbar" aria-live="polite">
            <strong>{statusName[search.status]}</strong>
            <span>
              {search.nodes.toLocaleString()}局面 /{" "}
              {search.edges.toLocaleString()}遷移
            </span>
            <span>展開済み {search.expanded.toLocaleString()}局面</span>
            <span>
              完了構成 {search.completeRuns} / {search.totalRuns}
            </span>
            <span>
              {search.complete
                ? "対象範囲の探索完了"
                : "未探索の分岐があります"}
            </span>
          </div>
          {search.error && (
            <p className="error-banner" role="alert">
              {search.error}
            </p>
          )}
          <nav className="tabs" aria-label="探索表示">
            {[
              ["candidates", "作戦候補"],
              ["graph", "グラフ・3D"],
              ["evaluation", "評価・比較"],
              ["model", "モデル・前提"],
            ].map(([key, label]) => (
              <button
                key={key}
                aria-current={tab === key ? "page" : undefined}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "candidates" ? (
            <main>
              <Candidates
                key={id}
                search={search}
                model={model}
                onOpen={(r, evidence) => {
                  const owner = id;
                  perform(async () => {
                    const data = await api<Replay>(`searches/${id}/replay`, {
                      edges: evidence.path,
                    });
                    if (chosen.current !== owner) return;
                    switchRun(r);
                    setNode(evidence.node);
                    setTrail(evidence.path);
                    setReplay(data);
                    setTime(data.frames[0]?.t || 0);
                    setTab("graph");
                  });
                }}
              />
            </main>
          ) : tab === "graph" ? (
            <main className="workbench">
              <div className="graph-area">
                <div className="section-title">
                  <h2>状態遷移グラフ</h2>
                  <label>
                    構成番号
                    <input
                      type="number"
                      min={0}
                      max={Number(search.totalRuns) - 1}
                      value={run}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (value < search.runs) switchRun(value);
                      }}
                    />
                  </label>
                  <button
                    disabled={
                      !!busy || BigInt(search.runs) >= BigInt(search.totalRuns)
                    }
                    onClick={() =>
                      perform(async () => {
                        const next = search.runs;
                        await api(`searches/${id}/run`, { index: next });
                        switchRun(next);
                      })
                    }
                  >
                    次の構成を生成
                  </button>
                </div>
                {graph && (
                  <Graph
                    data={graph}
                    selected={node}
                    path={trail ?? detail?.path ?? []}
                    select={select}
                    chooseEdge={edge}
                    onPage={setOffset}
                    onReveal={() => detail && setOffset(detail.offset)}
                  />
                )}
                <div className="node-jump">
                  <label>
                    局面IDへ移動
                    <input
                      type="number"
                      min={1}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          select(Number(e.currentTarget.value));
                      }}
                      placeholder="IDを入力してEnter"
                    />
                  </label>
                  <button
                    disabled={!graph}
                    onClick={() => graph && select(graph.root)}
                  >
                    初期局面へ
                  </button>
                </div>
              </div>
              <aside className="detail-area">
                {frame && (
                  <>
                    <Viewport frame={frame} replaying={!!replay} />
                    <div className="playback">
                      <button
                        disabled={
                          !!busy ||
                          !detail ||
                          (trail ?? detail.path).length === 0
                        }
                        onClick={play}
                      >
                        選択経路を再生
                      </button>
                      {replay && (
                        <>
                          <button onClick={() => setPlaying(!playing)}>
                            {playing ? "一時停止" : "再生"}
                          </button>
                          <input
                            aria-label="再生時刻"
                            type="range"
                            min={replay.frames[0]?.t || 0}
                            max={replay.frames.at(-1)?.t || 0}
                            step={0.25}
                            value={time}
                            onChange={(e) => {
                              setPlaying(false);
                              setTime(Number(e.target.value));
                            }}
                          />
                          <output>{time.toFixed(1)}秒</output>
                        </>
                      )}
                    </div>
                  </>
                )}
                {detail && (
                  <Inspector
                    key={id + "/" + detail.id}
                    detail={detail}
                    busy={!!busy}
                    onStep={step}
                    onEdge={edge}
                    onExpand={() =>
                      perform(async () => {
                        await api(`searches/${id}/start`, {
                          budget,
                          node: detail.id,
                        });
                      })
                    }
                  />
                )}
              </aside>
            </main>
          ) : tab === "evaluation" ? (
            <main>
              <Evaluation
                search={search}
                baseline={searches.find((s) => s.id === baseline) || null}
                model={model}
                onNode={(r, n) => {
                  switchRun(r);
                  setNode(n);
                  setTab("graph");
                }}
              />
            </main>
          ) : (
            <main className="model-document">
              <h2>モデルと探索範囲</h2>
              <p>
                {competitionName}の作戦検討用です。{ruleAssumption}。
              </p>
              <p>用語は手元の日本語参考訳（非公式）に合わせています。</p>
              <h3>競技と探索の用語</h3>
              <dl>
                {glossary.map(([term, description]) => (
                  <div key={term}>
                    <dt>
                      <b>{term}</b>
                    </dt>
                    <dd>{description}</dd>
                  </div>
                ))}
              </dl>
              <p>
                モデル：{model.version}
                。候補探索と、詳細な行動単位の全探索を別に実行できます。
              </p>
              <ul>
                {model.scope.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <h3>結果の読み方</h3>
              <p>
                ノードは局面、エッジは双方の行動と競合結果です。同じ局面への経路は合流しますが、入る遷移は保持します。グラフは100局面ずつ表示し、範囲外への遷移は局面詳細から移動できます。
              </p>
              <p>
                未探索は到達不能や0勝ではありません。同じ計算上限でも、構成ごとの網羅率は一致しません。途中の分布は発見済みの範囲です。
              </p>
              <p>
                勝敗割合は展開の集計であり、実大会の勝率ではありません。勝利確率の保証値は探索完了時だけ、相手の同時選択と不利な競合を含めて計算します。
              </p>
              <h3>適用した条件</h3>
              <pre>{JSON.stringify(search.config, null, 2)}</pre>
            </main>
          )}
          {replay && tab === "graph" && (
            <details className="timeline">
              <summary>選択経路の動作履歴 {replay.events.length}件</summary>
              <table>
                <thead>
                  <tr>
                    <th>秒</th>
                    <th>機体</th>
                    <th>段階</th>
                    <th>行動</th>
                  </tr>
                </thead>
                <tbody>
                  {replay.events.map((e, i) => (
                    <tr key={i}>
                      <td>
                        <button
                          onClick={() => {
                            setTime(e.t);
                            setPlaying(false);
                          }}
                        >
                          {e.t}
                        </button>
                      </td>
                      <td>{robotNames[e.robot]}</td>
                      <td>{phaseNames[e.phase] || e.phase}</td>
                      <td>{actionName(e.action)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </>
      )}
      <footer className="app-footer">
        計算・保存はこのPCで実行。画面を閉じても探索は継続します。
      </footer>
    </div>
  );
}
