import { useEffect, useMemo, useState } from "react";
import type { Study } from "../study/state";
import { activeCondition } from "../study/state";
import { runKey } from "../execution/identity";
import type { ResultSummary, Job, Priority } from "../execution/types";
import { download, csv } from "../ui/files";
export type Pair = { red: string; blue: string };
export function Comparison({
  study,
  results,
  jobs,
  selected,
  opponent,
  priority,
  onPriority,
  onSelect,
  baseline,
  onBaseline,
  onRun,
  busy,
}: {
  study: Study;
  results: Record<string, ResultSummary>;
  jobs: Job[];
  selected: string;
  opponent: string;
  priority: Priority;
  onPriority: (v: Priority) => void;
  onSelect: (p: string, o: string) => void;
  baseline: string;
  onBaseline: (id: string) => void;
  onRun: (pairs: Pair[], force?: boolean) => void;
  busy: boolean;
}) {
  const [query, setQuery] = useState(""),
    [metric, setMetric] = useState("margin"),
    [sort, setSort] = useState("list"),
    [chosen, setChosen] = useState<Pair[]>([]),
    [context, setContext] = useState(false),
    [copyMessage, setCopyMessage] = useState(""),
    [rowPage, setRowPage] = useState(0),
    [columnPage, setColumnPage] = useState(0);
  const c = activeCondition(study),
    base = study.policies.find((p) => p.id === baseline);
  const status = useMemo(
    () => new Map(jobs.map((j) => [j.key, j.status])),
    [jobs],
  );
  const keys = useMemo(
    () =>
      new Map(
        study.policies.flatMap((red) =>
          study.opponents.map(
            (blue) =>
              [
                JSON.stringify([red.id, blue.id]),
                runKey({
                  config: c.config,
                  conditionName: c.name,
                  red,
                  blue,
                  priority,
                }),
              ] as const,
          ),
        ),
      ),
    [c, study.policies, study.opponents, priority],
  );
  const result = (red: string, blue: string) => {
    const key = keys.get(JSON.stringify([red, blue]));
    return key ? { summary: results[key], status: status.get(key) } : undefined;
  };
  const reason = (red: string, blue: string) => {
    const r = result(red, blue);
    if (r?.status === "failed") return "失敗";
    if (!r?.summary)
      return r?.status === "running"
        ? "計算中"
        : r?.status === "queued"
          ? "待機"
          : "未計算";
    if (metric === "change") {
      if (!base) return "基準未指定";
      if (!result(base.id, blue)?.summary) return "基準未計算";
    }
    return "";
  };
  const value = (red: string, blue: string) => {
    const s = result(red, blue)?.summary;
    if (!s) return null;
    if (metric === "red") return s.scores[0];
    if (metric === "blue") return s.scores[1];
    const margin = s.scores[0] - s.scores[1];
    if (metric !== "change") return margin;
    const b = base && result(base.id, blue)?.summary;
    return b ? margin - (b.scores[0] - b.scores[1]) : null;
  };
  const rows = study.policies
    .filter((p) =>
      p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "ja")
        : sort === "score"
          ? (value(b.id, opponent) ?? -Infinity) -
            (value(a.id, opponent) ?? -Infinity)
          : 0,
    );
  const rowIndex = Math.min(
      rowPage,
      Math.max(0, Math.ceil(rows.length / 25) - 1),
    ),
    columnIndex = Math.min(
      columnPage,
      Math.max(0, Math.ceil(study.opponents.length / 10) - 1),
    );
  const visibleRows = rows.slice(rowIndex * 25, rowIndex * 25 + 25),
    columns = study.opponents.slice(columnIndex * 10, columnIndex * 10 + 10);
  useEffect(() => {
    setColumnPage(
      Math.floor(
        Math.max(
          0,
          study.opponents.findIndex((o) => o.id === opponent),
        ) / 10,
      ),
    );
  }, [opponent, study.opponents]);
  const validChosen = chosen.filter(
    (pair) =>
      study.policies.some((p) => p.id === pair.red) &&
      study.opponents.some((p) => p.id === pair.blue),
  );
  const names = {
    margin: "得点差",
    red: "自分の得点",
    blue: "相手の得点",
    change: "基準からの変化",
  };
  const exportRows = () => [
    ["条件", "作戦", "相手", "優先側", names[metric as keyof typeof names]],
    ...rows.flatMap((p) =>
      study.opponents.map((o) => [
        c.name,
        p.name,
        o.name,
        priority === "red" ? "赤" : "青",
        value(p.id, o.id) ?? reason(p.id, o.id),
      ]),
    ),
  ];
  return (
    <section className="comparison" aria-label="作戦の比較">
      <div className="toolbar comparison-filter">
        <input
          aria-label="作戦を検索"
          placeholder="作戦を検索"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setRowPage(0);
          }}
        />
        <select
          aria-label="表示指標"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
        >
          {Object.entries(names).map(([v, n]) => (
            <option key={v} value={v} disabled={v === "change" && !base}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="comparison-tools">
        <label>
          競合
          <select
            value={priority}
            onChange={(e) => onPriority(e.target.value as Priority)}
          >
            <option value="red">赤優先</option>
            <option value="blue">青優先</option>
          </select>
        </label>
        <details>
          <summary>表の設定</summary>
          <div className="toolbar">
            <label>
              基準
              <select
                value={baseline}
                onChange={(e) => onBaseline(e.target.value)}
              >
                <option value="">指定なし</option>
                {study.policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              並び順
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="list">登録順</option>
                <option value="name">名前順</option>
                <option value="score">選択した相手の得点順</option>
              </select>
            </label>
            <button
              onClick={() =>
                download(
                  "作戦比較.csv",
                  csv(exportRows()),
                  "text/csv;charset=utf-8",
                )
              }
            >
              表をCSVに保存
            </button>
          </div>
        </details>
      </div>
      {(rows.length > 25 || study.opponents.length > 10) && (
        <div className="toolbar table-pages">
          <span>
            作戦 {rows.length ? rowIndex * 25 + 1 : 0}–
            {Math.min(rows.length, (rowIndex + 1) * 25)} / {rows.length}
          </span>
          <button disabled={!rowIndex} onClick={() => setRowPage(rowIndex - 1)}>
            前の作戦
          </button>
          <button
            disabled={(rowIndex + 1) * 25 >= rows.length}
            onClick={() => setRowPage(rowIndex + 1)}
          >
            次の作戦
          </button>
          <span>
            相手 {columnIndex * 10 + 1}–
            {Math.min(study.opponents.length, (columnIndex + 1) * 10)}
          </span>
          <button
            disabled={!columnIndex}
            onClick={() => setColumnPage(columnIndex - 1)}
          >
            前の相手
          </button>
          <button
            disabled={(columnIndex + 1) * 10 >= study.opponents.length}
            onClick={() => setColumnPage(columnIndex + 1)}
          >
            次の相手
          </button>
        </div>
      )}
      <p className="mobile-hint">横にスクロールして他の相手を見る</p>
      <div className="table-scroll" tabIndex={0} aria-label="作戦比較表">
        <table className="comparison-table">
          <caption>
            {names[metric as keyof typeof names]}
            。セルを選ぶと試合を表示します。
          </caption>
          <thead>
            <tr>
              <th scope="col">自分の作戦</th>
              {columns.map((o) => (
                <th scope="col" key={o.id}>
                  {o.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((p) => (
              <tr
                key={p.id}
                className={p.id === selected ? "selected-row" : ""}
              >
                <th scope="row">
                  <button onClick={() => onSelect(p.id, opponent)}>
                    {p.name}
                    {baseline === p.id ? "（基準）" : ""}
                  </button>
                </th>
                {columns.map((o) => {
                  const v = value(p.id, o.id),
                    jobStatus = result(p.id, o.id)?.status,
                    previousStatus =
                      v !== null && jobStatus && jobStatus !== "completed"
                        ? {
                            queued: "再計算待機",
                            running: "再計算中",
                            failed: "再計算失敗",
                          }[jobStatus]
                        : "",
                    included = validChosen.some(
                      (x) => x.red === p.id && x.blue === o.id,
                    );
                  return (
                    <td
                      key={o.id}
                      className={included ? "execution-selected" : ""}
                    >
                      <button
                        className="score-cell"
                        aria-pressed={selected === p.id && opponent === o.id}
                        aria-label={`${p.name} 対 ${o.name}・${v === null ? reason(p.id, o.id) : `${names[metric as keyof typeof names]} ${v}`}${previousStatus ? `・前回結果・${previousStatus}` : ""}`}
                        onClick={() => onSelect(p.id, o.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          onSelect(p.id, o.id);
                          setContext(true);
                        }}
                      >
                        {v === null
                          ? reason(p.id, o.id) === "未計算"
                            ? "—"
                            : reason(p.id, o.id)
                          : `${v > 0 && ["margin", "change"].includes(metric) ? "+" : ""}${v}`}
                        {previousStatus && (
                          <small>前回結果 · {previousStatus}</small>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p>
          該当する作戦がありません。
          <button onClick={() => setQuery("")}>検索を解除</button>
        </p>
      )}
      <details
        open={context}
        onToggle={(e) => setContext(e.currentTarget.open)}
      >
        <summary>選択した試合の操作</summary>
        <p>
          {study.policies.find((p) => p.id === selected)?.name} 対{" "}
          {study.opponents.find((p) => p.id === opponent)?.name}
        </p>
        <div className="toolbar">
          <button onClick={() => onSelect(selected, opponent)}>
            この試合を見る
          </button>
          <button onClick={() => onBaseline(selected)}>基準にする</button>
          <button
            onClick={() =>
              setChosen(
                study.opponents.map((o) => ({ red: selected, blue: o.id })),
              )
            }
          >
            この作戦の行を選ぶ
          </button>
          <button
            onClick={() =>
              setChosen(
                study.policies.map((p) => ({ red: p.id, blue: opponent })),
              )
            }
          >
            この相手の列を選ぶ
          </button>
          <button
            disabled={busy}
            onClick={() => onRun([{ red: selected, blue: opponent }], true)}
          >
            この対戦を再計算
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  csv([
                    exportRows()[0],
                    [
                      c.name,
                      study.policies.find((p) => p.id === selected)?.name,
                      study.opponents.find((p) => p.id === opponent)?.name,
                      priority,
                      value(selected, opponent) ?? reason(selected, opponent),
                    ],
                  ]),
                );
                setCopyMessage("コピーしました。");
              } catch {
                setCopyMessage("コピーできません。表をCSVに保存してください。");
              }
            }}
          >
            結果をコピー
          </button>
        </div>
        <p role="status">{copyMessage}</p>
      </details>
      {!!validChosen.length && (
        <div className="toolbar">
          <span>{validChosen.length * 2}試合を選択（両優先側）</span>
          <button disabled={busy} onClick={() => onRun(validChosen)}>
            選択した試合を計算
          </button>
          <button onClick={() => setChosen([])}>選択を解除</button>
        </div>
      )}
      <p className="table-note">
        「—」は未計算。得点差は自分 − 相手。検索で実行対象は変わりません。
      </p>
      <details>
        <summary>比較条件について</summary>
        <p>
          全作戦を同じ機体条件・同じ相手で比較します。赤優先・青優先は競合の影響を確認する2条件で、勝率や全展開の上下限ではありません。
        </p>
      </details>
    </section>
  );
}
