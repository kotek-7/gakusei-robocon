export type History<T> = { past: T[]; present: T; future: T[] };
export const history = <T>(present: T): History<T> => ({
  past: [],
  present,
  future: [],
});
export function change<T>(h: History<T>, next: T, record = true): History<T> {
  return JSON.stringify(h.present) === JSON.stringify(next)
    ? h
    : {
        past: record ? [...h.past, h.present].slice(-50) : h.past,
        present: next,
        future: record ? [] : h.future,
      };
}
export function undo<T>(h: History<T>): History<T> {
  return h.past.length
    ? {
        past: h.past.slice(0, -1),
        present: h.past.at(-1)!,
        future: [h.present, ...h.future],
      }
    : h;
}
export function redo<T>(h: History<T>): History<T> {
  return h.future.length
    ? {
        past: [...h.past, h.present].slice(-50),
        present: h.future[0],
        future: h.future.slice(1),
      }
    : h;
}
