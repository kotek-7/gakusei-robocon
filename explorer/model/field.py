"""Finite action sites and corridor edges, metres, Y up; not rigid-body physics."""

import math

SPOTS = [
    (-2.75, 0.6, -2.75, 1, 0),
    (-2.75, 0.6, 2.75, 1, 0),
    (2.75, 0.6, -2.75, 1, 1),
    (2.75, 0.6, 2.75, 1, 1),
    (0, 0.6, -2.75, 1, -1),
    (0, 0.6, 2.75, 1, -1),
    (-1.25, 0.9, -1.25, 2, -1),
    (-1.25, 0.9, 1.25, 2, -1),
    (1.25, 0.9, -1.25, 2, -1),
    (1.25, 0.9, 1.25, 2, -1),
]
NODES = {}
EDGES = []


def node(name, p, team=-1, roles=("TR", "BR")):
    NODES[name] = {"id": name, "p": list(p), "team": team, "roles": list(roles)}
    return name


def edge(a, b, ability="walk", roles=("TR", "BR")):
    pa, pb = NODES[a]["p"], NODES[b]["p"]
    side = -1 if pa[0] < 0 else 1
    if ability == "ramp":
        route = [
            pa,
            [side * 3.5, 0, -3.15],
            [side * 3.5, 0, -2.694],
            [side * 3.5, 0.6, 0.8],
            pb,
        ]
    elif ability == "stairs1":
        route = [
            pa,
            [side * 3.5, 0, 3.1],
            [side * 3.5, 0, 2.7],
            [side * 3.5, 0.15, 2.55],
            [side * 3.5, 0.3, 2.25],
            [side * 3.5, 0.45, 1.95],
            pb,
        ]
    elif ability == "stairs2":
        route = [
            pa,
            [side * 1.95, 0.6, 0],
            [side * 1.65, 0.75, 0],
            [side * 1.15, 0.9, 0],
            pb,
        ]
    else:
        route = [pa, pb]
    EDGES.append(
        {
            "a": a,
            "b": b,
            "ability": ability,
            "roles": list(roles),
            "route": route,
            "distance": round(
                sum(math.dist(p, q) for p, q in zip(route, route[1:])), 6
            ),
        }
    )


for team in (0, 1):
    s = -1 if team == 0 else 1

    def n(k, p, roles=("TR", "BR")):
        return node(f"{k}{team}", p, team, roles)

    n("startA", (s * 5.1, 0, 5.1))
    n("startB", (s * 4.25, 0, 5.1))
    n("south", (s * 4.6, 0, 3.1))
    n("north", (s * 4.6, 0, -3.15))
    n("store", (s * 4.5, 0, -4.05), ("TR",))
    n("sky", (s * 0.95, 0, 4.6073), ("TR",))
    n("ball", (s * 0.55, 0, -3.8856), ("TR",))
    n("transfer", (s * 3.5, 0.6, 1.3))
    n("lane", (s * 2.1, 0.6, 1.3), ("BR",))
    n("middle", (s * 2.1, 0.6, 0), ("BR",))
    n("upper", (s * 0.65, 0.9, 0), ("BR",))
    n("pillar", (s * 0.55, 0.9, 0), ("BR",))
    for k in ("startA", "startB"):
        edge(k + str(team), "south" + str(team))
    edge("south" + str(team), "north" + str(team))
    edge("north" + str(team), "store" + str(team), roles=("TR",))
    edge("south" + str(team), "sky" + str(team), roles=("TR",))
    edge("north" + str(team), "ball" + str(team), roles=("TR",))
    edge("north" + str(team), "transfer" + str(team), "ramp")
    edge("south" + str(team), "transfer" + str(team), "stairs1")
    edge("transfer" + str(team), "lane" + str(team), roles=("BR",))
    edge("lane" + str(team), "middle" + str(team), roles=("BR",))
    edge("middle" + str(team), "upper" + str(team), "stairs2", ("BR",))
    edge("upper" + str(team), "pillar" + str(team), roles=("BR",))
    for i, (x, y, z, level, owner) in enumerate(SPOTS):
        if owner not in (-1, team):
            continue
        p = (
            (math.copysign(0.85, x), y, math.copysign(0.85, z))
            if level == 2
            else (s * (0.55 if owner == -1 else 2.15), y, math.copysign(2.55, z))
        )
        name = node(f"spot{i}-{team}", p, team, ("BR",))
        if level == 1:
            lane = n(
                f"lane{1 if z > 0 else 0}-",
                (s * 2.1, 0.6, math.copysign(2.05, z)),
                ("BR",),
            )
            if not any(e["a"] == f"middle{team}" and e["b"] == lane for e in EDGES):
                edge(f"middle{team}", lane, roles=("BR",))
            edge(lane, name, roles=("BR",))
        else:
            edge(f"upper{team}", name, roles=("BR",))


def routes(position, team, role, caps, rules):
    for i, e in enumerate(EDGES):
        if role not in e["roles"] or position not in (e["a"], e["b"]):
            continue
        dest = e["b"] if position == e["a"] else e["a"]
        if NODES[dest]["team"] not in (-1, team) or role not in NODES[dest]["roles"]:
            continue
        ability = e["ability"]
        if ability != "walk" and not caps[ability]:
            continue
        if role == "BR" and ability == "ramp" and not rules["br_ramp"]:
            continue
        if (
            role == "BR"
            and {position, dest} == {f"south{team}", f"north{team}"}
            and not (rules["br_ramp"] and caps["ramp"])
        ):
            continue
        # BR ground travel is restricted to its initial ascent corridor.
        if role == "BR" and NODES[dest]["p"][1] == 0 and NODES[position]["p"][1] > 0:
            continue
        yield i, dest, e


def spot_at(position):
    return int(position.split("-")[0][4:]) if position.startswith("spot") else None
