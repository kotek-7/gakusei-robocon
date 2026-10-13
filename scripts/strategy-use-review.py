"""Reproducible use review: prescribed match candidates and bounded full local search.

Uses the application's Store/Runtime and legal actions without changing the model.
Prescribed candidates are not exhaustive search or a proof of global optimality.
"""

import argparse
import heapq
from itertools import count
import json
import math
from pathlib import Path
import subprocess
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from explorer.model.config import defaults, config_at
from explorer.model.state import initial, scores, qualify
from explorer.model.actions import action, duration
from explorer.model.field import routes
from explorer.search.store import Store, connect
from explorer.runtime import Runtime
from explorer.presentation import replay


def route_first(s, r, dest, c, v):
    team, role = divmod(r, 2)
    serial = count()
    todo = [(0, next(serial), s["robots"][r]["pos"], [])]
    seen = set()
    while todo:
        cost, _, pos, path = heapq.heappop(todo)
        if pos in seen:
            continue
        seen.add(pos)
        if pos == dest:
            return path[0] if path else None
        for eid, nxt, _ in routes(
            pos, team, "BR" if role else "TR", v["teams"][team]["caps"], c["rules"]
        ):
            a = action("move", edge=eid, dest=nxt)
            heapq.heappush(
                todo, (cost + duration(a, c, v, r), next(serial), nxt, path + [a])
            )
    return None


def candidate(
    base, spot, speed, stairs=True, mustika=False, counter=False, bundled=False
):
    c = defaults()
    spots = spot if isinstance(spot, list) else [spot]
    c["name"] = f"候補再生・spot{spots}・走行{speed}・階段{stairs}・青待機"
    c["teams"][0]["speeds"]["move"] = [speed]
    c["teams"][0]["caps"]["stairs1"] = [stairs]
    if mustika:
        c["name"] += "・ムスティカ"
    if counter:
        c["name"] = c["name"].replace("青待機", "青は共有塔を反転")
    if bundled:
        c["name"] += "・3個混載"
    st = Store.create(base / "data", c)
    v = config_at(c, 0)
    # Human-authored work order; the tool calculates route legality, time and scores.
    queues = [[], [], [], []]
    for target in spots:
        queues[0] += (
            [
                ("move", "store0"),
                ("pick", "E", 2),
                ("move", "sky0"),
                ("pick", "S", 1),
                ("move", "transfer0"),
                ("drop", "E"),
                ("drop", "E"),
                ("drop", "S"),
            ]
            if bundled
            else [
                ("move", "store0"),
                ("pick", "E", 2),
                ("move", "transfer0"),
                ("drop", "E"),
                ("drop", "E"),
                ("move", "sky0"),
                ("pick", "S", 1),
                ("move", "transfer0"),
                ("drop", "S"),
            ]
        )
        queues[1] += [
            ("move", "transfer0"),
            ("pick", "E", 2),
            ("move", f"spot{target}-0"),
            ("place", "E"),
            ("place", "E"),
            ("move", "transfer0"),
            ("pick", "S", 1),
            ("move", f"spot{target}-0"),
            ("place", "S"),
        ]
    if mustika:
        queues[0] += [
            ("move", "ball0"),
            ("pick", "M", 1),
            ("move", "transfer0"),
            ("drop", "M"),
        ]
        queues[1] += [
            ("move", "transfer0"),
            ("pick", "M", 1),
            ("move", "pillar0"),
            ("placeM", "M"),
        ]
    if counter:
        queues[3] = [
            task
            for target in spots
            if target >= 4
            for task in [("move", f"spot{target}-1"), ("flip", "S")]
        ]
    nid = st.graph()["root"]
    path = []
    events = []
    start = time.monotonic()
    while True:
        d = st.node(nid)
        s = d["state"]
        if s["t"] >= 180:
            break
        acts = []
        for r, options in enumerate(d["actions"]):
            if s["robots"][r]["job"]:
                acts.append(action("continue"))
                continue
            while (
                queues[r]
                and queues[r][0][0] == "move"
                and s["robots"][r]["pos"] == queues[r][0][1]
            ):
                queues[r].pop(0)
            a = None
            if queues[r]:
                task = queues[r][0]
                if task[0] == "move":
                    desired = route_first(s, r, task[1], c, v)
                    if desired in options:
                        a = desired
                else:
                    a = next(
                        (
                            x
                            for x in options
                            if x["kind"] == task[0]
                            and all(
                                s["objects"][i]["kind"] == task[1]
                                for i in x.get("objects", [])
                            )
                            and (len(task) < 3 or len(x["objects"]) == task[2])
                        ),
                        None,
                    )
                    if a:
                        queues[r].pop(0)
            acts.append(a or next(x for x in options if x["kind"] == "wait"))
        eids = st.step(nid, acts[:2], acts[2:])
        if len(eids) != 1:
            raise RuntimeError("Prescribed no-contact candidate unexpectedly branched")
        edge = st.edge(eids[0])
        events.extend(edge["events"])
        path += eids
        nid = edge["dst"]
    data = replay(st, path)
    final = st.node(nid)
    assert data["frames"][-1]["scores"] == final["scores"]
    assert not any(e["phase"] == "blocked" for e in events), (
        "Prescribed tasks must be retried explicitly after contention"
    )
    return {
        "kind": "prescribed-candidate",
        "config": c,
        "id": st.path.stem,
        "node": nid,
        "path": path,
        "scores": final["scores"],
        "pendingTasks": queues,
        "elapsed": time.monotonic() - start,
        "events": events,
        "replayScores": data["frames"][-1]["scores"],
    }


