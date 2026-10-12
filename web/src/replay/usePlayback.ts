import { useEffect, useState } from "react";
import { createPlayback } from "./playback";
export function usePlayback(keyboardEnabled: boolean) {
  const [clock] = useState(() => createPlayback());
  const [snapshot, setSnapshot] = useState({
    time: clock.time,
    playing: clock.playing,
  });
  const publish = () =>
    setSnapshot({ time: clock.time, playing: clock.playing });
  useEffect(() => {
    let previous = performance.now(),
      lastDraw = 0,
      animation: number;
    function tick(now: number) {
      const wasPlaying = clock.playing;
      clock.tick((now - previous) / 1000);
      if (wasPlaying && (now - lastDraw > 70 || !clock.playing)) {
        publish();
        lastDraw = now;
      }
      previous = now;
      animation = requestAnimationFrame(tick);
    }
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [clock]);
  useEffect(() => {
    if (!keyboardEnabled) return;
    function keyboard(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLElement &&
        (["INPUT", "SELECT", "BUTTON", "TEXTAREA", "SUMMARY"].includes(
          e.target.tagName,
        ) ||
          e.target.isContentEditable)
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        clock.toggle();
        publish();
      }
      if (e.code === "ArrowRight" || e.code === "ArrowLeft") {
        e.preventDefault();
        clock.seek(clock.time + (e.code === "ArrowRight" ? 5 : -5));
        publish();
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, [clock, keyboardEnabled]);
  return {
    ...snapshot,
    seek(value: number) {
      clock.seek(value);
      publish();
    },
    toggle() {
      clock.toggle();
      publish();
    },
    setSpeed: (value: number) => clock.setSpeed(value),
  };
}
