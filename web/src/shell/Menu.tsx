import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
}: {
  items: MenuItem[];
  onClose: () => void;
  autoFocus?: boolean;
}) {
  useCommands((s) => s.version);
  const [open, setOpen] = useState<number | null>(null);
  const [focus, setFocus] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
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
        else if (e.key === "ArrowRight" && rows[focus]?.submenu) setOpen(focus);
        else if (e.key === "Enter" && rows[focus]) {
          const r = rows[focus]!;
          if (r.submenu) setOpen(focus);
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
            onPointerEnter={() => {
              setFocus(i);
              setOpen(r.submenu ? i : null);
            }}
          >
            <button
              role={r.checked === null ? "menuitem" : "menuitemcheckbox"}
              aria-checked={r.checked ?? undefined}
              aria-haspopup={r.submenu ? "menu" : undefined}
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
              <div className="menu-popup submenu">
                <MenuList items={r.submenu} onClose={onClose} autoFocus={false} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
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
      Math.min(menu.x, innerWidth - r.width - 4),
      Math.min(menu.y, innerHeight - r.height - 4),
    ]);
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) ui.closeMenu();
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
