import { useRef, type ReactNode } from "react";
import {
  layout,
  useLayout,
  findArea,
  leaves,
  type AreaLeaf,
  type AreaNode,
  type AreaSplit,
} from "../app/layout";
import { ui, useUI, type MenuItem } from "../app/store";
import { getPref } from "../app/prefs";
import { allEditors, getEditor } from "../editors/registry";
import { Icon } from "./icons";
import { run } from "../app/commands";
import { EditorHeader } from "./EditorHeader";

function Splitter({ split, index }: { split: AreaSplit; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const row = split.dir === "row";
  return (
    <div
      ref={ref}
      className={`splitter ${row ? "v" : "h"}`}
      role="separator"
      aria-orientation={row ? "vertical" : "horizontal"}
      tabIndex={0}
      title="ドラッグで大きさを変更・ダブルクリックで均等"
      onDoubleClick={() => {
        const sizes = [...split.sizes],
          pair = (sizes[index] + sizes[index + 1]) / 2;
        sizes[index] = sizes[index + 1] = pair;
        layout.resize(split.id, sizes);
      }}
      onKeyDown={(e) => {
        const d = (row ? { ArrowLeft: -2, ArrowRight: 2 } : { ArrowUp: -2, ArrowDown: 2 })[e.key as "ArrowLeft"];
        if (!d) return;
        e.preventDefault();
        const sizes = [...split.sizes];
        if (sizes[index] + d < 5 || sizes[index + 1] - d < 5) return;
        sizes[index] += d;
        sizes[index + 1] -= d;
        layout.resize(split.id, sizes);
      }}
      onPointerDown={(e) => {
        const parent = ref.current!.parentElement!;
        const rect = parent.getBoundingClientRect();
        const total = row ? rect.width : rect.height;
        const start = row ? e.clientX : e.clientY;
        const sizes = [...split.sizes];
        const a = sizes[index],
          b = sizes[index + 1];
        ref.current!.setPointerCapture(e.pointerId);
        const move = (ev: PointerEvent) => {
          const d = (((row ? ev.clientX : ev.clientY) - start) / total) * 100;
          const na = Math.max(4, Math.min(a + b - 4, a + d));
          const next = [...sizes];
          next[index] = na;
          next[index + 1] = a + b - na;
          layout.resize(split.id, next);
        };
        const up = () => {
          ref.current?.removeEventListener("pointermove", move);
          ref.current?.removeEventListener("pointerup", up);
        };
        ref.current!.addEventListener("pointermove", move);
        ref.current!.addEventListener("pointerup", up);
      }}
    />
  );
}

export function areaMenu(area: AreaLeaf): MenuItem[] {
  const groups = new Map<string, MenuItem[]>();
  for (const ed of allEditors()) {
    const list = groups.get(ed.group) ?? [];
    list.push({
      label: ed.title,
      checked: ed.type === area.editor,
      run: () => layout.setEditor(area.id, ed.type),
    });
    groups.set(ed.group, list);
  }
  return [
    ...[...groups].map(([g, items]) => ({ label: g, submenu: items })),
    { separator: true },
    ...(area.tabs && area.tabs.length > 1 ? [{ label: "このタブを隣に分離", run: () => layout.detachTab(area.id) }] : []),
    { command: "area.splitRow", args: area.id },
    { command: "area.splitCol", args: area.id },
    { command: "area.maximize", args: area.id },
    { command: "area.close", args: area.id },
  ];
}

function Area({ area, compactActive }: { area: AreaLeaf; compactActive: string }) {
  const def = getEditor(area.editor);
  const active = useUI((s) => s.activeArea === area.id);
  const maximized = useLayout((s) => s.maximized === area.id);
  const focus = () => {
    if (useUI.getState().activeArea !== area.id)
      useUI.setState({ activeArea: area.id, activeEditor: area.editor });
  };
  return (
    <section
      className={`area${active ? " active" : ""}${maximized ? " maximized" : ""}`}
      data-editor={area.editor}
      data-compact-active={area.id === compactActive}
      aria-label={def?.title ?? area.editor}
      onPointerEnter={() => getPref<boolean>("ui.hoverFocus") && focus()}
      onPointerDownCapture={focus}
      onFocusCapture={focus}
    >
      {area.tabs && <div className="dock-title"><div className="dock-tabs" role="tablist" aria-label="この領域の表示">
        {area.tabs.map((editor, index) => <button key={editor} role="tab"
          id={`${area.id}-tab-${editor}`} aria-controls={`${area.id}-panel`}
          aria-selected={area.editor === editor} tabIndex={area.editor === editor ? 0 : -1}
          onClick={() => layout.setEditor(area.id, editor)}
          onKeyDown={e => {
            const offset = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
            if (!offset && e.key !== "Home" && e.key !== "End") return;
            e.preventDefault();
            const next = e.key === "Home" ? 0 : e.key === "End" ? area.tabs!.length - 1 : (index + offset + area.tabs!.length) % area.tabs!.length;
            layout.setEditor(area.id, area.tabs![next]);
            document.getElementById(`${area.id}-tab-${area.tabs![next]}`)?.focus();
          }}>{getEditor(editor)?.title ?? editor}</button>)}
      </div><button className="tool icon-only" title="領域の配置と種類" aria-haspopup="menu" onClick={e => {
          const r = e.currentTarget.getBoundingClientRect();
          useUI.setState({ menu: { x: r.left, y: r.bottom + 2, items: areaMenu(area) } });
        }}><Icon name="chevron" size={12} /></button>
        <button className="tool icon-only area-max" title={maximized ? "元に戻す (Ctrl+Space)" : "最大化 (Ctrl+Space)"} aria-pressed={maximized} onClick={() => layout.toggleMaximize(area.id)}><Icon name="maximize" /></button></div>}
      {(!area.tabs || def?.Header) && <EditorHeader
        className="area-header"
        onDoubleClick={(e) => {
          if (e.target === e.currentTarget) layout.toggleMaximize(area.id);
        }}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) ui.contextMenu(e, areaMenu(area), def?.title);
        }}
      >
        {!area.tabs && <>
        <button
          className="area-type"
          title="エディタの種類を変更"
          aria-haspopup="menu"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            useUI.setState({ menu: { x: r.left, y: r.bottom + 2, items: areaMenu(area) } });
          }}
        >
          {def?.title ?? area.editor}
          <Icon name="chevron" size={12} />
        </button>
        </>}

        {def?.Header && <def.Header area={area} />}
        {!area.tabs && <>
        <span className="area-spacer" />
        <button
          className="tool icon-only area-max"
          title={maximized ? "元に戻す (Ctrl+Space)" : "最大化 (Ctrl+Space)"}
          aria-pressed={maximized}
          onClick={() => layout.toggleMaximize(area.id)}
        >
          <Icon name="maximize" />
        </button>
        </>}
      </EditorHeader>}
      <div className="area-body" id={`${area.id}-panel`} role={area.tabs ? "tabpanel" : undefined} aria-labelledby={area.tabs ? `${area.id}-tab-${area.editor}` : undefined}>
        {def ? <def.Component key={area.editor} area={area} /> : <p className="empty">不明なエディタ</p>}
      </div>
    </section>
  );
}