def local_config(case):
    c = defaults()
    c["name"] = "実作戦検討・" + case
    if case in ("defense", "delayed", "wait-probe"):
        c["scenario"] = "endgame"
        c["teams"][0]["speeds"]["flip"] = [0, 1, 2]
        c["teams"][1]["caps"]["flip"] = [False, True]
        if case == "wait-probe":
            c["teams"][0]["speeds"]["flip"] = [0]
            c["teams"][1]["caps"]["flip"] = [True]
        if case == "delayed":
            root = initial(c, config_at(c, 0))
            root["t"] = 176
            c.update(scenario="custom", root=root)
            c["teams"][0]["speeds"]["flip"] = [0]
            c["teams"][1]["caps"]["flip"] = [True]
        return c
    c["scenario"] = "custom"
    s = initial(defaults(), config_at(c, 0))
    s["t"] = 170
    # Decision fixture: BR carries a sky block; two alternative two-earth bases exist.
    s["robots"][1].update(pos="middle0", entered=True)
    for ids, spot in [([0, 1], 4), ([2, 3], 6)]:
        for layer, oid in enumerate(ids):
            s["objects"][oid].update(
                loc=f"tower{spot}", layer=layer, delivered=[True, False]
            )
    s["objects"][40].update(loc="robot1", delivered=[True, False])
    s["transfer"][0] = 5
    qualify(s, c["rules"])
    c["root"] = s
    c["teams"][0]["caps"]["stairs2"] = [False, True]
    c["teams"][0]["speeds"]["move"] = [0, 1, 2]
    return c


def explore(base, case, seconds):
    c = local_config(case)
    st = Store.create(base / "data", c)
    rt = Runtime(base / "data")
    start = time.monotonic()
    rt.start(st.path.stem, budget=1000000)
    thread = rt.jobs[st.path.stem][1]
    while thread.is_alive() and time.monotonic() - start < seconds:
        thread.join(0.5)
    rt.pause(st.path.stem)
    thread.join(15)
    if thread.is_alive():
        raise RuntimeError("Exploration did not stop")
    elapsed = time.monotonic() - start
    rt.start(st.path.stem, evaluate=True)
    thread = rt.jobs[st.path.stem][1]
    thread.join(25)
    if thread.is_alive():
        rt.pause(st.path.stem)
        thread.join(10)
    if thread.is_alive():
        raise RuntimeError("Evaluation did not stop")
    summary = st.summary()
    runs = []
    with connect(st.path) as db:
        for run in db.execute("SELECT * FROM runs ORDER BY id"):
            end = []
            for node in db.execute(
                "SELECT id,state FROM nodes WHERE run=?", (run["id"],)
            ):
                s = json.loads(node["state"])
                if s["t"] == 180:
                    end.append((scores(s), node["id"]))
            best = max(end, key=lambda x: x[0][0] - x[0][1]) if end else None
            witness = None
            if best:
                path = st.witness_path(best[1])
                data = replay(st, path)
                witness = {
                    "node": best[1],
                    "scores": best[0],
                    "path": path,
                    "events": [
                        event for eid in path for event in st.edge(eid)["events"]
                    ],
                    "replayScores": data["frames"][-1]["scores"],
                }
            runs.append(
                {
                    "run": run["id"],
                    "variant": json.loads(run["variant"]),
                    "terminalScores": sorted({tuple(x[0]) for x in end}),
                    "bestWitness": witness,
                }
            )
    rt.close()
    return {
        "kind": "bounded-exhaustive",
        "id": st.path.stem,
        "elapsed": elapsed,
        "summary": summary,
        "runs": runs,
    }


