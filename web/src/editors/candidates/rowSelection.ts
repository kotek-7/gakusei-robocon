import type { KeyboardEvent } from "react";

export function rowIndexForKey(key: string, index: number, length: number): number | null {
  if (!length) return null;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  if (key === "ArrowDown") return Math.min(length - 1, index + 1);
  if (key === "ArrowUp") return Math.max(0, index - 1);
  return null;
}

/** Selection stays inside this table body; activation is deliberately separate. */
export function navigateRow(event: KeyboardEvent<HTMLTableRowElement>, activate?: () => void) {
  if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
  const rows = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLTableRowElement>(":scope > tr[data-selectable-row]") ?? []);
  const next = rowIndexForKey(event.key, rows.indexOf(event.currentTarget), rows.length);
  if (next !== null) {
    event.preventDefault();
    event.stopPropagation();
    rows[next]?.focus();
    rows[next]?.scrollIntoView({ block: "nearest" });
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Enter") activate?.();
  }
}
