"""Resumable choice-preserving candidate search over independent robot intents."""

import json
import time
from hashlib import sha256
from math import prod

from explorer.model.actions import action
from explorer.model.config import config_at, count_configs
from explorer.model.state import scores, tower, payload
from explorer.model.transition import successors
from .guidance import Planner
from .choices import choices, fixed_choice, instruction, matched
from .evidence import persist as persist  # public replay helper
from .evaluation import classification, structural, token
from .store import connect, dumps, discovery_finished, discovery_metrics

SCOPE = (
    "候補探索：両チームの取得個数・混載・床／直接受け渡し・建設途中の切替・先行搬送を探索します。"
    "移動は作業地点までの最短経路、待機は次の動作完了または終了直前の反転開始までに限定します。"
    "未探索の分岐を保存して続行できます。候補は到達経路の代表例で、最適性・勝率・点差の保証ではありません。"
)


def setup(db):
    db.executescript("""
    CREATE TABLE IF NOT EXISTS discovery_jobs(
      id INTEGER PRIMARY KEY, run INTEGER, mode TEXT, candidate TEXT DEFAULT '', opponent TEXT DEFAULT '',
      scripts TEXT, active INTEGER, ticks INTEGER DEFAULT 0, done INTEGER DEFAULT 0,
      UNIQUE(run,mode,candidate,opponent));
    CREATE TABLE IF NOT EXISTS discovery_states(
      id INTEGER PRIMARY KEY, job INTEGER, node INTEGER, context TEXT, parent INTEGER, edge INTEGER,
      additions TEXT, hints TEXT, options TEXT, cursor INTEGER DEFAULT 0, total INTEGER, done INTEGER DEFAULT 0, priority REAL DEFAULT 0,
      UNIQUE(job,node,context));
    CREATE INDEX IF NOT EXISTS discovery_pending ON discovery_states(job,done,id);
    CREATE TABLE IF NOT EXISTS discovery_links(src INTEGER,dst INTEGER,edge INTEGER,additions TEXT,
      UNIQUE(src,dst,edge,additions));
    """)


def new_job(db, run, mode, candidate="", opponent="", scripts=None):
    db.execute(
        "INSERT OR IGNORE INTO discovery_jobs(run,mode,candidate,opponent,scripts) VALUES(?,?,?,?,?)",
        (run, mode, candidate, opponent, dumps(scripts or {})),
    )
    j = db.execute(
        "SELECT * FROM discovery_jobs WHERE run=? AND mode=? AND candidate=? AND opponent=?",
        (run, mode, candidate, opponent),
    ).fetchone()
    if not db.execute(
        "SELECT 1 FROM discovery_states WHERE job=? LIMIT 1", (j["id"],)
    ).fetchone():
        root = db.execute("SELECT root FROM runs WHERE id=?", (run,)).fetchone()[0]
        ctx = {"commitments": [None] * 4, "indices": [0] * 4, "blocked": []}
        sid = db.execute(
            "INSERT INTO discovery_states(job,node,context,hints,additions) VALUES(?,?,?,?,?)",
            (j["id"], root, dumps(ctx), dumps([None, None]), dumps([None] * 4)),
        ).lastrowid
        db.execute("UPDATE discovery_jobs SET active=? WHERE id=?", (sid, j["id"]))
    return j["id"]