def guided_l2(base):
    c = local_config("l2")
    c["name"] = "候補指定・L1とL2の最終設置比較"
    st = Store.create(base / "data", c)
    result = []
    for run in range(6):
        v = st.ensure_run(run)
        for spot in (4, 6):
            nid = st.graph(run)["root"]
            path = []
            events = []
            placed = False
            while True:
                d = st.node(nid)
                s = d["state"]
                if s["t"] == 180:
                    break
                acts = []
                for r, options in enumerate(d["actions"]):
                    a = None
                    if s["robots"][r]["job"]:
                        a = action("continue")
                    elif r == 1 and not placed:
                        if s["robots"][r]["pos"] != f"spot{spot}-0":
                            desired = route_first(s, r, f"spot{spot}-0", c, v)
                            if desired in options:
                                a = desired
                        else:
                            a = next((x for x in options if x["kind"] == "place"), None)
                            if a:
                                placed = True
                    acts.append(a or next(x for x in options if x["kind"] == "wait"))
                eids = st.step(nid, acts[:2], acts[2:])
                if len(eids) != 1:
                    raise RuntimeError("Unexpected contention")
                edge = st.edge(eids[0])
                events.extend(edge["events"])
                path += eids
                nid = edge["dst"]
            result.append(
                {
                    "kind": "prescribed-local-candidate",
                    "id": st.path.stem,
                    "config": c,
                    "variant": v,
                    "run": run,
                    "spot": spot,
                    "node": nid,
                    "path": path,
                    "events": events,
                    "scores": st.node(nid)["scores"],
                    "replayScores": replay(st, path)["frames"][-1]["scores"],
                }
            )
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "case",
        choices=[
            "candidates",
            "two-towers",
            "mustika",
            "counter",
            "protected",
            "bundled",
            "l2-guided",
            "l2",
            "defense",
            "delayed",
            "wait-probe",
        ],
    )
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--seconds", type=float, default=60)
    a = p.parse_args()
    if not math.isfinite(a.seconds) or a.seconds <= 0:
        p.error("--seconds must be positive and finite")
    a.output.mkdir(parents=True, exist_ok=True)
    if a.case == "candidates":
        result = [
            candidate(a.output, spot, speed)
            for spot in [0, 4, 6]
            for speed in [0, 1, 2]
        ] + [candidate(a.output, 0, 1, False)]
    elif a.case == "l2-guided":
        result = guided_l2(a.output)
    elif a.case == "bundled":
        result = [
            candidate(
                a.output, spots, speed, mustika=True, counter=counter, bundled=True
            )
            for spots in ([0, 4], [6, 7])
            for speed in (0, 1, 2)
            for counter in (False, True)
        ]
    elif a.case == "protected":
        result = [
            candidate(a.output, spots, speed, mustika=True, counter=True)
            for spots in ([0, 4], [0, 6])
            for speed in (0, 1, 2)
        ]
    elif a.case == "counter":
        result = [
            candidate(a.output, [6, 7], speed, mustika=True, counter=True)
            for speed in (0, 1, 2)
        ]
    elif a.case == "mustika":
        result = [
            candidate(a.output, spots, speed, mustika=True)
            for spots in ([0, 4], [6, 7], [0, 6])
            for speed in (0, 1, 2)
        ]
    elif a.case == "two-towers":
        result = [
            candidate(a.output, spots, speed)
            for spots in ([0, 4], [6, 7], [0, 6])
            for speed in (0, 1, 2)
        ]
    elif a.case == "wait-probe":
        # Isolated counterfactual, NOT a production-model result. Add just one
        # red-BR choice: wait four seconds at t=174, then use normal actions.
        from unittest.mock import patch
        from contextlib import ExitStack
        import explorer.model.actions as actions_module
        import explorer.model.transition as transition_module

        def extra_wait(fn):
            def wrapped(s, r, c, v):
                opts = fn(s, r, c, v)
                if s["t"] == 174 and r == 1 and s["robots"][r]["job"] is None:
                    opts = opts + [action("wait", seconds=4)]
                return opts

            return wrapped

        with ExitStack() as stack:
            legal_with_wait = extra_wait(actions_module.legal)
            raw_with_wait = extra_wait(actions_module.concrete_legal)
            stack.enter_context(patch.object(actions_module, "legal", legal_with_wait))
            stack.enter_context(
                patch.object(transition_module, "legal", legal_with_wait)
            )
            stack.enter_context(
                patch.object(transition_module, "concrete_legal", raw_with_wait)
            )
            result = explore(a.output, a.case, a.seconds)
        result["counterfactual"] = (
            "Only at t=174, red BR may wait 4 seconds; not supported by production model"
        )
    else:
        result = explore(a.output, a.case, a.seconds)
    report = {
        "sourceCommit": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], text=True
        ).strip(),
        "case": a.case,
        "result": result,
    }
    (a.output / (a.case + ".json")).write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    )
    if isinstance(result, list):
        print(
            [
                (
                    x["config"]["name"],
                    x["scores"],
                    x.get("run"),
                    x.get("spot"),
                    x.get("pendingTasks", [])[:2],
                )
                for x in result
            ]
        )
    else:
        print(
            {
                "case": a.case,
                "id": result["id"],
                "seconds": result["elapsed"],
                "nodes": result["summary"]["nodes"],
                "complete": result["summary"]["complete"],
                "runs": [(x["run"], x["terminalScores"]) for x in result["runs"]],
            }
        )


if __name__ == "__main__":
    main()
