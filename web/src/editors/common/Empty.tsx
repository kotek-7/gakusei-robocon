import type { ReactNode } from "react";
/** Placeholder for an editor with nothing to show, with the next action. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="editor-empty">
      <p className="editor-empty-title">{title}</p>
      {children && <div className="editor-empty-body">{children}</div>}
    </div>
  );
}
