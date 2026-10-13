"""Independent robot choices; only travel routes and timed waits are restricted.

An intent is either one existing primitive, a shortest-path destination, or an
end-of-match flip start time. Resource identities remain model representatives.
No supply, load-size, target-completion or inter-robot scheduling policy filters
these choices. Hints affect list order only.
"""

from explorer.model.actions import action, duration, legal
from explorer.model.abstraction import demand
from explorer.model.field import SPOTS
from .store import dumps


def sites(r):
    team, role = divmod(r, 2)
    if not role:
        return [f"{k}{team}" for k in ("store", "sky", "ball", "transfer")]
    return [f"transfer{team}", f"pillar{team}"] + [
        f"spot{i}-{team}" for i, p in enumerate(SPOTS) if p[4] in (-1, team)
    ]


def choices(planner, s, r, commitment=None, hint=None, destination=None):
    opts = legal(s, r, planner.c, planner.v)
    if s["robots"][r]["job"]:
        return [(action("continue"), commitment)]
    pos = s["robots"][r]["pos"]
    wait = next(a for a in opts if a["kind"] == "wait")
    if commitment:
        if commitment["kind"] == "travel" and pos != commitment["dest"]:
            route = planner.route(pos, commitment["dest"], r)
            a = route[1][0] if route and route[1] else None
            return [(a if a in opts else wait, commitment)]
        if commitment["kind"] == "until" and s["t"] < commitment["at"]:
            return [(action("delay", seconds=1), commitment)]
    result = [(a, None) for a in opts if a["kind"] not in ("move", "delay")]
    for dest in sites(r):
        route = planner.route(pos, dest, r)
        if (
            dest != pos
            and route
            and route[1]
            and route[0] <= planner.c["horizon"] - s["t"]
        ):
            result.append((route[1][0], {"kind": "travel", "dest": dest}))
    if any(a["kind"] == "flip" for a in opts):
        at = planner.c["horizon"] - duration(action("flip"), planner.c, planner.v, r)
        if at > s["t"]:
            result.append((action("delay", seconds=1), {"kind": "until", "at": at}))

    # Sorting never drops an alternative. Stable ordering is persisted by the engine.
    def rank(item):
        a, intent = item
        exact = a == hint and (not intent or intent.get("dest") == destination)
        useful = a["kind"] in (
            "place",
            "placeM",
            "flip",
            "pick",
            "drop",
            "give",
            "receive",
        )
        harmful = a["kind"] == "flip" and all(
            s["objects"][i]["face"] == r // 2 for i in a.get("objects", [])
        )
        return (
            not exact,
            harmful,
            not useful,
            a["kind"] in ("retry", "wait"),
            dumps(item),
        )

    return sorted(result, key=rank)


def matched(acts):
    for a, b in (acts[:2], acts[2:]):
        if a["kind"] == "give" or b["kind"] == "receive":
            if not (
                a["kind"] == "give"
                and b["kind"] == "receive"
                and a["objects"] == b["objects"]
            ):
                return False
    return True


def instruction(s, r, a, intent):
    if a["kind"] == "continue":
        return None
    if intent:
        return intent
    return {
        "kind": "operation",
        "at": s["robots"][r]["pos"],
        "action": {k: v for k, v in a.items() if k != "objects"},
        "demand": demand(s, a),
    }


def fixed_choice(planner, s, r, commitment, script, index):
    """Replay the same robot procedure; unavailable operations wait, never replan."""
    opts = legal(s, r, planner.c, planner.v)
    if s["robots"][r]["job"]:
        return [(action("continue"), commitment)], index, None
    pos = s["robots"][r]["pos"]
    if commitment and (
        (commitment["kind"] == "travel" and pos != commitment["dest"])
        or (commitment["kind"] == "until" and s["t"] < commitment["at"])
    ):
        return choices(planner, s, r, commitment), index, None
    wait = next(a for a in opts if a["kind"] == "wait")
    if index >= len(script):
        return [(wait, None)], index, None
    ins = script[index]
    if ins["kind"] == "travel":
        route = planner.route(pos, ins["dest"], r)
        if pos == ins["dest"]:
            return fixed_choice(planner, s, r, None, script, index + 1)
        if route and route[1] and route[1][0] in opts:
            return [(route[1][0], ins)], index + 1, None
    elif ins["kind"] == "until":
        if s["t"] >= ins["at"]:
            return fixed_choice(planner, s, r, None, script, index + 1)
        return [(action("delay", seconds=1), ins)], index + 1, None
    else:
        for a in opts:
            desc = {k: v for k, v in a.items() if k != "objects"}
            # Event waits mean "until next completion", not the original horizon remainder.
            wanted = ins["action"]
            if a["kind"] == wanted["kind"] == "wait":
                desc, wanted = {"kind": "wait"}, {"kind": "wait"}
            if pos == ins["at"] and desc == wanted and demand(s, a) == ins["demand"]:
                return [(a, None)], index + 1, None
    return (
        [(wait, None)],
        index,
        {
            "robot": r,
            "t": s["t"],
            "instruction": index,
            "reason": "手順の実行条件が成立していません",
        },
    )
