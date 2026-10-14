import { useEffect, useMemo, useRef, useState } from "react";
import {
  allCommands,
  chord,
  conflicts,
  formatKeys,
  isEnabled,
  keysFor,
  run,
  setKeys,
  useCommands,
} from "../app/commands";
import { PREF_DEFS, setPref, usePrefStore, type PrefDef } from "../app/prefs";
import { useSearch } from "../app/session";
import { ui, useUI } from "../app/store";
import { useWorkspaceData } from "../app/workspace";
import { Icon } from "./icons";

function Modal({
  label,
  children,
  wide,
  onClose,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    if (!ref.current?.contains(document.activeElement)) ref.current?.querySelector<HTMLElement>("input, select, button")?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("keydown", esc);
      prev?.focus?.();
    };
  }, []);
  return (
    <div
      className="modal-scrim"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={ref} className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

/** Subsequence match with a score that prefers word starts and contiguous runs. */
function fuzzy(q: string, text: string): number | null {
  if (!q) return 0;
  const t = text.toLowerCase(),
    s = q.toLowerCase();
  let ti = 0,
    score = 0,
    last = -2;
  for (const ch of s) {
    const i = t.indexOf(ch, ti);
    if (i < 0) return null;
    score += i === last + 1 ? 3 : i === 0 || " ・（".includes(t[i - 1]) ? 2 : 1;
    last = i;
    ti = i + 1;
  }
  return score - t.length / 100;
}

type Item = { id: string; label: string; hint?: string; group: string; keys?: string; run: () => void; disabled?: boolean };

function useGotoItems(q: string): Item[] {
  const search = useSearch();
  const ws = useWorkspaceData();
  return useMemo(() => {
    const items: Item[] = [];
    const t = q.trim();
    if (t === "?") {
      for (const [prefix, text] of [
        [">", "コマンドを実行"],
        ["#", "局面IDへ移動（例: #120）"],
        [":", "時刻へ移動（例: :73.5）"],
        ["@", "機体・スポット・物体を選択（例: @赤BR、@S6）"],
      ])
        items.push({ id: `help${prefix}`, label: `${prefix}  ${text}`, group: "ヘルプ", run: () => ui.open({ kind: "palette", mode: prefix === ">" ? "commands" : "goto" }) });
      return items;
    }
    if (t.startsWith("@")) {
      const w = t.slice(1).toLowerCase();
      const ents: [string, string][] = [
        ...["赤TR", "赤BR", "青TR", "青BR"].map((n, i): [string, string] => [n, `robot:${i}`]),
        ...Array.from({ length: 10 }, (_, i): [string, string] => [`S${i} 建設スポット`, `spot:${i}`]),
      ];
      for (const [label, ref] of ents)
        if (!w || label.toLowerCase().includes(w))
          items.push({ id: ref, label: `${label} を選択`, group: "選択", run: () => ui.select(ref as never) });
      const obj = w.match(/^(?:obj|物体)?\s*(\d+)$/);
      if (obj) items.push({ id: `obj${obj[1]}`, label: `物体 ${obj[1]} を選択`, group: "選択", run: () => ui.select(`obj:${obj[1]}`) });
      return items;
    }
    const num = t.replace(/^[nN#]/, "");
    if (/^\d+$/.test(num))
      items.push({ id: `node${num}`, label: `局面 N${num} へ移動`, group: "局面", run: () => run("nav.node", { node: Number(num) }) });
    const time = t.match(/^[:@]?(\d+(?:\.\d+)?)\s*(秒|s)?$/);
    if (time && (t.startsWith(":") || t.startsWith("@") || time[2]))
      items.push({
        id: `time${time[1]}`,
        label: `${time[1]}秒へ再生位置を移動`,
        group: "時刻",
        run: () => ui.patchPlayback({ time: Number(time[1]), playing: false }),
      });
    for (const m of ws?.markers ?? [])
      items.push({ id: `m${m.id}`, label: `マーカー ${m.name}`, hint: `${m.t}秒`, group: "マーカー", run: () => ui.patchPlayback({ time: m.t, playing: false }) });
    for (const r of search?.discovery?.runs ?? [])
      for (const c of r.candidates) {
        items.push({
          id: `c${c.id}`,
          label: `候補 C${r.run} ${c.baseline.strategy}`,
          hint: `相手待機 ${c.baseline.scores[0]} 対 ${c.baseline.scores[1]}`,
          group: "候補",
          run: () => run("nav.node", { node: c.baseline.node, path: c.baseline.path }),
        });
        c.responses.forEach((resp, i) =>
          items.push({
            id: `c${c.id}r${i}`,
            label: `候補 C${r.run} ${c.baseline.strategy} 対応${i + 1}`,
            hint: `${resp.scores[0]} 対 ${resp.scores[1]}${resp.opponent ? ` · ${resp.opponent}` : ""}`,
            group: "候補",
            run: () => run("nav.node", { node: resp.node, path: resp.path }),
          }),
        );
      }
    for (const er of search?.evaluation?.runs ?? [])
      for (const s of er.strategies)
        items.push({
          id: `s${er.run}${s.id}`,
          label: `作戦 ${s.id}`,
          hint: `構成 C${er.run} · 展開 ${s.groups}`,
          group: "評価",
          run: () => run("nav.node", { node: s.node }),
        });
    return items;
  }, [q, search, ws]);
}

function Palette({ mode }: { mode: "commands" | "goto" }) {
  const [q, setQ] = useState(mode === "commands" ? ">" : "");
  const [index, setIndex] = useState(0);
  const recent = useCommands((s) => s.recent);
  useCommands((s) => s.version);
  const commandMode = q.startsWith(">");
  const query = commandMode ? q.slice(1).trim() : q.trim();
  const goto = useGotoItems(commandMode ? "" : query);
  const items = useMemo(() => {
    let list: Item[];
    if (commandMode) {
      list = allCommands()
        .filter((c) => !c.hidden)
        .map((c) => ({
          id: c.id,
          label: `${c.category}: ${c.title}`,
          hint: c.detail,
          group: recent.includes(c.id) ? "最近使用" : c.category,
          keys: keysFor(c.id).map(formatKeys).join(" / "),
          disabled: !isEnabled(c.id),
          run: () => run(c.id),
        }));
    } else list = goto;
    const scored = list
      .map((it) => ({ it, s: fuzzy(/^[@?#:]/.test(query) ? "" : query, it.label + " " + (it.hint ?? "")) }))
      .filter((x) => x.s !== null || ["局面", "時刻", "選択", "ヘルプ"].includes(x.it.group));
    if (!query && commandMode)
      scored.sort((a, b) => {
        const ra = recent.indexOf(a.it.id),
          rb = recent.indexOf(b.it.id);
        return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
      });
    else scored.sort((a, b) => (b.s ?? 0) - (a.s ?? 0));
    return scored.map((x) => x.it).slice(0, 80);
  }, [commandMode, query, goto, recent]);
  useEffect(() => setIndex(0), [q]);
  const choose = (it: Item | undefined) => {
    if (!it || it.disabled) return;
    ui.open(null);
    it.run();
  };
  return (
    <Modal label="コマンドと移動" onClose={() => ui.open(null)}>
      <div className="palette">
        <input
          autoFocus
          className="palette-input"
          value={q}
          placeholder="候補・マーカーを検索。> コマンド  # 局面  : 時刻  @ 選択  ? 一覧"
          aria-label="検索"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setIndex((i) => Math.min(items.length - 1, i + 1));
            else if (e.key === "ArrowUp") setIndex((i) => Math.max(0, i - 1));
            else if (e.key === "Enter") choose(items[index]);
            else return;
            e.preventDefault();
          }}
        />
        <ul className="palette-list" role="listbox">
          {items.map((it, i) => (
            <li
              key={it.id}
              role="option"
              aria-selected={i === index}
              aria-disabled={it.disabled}
              className={`palette-item${i === index ? " focus" : ""}`}
              onPointerEnter={() => setIndex(i)}
              onClick={() => choose(it)}
            >
              <span className="palette-label">{it.label}</span>
              {it.hint && <span className="palette-hint">{it.hint}</span>}
              {it.keys && <kbd>{it.keys}</kbd>}
            </li>
          ))}
          {!items.length && <li className="palette-empty">一致する項目がありません</li>}
        </ul>
        <p className="palette-foot">
          {commandMode ? "Enterで実行 · 先頭の > を消すと移動" : "# 局面 · : 時刻 · @ 選択 · > コマンド · ? 一覧"}
        </p>
      </div>
    </Modal>
  );
}

function PrefRow({ def }: { def: PrefDef }) {
  const raw = usePrefStore((s) => s.values[def.id]);
  const value = raw === undefined ? def.default : raw;
  const modified = raw !== undefined;
  return (
    <div className={`pref-row${modified ? " modified" : ""}`}>
      <label htmlFor={`pref-${def.id}`}>
        <span className="pref-label">{def.label}</span>
        {def.description && <small>{def.description}</small>}
      </label>
      <div className="pref-control">
        {def.type === "boolean" ? (
          <input id={`pref-${def.id}`} type="checkbox" checked={!!value} onChange={(e) => setPref(def.id, e.target.checked)} />
        ) : def.type === "number" ? (
          <input
            id={`pref-${def.id}`}
            type="number"
            min={def.min}
            max={def.max}
            step={def.step ?? 1}
            value={Number(value)}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) setPref(def.id, Math.max(def.min, Math.min(def.max, n)));
            }}
          />
        ) : (
          <select id={`pref-${def.id}`} value={String(value)} onChange={(e) => setPref(def.id, e.target.value)}>
            {def.options.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        )}
        {def.type === "number" && def.unit}
        <button className="tool icon-only" title="既定値に戻す" disabled={!modified} onClick={() => setPref(def.id, def.default)}>
          <Icon name="back" size={12} />
        </button>
      </div>
    </div>
  );
}

function KeymapEditor({ filter }: { filter: string }) {
  useCommands((s) => s.version);
  const overrides = useCommands((s) => s.overrides);
  const [recording, setRecording] = useState<string | null>(null);
  const clash = conflicts();
  const clashed = new Set([...clash.values()].flat());
  const list = allCommands()
    .filter((c) => fuzzy(filter, `${c.category} ${c.title} ${keysFor(c.id).join(" ")}`) !== null)
    .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
  return (
    <table className="keymap">
      <thead>
        <tr>
          <th>分類</th>
          <th>コマンド</th>
          <th>キー</th>
          <th>対象</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {list.map((c) => (
          <tr key={c.id} className={clashed.has(c.id) ? "conflict" : ""}>
            <td>{c.category}</td>
            <td>{c.title}</td>
            <td>
              {recording === c.id ? (
                <input
                  autoFocus
                  className="key-record"
                  readOnly
                  value="キーを押す（Escで取消）"
                  onKeyDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.key === "Escape") return setRecording(null);
                    const k = chord(e.nativeEvent);
                    if (["Ctrl", "Alt", "Shift"].includes(k)) return;
                    setKeys(c.id, [k]);
                    setRecording(null);
                  }}
                  onBlur={() => setRecording(null)}
                />
              ) : (
                <button className="key-cell" onClick={() => setRecording(c.id)} title="クリックしてキーを記録">
                  {keysFor(c.id).map((k) => (
                    <kbd key={k}>{formatKeys(k)}</kbd>
                  ))}
                  {!keysFor(c.id).length && <span className="muted">なし</span>}
                </button>
              )}
              {clashed.has(c.id) && <small className="warn"> 重複</small>}
            </td>
            <td>{c.scope ? c.scope : "全体"}</td>
            <td>
              <button className="tool" disabled={!(c.id in overrides)} onClick={() => setKeys(c.id, null)}>
                既定に戻す
              </button>
              <button className="tool" disabled={!keysFor(c.id).length} onClick={() => setKeys(c.id, [])}>
                解除
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Preferences({ tab: initial }: { tab?: string }) {
  const categories = [...new Set(PREF_DEFS.map((d) => d.category)), "キーボード"];
  const [tab, setTab] = useState(initial === "keymap" ? "キーボード" : categories[0]);
  const [filter, setFilter] = useState("");
  const values = usePrefStore((s) => s.values);
  const shown = filter
    ? PREF_DEFS.filter((d) => fuzzy(filter.replace(/^@modified\s*/, ""), d.label + (d.description ?? "")) !== null && (!filter.startsWith("@modified") || d.id in values))
    : PREF_DEFS.filter((d) => d.category === tab);
  return (
    <Modal label="設定" wide onClose={() => ui.open(null)}>
      <div className="prefs">
        <div className="prefs-head">
          <h2>設定</h2>
          <input
            autoFocus
            className="prefs-search"
            placeholder="設定を検索（@modified で変更済みのみ）"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="設定を検索"
          />
          <button className="tool icon-only" title="閉じる" onClick={() => ui.open(null)}>
            <Icon name="close" />
          </button>
        </div>
        <div className="prefs-body">
          <nav className="prefs-nav">
            {categories.map((c) => (
              <button key={c} aria-current={tab === c && !filter ? "page" : undefined} onClick={() => (setTab(c), setFilter(""))}>
                {c}
                {c !== "キーボード" && PREF_DEFS.some((d) => d.category === c && d.id in values) && <span className="dot-mark" title="変更あり" />}
              </button>
            ))}
          </nav>
          <div className="prefs-content">
            {tab === "キーボード" && !filter.startsWith("@") ? (
              <KeymapEditor filter={filter} />
            ) : (
              <>
                {shown.map((d) => (
                  <PrefRow key={d.id} def={d} />
                ))}
                {!shown.length && <p className="muted">一致する設定がありません</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Shortcuts() {
  useCommands((s) => s.version);
  const groups = new Map<string, { title: string; keys: string[] }[]>();
  for (const c of allCommands()) {
    const keys = keysFor(c.id);
    if (!keys.length || c.hidden) continue;
    const g = c.scope ? `${c.category}（${c.scope}）` : c.category;
    groups.set(g, [...(groups.get(g) ?? []), { title: c.title, keys }]);
  }
  return (
    <Modal label="ショートカット一覧" wide onClose={() => ui.open(null)}>
      <div className="shortcuts">
        <div className="prefs-head">
          <h2>ショートカット</h2>
          <button className="tool" onClick={() => ui.open({ kind: "prefs", tab: "keymap" })}>
            変更する
          </button>
          <button className="tool icon-only" title="閉じる" onClick={() => ui.open(null)}>
            <Icon name="close" />
          </button>
        </div>
        <div className="shortcut-grid">
          {[...groups].map(([g, list]) => (
            <section key={g}>
              <h3>{g}</h3>
              <dl>
                {list.map((x) => (
                  <div key={x.title}>
                    <dt>{x.title}</dt>
                    <dd>
                      {x.keys.map((k) => (
                        <kbd key={k}>{formatKeys(k)}</kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <p className="muted">領域ごとのキーは、ポインタがその領域にあるときに有効です。</p>
      </div>
    </Modal>
  );
}

function Prompt({ title, value, resolve }: { title: string; value: string; resolve: (v: string | null) => void }) {
  const [v, setV] = useState(value);
  const done = (r: string | null) => {
    ui.open(null);
    resolve(r);
  };
  return (
    <Modal label={title} onClose={() => done(null)}>
      <form
        className="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          done(v);
        }}
      >
        <label>
          {title}
          <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onFocus={(e) => e.target.select()} />
        </label>
        <div className="dialog-actions">
          <button type="button" className="tool" onClick={() => done(null)}>
            取消
          </button>
          <button type="submit" className="tool primary">
            決定
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Confirm({ title, body, danger, resolve }: { title: string; body?: string; danger?: boolean; resolve: (v: boolean) => void }) {
  const done = (r: boolean) => {
    ui.open(null);
    resolve(r);
  };
  return (
    <Modal label={title} onClose={() => done(false)}>
      <div className="dialog">
        <h2>{title}</h2>
        {body && <p>{body}</p>}
        <div className="dialog-actions">
          <button className="tool" autoFocus onClick={() => done(false)}>
            取消
          </button>
          <button className={`tool ${danger ? "danger" : "primary"}`} onClick={() => done(true)}>
            {danger ? "削除" : "実行"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Notices() {
  const notices = useUI((s) => s.notices);
  useEffect(() => {
    useUI.setState((s) => ({ notices: s.notices.map((n) => ({ ...n, read: true })) }));
  }, []);
  return (
    <Modal label="通知" onClose={() => ui.open(null)}>
      <div className="prefs-head">
        <h2>通知</h2>
        <span className="topbar-spacer" />
        <button className="tool" disabled={!notices.length} onClick={() => useUI.setState({ notices: [] })}>
          すべて消去
        </button>
        <button className="tool icon-only" title="閉じる" onClick={() => ui.open(null)}>
          <Icon name="close" />
        </button>
      </div>
      <ul className="notice-list">
        {[...notices].reverse().map((n) => (
          <li key={n.id} className={n.tone}>
            <time className="tabular muted">{new Date(n.at).toLocaleTimeString()}</time>
            <span>{n.text}</span>
          </li>
        ))}
        {!notices.length && <li className="muted">この画面を開いてからの通知はありません</li>}
      </ul>
    </Modal>
  );
}

function About() {
  return (
    <Modal label="このアプリについて" onClose={() => ui.open(null)}>
      <div className="dialog">
        <h2>作戦探索 · NHK学生ロボコン2027</h2>
        <p>
          機体能力と数値スペックの組合せから、行動・局面・試合展開を探索する。計算と保存はこのブラウザ内で行い、サーバーへは送信しない。
        </p>
        <p className="muted">保存形式 browser-2 · バックアップ形式 robocon-browser v2</p>
        <div className="dialog-actions">
          <button className="tool primary" autoFocus onClick={() => ui.open(null)}>
            閉じる
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function OverlayHost() {
  const o = useUI((s) => s.overlay);
  if (!o) return null;
  switch (o.kind) {
    case "palette":
      return <Palette mode={o.mode} />;
    case "prefs":
      return <Preferences tab={o.tab} />;
    case "shortcuts":
      return <Shortcuts />;
    case "prompt":
      return <Prompt {...o} />;
    case "confirm":
      return <Confirm {...o} />;
    case "about":
      return <About />;
    case "notices":
      return <Notices />;
  }
}

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`} role={t.tone === "error" ? "alert" : "status"}>
          <span>{t.text}</span>
          {t.action && (
            <button className="tool" onClick={() => run(t.action!.command, t.action!.args)}>
              {t.action.label}
            </button>
          )}
          <button className="tool icon-only" title="閉じる" onClick={() => ui.dismissToast(t.id)}>
            <Icon name="close" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
