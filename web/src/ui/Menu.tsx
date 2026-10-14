import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
export function Menu({
  label,
  children,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const [at, setAt] = useState<{ left: number; top: number } | null>(null),
    button = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const close = () => {
    setAt(null);
    button.current?.focus();
  };
  useEffect(() => {
    if (!at) return;
    menu.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
    const out = (e: PointerEvent) => {
      if (
        !menu.current?.contains(e.target as Node) &&
        !button.current?.contains(e.target as Node)
      )
        setAt(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("pointerdown", out);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", out);
      document.removeEventListener("keydown", esc);
    };
  }, [at]);
  return (
    <>
      <button
        ref={button}
        disabled={disabled}
        aria-expanded={!!at}
        aria-haspopup="true"
        onClick={() => {
          if (at) close();
          else {
            const r = button.current!.getBoundingClientRect();
            setAt({
              left: Math.max(8, Math.min(r.left, window.innerWidth - 250)),
              top: Math.min(r.bottom + 4, window.innerHeight - 220),
            });
          }
        }}
      >
        {label}
      </button>
      {at &&
        createPortal(
          <div
            ref={menu}
            className="command-menu"
            style={{
              left: at.left,
              top: Math.max(8, at.top),
              maxHeight: Math.max(
                120,
                window.innerHeight - Math.max(8, at.top) - 8,
              ),
            }}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("button")) close();
            }}
            onKeyDown={(e) => {
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const items = Array.from(
                  menu.current!.querySelectorAll<HTMLButtonElement>(
                    "button:not(:disabled)",
                  ),
                );
                const n = items.indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                items[
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? items.length - 1
                      : (n + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                        items.length
                ]?.focus();
              }
            }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
