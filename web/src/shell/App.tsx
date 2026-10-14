import { useEffect, useRef } from "react";
import { installKeyboard } from "../app/commands";
import "../app/coreCommands";
import { goToRoot } from "../app/coreCommands";
import { startSync, useSearches } from "../app/data";
import { useLayout } from "../app/layout";
import { usePref } from "../app/prefs";
import { installComparisonSync } from "../app/workspace";
import { installRouter } from "../app/router";
import { useSpan } from "../app/session";
import { ui, useUI } from "../app/store";
import "../editors";
import { ContextMenuHost } from "./Menu";
import { Dock } from "./Dock";
import { OverlayHost, Toasts } from "./Overlays";
import { StatusBar } from "./StatusBar";
import { QuickActions } from "./QuickActions";
import { TopBar } from "./TopBar";

/** Advances the playhead with real time while playing. */
function usePlaybackClock() {
  const playing = useUI((s) => s.playback.playing);
  const [start, end] = useSpan();
  const span = useRef([start, end]);
  span.current = [start, end];
  useEffect(() => {
    if (!playing) return;
    let last: number | null = null;
    let frame = 0;
    const tick = (now: number) => {
      // Use animation-frame timestamps consistently: the first frame can be
      // timestamped before the effect ran, which would otherwise rewind time.
      const dt = last === null ? 0 : Math.max(0, (now - last) / 1000);
      last = now;
      const p = useUI.getState().playback;
      const [lo, hi] = p.range ?? span.current;
      let t = p.time + dt * p.speed * p.direction;
      if (t > hi || t < lo) {
        if (p.loop) t = p.direction > 0 ? lo : hi;
        else {
          ui.patchPlayback({ time: Math.max(lo, Math.min(hi, t)), playing: false });
          return;
        }
      }
      ui.patchPlayback({ time: t });
      frame = requestAnimationFrame(tick);
    };
    // Starting at the end restarts from the beginning, as media players do.
    const p = useUI.getState().playback;
    const [lo, hi] = p.range ?? span.current;
    if (p.direction > 0 && p.time >= hi - 1e-6) ui.patchPlayback({ time: lo });
    if (p.direction < 0 && p.time <= lo + 1e-6) ui.patchPlayback({ time: hi });
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
}

/** Opens the first saved search and selects its root when nothing is selected. */
function useAutoOpen() {
  const loaded = useSearches((s) => s.loaded);
  const list = useSearches((s) => s.list);
  const search = useUI((s) => s.session.search);
  const node = useUI((s) => s.session.node);
  useEffect(() => {
    if (!loaded) return;
    if (search && !list.some((s) => s.id === search)) {
      ui.openSearch(list[0]?.id ?? null);
      return;
    }
    if (!search && list.length) ui.openSearch(list[0].id);
    else if (!list.length && useLayout.getState().active !== "conditions")
      useLayout.setState((s) => ({ active: "conditions", mounted: [...new Set([...s.mounted, "conditions"])] }));
  }, [loaded, list, search]);
  useEffect(() => {
    if (search && node === null && list.some((s) => s.id === search)) goToRoot().catch(ui.error);
  }, [search, node, list]);
}

function useTheme() {
  const theme = usePref<string>("ui.theme");
  const scale = usePref<number>("ui.fontScale");
  const density = usePref<string>("ui.density");
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    root.dataset.density = density;
    root.style.fontSize = `${(13 * scale) / 100}px`;
  }, [theme, scale, density]);
}

export function App() {
  const mounted = useLayout((s) => s.mounted);
  const active = useLayout((s) => s.active);
  const error = useSearches((s) => s.error);
  const zen = useUI((s) => s.zen);
  useTheme();
  usePlaybackClock();
  useAutoOpen();
  useEffect(() => {
    startSync();
    const a = installKeyboard();
    const c = installComparisonSync();
    const b = installRouter();
    return () => {
      a();
      b();
      c();
    };
  }, []);
  return (
    <div className="shell">
      {!zen && <TopBar />}
      {!zen && <QuickActions />}
      {error && (
        <div className="shell-error" role="alert">
          ブラウザ内の計算処理を開始できません。{error}
        </div>
      )}
      <main className="workspaces">
        {mounted.map((w) => (
          <div key={w} className="workspace" hidden={w !== active}>
            <Dock workspace={w} />
          </div>
        ))}
      </main>
      <StatusBar />
      <ContextMenuHost />
      <OverlayHost />
      <Toasts />
    </div>
  );
}
