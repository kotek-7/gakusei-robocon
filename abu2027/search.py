"""Explicitly bounded searches: policy enumeration and exhaustive event trees."""
from copy import deepcopy
from dataclasses import dataclass
from itertools import permutations, product
from collections import Counter
import random

from .model import (SPOTS, Action, WAIT, Performance, State, initial, legal, duration,
                    start, advance, scores, winner, invariant)


@dataclass(frozen=True)
class Policy:
    order: tuple[str, ...]
    mission: bool
    flip_at: int
    supply: str
    qualify_first: bool = True

    @property
    def name(self):
        q = f"Q{int(self.qualify_first)}" if self.mission else ""
        return f"{''.join(self.order)}-M{int(self.mission)}{q}-F{self.flip_at}-{self.supply}"


def policies():
    # 6 * 3 * 3 * 2 = 108 policies, including both qualification orders.
    return [Policy(o, m, f, t, q) for o, (m,q), f, t in product(
        permutations("PSU"), ((False,False),(True,False),(True,True)),
        (0, 120, 181), ("balanced", "skyfirst"))]


def choose(s: State, robot: int, policy: Policy, perf: Performance, horizon=180):
    actions = [a for a in legal(s, robot) if s.t + duration(a, perf) <= horizon]
    if not actions:
        return WAIT
    team, role = divmod(robot, 2)
    mission = "mustika_tr" if role == 0 else "mustika_br"
    if policy.mission and Action(mission) in actions:
        return Action(mission)
    if role == 0:
        trips = [a for a in actions if a.kind == "transfer"]
        if not trips:
            return WAIT
        e, c = s.buffer[team]
        # Fixed buffer thresholds; no inter-robot messages are used.
        if c < 2 and policy.supply == "skyfirst":
            key = lambda a: (a.sky, a.earth)
        elif c < 2 and e < 4:
            key = lambda a: (int(a.earth == 2 and a.sky == 1), a.earth + a.sky, a.sky)
        elif c < 2:
            key = lambda a: (a.sky, a.earth)
        else:
            key = lambda a: (a.earth, a.sky)
        return max(trips, key=key)
    flips = [a for a in actions if a.kind == "flip"]
    owned = [i for i, tower in enumerate(s.towers) if tower.sky == team]
    shared_owned = any(SPOTS[i].exclusive == -1 for i in owned)
    if policy.mission and policy.qualify_first and not s.mandate[team] and owned:
        qualifying = [a for a in flips if shared_owned or SPOTS[a.spot].exclusive == -1]
        if qualifying:
            return min(qualifying, key=lambda a: duration(a, perf))
    if s.t >= policy.flip_at and flips:
        return max(flips, key=lambda a: (SPOTS[a.spot].level, -a.spot))
    build = [a for a in actions if a.kind in ("earth", "sky")]
    if policy.mission and policy.qualify_first and not s.mandate[team] and owned and not shared_owned:
        build = [a for a in build if SPOTS[a.spot].exclusive == -1]
    if not build:
        return WAIT

    def key(a):
        spot = SPOTS[a.spot]
        zone = "P" if spot.exclusive >= 0 else "S" if spot.level == 1 else "U"
        return (policy.order.index(zone), -len(s.towers[a.spot].earth), -a.earth, a.spot)
    return min(build, key=key)


def dispatch(s, choices, perfs, priority=0, record=False):
    """Choices made on one snapshot; simultaneous reservation conflicts wait 1 s."""
    for team in (priority, 1 - priority):
        for robot in (team * 2, team * 2 + 1):
            if robot in choices:
                a = choices[robot]
                if a not in legal(s, robot):
                    a = WAIT
                start(s, robot, a, perfs[team], record)


def simulate(red, blue, perfs, *, priority=0, seed=0, horizon=180, record=False, check=False, skip_waits=True):
    s = initial(perfs)
    rng = random.Random(seed) if any(p.success < 1 for p in perfs) else None
    while s.t < horizon:
        choices = {r: choose(s, r, (red, blue)[r // 2], perfs[r // 2], horizon)
                   for r in range(4) if s.jobs[r] is None}
        dispatch(s, choices, perfs, priority, record)
        if skip_waits and all(a == WAIT for a in choices.values()):
            # The policy can change only after a job ends or a flip threshold.
            # Collapse no-op seconds without skipping any decision opportunity.
            from .model import Job
            wake = min([horizon] + [j.end for j in s.jobs if j and j.action != WAIT]
                       + [p.flip_at for p in (red,blue) if s.t < p.flip_at <= horizon])
            for r,j in enumerate(s.jobs):
                if j and j.action == WAIT:
                    s.jobs[r] = Job(WAIT,wake)
        advance(s, perfs, horizon, priority, rng, record)
        if check:
            invariant(s)
    return s


def state_key(s):
    return (s.t, tuple(s.earth_stock), s.sky_stock, tuple(map(tuple, s.buffer)),
            tuple(s.transfers), tuple((tuple(t.earth), t.sky) for t in s.towers),
            tuple(s.mandate), s.mustika, tuple(s.jobs))


def exhaustive(root, perfs, *, horizon=180, priority=0, active=(0, 1, 2, 3), max_states=100000):
    """Enumerate every reachable abstract state/edge under fixed tie priority.

    This is reachability, not a minimax solution. Visited-state merging preserves
    terminal outcomes, not the number of histories. A cap always marks incomplete.
    Stochastic failures are intentionally refused here.
    """
    if any(p.success != 1 for p in perfs):
        raise ValueError("Exact search requires deterministic performance")
    if max_states < 1 or horizon < root.t:
        raise ValueError("Invalid search bound")
    stack = [deepcopy(root)]
    seen, terminals = set(), Counter()
    edges, complete = 0, True
    terminal_scores = set()
    while stack:
        s = stack.pop()
        key = state_key(s)
        if key in seen:
            continue
        if len(seen) >= max_states:
            complete = False
            break
        seen.add(key)
        if s.t >= horizon:
            terminals[winner(s)] += 1
            terminal_scores.add(tuple(scores(s)))
            continue
        idle = [r for r in range(4) if s.jobs[r] is None]
        options = [legal(s, r) if r in active else [WAIT] for r in idle]
        for combo in product(*options):
            child = deepcopy(s)
            dispatch(child, dict(zip(idle, combo)), perfs, priority)
            advance(child, perfs, horizon, priority)
            invariant(child)
            stack.append(child)
            edges += 1
    return {"complete": complete, "states": len(seen), "edges": edges,
            "terminal_states_by_winner": dict(terminals), "terminal_scores": sorted(terminal_scores),
            "pending_stack": len(stack), "horizon": horizon, "priority": priority,
            "active_robots": list(active), "max_states": max_states,
            "meaning": "reachable abstract states; not history counts or optimal strategy"}
