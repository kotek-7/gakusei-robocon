"""Anytime hierarchical candidate discovery, validated by the detailed simulator.

Goals are generated from reachable sites and resource preconditions. This is a
restricted planner, NOT exhaustive enumeration: shortest routes, one construction
goal per team at a time, and homogeneous supply loads. Alternative goal orders
are kept on a resumable frontier. No named strategies or authored match scripts.
"""

from collections import Counter
from hashlib import sha256
import heapq
from itertools import count, permutations
import json
import time

from explorer.model.actions import action, duration, legal
from explorer.model.config import config_at, count_configs
from explorer.model.field import SPOTS, routes
from explorer.model.state import initial, payload, scores, tower
from explorer.model.transition import successors
from .evaluation import classification, structural, token
from .store import connect, dumps


class Planner:
    def __init__(self, config, variant):
        self.c, self.v = config, variant
        self.paths = {}

    def route(self, pos, dest, r):
        key = (pos, dest, r)
        if key not in self.paths:
            serial = count()
            heap = [(0, next(serial), pos, [])]
            seen = set()
            answer = None
            while heap:
                cost, _, loc, path = heapq.heappop(heap)
                if loc in seen:
                    continue
                seen.add(loc)
                if loc == dest:
                    answer = cost, path
                    break
                for eid, nxt, _ in routes(
                    loc,
                    r // 2,
                    "BR" if r % 2 else "TR",
                    self.v["teams"][r // 2]["caps"],
                    self.c["rules"],
                ):
                    a = action("move", edge=eid, dest=nxt)
                    heapq.heappush(
                        heap,
                        (
                            cost + duration(a, self.c, self.v, r),
                            next(serial),
                            nxt,
                            path + [a],
                        ),
                    )
            self.paths[key] = answer
        return self.paths[key]

    def goals(self, s, team):
        br = team * 2 + 1
        caps = self.v["teams"][team]["caps"]
        result = []
        if (
            caps["mustika"]
            and s["mandate"][team]
            and s["objects"][52]["loc"] != "pillar"
        ):
            if self.route(s["robots"][br]["pos"], f"pillar{team}", br):
                result.append({"kind": "mustika"})
        for i, spot in enumerate(SPOTS):
            if spot[4] not in (-1, team) or not self.route(
                s["robots"][br]["pos"], f"spot{i}-{team}", br
            ):
                continue
            ts = tower(s, i)
            if len(ts) == 3:
                if caps["flip"] and ts[-1]["face"] != team:
                    result.append({"kind": "flip", "spot": i})
                    last = self.c["horizon"] - duration(
                        action("flip"), self.c, self.v, br
                    )
                    if (
                        last
                        > s["t"]
                        + self.route(s["robots"][br]["pos"], f"spot{i}-{team}", br)[0]
                    ):
                        result.append({"kind": "flip", "spot": i, "at": last})
            elif caps["capacity_br"] and (len(ts) >= 2 or caps["earth"]):
                height = 3 if caps["sky"] else 2
                if len(ts) < height:
                    result.append({"kind": "build", "spot": i, "height": height})
        # Transfer-only capability configurations must still produce candidates.
        if not result and caps["capacity_tr"] and (caps["earth"] or caps["sky"]):
            result.append({"kind": "deliver", "count": s["transfer"][team] + 1})

        def priority(g):
            if g["kind"] == "mustika":
                return -1000
            if g["kind"] == "deliver":
                return 0
            i = g["spot"]
            travel = self.route(s["robots"][br]["pos"], f"spot{i}-{team}", br)[0]
            remaining = 3 - len(tower(s, i))
            # Progress affects order only; alternative goals remain on the frontier.
            benefit = (80 if g["kind"] == "flip" else 70) * SPOTS[i][3]
            return -benefit / (1 + travel + remaining * 12)

        return sorted(result, key=lambda g: (priority(g), dumps(g)))

    def achieved(self, s, goal, team):
        if goal["kind"] == "mustika":
            return s["objects"][52]["loc"] == "pillar"
        if goal["kind"] == "deliver":
            return s["transfer"][team] >= goal["count"]
        ts = tower(s, goal["spot"])
        return len(ts) >= goal.get("height", 3) and (
            goal["kind"] == "build" or ts[-1]["face"] == team
        )

    def choose(self, s, r, options, dest, kind=None, resource=None, amount=1):
        if s["robots"][r]["pos"] != dest:
            path = self.route(s["robots"][r]["pos"], dest, r)
            return path[1][0] if path and path[1] and path[1][0] in options else None
        possible = [
            a
            for a in options
            if a["kind"] == kind
            and (
                resource is None
                or all(
                    s["objects"][i]["kind"] == resource for i in a.get("objects", [])
                )
            )
            and len(a.get("objects", [])) <= amount
        ]
        return max(possible, key=lambda a: len(a.get("objects", [])), default=None)

    def command(self, s, r, goal, options):
        if s["robots"][r]["job"]:
            return action("continue")
        wait = action("wait", seconds=self.c["horizon"] - s["t"])
        if not goal:
            return wait
        team, role = divmod(r, 2)
        br = team * 2 + 1
        held = payload(s, r)
        transfer = f"transfer{team}"
        gkind = goal["kind"]
        if gkind == "flip":
            if not role:
                return wait
            if held:
                return (
                    self.choose(s, r, options, transfer, "drop", held[0]["kind"])
                    or wait
                )
            if s["robots"][r]["pos"] == f"spot{goal['spot']}-{team}" and s[
                "t"
            ] < goal.get("at", 0):
                return (
                    action("delay", seconds=1)
                    if action("delay", seconds=1) in options
                    else wait
                )
            return (
                self.choose(s, r, options, f"spot{goal['spot']}-{team}", "flip") or wait
            )
        if gkind == "mustika":
            need = Counter(M=1)
            target = f"pillar{team}"
        elif gkind == "deliver":
            need = Counter(
                E=1 if self.v["teams"][team]["caps"]["earth"] else 0,
                S=0 if self.v["teams"][team]["caps"]["earth"] else 1,
            )
            target = transfer
        else:
            ts = tower(s, goal["spot"])
            need = Counter(
                E=max(0, min(2, goal.get("height", 3)) - len(ts)),
                S=int(goal.get("height", 3) == 3 and len(ts) < 3),
            )
            target = f"spot{goal['spot']}-{team}"
        if role:
            if gkind == "deliver":
                return wait
            phase = next((k for k in ("M", "E", "S") if need[k]), None)
            if held:
                if any(o["kind"] == phase for o in held):
                    return (
                        self.choose(
                            s,
                            r,
                            options,
                            target,
                            "placeM" if phase == "M" else "place",
                            phase,
                        )
                        or wait
                    )
                return (
                    self.choose(s, r, options, transfer, "drop", held[0]["kind"])
                    or wait
                )
            amount = min(
                need[phase], max(1, self.v["teams"][team]["caps"]["capacity_br"])
            )
            if s["robots"][r]["pos"] == transfer:
                ready = sum(
                    o["kind"] == phase and o["loc"] == f"buffer{team}"
                    for o in s["objects"]
                )
                if ready < amount:
                    return wait
            return self.choose(s, r, options, transfer, "pick", phase, amount) or wait
        if held:
            return self.choose(s, r, options, transfer, "drop", held[0]["kind"]) or wait
        supplied = Counter(
            o["kind"]
            for o in s["objects"]
            if o["loc"] in (f"buffer{team}", f"robot{br}")
        )
        needed = need if gkind == "deliver" else need - supplied
        kind = next((k for k in ("M", "E", "S") if needed[k]), None)
        if kind:
            dest = (
                f"{'ball' if kind == 'M' else 'store' if kind == 'E' else 'sky'}{team}"
            )
            return self.choose(s, r, options, dest, "pick", kind, needed[kind]) or wait
        # Moving towards the next legally gated resource does not acquire it early.
        completed = [
            i
            for i in range(10)
            if len(tower(s, i)) == 3 and tower(s, i)[-1]["face"] == team
        ]
        if (
            gkind == "build"
            and completed
            and any(SPOTS[i][4] == -1 for i in completed + [goal["spot"]])
        ):
            return self.choose(s, r, options, f"ball{team}") or wait
        return wait

    def simulate(
        self,
        prefix=(),
        counter=(),
        cancel=None,
        deadline=float("inf"),
        opponent_build=False,
    ):
        s = initial(self.c, self.v)
        history, decisions, plan = [], [], []
        goal = None
        blue_goal = None
        blue_index = 0
        while s["t"] < self.c["horizon"]:
            if cancel and cancel.is_set() or time.monotonic() >= deadline:
                raise InterruptedError()
            if goal is None or self.achieved(s, goal, 0):
                choices = self.goals(s, 0)
                if not choices:
                    goal = None
                else:
                    idx = len(plan)
                    goal = prefix[idx] if idx < len(prefix) else choices[0]
                    # Counterfactual outcomes may make a previously chosen goal moot.
                    if self.achieved(s, goal, 0):
                        goal = choices[0]
                    decisions.append((list(plan), choices))
                    plan.append(goal)
            if opponent_build:
                if blue_goal is None or self.achieved(s, blue_goal, 1):
                    blue_goal = next(iter(self.goals(s, 1)), None)
            elif counter:
                if blue_goal and self.achieved(s, blue_goal, 1):
                    blue_index += 1
                blue_goal = (
                    {"kind": "flip", "spot": counter[blue_index]}
                    if blue_index < len(counter)
                    else None
                )
            options = [legal(s, r, self.c, self.v) for r in range(4)]
            acts = [
                self.command(s, r, goal if r < 2 else blue_goal, options[r])
                for r in range(4)
            ]
            outcomes = successors(s, acts[:2], acts[2:], self.c, self.v)
            # One concrete conservative witness; never label it a guarantee.
            out = min(
                outcomes, key=lambda o: scores(o["state"])[0] - scores(o["state"])[1]
            )
            history.append((acts, outcomes, out))
            s = out["state"]
        return {"state": s, "history": history, "decisions": decisions, "plan": plan}


def persist(store, run, result, config):
    """Store all arbitration siblings, and the exact selected witness path."""
    path = []
    events = []
    with connect(store.path) as db:
        nid = db.execute("SELECT root FROM runs WHERE id=?", (run,)).fetchone()[0]
        for acts, outcomes, chosen in result["history"]:
            ids = store.add_outcomes(db, run, nid, acts[:2], acts[2:], outcomes, config)
            eid = ids[next(i for i, o in enumerate(outcomes) if o is chosen)]
            nid = db.execute("SELECT dst FROM edges WHERE id=?", (eid,)).fetchone()[0]
            path.append(eid)
            events.extend(chosen["events"])
        db.execute("UPDATE meta SET value='null' WHERE key='evaluation'")
    trace = tuple(
        token(e, None, True)
        for e in sorted(events, key=lambda e: (e["t"], e["phase"], e["robot"]))
        if e["action"]["kind"] not in ("wait", "delay", "continue")
    )
    sid, milestones = classification(structural(trace))
    return {
        "node": nid,
        "path": path,
        "scores": scores(result["state"]),
        "strategy": sid,
        "milestones": milestones,
    }


def discover(store, seconds=10, cancel=None):
    """Wall-clock bounded, persisted after every candidate or opponent test."""
    c = store.config()
    started = time.monotonic()
    deadline = started + seconds
    with connect(store.path) as db:
        row = db.execute("SELECT value FROM meta WHERE key='discovery'").fetchone()
    report = (
        json.loads(row[0])
        if row
        else {
            "version": 1,
            "elapsed": 0,
            "schedule": 0,
            "runs": {},
            "complete": False,
            "scope": "候補探索：建設目標の順序、最短経路、同種資材の搬送を探索。相手の共有塔反転順序と建設を検査します。未探索の作戦・経路・待機・相手の対応があります。最適性・勝率・点差の保証ではありません。",
        }
    )
    planners = {}

    def checkpoint():
        report["elapsed"] += time.monotonic() - checkpoint.last
        checkpoint.last = time.monotonic()
        store.set_meta("discovery", report)

    checkpoint.last = started
    try:
        while time.monotonic() < deadline and not (cancel and cancel.is_set()):
            run = report["schedule"] % count_configs(c)
            report["schedule"] += 1
            store.ensure_run(run)
            p = planners.setdefault(run, Planner(c, config_at(c, run)))
            data = report["runs"].setdefault(
                str(run),
                {
                    "frontier": [[]],
                    "seen": [],
                    "visited": [],
                    "candidates": [],
                    "tested": 0,
                    "firstCandidateSeconds": None,
                },
            )
            pending = min(
                (a for a in data["candidates"] if a["pending"]),
                key=lambda a: len(a["responses"]),
                default=None,
            )
            # Alternate finding a different goal order with testing its opponent.
            if pending and (data["tested"] % 2 or not data["frontier"]):
                response = pending["pending"][0]
                result = p.simulate(
                    pending["plan"],
                    response.get("targets", []),
                    cancel,
                    deadline,
                    response["kind"] == "build",
                )
                pending["responses"].append(
                    {**response, **persist(store, run, result, c)}
                )
                pending["pending"].pop(0)
            elif data["frontier"]:
                prefix = data["frontier"][0]
                result = p.simulate(prefix, cancel=cancel, deadline=deadline)
                data["frontier"].pop(0)
                data["visited"].append(dumps(prefix))
                plan_key = dumps(result["plan"])
                if plan_key not in data["seen"]:
                    data["seen"].append(plan_key)
                    evidence = persist(store, run, result, c)
                    targets = list(
                        dict.fromkeys(
                            g["spot"]
                            for g in result["plan"]
                            if "spot" in g and SPOTS[g["spot"]][4] == -1
                        )
                    )
                    # Generate response orders from candidate resource targets, not names.
                    responses = (
                        [
                            {"kind": "flip", "targets": list(t)}
                            for t in dict.fromkeys(
                                [
                                    tuple(targets),
                                    tuple(reversed(targets)),
                                    *permutations(targets, min(2, len(targets))),
                                ]
                            )
                        ]
                        if targets
                        else []
                    )
                    if not config_at(c, run)["teams"][1]["caps"]["flip"]:
                        responses = []
                    responses.insert(min(1, len(responses)), {"kind": "build"})
                    data["candidates"].append(
                        {
                            "id": "P-" + sha256(plan_key.encode()).hexdigest()[:12],
                            "plan": result["plan"],
                            "baseline": evidence,
                            "responses": [],
                            "pending": responses,
                        }
                    )
                    if data["firstCandidateSeconds"] is None:
                        data["firstCandidateSeconds"] = (
                            report["elapsed"] + time.monotonic() - checkpoint.last
                        )
                queued = {dumps(x) for x in data["frontier"]}
                for base, choices in result["decisions"]:
                    for goal in choices:
                        new = base + [goal]
                        k = dumps(new)
                        if (
                            result["plan"][: len(new)] != new
                            and k not in queued
                            and k not in data["visited"]
                        ):
                            data["frontier"].append(new)
                            queued.add(k)
            else:
                if len(report["runs"]) == count_configs(c) and all(
                    not d["frontier"] and not any(a["pending"] for a in d["candidates"])
                    for d in report["runs"].values()
                ):
                    break

            def priority(prefix):
                # Cover first-goal alternatives, then expand prefixes whose
                # completed candidates survived the tested counterplay best.
                parent = prefix[:-1]
                matched = [
                    a
                    for a in data["candidates"]
                    if a["responses"] and a["plan"][: len(parent)] == parent
                ]
                value = max(
                    (
                        min(x["scores"][0] - x["scores"][1] for x in a["responses"])
                        for a in matched
                    ),
                    default=0,
                )
                return (len(prefix) > 1, -value, len(prefix))

            data["frontier"].sort(key=priority)
            data["tested"] += 1
            checkpoint()
    except InterruptedError:
        pass
    checkpoint()
    return report
