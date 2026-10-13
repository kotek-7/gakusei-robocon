"""SQLite owns continuation states, all labelled edges and resumable enumeration cursors."""

import json, sqlite3, time, uuid
from pathlib import Path
from contextlib import contextmanager
from explorer.model import config as schema
from explorer.model.state import initial, key, snapshot
from explorer.model.actions import team_choices
from explorer.model.transition import successors


def dumps(x):
    return json.dumps(x, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


@contextmanager
def connect(path):
    db = sqlite3.connect(path, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=ON")
    try:
        with db:
            yield db
    finally:
        db.close()


class Store:
    def __init__(self, path):
        self.path = Path(path)

    @classmethod
    def create(cls, directory, c):
        schema.validate(c)
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / (uuid.uuid4().hex + ".sqlite3")
        out = cls(path)
        with connect(path) as db:
            db.executescript("""
            CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
            CREATE TABLE runs(id INTEGER PRIMARY KEY, variant TEXT NOT NULL, root INTEGER);
            CREATE TABLE nodes(id INTEGER PRIMARY KEY,run INTEGER NOT NULL REFERENCES runs(id),key TEXT NOT NULL,state TEXT NOT NULL,cursor INTEGER NOT NULL DEFAULT 0,expanded INTEGER NOT NULL DEFAULT 0,UNIQUE(run,key));
            CREATE TABLE edges(id INTEGER PRIMARY KEY,run INTEGER NOT NULL,src INTEGER NOT NULL REFERENCES nodes(id),dst INTEGER NOT NULL REFERENCES nodes(id),red TEXT NOT NULL,blue TEXT NOT NULL,events TEXT NOT NULL,started TEXT NOT NULL,cases TEXT NOT NULL,UNIQUE(src,red,blue,dst));
            CREATE INDEX pending ON nodes(run,expanded,id);
            CREATE INDEX outgoing ON edges(src);
            CREATE INDEX incoming ON edges(dst);
            """)
            for k, v in {
                "config": c,
                "version": schema.VERSION,
                "status": "paused",
                "created": time.time(),
                "schedule": 0,
                "error": None,
                "evaluation": None,
            }.items():
                db.execute("INSERT INTO meta VALUES (?,?)", (k, dumps(v)))
        out.ensure_run(0)
        return out

    def config(self):
        with connect(self.path) as db:
            return json.loads(
                db.execute("SELECT value FROM meta WHERE key='config'").fetchone()[0]
            )

    def set_meta(self, k, v):
        with connect(self.path) as db:
            db.execute("INSERT OR REPLACE INTO meta VALUES (?,?)", (k, dumps(v)))

    def ensure_run(self, index):
        c = self.config()
        v = schema.config_at(c, index)
        s = initial(c, v)
        with connect(self.path) as db:
            db.execute(
                "INSERT OR IGNORE INTO runs(id,variant) VALUES (?,?)", (index, dumps(v))
            )
            row = db.execute("SELECT root FROM runs WHERE id=?", (index,)).fetchone()
            if row[0] is None:
                root = db.execute(
                    "INSERT INTO nodes(run,key,state,expanded) VALUES (?,?,?,?)",
                    (index, key(s), dumps(s), int(s["t"] >= c["horizon"])),
                ).lastrowid
                db.execute("UPDATE runs SET root=? WHERE id=?", (root, index))
        return v

    def summary(self):
        with connect(self.path) as db:
            m = {r[0]: json.loads(r[1]) for r in db.execute("SELECT * FROM meta")}
            count = db.execute("SELECT count(*),sum(expanded) FROM nodes").fetchone()
            runs = db.execute("SELECT count(*) FROM runs").fetchone()[0]
            complete_runs = db.execute(
                "SELECT count(*) FROM runs WHERE NOT EXISTS(SELECT 1 FROM nodes WHERE nodes.run=runs.id AND expanded=0)"
            ).fetchone()[0]
            return {
                "id": self.path.stem,
                "name": m["config"]["name"],
                "status": m["status"],
                "error": m["error"],
                "created": m["created"],
                "config": m["config"],
                "nodes": count[0],
                "expanded": count[1] or 0,
                "edges": db.execute("SELECT count(*) FROM edges").fetchone()[0],
                "runs": runs,
                "completeRuns": complete_runs,
                "totalRuns": str(schema.count_configs(m["config"])),
                "complete": str(complete_runs)
                == str(schema.count_configs(m["config"])),
                "evaluation": m.get("evaluation"),
            }

    def add_outcomes(self, db, run, src, red, blue, outcomes, c):
        ids = []
        for out in outcomes:
            s = out["state"]
            ck = key(s)
            db.execute(
                "INSERT OR IGNORE INTO nodes(run,key,state,expanded) VALUES (?,?,?,?)",
                (run, ck, dumps(s), int(s["t"] >= c["horizon"])),
            )
            dst = db.execute(
                "SELECT id FROM nodes WHERE run=? AND key=?", (run, ck)
            ).fetchone()[0]
            db.execute(
                "INSERT OR IGNORE INTO edges(run,src,dst,red,blue,events,started,cases) VALUES (?,?,?,?,?,?,?,?)",
                (
                    run,
                    src,
                    dst,
                    dumps(red),
                    dumps(blue),
                    dumps(out["events"]),
                    dumps(out["started"]),
                    dumps(out["cases"]),
                ),
            )
            ids.append(
                db.execute(
                    "SELECT id FROM edges WHERE src=? AND red=? AND blue=? AND dst=?",
                    (src, dumps(red), dumps(blue), dst),
                ).fetchone()[0]
            )
        return ids

    def batch(self, limit=100, node=None, run=None):
        """At most limit joint choices. Commit frontier cursor and resulting edges together."""
        c = self.config()
        processed = 0
        deadline = time.monotonic() + 0.35
        with connect(self.path) as db:
            while processed < limit and time.monotonic() < deadline:
                query = "SELECT * FROM nodes WHERE expanded=0"
                args = []
                if node is not None:
                    query += " AND id=?"
                    args.append(node)
                if run is not None:
                    query += " AND run=?"
                    args.append(run)
                row = db.execute(query + " ORDER BY id LIMIT 1", args).fetchone()
                if row is None:
                    break
                s = json.loads(row["state"])
                v = json.loads(
                    db.execute(
                        "SELECT variant FROM runs WHERE id=?", (row["run"],)
                    ).fetchone()[0]
                )
                aa = team_choices(s, 0, c, v)
                bb = team_choices(s, 1, c, v)
                total = len(aa) * len(bb)
                cursor = row["cursor"]
                while (
                    cursor < total and processed < limit and time.monotonic() < deadline
                ):
                    ai, bi = divmod(cursor, len(bb))
                    a, b = aa[ai], bb[bi]
                    outcomes = successors(s, a, b, c, v)
                    self.add_outcomes(db, row["run"], row["id"], a, b, outcomes, c)
                    cursor += 1
                    processed += 1
                db.execute(
                    "UPDATE nodes SET cursor=?,expanded=? WHERE id=?",
                    (cursor, int(cursor == total), row["id"]),
                )
            if processed:
                db.execute("UPDATE meta SET value='null' WHERE key='evaluation'")
        return processed

    def step(self, node, red, blue):
        c = self.config()
        with connect(self.path) as db:
            row = db.execute("SELECT * FROM nodes WHERE id=?", (node,)).fetchone()
            if row is None:
                raise ValueError("局面が存在しません")
            s = json.loads(row["state"])
            v = json.loads(
                db.execute(
                    "SELECT variant FROM runs WHERE id=?", (row["run"],)
                ).fetchone()[0]
            )
            if red not in team_choices(s, 0, c, v) or blue not in team_choices(
                s, 1, c, v
            ):
                raise ValueError("同期条件を満たさない行動です")
            ids = self.add_outcomes(
                db, row["run"], node, red, blue, successors(s, red, blue, c, v), c
            )
            db.execute("UPDATE meta SET value='null' WHERE key='evaluation'")
        return ids

    def graph(self, run=0, offset=0, limit=120):
        with connect(self.path) as db:
            r = db.execute("SELECT * FROM runs WHERE id=?", (run,)).fetchone()
            if r is None:
                raise ValueError("構成はまだ生成されていません")
            rows = db.execute(
                "SELECT * FROM nodes WHERE run=? ORDER BY id LIMIT ? OFFSET ?",
                (run, limit, offset),
            ).fetchall()
            nodes = [
                {
                    "id": x["id"],
                    "expanded": bool(x["expanded"]),
                    "cursor": x["cursor"],
                    **snapshot(json.loads(x["state"])),
                }
                for x in rows
            ]
            ids = [n["id"] for n in nodes]
            edges = []
            if ids:
                edges = [
                    dict(x)
                    for x in db.execute(
                        "SELECT id,src,dst FROM edges WHERE run=? AND src>=? AND src<=?",
                        (run, min(ids), max(ids)),
                    )
                ]
            return {
                "nodes": nodes,
                "edges": edges,
                "root": r["root"],
                "variant": json.loads(r["variant"]),
                "total": db.execute(
                    "SELECT count(*) FROM nodes WHERE run=?", (run,)
                ).fetchone()[0],
                "offset": offset,
            }

    def node(self, n):
        with connect(self.path) as db:
            row = db.execute("SELECT * FROM nodes WHERE id=?", (n,)).fetchone()
            if row is None:
                raise ValueError("局面が存在しません")
            s = json.loads(row["state"])
            v = json.loads(
                db.execute(
                    "SELECT variant FROM runs WHERE id=?", (row["run"],)
                ).fetchone()[0]
            )
            edges = []
            for e in db.execute(
                "SELECT * FROM edges WHERE src=? OR dst=? ORDER BY id", (n, n)
            ):
                edges.append(
                    {
                        k: json.loads(e[k])
                        if k in ("red", "blue", "events", "cases")
                        else e[k]
                        for k in e.keys()
                        if k != "started"
                    }
                )
            from explorer.model.actions import legal

            return {
                "offset": db.execute(
                    "SELECT count(*) FROM nodes WHERE run=? AND id<?", (row["run"], n)
                ).fetchone()[0]
                // 100
                * 100,
                "id": n,
                "run": row["run"],
                "variant": v,
                "expanded": bool(row["expanded"]),
                **snapshot(s),
                "edges": edges,
                "actions": [legal(s, r, self.config(), v) for r in range(4)],
            }

    def edge(self, eid):
        with connect(self.path) as db:
            e = db.execute("SELECT * FROM edges WHERE id=?", (eid,)).fetchone()
            if e is None:
                raise ValueError("遷移が存在しません")
            return {
                k: json.loads(e[k])
                if k in ("red", "blue", "events", "cases", "started")
                else e[k]
                for k in e.keys()
            }

    def witness_path(self, node):
        """Return one reproducible path. All alternate incoming edges remain in the graph."""
        with connect(self.path) as db:
            ids = []
            visited = set()
            while node not in visited:
                visited.add(node)
                e = db.execute(
                    "SELECT id,src FROM edges WHERE dst=? ORDER BY id LIMIT 1", (node,)
                ).fetchone()
                if e is None:
                    break
                ids.append(e["id"])
                node = e["src"]
        return list(reversed(ids))

    def export(self):
        with connect(self.path) as db:
            return {
                t: [dict(r) for r in db.execute("SELECT * FROM " + t)]
                for t in ("meta", "runs", "nodes", "edges")
            }