def alternatives(p, state, context, hints, job):
    scripts = json.loads(job["scripts"])
    options, indices, blocked = [], list(context["indices"]), list(context["blocked"])
    hints = list(hints)
    for team in range(2):
        if hints[team] is None or p.achieved(state, hints[team], team):
            hints[team] = next(iter(p.goals(state, team)), None)
    for r in range(4):
        team = r // 2
        fixed = scripts.get(str(team))
        if fixed is not None:
            opts, indices[r], failure = fixed_choice(
                p, state, r, context["commitments"][r], fixed[r % 2], indices[r]
            )
            if failure and not any(
                x["robot"] == r and x["instruction"] == failure["instruction"]
                for x in blocked
            ):
                blocked.append(failure)
        elif job["mode"] == "baseline" and team == 1:
            a = (
                action("continue")
                if state["robots"][r]["job"]
                else action("wait", seconds=p.c["horizon"] - state["t"])
            )
            opts = [(a, None)]
        else:
            from explorer.model.actions import legal

            legal_opts = legal(state, r, p.c, p.v)
            hint = p.command(state, r, hints[team], legal_opts)
            opts = choices(
                p, state, r, context["commitments"][r], hint, p.destinations.get(r)
            )
        # Prefer a useful mixed BR load, but keep every subset on the frontier.
        g = hints[team]
        if fixed is None and r % 2 == 0 and g and g["kind"] == "flip":
            # Supply during BR's flip is an ordering hint, never a forced wait.
            held = bool(payload(state, r))
            opts.sort(
                key=lambda x: (
                    not (
                        x[0]["kind"] in ("drop", "give")
                        or (held and x[1] and x[1].get("dest") == f"transfer{team}")
                        or (not held and x[0]["kind"] == "pick")
                    ),
                    -len(x[0].get("objects", [])),
                )
            )
        if fixed is None and r % 2 and g and g["kind"] == "build":
            ts = tower(state, g["spot"])
            need = {
                "E": max(0, 2 - len(ts)),
                "S": int(len(ts) < 3 and g.get("height", 3) == 3),
            }

            def useful_load(item):
                a = item[0]
                if a["kind"] != "pick":
                    return 0
                kinds = [state["objects"][i]["kind"] for i in a["objects"]]
                return sum(min(kinds.count(k), n) for k, n in need.items())

            opts.sort(key=lambda x: -useful_load(x))
        options.append(opts)
    # A matching direct transfer is a joint alternative, ordered before the
    # floor transfer when both robots are free. Floor paths remain enumerable.
    for team in (0, 1):
        if str(team) in scripts or job["mode"] == "baseline" and team == 1:
            continue
        a, b = options[team * 2 : team * 2 + 2]
        pair = next(
            (
                (x, y)
                for x in a
                for y in b
                if x[0]["kind"] == "give"
                and y[0]["kind"] == "receive"
                and x[0]["objects"] == y[0]["objects"]
            ),
            None,
        )
        if pair:
            for opts, item in zip((a, b), pair):
                opts.remove(item)
                opts.insert(0, item)
    # A fixed pair must never disappear because only one half of its next
    # handover is ready. Wait for the other half without consuming either step.
    for team in (0, 1):
        if str(team) not in scripts:
            continue
        r = team * 2
        a, b = options[r][0][0], options[r + 1][0][0]
        if (a["kind"] == "give" or b["kind"] == "receive") and not (
            a["kind"] == "give"
            and b["kind"] == "receive"
            and a["objects"] == b["objects"]
        ):
            for rr in (r, r + 1):
                if not state["robots"][rr]["job"]:
                    options[rr] = [
                        (action("wait", seconds=p.c["horizon"] - state["t"]), None)
                    ]
                    indices[rr] = context["indices"][rr]
            failure = {
                "robot": r,
                "t": state["t"],
                "instruction": indices[r],
                "reason": "直接受け渡しの相手手順がまだ成立していません",
            }
            if not any(
                x["robot"] == r and x["instruction"] == indices[r] for x in blocked
            ):
                blocked.append(failure)
    return {"robots": options, "indices": indices, "blocked": blocked}, hints


def combination(options, cursor):
    result = [None] * 4
    for r in range(3, -1, -1):
        cursor, i = divmod(cursor, len(options[r]))
        result[r] = options[r][i]
    return result


def witness(db, row):
    path, scripts = [], [[], [], [], []]
    while row["parent"] is not None:
        path.append(row["edge"])
        adds = json.loads(row["additions"])
        for r, ins in enumerate(adds):
            if ins is not None:
                scripts[r].append(ins)
        row = db.execute(
            "SELECT * FROM discovery_states WHERE id=?", (row["parent"],)
        ).fetchone()
    return list(reversed(path)), [list(reversed(x)) for x in scripts]


