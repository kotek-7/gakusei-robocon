"""Resource demand signatures. Concrete IDs are witnesses for rendering, not choices.

Stack shape, ownership, face and transfer history are retained. Shared stock is
allocated at contact in arbitration order; a request is fulfilled in full or blocked.
"""

from collections import defaultdict
import json


def attributes(obj):
    return (obj["kind"], obj["owner"], obj["face"], tuple(obj["delivered"]))


def demand(state, action):
    ids = set(action.get("objects", []))
    stacks = defaultdict(list)
    selected = []
    for obj in state["objects"]:
        if obj["loc"].startswith("store"):
            stacks[(obj["loc"], obj["slot"])].append(obj)
        elif obj["id"] in ids:
            selected.append((obj["loc"], attributes(obj)))
    shapes = []
    for (loc, _), stack in stacks.items():
        stack.sort(key=lambda o: o["layer"])
        positions = tuple(i for i, o in enumerate(stack) if o["id"] in ids)
        if positions:
            shapes.append((loc, tuple(attributes(o) for o in stack), positions))
    return json.dumps([sorted(selected), sorted(shapes)], sort_keys=True)


def signature(state, action):
    return json.dumps(
        {k: v for k, v in action.items() if k != "objects"}, sort_keys=True
    ) + demand(state, action)


def representatives(state, actions):
    seen = set()
    for a in actions:
        sig = signature(state, a)
        if sig not in seen:
            seen.add(sig)
            yield a


def outcome_key(state):
    """Deduplicate arbitration orders only; persisted states keep witness IDs."""
    from copy import deepcopy

    result = deepcopy(state)
    for robot in result["robots"]:
        if robot["job"] and "objects" in robot["job"]["action"]:
            robot["job"]["action"]["objects"] = sorted(
                (state["objects"][i]["loc"], attributes(state["objects"][i]))
                for i in robot["job"]["action"]["objects"]
            )
    stacks = defaultdict(list)
    items = []
    for obj in state["objects"]:
        loc = obj["loc"]
        if loc.startswith("store"):
            stacks[(loc, obj["slot"])].append(obj)
        else:
            items.append(
                (loc, obj["layer"] if loc.startswith("tower") else 0, attributes(obj))
            )
    result["objects"] = sorted(items)
    result["stacks"] = sorted(
        (loc, tuple(attributes(o) for o in sorted(stack, key=lambda o: o["layer"])))
        for (loc, _), stack in stacks.items()
    )
    return json.dumps(result, sort_keys=True)
