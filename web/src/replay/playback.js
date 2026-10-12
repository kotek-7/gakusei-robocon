export function createPlayback(duration = 180) {
  let time = 0,
    playing = false,
    speed = 1;
  return {
    get time() {
      return time;
    },
    get playing() {
      return playing;
    },
    seek(value) {
      if (!Number.isFinite(value)) return;
      time = Math.max(0, Math.min(duration, value));
    },
    toggle() {
      if (time === duration && !playing) time = 0;
      playing = !playing;
    },
    setSpeed(value) {
      if (Number.isFinite(value) && value > 0) speed = value;
    },
    tick(elapsed) {
      if (playing && Number.isFinite(elapsed) && elapsed >= 0) {
        time = Math.min(duration, time + elapsed * speed);
        if (time === duration) playing = false;
      }
    },
  };
}
export function frameAt(run, time) {
  const index = Math.min(run.frames.length - 1, Math.floor(time * 2)),
    frame = run.frames[index],
    next = run.frames[Math.min(run.frames.length - 1, index + 1)],
    blend = time * 2 - index;
  return {
    ...frame,
    robots: frame.robots.map((robot, i) => ({
      ...robot,
      p: robot.p.map((v, j) => v + (next.robots[i].p[j] - v) * blend),
    })),
  };
}
