/** Stroke icons drawn on a 16px grid. Each one names an operation, not a mood. */
const P = {
  save: "M3 2.5h8l2 2v9H3zM5 2.5v4h5v-4M5 13.5v-5h6v5",
  redo: "M9 3l4 3-4 3M13 6H6a3 3 0 000 6h3",
  undo: "M6 3L2.5 6.5 6 10M3 6.5h6a4 4 0 0 1 0 8",
  reset: "M3 6a5.5 5.5 0 1 1-.2 4M3 2.5V6h3.5",
  history: "M3 6a5.5 5.5 0 1 1-.2 4M3 2.5V6h3.5M8 4.5V8l2.5 1.5",
  clock: "M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2zM8 4.5V8l3 2",
  list: "M6 4h7M6 8h7M6 12h7M2.5 4h1M2.5 8h1M2.5 12h1",
  inspect: "M3 2h6l3 3v3M3 2v12h4M9 2v3h3M10 9a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM12 13l2 2",
  chart: "M2.5 2v11.5H14M5 10V7M8.5 10V4M12 10V6",
  warning: "M8 2l6.5 11.5h-13zM8 6v3.5M8 11.5v.1",
  robot: "M3 5h10v8H3zM8 2v3M6 8h.1M10 8h.1M6 11h4M1 7v4M15 7v4",
  branch: "M3 2v12M3 8h6a3 3 0 0 0 3-3V2M10 3l2-2 2 2M1 12l2 2 2-2",
  range: "M3 3v10M13 3v10M3 8h10M5 6L3 8l2 2M11 6l2 2-2 2",
  sort: "M3 3v10M1 11l2 2 2-2M7 4h7M7 8h5M7 12h3",
  keyboard: "M1.5 4h13v8h-13zM4 6h.1M7 6h.1M10 6h.1M12 6h.1M4 8h.1M7 8h.1M10 8h.1M5 10h6",
  bell: "M3 11h10l-1.5-2V6a3.5 3.5 0 0 0-7 0v3zM6.5 13a1.5 1.5 0 0 0 3 0",
  play: "M5 3.5v9l7-4.5z",
  pause: "M5 3.5v9M11 3.5v9",
  reverse: "M11 3.5v9L4 8z",
  stop: "M4.5 4.5h7v7h-7z",
  stepBack: "M11.5 4v8L6 8zM4.5 4v8",
  stepFwd: "M4.5 4v8L10 8zM11.5 4v8",
  prevEvent: "M12 4v8L7 8zM7 4v8L2 8z",
  nextEvent: "M4 4v8l5-4zM9 4v8l5-4z",
  first: "M12 4v8L6 8zM4 4v8",
  last: "M4 4v8l6-4zM12 4v8",
  loop: "M3 7a3.5 3.5 0 0 1 3.5-3.5h5M10 1.5l2 2-2 2M13 9a3.5 3.5 0 0 1-3.5 3.5h-5M6 14.5l-2-2 2-2",
  marker: "M4 2.5h8v8L8 13.5 4 10.5z",
  menu: "M3 4.5h10M3 8h10M3 11.5h10",
  chevron: "M5 6.5l3 3 3-3",
  chevronRight: "M6.5 5l3 3-3 3",
  close: "M4.5 4.5l7 7M11.5 4.5l-7 7",
  splitH: "M2.5 3.5h11v9h-11zM8 3.5v9",
  splitV: "M2.5 3.5h11v9h-11zM2.5 8h11",
  maximize: "M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3",
  search: "M7 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM10 10l3.5 3.5",
  grid: "M2.5 2.5h11v11h-11zM2.5 6.2h11M2.5 9.8h11M6.2 2.5v11M9.8 2.5v11",
  eye: "M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 6.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z",
  eyeOff: "M2 2l12 12M6.3 4A6.8 6.8 0 0 1 8 3.5C12 3.5 14.5 8 14.5 8a12 12 0 0 1-1.9 2.5M4.1 5.2A12 12 0 0 0 1.5 8S4 12.5 8 12.5a6.5 6.5 0 0 0 2.6-.6",
  camera: "M2.5 5h2.5l1-1.5h4L11 5h2.5v7.5h-11zM8 6.8a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
  focus: "M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3M8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
  home: "M2.5 7.5L8 3l5.5 4.5M4 6.5v6.5h8V6.5",
  ruler: "M2 11l9-9 3 3-9 9zM5 8l1.5 1.5M7 6l1.5 1.5M9 4l1.5 1.5",
  pin: "M6 2.5h4M7 2.5v4L4.5 9h7L9 6.5v-4M8 9v4.5",
  link: "M7 9l2-2M6 11l-1 1a2.1 2.1 0 0 1-3-3l2-2a2.1 2.1 0 0 1 3 0M10 5l1-1a2.1 2.1 0 0 1 3 3l-2 2a2.1 2.1 0 0 1-3 0",
  plus: "M8 3v10M3 8h10",
  minus: "M3 8h10",
  fit: "M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10M5.5 5.5h5v5h-5z",
  filter: "M2.5 3.5h11L9 8.5v4l-2 1v-5z",
  gear: "M8 5.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4",
  back: "M10 3.5L5.5 8l4.5 4.5",
  forward: "M6 3.5L10.5 8 6 12.5",
  copy: "M5.5 5.5h7v8h-7zM3.5 10.5v-8h7",
  download: "M8 2.5v8M4.5 7l3.5 3.5L11.5 7M3 13.5h10",
  upload: "M8 10.5v-8M4.5 6L8 2.5 11.5 6M3 13.5h10",
  trash: "M3 4.5h10M6.5 4.5v-2h3v2M4.5 4.5l.7 9h5.6l.7-9",
  ortho: "M3 5.5l5-2.5 5 2.5v5L8 13l-5-2.5zM3 5.5l5 2.5 5-2.5M8 8v5",
  follow: "M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3M8 6.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z",
  layers: "M8 2.5l5.5 3L8 8.5 2.5 5.5zM2.5 8.5l5.5 3 5.5-3M2.5 11l5.5 3 5.5-3",
  zoomIn: "M7 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM10 10l3.5 3.5M5 7h4M7 5v4",
  zoomOut: "M7 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM10 10l3.5 3.5M5 7h4",
  swap: "M3 5.5h9.5L10 3M13 10.5H3.5L6 13",
  edit: "M10.5 2.5l3 3-8 8h-3v-3z",
  check: "M3.5 8.5l3 3 6-7",
  dot: "M8 6.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z",
} as const;
export type IconName = keyof typeof P;
export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const filled = ["play", "reverse", "stop", "stepBack", "stepFwd", "prevEvent", "nextEvent", "first", "last", "marker"].includes(name);
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0.8 : 1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={P[name]} />
    </svg>
  );
}
