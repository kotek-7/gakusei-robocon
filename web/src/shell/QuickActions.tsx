import { IconButton } from "../editors/common/IconButton";
import { Icon } from "./icons";
import { getCommand, isEnabled, keysFor, formatKeys, run, useCommands } from "../app/commands";
import { ui, useUI } from "../app/store";
import { useSearches } from "../app/data";

/** Favorites stay reachable while working in any editor. */
export function QuickActions() {
  const pinned = useCommands(s => s.pinned);
  useCommands(s => s.version);
  useCommands(s => s.overrides);
  const activeEditor = useUI(s => s.activeEditor);
  useUI(s => s.activeArea);
  useUI(s => s.session);
  useUI(s => s.busy);
  useUI(s => s.playback.range);
  useSearches(s => s.list);
  const commands = pinned.map(getCommand).filter(c => c && !c.hidden);
  if (!commands.length) return null;
  return <nav className="quick-actions" aria-label="固定した操作">
    <span className="muted" title="固定した操作"><Icon name="pin" /></span>
    <div className="quick-actions-list">
      {commands.map(c => c && <button key={c.id} className="tool"
        disabled={!isEnabled(c.id) || !!c.scope && c.scope !== activeEditor}
        title={`${c.category} · ${c.title}${keysFor(c.id).length ? ` (${keysFor(c.id).map(formatKeys).join(" / ")})` : ""}`}
        onClick={() => run(c.id)}
        onContextMenu={e => { e.preventDefault(); ui.contextMenu(e, [{ label: "固定を解除", run: () => run("command.pin", c.id) }]); }}>
        {c.title}
      </button>)}
    </div>
    <IconButton icon="edit" label="固定する操作を選ぶ" onClick={() => run("app.palette")} />
  </nav>;
}
