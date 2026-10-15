import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  formatKeys,
  getCommand,
  isChecked,
  isEnabled,
  keysFor,
  run,
  useCommands,
} from "../app/commands";
import { ui, useUI, type MenuItem } from "../app/store";
import { Icon } from "./icons";

type Row = {
  label: string;
  disabled: boolean;
  checked: boolean | null;
  shortcut: string;
  submenu?: MenuItem[];
  act?: () => void;
};
function rowOf(item: MenuItem): Row | null {
  if ("separator" in item) return null;
  if ("submenu" in item)
    return { label: item.label, disabled: false, checked: null, shortcut: "", submenu: item.submenu };
  if ("command" in item) {
    const c = getCommand(item.command);
    return {
      label: item.label ?? c?.title ?? item.command,
      disabled: !isEnabled(item.command, item.args),
      checked: c?.checked ? isChecked(item.command, item.args) : null,
      shortcut: keysFor(item.command)[0] ? formatKeys(keysFor(item.command)[0]) : "",
      act: () => run(item.command, item.args),
    };
  }
  return {
    label: item.label,
    disabled: !!item.disabled,
    checked: item.checked ?? null,
    shortcut: item.shortcut ?? "",
    act: item.run,
  };
}

/** A vertical menu list with keyboard navigation and nested submenus. */
export function MenuList({
  items,
  onClose,
  autoFocus = true,
  onBack,
}: {
  items: MenuItem[];
  onClose: () => void;
  autoFocus?: boolean;
  onBack?: () => void;
}) {
  useCommands((s) => s.version);
  const [open, setOpen] = useState<number | null>(null);
  const [focus, setFocus] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const anchors = useRef(new Map<number, HTMLDivElement>());
  const [focusChild, setFocusChild] = useState(false);
  const rows = items.map(rowOf);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  const move = (d: number) => {
    let i = focus;
    for (let n = 0; n < rows.length; n++) {
      i = (i + d + rows.length) % rows.length;
      if (rows[i] && !rows[i]!.disabled) break;
    }
    setFocus(i);
  };
  return (
    <div
      className="menu-list"
      role="menu"
      tabIndex={-1}
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") move(1);
        else if (e.key === "ArrowUp") move(-1);
        else if (e.key === "ArrowRight" && rows[focus]?.submenu) {
          setFocusChild(true);
          setOpen(focus);
        }
        else if (e.key === "ArrowLeft" && onBack) onBack();
        else if (e.key === "Enter" && rows[focus]) {
          const r = rows[focus]!;
          if (r.submenu) { setFocusChild(true); setOpen(focus); }
          else if (!r.disabled) {
            onClose();
            r.act?.();
          }
        } else if (e.key === "Escape") onClose();
        else return;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {items.map((item, i) => {
        const r = rows[i];
        if (!r) return <div key={i} className="menu-sep" role="separator" />;
        return (
          <div
            key={i}
            className="menu-row-wrap"
            ref={(element) => { if (element) anchors.current.set(i, element); else anchors.current.delete(i); }}
            onPointerEnter={() => {
              setFocusChild(false);
              setFocus(i);
              setOpen(r.submenu ? i : null);
            }}
          >
            <button
              role={r.checked === null ? "menuitem" : "menuitemcheckbox"}
              aria-checked={r.checked ?? undefined}
              aria-haspopup={r.submenu ? "menu" : undefined}
              aria-expanded={r.submenu ? open === i : undefined}
              className={`menu-row${focus === i ? " focus" : ""}`}
              disabled={r.disabled}
              tabIndex={-1}
              onClick={() => {
                if (r.submenu) return setOpen(i);
                onClose();
                r.act?.();
              }}
            >
              <span className="menu-check">{r.checked ? <Icon name="check" size={12} /> : null}</span>
              <span className="menu-label">{r.label}</span>
              <span className="menu-key">{r.shortcut}</span>
              <span className="menu-sub">{r.submenu ? <Icon name="chevronRight" size={12} /> : null}</span>
            </button>
            {open === i && r.submenu && (
              <Submenu anchor={anchors.current.get(i)!}>
                <MenuList items={r.submenu} onClose={onClose} autoFocus={focusChild}
                  onBack={() => { setOpen(null); ref.current?.focus(); }} />
              </Submenu>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Keep menubar dropdowns outside the horizontally scrolling navigation. */
export function DropdownMenu({ anchor, items, onClose }: {
  anchor: HTMLElement;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0, maxHeight: 0 });
  useLayoutEffect(() => {
    const update = () => {
      if (!ref.current) return;
      const button = anchor.getBoundingClientRect();
      const popup = ref.current.getBoundingClientRect();
      const top = Math.max(4, Math.min(button.bottom + 2, innerHeight - 4));
      setPos({
        left: Math.max(4, Math.min(button.left, innerWidth - popup.width - 4)),
        top,
        maxHeight: innerHeight - top - 4,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor]);
  return createPortal(<>
    <div className="menu-scrim" onPointerDown={onClose} />
    <div ref={ref} className="menu-popup dropdown" style={pos}>
      <MenuList items={items} onClose={onClose} />
    </div>
  </>, document.body);
}

/** Escape the parent's scrolling box while keeping nested menu events together. */
function Submenu({ anchor, children }: { anchor: HTMLElement; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const update = () => {
      if (!ref.current || !anchor) return;
      const row = anchor.getBoundingClientRect();
      const popup = ref.current.getBoundingClientRect();
      const right = row.right;
      const left = right + popup.width <= innerWidth - 4 ? right : row.left - popup.width;
      setPos({
        left: Math.max(4, Math.min(left, innerWidth - popup.width - 4)),
        top: Math.max(4, Math.min(row.top - 4, innerHeight - popup.height - 4)),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor]);
  return createPortal(<div ref={ref} className="menu-popup submenu" style={pos}>{children}</div>, document.body);
}

/** Floating context menu at the pointer, clamped to the viewport. */
export function ContextMenuHost() {
  const menu = useUI((s) => s.menu);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<[number, number]>([0, 0]);
  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos([
      Math.max(4, Math.min(menu.x, innerWidth - r.width - 4)),
      Math.max(4, Math.min(menu.y, innerHeight - r.height - 4)),
    ]);
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!(e.target instanceof Element && e.target.closest(".menu-popup"))) ui.closeMenu();
    };
    const t = setTimeout(() => window.addEventListener("pointerdown", close), 0);
    window.addEventListener("blur", ui.closeMenu);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", ui.closeMenu);
    };
  }, [menu]);
  if (!menu) return null;
  return (
    <div
      ref={ref}
      className="menu-popup context"
      style={{ left: pos[0] || menu.x, top: pos[1] || menu.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.title && <div className="menu-title">{menu.title}</div>}
      <MenuList items={menu.items} onClose={ui.closeMenu} />
    </div>
  );
}

/** Button that opens a dropdown menu below itself. */
export function MenuButton({
  label,
  items,
  className = "",
  title,
  children,
}: {
  label?: string;
  items: MenuItem[] | (() => MenuItem[]);
  className?: string;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      className={`tool ${className}`}
      title={title}
      aria-haspopup="menu"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        useUI.setState({
          menu: { x: r.left, y: r.bottom + 2, items: typeof items === "function" ? items() : items },
        });
      }}
    >
      {children ?? label}
      <Icon name="chevron" size={12} />
    </button>
  );
}