def evidence(db, row):
    path, scripts = witness(db, row)
    events = []
    for eid in path:
        events.extend(
            json.loads(
                db.execute("SELECT events FROM edges WHERE id=?", (eid,)).fetchone()[0]
            )
        )
    trace = tuple(
        token(e, None, True)
        for e in sorted(events, key=lambda e: (e["t"], e["phase"], e["robot"]))
        if e["action"]["kind"] not in ("wait", "delay", "continue")
    )
    sid, milestones = classification(structural(trace))
    s = json.loads(
        db.execute("SELECT state FROM nodes WHERE id=?", (row["node"],)).fetchone()[0]
    )
    plan = []
    for e in events:
        if e["robot"] // 2 == 0 and e["phase"] == "finish":
            a = e["action"]
            k = a["kind"]
            if k in ("place", "flip", "placeM"):
                g = {"kind": {"place": "build", "flip": "flip", "placeM": "mustika"}[k]}
                if "spot" in a:
                    g["spot"] = a["spot"]
                if not plan or plan[-1] != g:
                    plan.append(g)
    return (
        {
            "node": row["node"],
            "path": path,
            "scores": scores(s),
            "strategy": sid,
            "milestones": milestones,
            "blocked": json.loads(row["context"])["blocked"],
        },
        scripts,
        plan,
    )


def step(db, store, p, job):
    """One lazy joint choice or terminal visit, atomically with its continuation."""
    active = job["active"]
    row = None
    if job["ticks"] % 2 == 0 and active:
        row = db.execute(
            "SELECT * FROM discovery_states WHERE id=? AND done=0", (active,)
        ).fetchone()
    if row is None and job["ticks"] % 2 == 0:
        row = db.execute(
            "SELECT * FROM discovery_states WHERE job=? AND done=0 AND options IS NULL ORDER BY priority DESC,id LIMIT 1",
            (job["id"],),
        ).fetchone()
    if row is None:
        row = db.execute(
            "SELECT * FROM discovery_states WHERE job=? AND done=0 ORDER BY id LIMIT 1",
            (job["id"],),
        ).fetchone()
    if row is None:
        db.execute("UPDATE discovery_jobs SET done=1 WHERE id=?", (job["id"],))
        return None
    s = json.loads(
        db.execute("SELECT state FROM nodes WHERE id=?", (row["node"],)).fetchone()[0]
    )
    if s["t"] >= p.c["horizon"]:
        db.execute(
            "UPDATE discovery_states SET done=1,total=0 WHERE id=?", (row["id"],)
        )
        db.execute(
            "UPDATE discovery_jobs SET active=NULL,ticks=ticks+1 WHERE id=?",
            (job["id"],),
        )
        return evidence(db, row)
    ctx = json.loads(row["context"])
    hints = json.loads(row["hints"])
    if row["options"] is None:
        data, hints = alternatives(p, s, ctx, hints, job)
        total = prod(len(x) for x in data["robots"])
        db.execute(
            "UPDATE discovery_states SET options=?,hints=?,total=? WHERE id=?",
            (dumps(data), dumps(hints), total, row["id"]),
        )
    else:
        data = json.loads(row["options"])
        total = row["total"]
    cursor = row["cursor"]
    chosen = combination(data["robots"], cursor)
    acts = [x[0] for x in chosen]
    db.execute(
        "UPDATE discovery_states SET cursor=?,done=? WHERE id=?",
        (cursor + 1, int(cursor + 1 == total), row["id"]),
    )
    db.execute("UPDATE discovery_jobs SET ticks=ticks+1 WHERE id=?", (job["id"],))
    if not matched(acts):
        return None
    commitments = [x[1] for x in chosen]
    adds = []
    for r, (a, intent) in enumerate(chosen):
        old = ctx["commitments"][r]
        continuing = old and (
            (old["kind"] == "travel" and s["robots"][r]["pos"] != old["dest"])
            or (old["kind"] == "until" and s["t"] < old["at"])
        )
        adds.append(None if continuing else instruction(s, r, a, intent))
    childctx = {
        "commitments": commitments,
        "indices": data["indices"],
        "blocked": data["blocked"],
    }
    outs = successors(s, acts[:2], acts[2:], p.c, p.v)
    ids = store.add_outcomes(db, job["run"], row["node"], acts[:2], acts[2:], outs, p.c)
    first = None
    for eid, outcome in zip(ids, outs):
        point = scores(outcome["state"])
        priority = (
            point[1] - point[0] if job["mode"] == "counter" else point[0] - point[1]
        )
        nid = db.execute("SELECT dst FROM edges WHERE id=?", (eid,)).fetchone()[0]
        db.execute(
            "INSERT OR IGNORE INTO discovery_states(job,node,context,parent,edge,additions,hints,priority) VALUES(?,?,?,?,?,?,?,?)",
            (
                job["id"],
                nid,
                dumps(childctx),
                row["id"],
                eid,
                dumps(adds),
                dumps(hints),
                priority,
            ),
        )
        child = db.execute(
            "SELECT id,done FROM discovery_states WHERE job=? AND node=? AND context=?",
            (job["id"], nid, dumps(childctx)),
        ).fetchone()
        db.execute(
            "INSERT OR IGNORE INTO discovery_links VALUES(?,?,?,?)",
            (row["id"], child["id"], eid, dumps(adds)),
        )
        if first is None and not child["done"]:
            first = child["id"]
    # Fairness expansion must not displace the current completion walk.
    if job["ticks"] % 2 == 0 or active is None:
        db.execute("UPDATE discovery_jobs SET active=? WHERE id=?", (first, job["id"]))
    db.execute("UPDATE meta SET value='null' WHERE key='evaluation'")
    return None


