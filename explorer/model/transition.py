"""Joint snapshot decisions, contact-time arbitration and integer-time events."""

from copy import deepcopy
from .actions import legal, duration, action
from .state import key, payload, tower, qualify, validate
from .field import NODES


def _return_object(o):
    o["loc"] = (
        f"store{o['owner']}"
        if o["kind"] == "E"
        else "groundSky"
        if o["kind"] == "S"
        else "groundBall"
    )
    # Retry returns blocks to their home cell, unstacked; avoids introducing support dependencies.
    o["slot"] = o["id"]
    o["layer"] = 0
    if o["kind"] == "M":
        o["owner"] = -1


def _start(s, r, a, config, v, events):
    rob = s["robots"][r]
    k = a["kind"]
    if k == "continue":
        return
    matching_receive = (
        k == "receive"
        and s["robots"][a["partner"]]["job"] is not None
        and s["robots"][a["partner"]]["job"]["action"].get("objects") == a["objects"]
        and s["robots"][a["partner"]]["job"]["action"]["kind"] == "give"
    )
    if not matching_receive and a not in legal(s, r, config, v):
        events.append({"t": s["t"], "robot": r, "phase": "blocked", "action": a})
        a = action("wait", seconds=1)
        k = "wait"
    if k == "retry":
        prev = rob["job"]
        if prev and prev["action"]["kind"] in ("give", "receive"):
            s["robots"][prev["action"]["partner"]]["job"] = None
        for o in payload(s, r):
            if o["kind"] == "M" or config["rules"]["retry_payload"] == "return":
                _return_object(o)
    if k in ("pick", "take", "flip", "takeM"):
        for oid in a["objects"]:
            s["objects"][oid]["loc"] = f"robot{r}"
    rob["job"] = {
        "action": deepcopy(a),
        "start": s["t"],
        "end": s["t"] + duration(a, config, v, r),
        "from": rob["pos"],
    }
    if k == "receive":
        rob["job"]["end"] = s["t"] + duration(a, config, v, r - 1)
    if k != "wait":
        events.append({"t": s["t"], "robot": r, "phase": "start", "action": a})


def _finish(s, r, config, v, events):
    rob = s["robots"][r]
    job = rob["job"]
    a = job["action"]
    k = a["kind"]
    team = r // 2
    rob["job"] = None
    if k in ("move", "retry"):
        rob["pos"] = a["dest"]
        if r % 2 and NODES[rob["pos"]]["p"][1] >= 0.6:
            rob["entered"] = True
    elif k == "drop":
        for oid in a["objects"]:
            o = s["objects"][oid]
            o.update(loc=f"buffer{team}", layer=0, slot=oid)
            if (
                r % 2 == 0
                and o["kind"] != "M"
                and (not o["delivered"][team] or config["rules"]["repeat_transfer"])
            ):
                s["transfer"][team] += 1
                o["delivered"][team] = True
    elif k == "give":
        for oid in a["objects"]:
            o = s["objects"][oid]
            o["loc"] = f"robot{a['partner']}"
            if o["kind"] != "M" and (
                not o["delivered"][team] or config["rules"]["repeat_transfer"]
            ):
                s["transfer"][team] += 1
                o["delivered"][team] = True
    elif k in ("place", "flip"):
        for oid in a["objects"]:
            o = s["objects"][oid]
            layer = len(tower(s, a["spot"]))
            o.update(loc=f"tower{a['spot']}", layer=layer)
            if o["kind"] == "S":
                o["face"] = team
            else:
                o["owner"] = team
    elif k == "placeM":
        s["objects"][52].update(loc="pillar", owner=team, layer=0)
    if k == "wait":
        rob["waited"] = True
    else:
        events.append({"t": s["t"], "robot": r, "phase": "finish", "action": a})


def successors(s, red, blue, config, v):
    """One outcome for each distinct arbitration result; no stochastic probability."""
    for r, a in enumerate(red + blue):
        if a not in legal(s, r, config, v):
            raise ValueError("この局面では選べない行動です")
    priorities = (
        [0, 1]
        if config["rules"]["conflict"] == "branch"
        else [0 if config["rules"]["conflict"] == "red" else 1]
    )
    seen = {}
    for priority in priorities:
        child = deepcopy(s)
        events = []
        for team in (priority, 1 - priority):
            for r in (team * 2, team * 2 + 1):
                _start(child, r, (red + blue)[r], config, v, events)
        started = deepcopy(child)
        # Retry remains possible at every second of an active operation.
        jobs = [r["job"] for r in child["robots"] if r["job"]]
        nxt = min([config["horizon"]] + [j["end"] for j in jobs])
        if any(j["action"]["kind"] not in ("wait", "retry") for j in jobs):
            nxt = min(nxt, s["t"] + 1)
        if nxt <= s["t"]:
            raise ValueError("遷移後の時刻が進んでいません")
        child["t"] = nxt
        for team in (priority, 1 - priority):
            for r in (team * 2, team * 2 + 1):
                if (
                    child["robots"][r]["job"]
                    and child["robots"][r]["job"]["end"] == nxt
                ):
                    _finish(child, r, config, v, events)
        if any(e["phase"] == "finish" for e in events):
            for rob in child["robots"]:
                rob["waited"] = False
                if rob["job"] and rob["job"]["action"]["kind"] == "wait":
                    rob["job"] = None
        qualify(child, config["rules"])
        validate(child)
        ck = key(child)
        if ck in seen:
            seen[ck]["cases"].append(priority)
        else:
            seen[ck] = {
                "state": child,
                "started": started,
                "events": events,
                "cases": [priority],
            }
    return list(seen.values())
