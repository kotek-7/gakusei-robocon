/** Edit one endpoint without silently exchanging the user's start and end. */
export function editRangeEndpoint(range: [number, number], endpoint: 0 | 1, value: string, horizon: number): [number, number] | null {
  if (!value.trim()) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const bounded = Math.max(0, Math.min(horizon, number));
  return endpoint === 0 ? [Math.min(bounded, range[1]), range[1]] : [range[0], Math.max(bounded, range[0])];
}
