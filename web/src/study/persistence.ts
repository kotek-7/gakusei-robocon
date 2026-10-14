import { openDB } from "idb";
import type { Match } from "./match";
import { readStudy, activeConfig } from "./state";
import { runKey } from "../execution/identity";
import type { Job, ResultSummary } from "../execution/types";
const db = () =>
  openDB("robocon-strategy-notebook-2", 1, {
    upgrade(db) {
      for (const s of ["summaries", "matches", "jobs", "meta"])
        db.createObjectStore(s);
    },
  });
export async function loadSummaries(): Promise<Record<string, ResultSummary>> {
  const d = await db();
  try {
    return Object.fromEntries(
      (await d.getAll("summaries")).map((r) => [r.key, r]),
    );
  } finally {
    d.close();
  }
}
export async function loadMatch(key: string): Promise<Match | undefined> {
  const d = await db();
  try {
    return await d.get("matches", key);
  } finally {
    d.close();
  }
}
export async function saveResult(
  job: Job,
  match: Match,
): Promise<ResultSummary> {
  const d = await db(),
    summary = {
      key: job.key,
      scores: match.scores,
      completedAt: new Date().toISOString(),
    };
  try {
    const tx = d.transaction(["summaries", "matches", "jobs"], "readwrite");
    await Promise.all([
      tx.objectStore("summaries").put(summary, job.key),
      tx.objectStore("matches").put(match, job.key),
      tx
        .objectStore("jobs")
        .put({ ...job, status: "completed", error: undefined }, job.key),
    ]);
    await tx.done;
    return summary;
  } finally {
    d.close();
  }
}
export async function saveJobs(jobs: Job[]) {
  const d = await db();
  try {
    const tx = d.transaction("jobs", "readwrite");
    for (const j of jobs) tx.store.put(j, j.key);
    await tx.done;
  } finally {
    d.close();
  }
}
export async function loadJobs(): Promise<Job[]> {
  const d = await db();
  try {
    return (await d.getAll("jobs")).map((j) => ({
      ...j,
      status: j.status === "running" ? "queued" : j.status,
    }));
  } finally {
    d.close();
  }
}
/** Import in bounded transactions; keep the old database as a recoverable source. */
let migration: Promise<void> | undefined;
export function migrateResults() {
  return (migration ??= importLegacy().catch((error) => {
    migration = undefined;
    throw error;
  }));
}
async function importLegacy() {
  const d = await db();
  try {
    if (await d.get("meta", "legacy-imported")) return;
    const names =
      typeof indexedDB.databases === "function"
        ? await indexedDB.databases()
        : [];
    if (names.some((x) => x.name === "robocon-strategy-notebook-1")) {
      const old = await openDB("robocon-strategy-notebook-1");
      try {
        if (old.objectStoreNames.contains("matches")) {
          const keys = await old.getAllKeys("matches"),
            saved = new Set(await d.getAllKeys("summaries"));
          for (let offset = 0; offset < keys.length; offset += 10) {
            const read = old.transaction("matches");
            const rows = await Promise.all(
              keys.slice(offset, offset + 10).map((key) => read.store.get(key)),
            );
            const imports: { job: Job; match: Match }[] = [];
            for (const row of rows) {
              try {
                const s = readStudy(JSON.parse(row.signature));
                const red = s.policies.find((p) => p.id === row.match.red),
                  blue = s.opponents.find((p) => p.id === row.match.blue);
                if (!red || !blue) continue;
                const input = {
                    config: activeConfig(s),
                    red,
                    blue,
                    priority: row.match.priority,
                    conditionName: s.conditions[0].name,
                  },
                  key = runKey(input);
                if (saved.has(key)) continue;
                saved.add(key);
                imports.push({
                  job: { key, input, status: "completed" },
                  match: row.match,
                });
              } catch {
                /* Malformed legacy input is skipped without touching its source. */
              }
            }
            if (imports.length) {
              const tx = d.transaction(
                ["summaries", "matches", "jobs"],
                "readwrite",
              );
              for (const { job, match } of imports) {
                tx.objectStore("summaries").put(
                  {
                    key: job.key,
                    scores: match.scores,
                    completedAt: new Date().toISOString(),
                  },
                  job.key,
                );
                tx.objectStore("matches").put(match, job.key);
                tx.objectStore("jobs").put(job, job.key);
              }
              await tx.done;
            }
          }
        }
      } finally {
        old.close();
      }
    }
    await d.put("meta", true, "legacy-imported");
  } finally {
    d.close();
  }
}
