"""Projection only: scores and object locations come from the explorer state."""

from explorer.model.field import NODES, SPOTS, EDGES
import math
from explorer.model.state import payload, scores, ROBOT_NAMES


def frame(s, time=None):
    t = s["t"] if time is None else time
    robots = []
    for r, rob in enumerate(s["robots"]):
        p = NODES[rob["pos"]]["p"][:]
        job = rob["job"]
        if job and job["action"]["kind"] in ("move", "retry"):
            to = NODES[job["action"]["dest"]]["p"]
            f = max(0, min(1, (t - job["start"]) / (job["end"] - job["start"])))
            if job["action"]["kind"] == "move":
                e = EDGES[job["action"]["edge"]]
                route = (
                    e["route"] if e["a"] == job["from"] else list(reversed(e["route"]))
                )
                left = e["distance"] * f
                for a, b in zip(route, route[1:]):
                    length = math.dist(a, b)
                    if left <= length or b == route[-1]:
                        frac = min(1, left / length) if length else 1
                        p = [x + (y - x) * frac for x, y in zip(a, b)]
                        break
                    left -= length
            else:
                p = [a + (b - a) * f for a, b in zip(p, to)]
        robots.append(
            {
                "id": ROBOT_NAMES[r],
                "team": r // 2,
                "role": "BR" if r % 2 else "TR",
                "p": p,
                "state": job["action"]["kind"] if job else "idle",
                "location": rob["pos"],
                "action": job["action"] if job else None,
                "carry": [o["kind"] for o in payload(s, r)],
            }
        )
    objs = []
    for o in s["objects"]:
        loc = o["loc"]
        p = [0, 0, 0]
        if loc.startswith("robot"):
            r = int(loc[5:])
            p = robots[r]["p"][:]
            idx = [x["id"] for x in payload(s, r)].index(o["id"])
            p[1] += 0.7 + idx * 0.35
        elif loc.startswith("tower"):
            p = list(SPOTS[int(loc[5:])][:3])
            p[1] += (0.175 if o["kind"] == "E" else 0.1) + o["layer"] * 0.35
        elif loc.startswith("store"):
            team = int(loc[-1])
            side = -1 if team == 0 else 1
            slot = o["slot"] % 20
            p = [
                side * (3.7 + (slot % 5) * 0.375),
                0.175 + o["layer"] * 0.35,
                -4.7 + (slot // 5) * 0.36,
            ]
        elif loc.startswith("buffer"):
            p = NODES["transfer" + loc[-1]]["p"][:]
            slot = sorted(x["id"] for x in s["objects"] if x["loc"] == loc).index(
                o["id"]
            )
            p[0] += (slot % 2 - 0.5) * 0.36
            p[2] += (slot // 2 % 2 - 0.5) * 0.36
            p[1] += 0.175 + (slot // 4) * 0.35
        elif loc == "groundSky":
            pattern = [
                (0, 0),
                (0, 2),
                (0, 4),
                (1, 1),
                (1, 3),
                (2, 0),
                (2, 4),
                (3, 1),
                (3, 3),
                (4, 0),
                (4, 2),
                (4, 4),
            ]
            row, col = pattern[(o["id"] - 40) % 12]
            p = [(col - 2) * 0.2, 0.1, 4.6073 + (row - 2) * 0.2]
        elif loc == "groundBall":
            p = [0, 0.5 + 0.055, -3.8856]
        elif loc == "pillar":
            p = [0, 1.7 + 0.055, -0.002]
        objs.append({**o, "p": p})
    return {
        "t": t,
        "scores": scores(s),
        "robots": robots,
        "objects": objs,
        "mandate": s["mandate"],
    }


def replay(store, ids):
    if (
        not isinstance(ids, list)
        or len(ids) > 2000
        or any(type(x) is not int for x in ids)
    ):
        raise ValueError("不正な経路です")
    frames = []
    events = []
    previous = None
    for eid in ids:
        e = store.edge(eid)
        if previous is not None and e["src"] != previous:
            raise ValueError("連続しない経路です")
        dest = store.node(e["dst"])["state"]
        start = e["started"]
        for t in range(start["t"], dest["t"]):
            frames.append(frame(start, t))
        frames.append(frame(dest))
        events += e["events"]
        previous = e["dst"]
    # At the same timestamp, keep the right-continuous state after the next dispatch.
    by_time = {f["t"]: f for f in frames}
    return {
        "frames": [by_time[t] for t in sorted(by_time)],
        "events": events,
        "edges": ids,
    }
