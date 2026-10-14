import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { run } from "../../app/commands";
import { helpArticles, resolveHelpTopic } from "../../app/help";
import "./help.css";

let showingHelp = false;

export function Help({ topic, text }: { topic: string; text?: string }) {
  const id = useId(), button = useRef<HTMLButtonElement>(null), bubble = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const frame = useRef(0);
  const pinned = useRef(false);
  const restoringFocus = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const article = helpArticles[resolveHelpTopic(topic)];
  const cancel = () => clearTimeout(timer.current);
  const hide = () => { cancelAnimationFrame(frame.current); cancel(); pinned.current = false; bubble.current?.hidePopover(); setOpen(false); };
  const show = () => {
    if (showingHelp) return;
    cancel();
    const rect = button.current?.getBoundingClientRect();
    if (rect) setPosition({ left: Math.max(8, Math.min(rect.left, innerWidth - Math.min(336, innerWidth - 16) - 8)), top: rect.bottom + 6 });
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (!button.current?.isConnected || !button.current.getClientRects().length) return;
      showingHelp = true;
      try { if (!bubble.current?.matches(":popover-open")) bubble.current?.showPopover(); setOpen(true); } finally { showingHelp = false; }
    });
    requestAnimationFrame(() => { const box = bubble.current?.getBoundingClientRect(); if (box && rect && box.bottom > innerHeight - 8) setPosition(p => ({ ...p, top: Math.max(8, rect.top - box.height - 6) })); });
  };
  const later = () => { cancel(); if (!pinned.current) timer.current = setTimeout(hide, 200); };
  useEffect(() => () => { clearTimeout(timer.current); cancelAnimationFrame(frame.current); }, []);
  return <>
    <button ref={button} type="button" className="help-trigger" aria-label={`${article.title}のヘルプ`} aria-describedby={open ? id : undefined} aria-expanded={open}
      onPointerEnter={e => { if (e.pointerType !== "touch") show(); }} onPointerLeave={later}
      onFocus={() => { if (!restoringFocus.current) show(); }} onBlur={e => { if (!bubble.current?.contains(e.relatedTarget as Node)) later(); }}
      onClick={() => { if (pinned.current) hide(); else { show(); pinned.current = true; } }}><span aria-hidden="true">?</span></button>
    {createPortal(<div ref={bubble} id={id} popover="auto" role="dialog" aria-label={`${article.title}のヘルプ`} className="help-bubble" style={position}
      onToggle={e => { const shown = (e.nativeEvent as ToggleEvent).newState === "open"; setOpen(shown); if (!shown) pinned.current = false; }}
      onPointerEnter={cancel} onPointerLeave={later} onFocus={cancel}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node) && e.relatedTarget !== button.current) later(); }}
      onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); hide(); restoringFocus.current = true; button.current?.focus(); restoringFocus.current = false; } }}>
      <div className="help-title"><strong>{article.title}</strong><button type="button" className="tool" aria-label="ヘルプを閉じる" onClick={hide}>閉じる</button></div>
      <p>{text ?? article.summary}</p>
      <button type="button" className="link" onClick={() => { button.current?.closest("dialog")?.close(); hide(); run("docs.open", topic); }}>ドキュメントで詳しく読む</button>
    </div>, document.body)}
  </>;
}
