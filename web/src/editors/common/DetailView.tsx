import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLayout } from "../../app/layout";
import { ui, useUI } from "../../app/store";
import "./help.css";

/** A separate data view with focus containment; never an inline disclosure. */
export function DetailView({ label, title = label, children, className = "" }: { label: string; title?: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useId();
  const workspace = useLayout(s => s.active);
  const search = useUI(s => s.session.search), node = useUI(s => s.session.node);
  const selection = useUI(s => s.session.selection), comparison = useUI(s => s.session.compare);
  const time = useUI(s => s.playback.time), range = useUI(s => s.playback.range);
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  useEffect(() => { dialog.current?.close(); setOpen(false); }, [workspace, search, node, selection, comparison, time, range]);
  return <>
    <button ref={trigger} type="button" className={`tool detail-launch ${className}`} aria-haspopup="dialog" onClick={() => { ui.patchPlayback({ playing: false }); setOpen(true); }}>{label}</button>
    {open && createPortal(<dialog ref={dialog} className="data-dialog" aria-labelledby={heading}
      onClose={() => { setOpen(false); trigger.current?.focus(); }}
      onCancel={e => { e.stopPropagation(); }}
      onKeyDown={e => e.stopPropagation()}
      onClick={e => { if (e.target === dialog.current) { const r = dialog.current.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.current.close(); } }}>
      <header className="data-dialog-header"><h2 id={heading}>{title}</h2><button autoFocus type="button" className="tool" aria-label="詳細画面を閉じる" onClick={() => dialog.current?.close()}>閉じる</button></header>
      <div className="data-dialog-content">{children}</div>
    </dialog>, document.body)}
  </>;
}
