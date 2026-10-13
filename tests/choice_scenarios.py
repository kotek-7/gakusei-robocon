"""Synthetic finite cases for scheduling capability regressions (not measured robots)."""

from explorer.model.config import defaults, config_at
from explorer.model.state import initial


def local(kind, enabled=True):
    c = defaults()
    c["profiles"]["move"][0] = 10
    c["teams"][0]["speeds"]["move"] = [0]
    v = config_at(c, 0)
    s = initial(c, v)
    for r in (0, 1):
        s["robots"][r].update(pos="transfer0", entered=True)
    if kind == "direct":
        s["t"] = 170
        s["objects"][0].update(loc="tower1", layer=0)
        s["objects"][1]["loc"] = "robot0"
        c["teams"][0]["caps"]["direct"] = [enabled]
    elif kind == "small":
        s["t"] = 170
        s["objects"][0]["loc"] = "buffer0"
        c["teams"][0]["caps"]["capacity_tr"] = [0]
    elif kind == "mixed":
        s["t"] = 164
        s["objects"][0].update(loc="tower1", layer=0)
        s["objects"][1]["loc"] = "buffer0"
        s["objects"][40]["loc"] = "buffer0"
        c["teams"][0]["caps"]["capacity_tr"] = [0]
        c["teams"][0]["caps"]["mixed"] = [enabled]
    elif kind == "switch":
        s["t"] = 166
        s["robots"][1]["pos"] = "spot0-0"
        s["objects"][0]["loc"] = "robot1"
        s["objects"][40]["loc"] = "robot1"
        for oid, layer in [(1, 0), (2, 1)]:
            s["objects"][oid].update(loc="tower6", layer=layer)
        c["teams"][0]["caps"]["capacity_tr"] = [0]
    elif kind == "prefetch":
        s["t"] = 172
        s["robots"][0]["pos"] = "store0"
        s["robots"][1]["pos"] = "spot6-0"
        for oid, layer in [(0, 0), (1, 1), (40, 2)]:
            s["objects"][oid].update(loc="tower6", layer=layer)
        s["objects"][40]["face"] = 1
    c.update(scenario="custom", root=s, name=kind + str(enabled))
    return c
