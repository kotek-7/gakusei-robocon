import { useRef, useState, useCallback } from "react";
import { Catalog, type CatalogHandle } from "../catalog/Catalog";
import { catalog } from "../catalog/plans";
import { Conditions } from "../conditions/Conditions";
import { Help } from "../help/Help";
import { Replay } from "../replay/Replay";
import { usePlayback } from "../replay/usePlayback";
import { frameAt } from "../replay/playback";
import { Viewport } from "../viewport/Viewport";
import type { Plan } from "../simulation/types";
import { createSession } from "./session";
import { downloadResult } from "./export.js";
export function App() {
  const [session] = useState(() => createSession(catalog())),
    [run, setRun] = useState(session.run);
  const [expanded, setExpanded] = useState(false),
    [helpOpen, setHelpOpen] = useState(false);
  const help = useRef<HTMLDialogElement>(null),
    catalogRef = useRef<CatalogHandle>(null);
  const playback = usePlayback(!expanded && !helpOpen),
    frame = frameAt(run, playback.time);
  const selectPlan = useCallback(
    (plan: Plan) => {
      session.selectPlan(plan);
      setRun(session.run);
      playback.restart();
      setExpanded(false);
    },
    [session, playback.restart],
  );
  return (
    <>
      <header>
        <div className="brand">
          STRATA <small>ABU ROBOCON 2027</small>
        </div>
        <nav>
          <span className="workspace-title">作戦ワークスペース</span>
          <button
            id="help"
            onClick={() => {
              help.current?.showModal();
              setHelpOpen(true);
            }}
          >
            使い方・計算条件
          </button>
        </nav>
        <div className="topright">
          <button
            id="export"
            onClick={() =>
              downloadResult({
                ...session.exportResult(),
                catalogAnalysis: catalogRef.current?.exportAnalysis(),
              })
            }
          >
            結果を保存
          </button>
        </div>
      </header>
      <main className={expanded ? "catalog-expanded" : ""}>
        <Catalog
          ref={catalogRef}
          run={run}
          expanded={expanded}
          onExpanded={setExpanded}
          onSelect={selectPlan}
        />
        <section className="center">
          <Viewport planId={run.plan.id} frame={frame} time={playback.time} active={!expanded} />
          <Replay
            run={run}
            {...playback}
            onSeek={playback.seek}
            onToggle={playback.toggle}
            onSpeed={playback.setSpeed}
          />
        </section>
        <Conditions
          run={run}
          frame={frame}
          time={playback.time}
          onSeek={playback.seek}
          onPerformance={(key, value) => {
            session.changePerformance(key, value);
            setRun(session.run);
          }}
          onOpponent={(key) => {
            session.changeOpponent(key);
            setRun(session.run);
          }}
        />
      </main>
      <footer>
        <span>ABU ROBOCON 2027 · 作戦検討</span>
        <span>SPACE 再生　← → 5秒移動</span>
      </footer>
      <Help ref={help} onClose={() => setHelpOpen(false)} />
    </>
  );
}
