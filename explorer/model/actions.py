"""Legal operations generated from state + capability predicates, without policies."""

from itertools import combinations, product
import math
from .field import EDGES, routes, spot_at
from .state import payload, tower, ROBOT_NAMES


def action(kind, **kw):
    return {"kind": kind, **kw}


def profile(config, v, team, k):
    return config["profiles"][k][v["teams"][team]["speeds"][k]]


def duration(a, config, v, r):
    k = a["kind"]
    t = r // 2
    if k == "move":
        return max(
            1, math.ceil(EDGES[a["edge"]]["distance"] / profile(config, v, t, "move"))
        )
    if k == "wait":
        return a["seconds"]
    name = (
        "pick"
        if k in ("pick", "take", "takeM")
        else "flip"
        if k == "flip"
        else "retry"
        if k == "retry"
        else "handover"
        if k in ("drop", "give", "receive")
        else "place"
    )
    return max(1, math.ceil(profile(config, v, t, name)))


def fits(objects, caps, role):
    if any(o["kind"] == "M" for o in objects):
        return caps["mustika"] and len(objects) == 1
    if len(objects) > caps["capacity_tr" if role == 0 else "capacity_br"]:
        return False
    if any(not caps["earth" if o["kind"] == "E" else "sky"] for o in objects):
        return False
    return caps["mixed"] or len({o["kind"] for o in objects}) <= 1


def concrete_legal(s, r, config, v):
    robot = s["robots"][r]
    team, role = divmod(r, 2)
    caps = v["teams"][team]["caps"]
    rules = config["rules"]
    pos = robot["pos"]
    if s["t"] >= config["horizon"]:
        return []
    retries = [
        action(
            "retry",
            dest=f"start{'B' if role ^ ((v['start'] >> team) & 1) else 'A'}{team}",
        )
    ]
    if role and robot["entered"]:
        retries.append(action("retry", dest=f"transfer{team}"))
    if robot["job"]:
        return [action("continue")]
    opts = [action("wait", seconds=config["horizon"] - s["t"])]
    opts += retries
    held = payload(s, r)
    for eid, dest, e in routes(pos, team, "BR" if role else "TR", caps, rules):
        opts.append(action("move", edge=eid, dest=dest))
    available = []
    if role == 0:
        if pos == f"store{team}":
            available = [o for o in s["objects"] if o["loc"] == pos]
        if pos == f"sky{team}":
            available = [o for o in s["objects"] if o["loc"] == "groundSky"]
        if (
            pos == f"ball{team}"
            and s["mandate"][team]
            and s["objects"][52]["loc"] == "groundBall"
        ):
            available = [s["objects"][52]]
    if pos == f"transfer{team}":
        available = [o for o in s["objects"] if o["loc"] == f"buffer{team}"]
        for o in held:
            opts.append(action("drop", objects=[o["id"]]))
        # Direct handover is a joint, matching pair of operations.
        if (
            role == 0
            and caps["direct"]
            and s["robots"][r + 1]["pos"] == pos
            and s["robots"][r + 1]["job"] is None
        ):
            for o in held:
                if fits(payload(s, r + 1) + [o], caps, 1):
                    opts.append(action("give", objects=[o["id"]], partner=r + 1))
        if (
            role == 1
            and caps["direct"]
            and s["robots"][r - 1]["pos"] == pos
            and s["robots"][r - 1]["job"] is None
        ):
            for o in payload(s, r - 1):
                if fits(held + [o], caps, 1):
                    opts.append(action("receive", objects=[o["id"]], partner=r - 1))
    room = max(0, caps["capacity_tr" if role == 0 else "capacity_br"] - len(held))
    if not held and any(o["kind"] == "M" for o in available):
        room = max(room, 1)
    for size in range(1, min(room, len(available)) + 1):
        for subset in combinations(available, size):
            if not fits(held + list(subset), caps, role):
                continue
            ids = {o["id"] for o in subset}
            if any(
                any(
                    x["slot"] == o["slot"]
                    and x["layer"] > o["layer"]
                    and x["id"] not in ids
                    for x in available
                )
                for o in subset
                if o["kind"] == "E"
            ):
                continue
            opts.append(action("pick", objects=sorted(ids)))
    spot = spot_at(pos)
    if role and spot is not None:
        locked = any(
            rr["job"] and rr["job"]["action"].get("spot") == spot for rr in s["robots"]
        )
        if not locked:
            ts = tower(s, spot)
            for o in held:
                if o["kind"] == "E" and len(ts) < 2 and caps["earth"]:
                    opts.append(action("place", objects=[o["id"]], spot=spot))
                if o["kind"] == "S" and len(ts) == 2 and caps["sky"]:
                    opts.append(action("place", objects=[o["id"]], spot=spot))
            if ts:
                top = ts[-1]
                if top["kind"] == "S" and caps["flip"] and not held:
                    opts.append(action("flip", objects=[top["id"]], spot=spot))
                if (
                    caps["reposition"]
                    and fits(held + [top], caps, 1)
                    and (
                        top["kind"] == "E"
                        and top["owner"] == team
                        or top["kind"] == "S"
                        and rules["sky_relocate"]
                    )
                ):
                    opts.append(action("take", objects=[top["id"]], spot=spot))
    if role and pos == f"pillar{team}" and caps["mustika"]:
        if any(o["kind"] == "M" for o in held) and s["mandate"][team]:
            opts.append(action("placeM", objects=[52]))
        if not held and rules["placed_mustika"] and s["objects"][52]["loc"] == "pillar":
            opts.append(action("takeM", objects=[52]))
    return opts


