/**
 * Read cache over the Worker queries. Entries are keyed by method and params,
 * shared between editors, and refreshed when the Worker reports that the
 * search they read from changed. Stale data stays visible while refreshing.
 */
import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import type { Method, Params, Queries, Result } from "../engine/protocol";
import type { Search } from "../engine/types";
import { call, onEngineEvent } from "./client";

type Entry = {
  data?: unknown;
  error?: string;
  loading: boolean;
  generation: number;
  search: string | null;
  /** Reads whose result never changes for the same params. */
  stable: boolean;
};
const STABLE = new Set<Method>([
  "model.get",
  "replay.get",
  "analysis.match",
  "search.export",
]);
const entries = new Map<string, Entry>();
const subscribers = new Set<() => void>();
let version = 0;
const notify = () => {
  version++;
  for (const s of subscribers) s();
};
const keyOf = (method: string, params: unknown) =>
  `${method} ${JSON.stringify(params ?? null)}`;

async function load(key: string, method: keyof Queries, params: unknown) {
  const entry = entries.get(key)!;
  const generation = ++entry.generation;
  entry.loading = true;
  notify();
  try {
    const data = await (call as (m: string, p: unknown) => Promise<unknown>)(
      method,
      params,
    );
    if (entry.generation !== generation) return;
    entry.data = data;
    entry.error = undefined;
  } catch (e) {
    if (entry.generation !== generation) return;
    entry.error = e instanceof Error ? e.message : String(e);
  } finally {
    if (entry.generation === generation) {
      entry.loading = false;
      notify();
    }
  }
}

export function fetchQuery<M extends keyof Queries>(
  method: M,
  params: Params<M>,
): Promise<Result<M>> {
  const key = keyOf(method, params),
    hit = entries.get(key);
  if (hit && hit.data !== undefined && !hit.loading)
    return Promise.resolve(hit.data as Result<M>);
  return (call as (m: string, p: unknown) => Promise<Result<M>>)(
    method,
    params,
  ).then((data) => {
    const e = ensure(key, method, params);
    e.data = data;
    notify();
    return data;
  });
}

function ensure(key: string, method: Method, params: unknown) {
  let e = entries.get(key);
  if (!e) {
    e = {
      loading: false,
      generation: 0,
      search:
        params && typeof params === "object" && "search" in params
          ? String((params as { search: string }).search)
          : null,
      stable: STABLE.has(method),
    };
    entries.set(key, e);
  }
  return e;
}

/** Invalidate reads of one search (or all) and reload those with readers. */
export function invalidate(search: string | null) {
  for (const [key, e] of entries) {
    if (e.stable) continue;
    if (search !== null && e.search !== search) continue;
    const [method, raw] = [key.slice(0, key.indexOf(" ")), key.slice(key.indexOf(" ") + 1)];
    if (readers.get(key)) void load(key, method as keyof Queries, JSON.parse(raw));
    else entries.delete(key);
  }
}

const readers = new Map<string, number>();

export type Resource<T> = {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
};

/** Subscribe to a query. Pass `null` params to read nothing. */
export function useQuery<M extends keyof Queries>(
  method: M,
  params: Params<M> | null,
): Resource<Result<M>> {
  const key = params === null ? null : keyOf(method, params);
  useEffect(() => {
    if (key === null) return;
    readers.set(key, (readers.get(key) ?? 0) + 1);
    const e = ensure(key, method, params);
    if (e.data === undefined && !e.loading) void load(key, method, params);
    return () => {
      const n = (readers.get(key) ?? 1) - 1;
      if (n) readers.set(key, n);
      else readers.delete(key);
    };
    // params are captured through key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useSyncExternalStore(
    (cb) => {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    () => version,
  );
  const e = key === null ? undefined : entries.get(key);
  return {
    data: e?.data as Result<M> | undefined,
    error: e?.error,
    loading: !!e?.loading || (key !== null && !e),
  };
}

/** Search summaries, kept current by Worker events instead of polling. */
type SearchState = {
  list: Search[];
  loaded: boolean;
  error: string;
  /** Change counter per search, bumped by Worker events. */
  revision: Record<string, number>;
};
export const useSearches = create<SearchState>(() => ({
  list: [],
  loaded: false,
  error: "",
  revision: {},
}));

const lastShape = new Map<string, string>();
const shape = (s: Search) =>
  `${s.nodes}/${s.edges}/${s.status}/${s.runs}/${s.config.name}/${s.discovery?.metrics.candidates ?? 0}/${s.evaluation ? 1 : 0}/${s.evaluationProgress?.done ?? 0}`;

export function upsertSearch(s: Search) {
  useSearches.setState((st) => {
    const list = st.list.some((x) => x.id === s.id)
      ? st.list.map((x) => (x.id === s.id ? s : x))
      : [s, ...st.list];
    return {
      list,
      revision: { ...st.revision, [s.id]: (st.revision[s.id] ?? 0) + 1 },
    };
  });
  const sh = shape(s);
  if (lastShape.get(s.id) !== sh) {
    lastShape.set(s.id, sh);
    invalidate(s.id);
  }
}

let started = false;
export function startSync() {
  if (started) return;
  started = true;
  onEngineEvent((e) => {
    if (e.type === "search.changed") upsertSearch(e.search);
    else if (e.type === "search.removed") {
      useSearches.setState((st) => ({
        list: st.list.filter((x) => x.id !== e.id),
      }));
      invalidate(e.id);
    }
  });
  call("search.list")
    .then((list) => {
      for (const s of list) lastShape.set(s.id, shape(s));
      useSearches.setState({ list, loaded: true });
    })
    .catch((e) =>
      useSearches.setState({
        loaded: true,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
}

/** Replace a cached read with a known value (after a command returned it). */
export function setQueryData<M extends keyof Queries>(
  method: M,
  params: Params<M>,
  data: Result<M>,
) {
  const e = ensure(keyOf(method, params), method, params);
  e.generation++;
  e.data = data;
  e.loading = false;
  e.error = undefined;
  notify();
}
