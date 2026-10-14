import { openDB } from "idb";
import type { Study } from "./state";
import type { Match } from "./match";
const db = () =>
  openDB("robocon-strategy-notebook-1", 1, {
    upgrade(db) {
      db.createObjectStore("matches");
    },
  });
export const matchKey = (red: string, blue: string, priority: string) =>
  JSON.stringify([red, blue, priority]);
export async function saveMatch(study: Study, match: Match) {
  const database = await db();
  try {
    await database.put(
      "matches",
      { signature: JSON.stringify(study), match },
      matchKey(match.red, match.blue, match.priority),
    );
  } finally {
    database.close();
  }
}
export async function loadMatches(
  study: Study,
): Promise<Record<string, Match>> {
  const database = await db();
  try {
    const rows = await database.getAll("matches");
    return Object.fromEntries(
      rows
        .filter((r) => r.signature === JSON.stringify(study))
        .map((r) => [
          matchKey(r.match.red, r.match.blue, r.match.priority),
          r.match,
        ]),
    );
  } finally {
    database.close();
  }
}
