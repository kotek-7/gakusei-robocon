import { useEffect, useRef, useState } from "react";
import { seekState } from "./analysis";
export function usePlayback(
  runKey: string,
  active: boolean,
  end: number,
  defaultSpeed: number,
) {
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(defaultSpeed);
  const [range, setRange] = useState<[number, number] | null>(null),
    [loop, setLoop] = useState(false),
    [zoom, setZoom] = useState(false);
  const latest = useRef({ range, loop, end, speed });
  latest.current = { range, loop, end, speed };
  useEffect(() => {
    setTime(0);
    setPlaying(false);
    setRange(null);
    setLoop(false);
    setZoom(false);
  }, [runKey]);
  useEffect(() => {
    if (!active) setPlaying(false);
  }, [active]);
  useEffect(() => {
    setSpeed(defaultSpeed);
  }, [defaultSpeed]);
  useEffect(() => {
    if (!playing || !active) return;
    let accumulated = 0,
      last = performance.now();
    const tick = setInterval(() => {
      const now = performance.now();
      accumulated += ((now - last) / 1000) * latest.current.speed;
      last = now;
      if (accumulated < 1) return;
      const step = Math.floor(accumulated);
      accumulated -= step;
      setTime((old) => {
        const { range, loop, end } = latest.current,
          stop = range?.[1] ?? end;
        if (old + step >= stop) {
          if (loop && range) return range[0];
          setPlaying(false);
          return stop;
        }
        return old + step;
      });
    }, 50);
    return () => clearInterval(tick);
  }, [playing, active]);
  const seek = (value: number) => {
    const next = seekState(value, end, range, loop);
    setTime(next.t);
    setLoop(next.loop);
    setPlaying(false);
  };
  const play = () => {
    if (range && (time < range[0] || time > range[1])) {
      setRange(null);
      setLoop(false);
      setZoom(false);
    } else if (range && time === range[1]) setTime(range[0]);
    else if (time >= end) setTime(0);
    setPlaying(true);
  };
  const clearRange = () => {
    setRange(null);
    setLoop(false);
    setZoom(false);
  };
  return {
    time,
    playing,
    setPlaying,
    speed,
    setSpeed,
    range,
    setRange,
    loop,
    setLoop,
    zoom,
    setZoom,
    seek,
    play,
    clearRange,
  };
}