function Node({ node, compactActive }: { node: AreaNode; compactActive: string }): ReactNode {
  if (node.kind === "area") return <Area key={node.id} area={node} compactActive={compactActive} />;
  const parts: ReactNode[] = [];
  node.children.forEach((c, i) => {
    if (i) parts.push(<Splitter key={`s${c.id}`} split={node} index={i - 1} />);
    parts.push(
      <div key={c.id} className="dock-cell" style={{ flexBasis: 0, flexGrow: node.sizes[i] }}>
        <Node node={c} compactActive={compactActive} />
      </div>,
    );
  });
  return <div className={`dock-split dir-${node.dir}`}>{parts}</div>;
}

export function Dock({ workspace }: { workspace: string }) {
  const w = useLayout((s) => s.workspaces.find((x) => x.id === workspace));
  const maximized = useLayout((s) => (s.active === workspace ? s.maximized : null));
  const activeArea = useUI(s => s.activeArea);
  if (!w) return null;
  // The maximized area is lifted over the others so no editor remounts.
  const max = maximized ? findArea(w.root, maximized) : null;
  const areas = leaves(w.root);
  const compactActive = max?.id ?? areas.find(a => a.id === activeArea)?.id ?? areas[0].id;
  return (
    <div className={`dock${max ? " has-max" : ""}`}>
      <nav className="compact-area-tabs" aria-label="表示する領域">
        {areas.map((area, i) => <button key={area.id} aria-current={compactActive === area.id ? "true" : undefined}
          onClick={() => run("area.activate", { id: area.id, editor: area.editor })}>
          {getEditor(area.editor)?.title ?? area.editor}{areas.filter(a => a.editor === area.editor).length > 1 ? ` ${i + 1}` : ""}
        </button>)}
      </nav>
      <Node node={w.root} compactActive={compactActive} />
    </div>
  );
}
