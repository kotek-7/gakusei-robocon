import { IconButton } from "../editors/common/IconButton";
import { useEffect, useRef, useState } from "react";
import { useCommands } from "../app/commands";
import { useSearches } from "../app/data";
import { layout, leaves, useLayout } from "../app/layout";
import { useSearch } from "../app/session";
import { ui, useUI, type MenuItem } from "../app/store";
import { allEditors } from "../editors/registry";
import { Icon } from "./icons";
import { DropdownMenu } from "./Menu";
import { ReplayContext } from "./ReplayContext";
import { run, isEnabled } from "../app/commands";
import { getPref, setPref, usePref } from "../app/prefs";

const C = (command: string, args?: unknown): MenuItem => ({ command, args });
const SEP: MenuItem = { separator: true };

function menus(): [string, MenuItem[]][] {
  const searches = useSearches.getState().list;
  const active = useUI.getState().session.search;
  return [
    [
      "ファイル",
      [
        C("search.new"),
        {
          label: "探索を開く",
          submenu: searches.length
            ? searches.map((s) => ({
                label: s.name,
                checked: s.id === active,
                run: () => run("search.open", s.id),
              }))
            : [{ label: "保存済みの探索はありません", run: () => {}, disabled: true }],
        },
        SEP,
        C("search.import"),
        C("search.export"),
        C("search.exportConfig"),
        SEP,
        C("search.rename"),
        C("search.duplicate"),
        C("search.delete"),
        SEP,
        C("app.copyLink"),
      ],
    ],
    [
      "編集",
      [C("nav.back"), C("nav.forward"), SEP, C("select.clear"), SEP, C("app.prefs"), C("app.keymap")],
    ],
    [
      "表示",
      [
        C("view.theme"),
        C("view.statusBar"),
        SEP,
        C("view.zoomIn"),
        C("view.zoomOut"),
        C("view.zoomReset"),
        SEP,
        C("area.maximize"),
        C("view.zen"),
        SEP,
        C("view.notifications"),
        C("view.revealJobs"),
      ],
    ],
    [
      "移動",
      [C("nav.goto"), C("nav.root"), SEP, C("nav.back"), C("nav.forward")],
    ],
    [
      "再生",
      [
        C("play.toggle"),
        C("play.reverse"),
        SEP,
        C("play.stepBack"),
        C("play.stepFwd"),
        C("play.back1"),
        C("play.fwd1"),
        C("play.prevEvent"),
        C("play.nextEvent"),
        C("play.prevScore"),
        C("play.nextScore"),
        C("play.start"),
        C("play.end"),
        SEP,
        { label: "再生速度", submenu: [0.25, 0.5, 1, 2, 4, 8].map((s) => C(`play.speed${s}`)) },
        C("play.loop"),
        C("play.setIn"),
        C("play.setOut"),
        C("play.clearRange"),
        SEP,
        C("marker.add"),
        C("marker.prev"),
        C("marker.next"),
      ],
    ],
    [
      "探索",
      [
        C("job.discover"),
        C("job.exact"),
        C("job.exactHere"),
        C("job.evaluate"),
        C("job.pause"),
        SEP,
        C("candidate.openBest"),
        C("run.next"),
        SEP,
        C("compare.setA"),
        C("compare.setB"),
        C("compare.swap"),
        C("compare.open"),
      ],
    ],
    [
      "検討",
      [C("review.capture"), C("review.open"), SEP, C("compare.setA"), C("compare.setB"), C("compare.open")],
    ],
    ["解析", [C("view.intervalAnalysis"), C("play.setIn"), C("play.setOut"), C("play.clearRange"), SEP, C("play.prevScore"), C("play.nextScore"), C("review.capture")]],
    [
      "ウィンドウ",
      [
        ...useLayout.getState().workspaces.map((w, i) => ({
          label: w.name,
          checked: w.id === useLayout.getState().active,
          shortcut: i < 9 ? `Ctrl+${i + 1}` : undefined,
          run: () => layout.activate(w.id),
        })),
        SEP,
        {
          label: "アクティブな領域の表示",
          submenu: allEditors().map((e) => ({
            label: e.title,
            disabled: !useUI.getState().activeArea,
            run: () => layout.setEditor(useUI.getState().activeArea!, e.type),
          })),
        },
        C("area.splitRow"),
        C("area.splitCol"),
        C("area.close"),
        SEP,
        C("workspace.new"),
        C("workspace.duplicate"),
        C("workspace.rename"),
        C("workspace.remove"),
        C("workspace.reset"),
        C("workspace.resetAll"),
        SEP,
        C("layout.export"),
        C("layout.import"),
      ],
    ],
    ["ヘルプ", [C("docs.open"), SEP, C("app.palette"), C("app.shortcuts"), SEP, C("app.about")]],
  ];
}

function MenuBar() {
  const [open, setOpen] = useState<number | null>(null);
  const anchors = useRef(new Map<number, HTMLButtonElement>());
  useCommands((s) => s.version);
  const list = open === null ? null : menus();
  // F10 opens the menu bar, as in desktop applications; arrows move between menus.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "F10" && !useUI.getState().overlay) {
        e.preventDefault();
        setOpen((o) => (o === null ? 0 : null));
      } else if (open !== null && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const n = menus().length;
        setOpen((o) => ((o ?? 0) + (e.key === "ArrowRight" ? 1 : n - 1)) % n);
        e.preventDefault();
      } else if (open !== null && e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [open]);
  return (
    <nav className="menubar" aria-label="メニュー" onPointerLeave={() => {}}>
      {menus().map(([name], i) => (
        <div key={name} className="menubar-item">
          <button
            ref={(element) => { if (element) anchors.current.set(i, element); else anchors.current.delete(i); }}
            className={`menubar-button${open === i ? " open" : ""}`}
            aria-haspopup="menu"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
            onPointerEnter={() => open !== null && setOpen(i)}
          >
            {name}
          </button>
          {open === i && list && (
            <DropdownMenu anchor={anchors.current.get(i)!} items={list[i][1]} onClose={() => setOpen(null)} />
          )}
        </div>
      ))}
    </nav>
  );
}