def legal(s, r, config, v):
    from .abstraction import representatives

    if s["t"] >= config["horizon"]:
        return []
    if s["robots"][r]["job"]:
        return [action("continue")]
    choices = []
    for a in concrete_legal(s, r, config, v):
        held = payload(s, r)
        returns_payload = a["kind"] == "retry" and any(
            o["kind"] == "M" or config["rules"]["retry_payload"] == "return"
            for o in held
        )
        if (
            a["kind"] in ("move", "retry")
            and duration(a, config, v, r) > config["horizon"] - s["t"]
            and not returns_payload
        ):
            continue
        if a["kind"] == "retry" and a["dest"] == s["robots"][r]["pos"]:
            held = payload(s, r)
            if not held or (
                config["rules"]["retry_payload"] == "retain"
                and not any(o["kind"] == "M" for o in held)
            ):
                continue
        choices.append(a)
    return list(representatives(s, choices))


def team_choices(s, team, config, v):
    out = []
    for a, b in product(
        legal(s, team * 2, config, v), legal(s, team * 2 + 1, config, v)
    ):
        direct = a["kind"] == "give" or b["kind"] == "receive"
        if direct and not (
            a["kind"] == "give"
            and b["kind"] == "receive"
            and a["objects"] == b["objects"]
        ):
            continue
        out.append([a, b])
    return out


NAMES = {
    "move": "移動",
    "pick": "取得",
    "drop": "受け渡しエリアの床に置く",
    "give": "直接渡す",
    "receive": "直接受け取る",
    "place": "設置",
    "take": "持ち直す",
    "flip": "スカイブロックを裏返す",
    "placeM": "ムスティカを設置",
    "takeM": "ムスティカを持ち直す",
    "retry": "リトライ",
    "wait": "待機",
    "continue": "継続",
}


def label(a, r=None):
    text = NAMES[a["kind"]]
    if a.get("dest"):
        text += " → " + a["dest"]
    if "spot" in a:
        text += f" 建設スポット{a['spot']}"
    if "objects" in a:
        text += " [" + ",".join(map(str, a["objects"])) + "]"
    if a["kind"] == "wait":
        text += f" {a['seconds']}秒"
    return (ROBOT_NAMES[r] + " " if r is not None else "") + text
