"""Measure the unchanged explorer with bounded wall time; preserve resumable SQLite data.

Example: python3 scripts/practical-search-benchmark.py start180 --output /tmp/robocon-benchmark
Use --resume --seconds 240 to extend the existing case instead of creating a new one.
"""

import argparse
import json
import math
import resource
import sys
import time
import subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from explorer.model.config import defaults, config_at
from explorer.model.state import initial, scores
from explorer.search.store import Store, connect
from explorer.runtime import Runtime

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "case", choices=["start1", "start10", "start180", "end6", "end2-six"]
)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--seconds", type=float)
parser.add_argument("--resume", action="store_true")
args = parser.parse_args()
case = args.case
base = args.output
folder = base / case
previous = json.loads((base / (case + ".json")).read_text()) if args.resume else None
c = defaults()
c["name"] = "実用性検証・" + case
limits = {"start1": 45, "start10": 45, "start180": 60, "end6": 60, "end2-six": 90}
if case.startswith("start"):
    c["horizon"] = int(case[5:])
else:
    c["scenario"] = "endgame"
    if case == "end2-six":
        root = initial(c, config_at(c, 0))
        root["t"] = 178
        c["scenario"] = "custom"
        c["root"] = root
        c["teams"][0]["caps"]["flip"] = [False, True]
        c["teams"][0]["speeds"]["flip"] = [0, 1, 2]
if args.seconds is not None and (not math.isfinite(args.seconds) or args.seconds <= 0):
    parser.error("--seconds must be positive")
limit = args.seconds if args.seconds is not None else limits[case]
rt = Runtime(folder)
s = rt.get(previous["checkpoint"]["id"]) if previous else Store.create(folder, c)
c = s.config()
ident = s.path.stem
start = time.monotonic()
rt.start(ident, budget=1000000)
thread = rt.jobs[ident][1]
last = start
while thread.is_alive():
    thread.join(timeout=1)
    now = time.monotonic()
    if now - last >= 15:
        m = s.summary()
        print(
            json.dumps(
                {
                    "case": case,
                    "elapsed": round(now - start, 1),
                    "nodes": m["nodes"],
                    "edges": m["edges"],
                    "completeRuns": m["completeRuns"],
                },
                ensure_ascii=False,
            ),
            flush=True,
        )
        last = now
    if now - start >= limit:
        rt.pause(ident)
        thread.join(timeout=10)
        break
if thread.is_alive():
    raise RuntimeError("Exploration did not stop within the cancellation grace period")
explore = time.monotonic() - start
m = s.summary()
checkpoint = {
    k: m[k]
    for k in [
        "id",
        "status",
        "nodes",
        "edges",
        "expanded",
        "runs",
        "completeRuns",
        "totalRuns",
        "complete",
        "error",
    ]
}
stats = []
with connect(s.path) as db:
    for r in db.execute("SELECT id,variant FROM runs ORDER BY id"):
        nodes = db.execute(
            "SELECT state,expanded,cursor FROM nodes WHERE run=?", (r["id"],)
        ).fetchall()
        states = [json.loads(n["state"]) for n in nodes]
        terminal = [x for x in states if x["t"] >= c["horizon"]]
        pending = [x["t"] for x, n in zip(states, nodes) if not n["expanded"]]
        stats.append(
            {
                "run": r["id"],
                "variant": json.loads(r["variant"]),
                "nodes": len(states),
                "terminal": len(terminal),
                "terminalScores": sorted(set(tuple(scores(x)) for x in terminal)),
                "frontierMin": min(pending) if pending else None,
                "frontierMax": max(pending) if pending else None,
                "expanded": sum(n["expanded"] for n in nodes),
                "jointChoices": sum(n["cursor"] for n in nodes),
            }
        )
start_eval = time.monotonic()
rt.start(ident, evaluate=True)
thread = rt.jobs[ident][1]
thread.join(timeout=30)
if thread.is_alive():
    rt.pause(ident)
    thread.join(timeout=15)
if thread.is_alive():
    raise RuntimeError("Evaluation did not stop within the cancellation grace period")
eval_secs = time.monotonic() - start_eval
m = s.summary()
ev = m["evaluation"]
report = []
for r in (ev or {}).get("runs", []):
    report.append(
        {
            k: r[k]
            for k in [
                "run",
                "complete",
                "statisticsComplete",
                "historyLimited",
                "rawGraphPaths",
                "paths",
                "groups",
                "groupWinFraction",
                "unresolvedFraction",
                "distribution",
                "guarantee",
            ]
        }
        | {"strategyCount": len(r["strategies"])}
    )
result = {
    "sourceCommit": subprocess.check_output(
        ["git", "rev-parse", "HEAD"], text=True
    ).strip(),
    "previousExploreSeconds": (
        previous.get("previousExploreSeconds", 0) + previous["exploreSeconds"]
    )
    if previous
    else 0,
    "case": case,
    "config": c,
    "exploreSeconds": round(explore, 3),
    "evaluationSeconds": round(eval_secs, 3),
    "checkpoint": checkpoint,
    "finalStatus": m["status"],
    "finalError": m["error"],
    "peakRssMiB": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1),
    "databaseMiB": round(sum(p.stat().st_size for p in folder.glob(s.path.name + "*")) / 1024**2, 2),
    "stats": stats,
    "evaluation": report,
    "evaluationAvailable": ev is not None,
}
(base / (case + ("-resumed" if args.resume else "") + ".json")).write_text(
    json.dumps(result, ensure_ascii=False, indent=2)
)
print(
    json.dumps(
        {k: v for k, v in result.items() if k not in ["config", "stats", "evaluation"]},
        ensure_ascii=False,
    ),
    flush=True,
)
rt.close()