function WorkspaceTabs() {
  const workspaces = useLayout((s) => s.workspaces);
  const active = useLayout((s) => s.active);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  return (
    <div className="workspace-tabs" role="tablist" aria-label="ワークスペース">
      {workspaces.map((w, i) => (
        <button
          key={w.id}
          role="tab"
          aria-selected={w.id === active}
          className={`workspace-tab${over === i && dragging !== w.id ? " drag-over" : ""}`}
          title={i < 9 ? `Ctrl+${i + 1}` : undefined}
          draggable
          onDragStart={(e) => {
            setDragging(w.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            if (!dragging) return;
            e.preventDefault();
            setOver(i);
          }}
          onDragEnd={() => {
            setDragging(null);
            setOver(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragging) layout.move(dragging, i);
            setDragging(null);
            setOver(null);
          }}
          onClick={() => layout.activate(w.id)}
          onDoubleClick={() => run("workspace.rename")}
          onContextMenu={(e) => {
            layout.activate(w.id);
            ui.contextMenu(e, [
              { command: "workspace.rename" },
              { command: "workspace.new" },
              { command: "workspace.duplicate" },
              { command: "workspace.reset" },
              { separator: true },
              { command: "workspace.remove" },
            ]);
          }}
        >
          {w.name}
        </button>
      ))}
      <IconButton icon="plus" label="新しいワークスペース" onClick={() => run("workspace.new")} />
    </div>
  );
}

function SearchControls() {
  const search = useSearch();
  const workspace = useLayout(s => s.workspaces.find(w => w.id === s.active));
  const maximized = useLayout(s => s.maximized);
  const areas = workspace ? leaves(workspace.root) : [];
  const jobsVisible = areas.some(a => a.editor === "jobs" && (!maximized || maximized === a.id));
  const editors = areas.flatMap(a => [a.editor, ...(a.tabs ?? [])]);
  const active = editors.includes("candidates") ? "discover" : editors.includes("evaluation") ? "evaluate" : editors.includes("graph") || editors.includes("jobs") ? "graph" : "";
  const busy = useUI((s) => s.busy);
  usePref("job.discoverySeconds");
  const runningJob = search?.status === "running" || search?.status === "evaluating" || !!search?.jobProgress && search.jobProgress.phase !== "finished";
  if (jobsVisible || !["discover", "evaluate", "graph"].includes(active)) return null;
  return (
    <div className="search-controls">
      {active === "discover" && <select
        aria-label="候補探索の時間"
        title="候補探索の時間（設定の既定値も変わります）"
        value={String(getPref("job.discoverySeconds"))}
        onChange={(e) => setPref("job.discoverySeconds", e.target.value)}
      >
        {[
          ["10", "10秒"],
          ["60", "1分"],
          ["300", "5分"],
          ["1800", "30分"],
          ["3600", "1時間"],
          ["21600", "6時間"],
          ["86400", "24時間"],
        ].map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>}
      {runningJob ? (
        <button className="tool danger" onClick={() => run("job.pause")} disabled={!isEnabled("job.pause")} title="計算を停止 (Ctrl+.)">
          <Icon name="stop" size={14} />
          {busy[`pause:${search?.id}`] ? "停止処理中" : "停止"}
        </button>
      ) : active === "evaluate" ? (
        <button className="tool primary" disabled={!isEnabled("job.evaluate")} onClick={() => run("job.evaluate")}>評価を計算</button>
      ) : active === "graph" ? (
        <button className="tool" onClick={() => run("view.revealJobs")}>計算と進捗</button>
      ) : (
        <button
          className="tool primary"
          onClick={() => run("job.discover")}
          disabled={!isEnabled("job.discover")}
          title="候補探索を開始・再開 (F5)"
        >
          <Icon name="play" size={14} />
          {search?.discovery ? "探索を続ける" : "候補を探す"}
        </button>
      )}
    </div>
  );
}

export function TopBar() {
  const search = useSearch();
  const list = useSearches(s => s.list);
  return (
    <><header className="topbar">
      <span className="app-mark" title="作戦探索 · NHK学生ロボコン2027">
        <svg width="18" height="18" viewBox="0 0 28 28" aria-hidden="true">
          <path d="M5 14H14M14 14L23 5M14 14L23 23" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <circle cx="5" cy="14" r="3" fill="currentColor" />
          <circle cx="23" cy="5" r="3" fill="currentColor" />
          <circle cx="23" cy="23" r="3" fill="currentColor" />
        </svg>
      </span>
      <MenuBar />
      <span className="topbar-spacer" />
      <div className="search-switcher">
        <select
        aria-label="開いている探索"
        value={search?.id ?? ""}
        onChange={(e) => run("search.open", e.target.value)}
      >
        {!search && <option value="">探索なし</option>}
        {list.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <ReplayContext />
      </div>
      <IconButton icon="search" label="コマンドを検索 (Ctrl+Shift+P)" onClick={() => run("app.palette")} />
      <IconButton icon="gear" label="設定 (Ctrl+,)" onClick={() => run("app.prefs")} />
    </header>
    <div className="workspace-bar"><WorkspaceTabs /><SearchControls /></div></>
  );
}
