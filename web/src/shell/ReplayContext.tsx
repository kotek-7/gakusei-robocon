import { useEffect, useRef, useState } from "react";
import { useSearch } from "../app/session";
import { useUI } from "../app/store";
import { isEnabled, run } from "../app/commands";
import { samePath } from "../app/replayContext";
import { resolveStrategy } from "../editors/strategy-detail/selection";
import { candidatePlanLabel } from "../editors/candidates/collection";
import { selectionLabel } from "./selectionLabel";
import { Icon } from "./icons";
import "./replay-context.css";

/** The displayed match belongs to the session, not the focused editor's selection. */
export function ReplayContext() {
  const search = useSearch();
  const session = useUI(s => s.session);
  const source = session.replay;
  const anchor = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 34, right: 8 });
  const [open, setOpen] = useState(false);
  useEffect(() => { popup.current?.hidePopover(); }, [session.search, session.run, session.node, session.path]);
  if (!search) return null;
  const resolved = source ? resolveStrategy(search, source) : null;
  const evidence = resolved?.chosen?.evidence;
  const validSource = Boolean(source && evidence && evidence.node === session.node && samePath(evidence.path, session.path));
  const candidateLabel = validSource && resolved ? resolved.candidate.id.slice(0, 14) : "";
  const label = candidateLabel || (session.node !== null ? `局面 N${session.node}` : "経路未選択");
  const opponent = validSource ? source?.evidence === "baseline" ? "相手待機" : resolved?.chosen?.label ?? "相手手順" : "";
  const reveal = () => {
    popup.current?.hidePopover();
    if (source) void run("strategy.reveal", source);
  };
  return <>
    <Icon name="chevronRight" size={12} />
    <button ref={anchor} className="replay-context-trigger" aria-label={`表示中の試合: ${label}${opponent ? ` · ${opponent}` : ""}`} aria-expanded={open} aria-controls="shared-replay-context" title={`表示中: ${label}${opponent ? ` · ${opponent}` : ""}`} onClick={() => {
      const rect = anchor.current!.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, right: Math.min(Math.max(8, window.innerWidth - rect.right), Math.max(8, window.innerWidth - 358)) });
      popup.current?.togglePopover();
    }}>
      <span className="replay-context-prefix">表示中</span>
      <span className="replay-context-label">{label}{opponent ? ` · ${opponent}` : ""}</span>
      <Icon name="chevron" size={12} />
    </button>
    <div ref={popup} id="shared-replay-context" className="replay-context-popup" popover="auto" style={position} onToggle={e => setOpen(e.newState === "open")}>
      <h2>表示中の試合</h2>
      <dl>
        <dt>探索</dt><dd>{search.name}</dd>
        <dt>構成</dt><dd>{session.run !== null ? `C${session.run}` : "未選択"}</dd>
        {validSource && resolved && <><dt>候補</dt><dd>{candidatePlanLabel(resolved.candidate.plan)}<small className="replay-context-id" title={resolved.candidate.id}>{candidateLabel}</small></dd><dt>相手</dt><dd>{opponent}</dd></>}
        <dt>局面</dt><dd>{session.node !== null ? `N${session.node}` : "未選択"}</dd>
        {session.selection && !session.selection.startsWith("node:") && <><dt>選択</dt><dd>{selectionLabel(session.selection)}</dd></>}
      </dl>
      {validSource ? <button className="tool" disabled={!isEnabled("strategy.reveal", source)} onClick={reveal}>この候補の詳細へ</button> : <p>{source ? "表示元の候補を確認できません。" : "候補から試合を開くと、候補と相手をここで確認できます。"}</p>}
    </div>
  </>;
}