def digest(x):
    return sha256(dumps(x).encode()).hexdigest()[:12]


def record(db, report, data, job, result):
    ev, scripts, plan = result
    if job["mode"] == "baseline":
        cid = "P-" + digest(scripts[:2])
        if any(a["id"] == cid for a in data["candidates"]):
            return
        data["candidates"].append(
            {
                "id": cid,
                "plan": plan,
                "script": scripts[:2],
                "baseline": ev,
                "responses": [],
                "pending": 0,
            }
        )
        if data["firstCandidateSeconds"] is None and ev["scores"][0] > 0:
            data["firstCandidateSeconds"] = report["elapsed"]
        new_job(db, job["run"], "counter", cid, scripts={"0": scripts[:2]})
        for oid, script in data["opponents"].items():
            new_job(
                db, job["run"], "compare", cid, oid, {"0": scripts[:2], "1": script}
            )
    else:
        candidate = next(a for a in data["candidates"] if a["id"] == job["candidate"])
        oid = job["opponent"] or "O-" + digest(scripts[2:])
        # Only procedures actually completed by free blue are shared. Replay jobs
        # retain the requested opponent ID even when competition blocks it.
        if job["mode"] == "counter" and oid not in data["opponents"]:
            data["opponents"][oid] = scripts[2:]
            for a in data["candidates"]:
                new_job(
                    db,
                    job["run"],
                    "compare",
                    a["id"],
                    oid,
                    {"0": a["script"], "1": scripts[2:]},
                )
        previous = next(
            (
                x
                for x in candidate["responses"]
                if x["opponent"] == oid and x["path"] == ev["path"]
            ),
            None,
        )
        if previous is not None:
            previous["shared"] = previous["shared"] or job["mode"] == "compare"
        else:
            candidate["responses"].append(
                {
                    **ev,
                    "kind": "procedure",
                    "opponent": oid,
                    "shared": job["mode"] == "compare",
                }
            )


def refresh(db, report):
    for run, data in report["runs"].items():
        data["frontier"] = db.execute(
            "SELECT count(*) FROM discovery_states s JOIN discovery_jobs j ON j.id=s.job WHERE j.run=? AND s.done=0",
            (int(run),),
        ).fetchone()[0]
        data["remainingChoices"] = db.execute(
            "SELECT coalesce(sum(total-cursor),0) FROM discovery_states s JOIN discovery_jobs j ON j.id=s.job WHERE j.run=? AND s.done=0 AND total IS NOT NULL",
            (int(run),),
        ).fetchone()[0]
        data["complete"] = not db.execute(
            "SELECT 1 FROM discovery_jobs WHERE run=? AND done=0 LIMIT 1", (int(run),)
        ).fetchone()
        common = set(data["opponents"])
        for a in data["candidates"]:
            confirmed = {
                r[0]
                for r in db.execute(
                    "SELECT opponent FROM discovery_jobs WHERE run=? AND mode='compare' AND candidate=? AND done=1",
                    (int(run), a["id"]),
                )
            }
            common &= confirmed
            a["pending"] = len(set(data["opponents"]) - confirmed)
        data["commonOpponents"] = sorted(common) if data["candidates"] else []
    db.execute("INSERT OR REPLACE INTO meta VALUES('discovery',?)", (dumps(report),))


