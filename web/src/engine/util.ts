/** Canonical JSON keys are used for exact states and resumable choices. */
export function key(value: unknown): string {
  return JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
}
export const equal = (a: unknown, b: unknown) => key(a) === key(b);
export const clone = <T>(x: T): T => structuredClone(x);
export function* combinations<T>(
  xs: T[],
  n: number,
  start = 0,
  prefix: T[] = [],
): Generator<T[]> {
  if (!n) {
    yield prefix;
    return;
  }
  for (let i = start; i <= xs.length - n; i++)
    yield* combinations(xs, n - 1, i + 1, [...prefix, xs[i]]);
}
export function combination<T>(options: T[][], cursor: number): T[] {
  const out: T[] = [];
  for (let i = options.length - 1; i >= 0; i--) {
    out[i] = options[i][cursor % options[i].length];
    cursor = Math.floor(cursor / options[i].length);
  }
  return out;
}
export const pauseTurn = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function compare(a: unknown, b: unknown): number {
  const x = key(a),
    y = key(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