def discover(store, seconds=10, cancel=None):
    c = store.config()
    start = time.monotonic()
    deadline = start + seconds
    with connect(store.path) as db:
        setup(db)
        row = db.execute("SELECT value FROM meta WHERE key='discovery'").fetchone()
        report = (
            json.loads(row[0])
            if row
            else {
                "version": 2,
                "elapsed": 0,
                "schedule": 0,
                "runs": {},
                "complete": False,
                "scope": SCOPE,
            }
        )
    if discovery_finished(report, c):
        return report
    before = discovery_metrics(report)
    report["stopReason"] = None
    planners = {}
    base = report["elapsed"]
    while time.monotonic() < deadline and not (cancel and cancel.is_set()):
        run = report["schedule"] % count_configs(c)
        report["schedule"] += 1
        if run not in planners:
            store.ensure_run(run)
            planners[run] = Planner(c, config_at(c, run))
        with connect(store.path) as db:
            data = report["runs"].setdefault(
                str(run),
                {
                    "candidates": [],
                    "opponents": {},
                    "tested": 0,
                    "frontier": 0,
                    "firstCandidateSeconds": None,
                },
            )
            new_job(db, run, "baseline")
            # Baseline, new opponent, and shared comparisons each receive a turn.
            mode = ("baseline", "counter", "compare")[data["tested"] % 3]
            if mode == "compare":
                job = db.execute(
                    "SELECT j.* FROM discovery_jobs j WHERE run=? AND mode=? AND done=0 ORDER BY (SELECT min(k.id) FROM discovery_jobs k WHERE k.run=j.run AND k.opponent=j.opponent), ticks,id LIMIT 1",
                    (run, mode),
                ).fetchone()
            else:
                job = db.execute(
                    "SELECT * FROM discovery_jobs WHERE run=? AND mode=? AND done=0 ORDER BY ticks,id LIMIT 1",
                    (run, mode),
                ).fetchone()
            if job is None:
                job = db.execute(
                    "SELECT * FROM discovery_jobs WHERE run=? AND done=0 ORDER BY ticks,id LIMIT 1",
                    (run,),
                ).fetchone()
            if job:
                result = step(db, store, planners[run], job)
                report["elapsed"] = base + time.monotonic() - start
                if result:
                    record(db, report, data, job, result)
                data["tested"] += 1
            report["elapsed"] = base + time.monotonic() - start
            # Metadata and cursors are committed together, including candidate registration.
            refresh(db, report)
            if len(report["runs"]) == count_configs(c) and all(
                d["complete"] for d in report["runs"].values()
            ):
                break
    report["elapsed"] = base + time.monotonic() - start
    after = discovery_metrics(report)
    reason = (
        "exhausted" if discovery_finished(report, c)
        else "cancelled" if cancel and cancel.is_set()
        else "time_limit"
    )
    report["stopReason"] = reason
    report.setdefault("sessions", []).append({
        "seconds": time.monotonic() - start,
        "budget": seconds,
        "reason": reason,
        "newCandidates": after["candidates"] - before["candidates"],
        "newStrategies": after["strategies"] - before["strategies"],
        "responses": after["responses"] - before["responses"],
        "scoreChanges": [
            {"run": int(k), "before": before["bestScores"][k], "after": value}
            for k, value in after["bestScores"].items()
            if before["bestScores"].get(k) is not None
            and value is not None and value > before["bestScores"][k]
        ],
    })
    report["sessions"] = report["sessions"][-12:]
    with connect(store.path) as db:
        refresh(db, report)
    return report
