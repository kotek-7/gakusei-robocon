"""Discrete-event macro model; quantities are blocks, durations are seconds.

Rules and modeling assumptions are deliberately documented separately.
Four robots run concurrently. A job reserves its objects/spot at dispatch.
"""
from dataclasses import dataclass, field
from itertools import product
import random


@dataclass(frozen=True)
class Spot:
    name: str
    level: int
    exclusive: int = -1


# Rulebook Fig. 3: 2 private spots/team, 2 shared L1, 4 shared L2.
SPOTS = tuple(
    [Spot(f"R{i}", 1, 0) for i in range(2)]
    + [Spot(f"B{i}", 1, 1) for i in range(2)]
    + [Spot(f"S{i}", 1) for i in range(2)]
    + [Spot(f"U{i}", 2) for i in range(4)]
)


@dataclass(frozen=True)
class Performance:
    name: str = "reference"
    transfer: int = 12  # trip overhead, including ramp and release
    collect: int = 2  # per block; mixed Earth/Sky trip extra cost below
    mixed: int = 4
    ascent: int = 10
    earth: int = 12  # buffer -> spot -> release, one block, on L1
    second: int = 3  # extra cost to place second block in the same trip
    sky: int = 10
    flip: int = 6
    upper: int = 8  # additional L2 trip time
    mustika_tr: int = 16
    mustika_br: int = 20
    success: float = 1.0
    recovery: int = 8

    def __post_init__(self):
        for key, value in vars(self).items():
            if key not in ("name", "success") and (type(value) is not int or value < 1):
                raise ValueError(f"{key} must be a positive integer")
        if not 0 <= self.success <= 1:
            raise ValueError("success must be in [0, 1]")


@dataclass(frozen=True)
class Action:
    kind: str
    spot: int = -1
    earth: int = 0
    sky: int = 0


WAIT = Action("wait")


@dataclass(frozen=True)
class Job:
    action: Action
    end: int
    old_sky: int = -1


@dataclass
class Tower:
    earth: list[int] = field(default_factory=list)
    sky: int = -1


@dataclass
class State:
    t: int = 0
    earth_stock: list[int] = field(default_factory=lambda: [20, 20])
    sky_stock: int = 12
    buffer: list[list[int]] = field(default_factory=lambda: [[0, 0], [0, 0]])
    transfers: list[int] = field(default_factory=lambda: [0, 0])
    towers: list[Tower] = field(default_factory=lambda: [Tower() for _ in SPOTS])
    mandate: list[bool] = field(default_factory=lambda: [False, False])
    mandate_at: list[int | None] = field(default_factory=lambda: [None, None])
    # ground, tr0/tr1, buffer0/buffer1, br0/br1, placed0/placed1
    mustika: str = "ground"
    mustika_at: int | None = None
    jobs: list[Job | None] = field(default_factory=lambda: [None] * 4)
    trace: list[dict] = field(default_factory=list)


def initial(perfs: tuple[Performance, Performance]) -> State:
    s = State()
    for team in range(2):
        s.jobs[team * 2 + 1] = Job(Action("ascent"), perfs[team].ascent)
    return s


def duration(a: Action, p: Performance) -> int:
    if a.kind == "wait":
        return 1
    if a.kind == "transfer":
        return p.transfer + p.collect * (a.earth + a.sky) + (p.mixed if a.earth and a.sky else 0)
    if a.kind == "mustika_tr":
        return p.mustika_tr
    if a.kind == "mustika_br":
        return p.mustika_br
    if a.kind == "earth":
        base = p.earth + (a.earth - 1) * p.second
    elif a.kind == "sky":
        base = p.sky
    elif a.kind == "flip":
        base = p.flip
    else:
        raise ValueError(a)
    return base + (p.upper if SPOTS[a.spot].level == 2 else 0)


def legal(s: State, robot: int) -> list[Action]:
    if s.jobs[robot] is not None:
        return []
    team, role = divmod(robot, 2)
    actions = [WAIT]
    if role == 0:
        for e, c in product(range(4), repeat=2):
            if 1 <= e + c <= 3 and e <= s.earth_stock[team] and c <= s.sky_stock:
                actions.append(Action("transfer", earth=e, sky=c))
        if s.mandate[team] and s.mustika == "ground":
            actions.append(Action("mustika_tr"))
        return actions
    if s.mustika == f"buffer{team}":
        actions.append(Action("mustika_br"))
    locked = {j.action.spot for j in s.jobs if j is not None and j.action.spot >= 0}
    for i, (spot, tower) in enumerate(zip(SPOTS, s.towers)):
        if spot.exclusive not in (-1, team) or i in locked:
            continue
        if tower.sky >= 0:
            if tower.sky != team:
                actions.append(Action("flip", i))
        elif len(tower.earth) < 2:
            for n in range(1, min(2 - len(tower.earth), s.buffer[team][0]) + 1):
                actions.append(Action("earth", i, earth=n))
        elif s.buffer[team][1]:
            actions.append(Action("sky", i, sky=1))
    return actions


def start(s: State, robot: int, a: Action, p: Performance, record=False):
    if a not in legal(s, robot):
        raise ValueError(f"Illegal action for robot {robot}: {a}")
    team = robot // 2
    old_sky = -1
    if a.kind == "transfer":
        s.earth_stock[team] -= a.earth
        s.sky_stock -= a.sky
    elif a.kind in ("earth", "sky"):
        s.buffer[team][0] -= a.earth
        s.buffer[team][1] -= a.sky
    elif a.kind == "flip":
        old_sky = s.towers[a.spot].sky
        s.towers[a.spot].sky = -1  # held sky earns no terminal points
    elif a.kind == "mustika_tr":
        s.mustika = f"tr{team}"
    elif a.kind == "mustika_br":
        s.mustika = f"br{team}"
    s.jobs[robot] = Job(a, s.t + duration(a, p), old_sky)
    if record and a.kind != "wait":
        s.trace.append({"event": "start", "t": s.t, "robot": robot, "action": vars(a), "end": s.jobs[robot].end})


def update_mandate(s: State):
    for team in range(2):
        owned = [i for i, t in enumerate(s.towers) if len(t.earth) == 2 and t.sky == team]
        if len(owned) >= 2 and any(SPOTS[i].exclusive == -1 for i in owned):
            if not s.mandate[team]:
                s.mandate_at[team] = s.t
            s.mandate[team] = True


def finish(s: State, robot: int, p: Performance, rng=None, record=False):
    j = s.jobs[robot]
    assert j is not None and j.end == s.t
    a, team = j.action, robot // 2
    failed = a.kind not in ("wait", "ascent", "recover") and rng is not None and rng.random() >= p.success
    s.jobs[robot] = None
    if failed:
        # Scenario assumption: failed block task keeps payload and retries after recovery.
        # Mustika failure is returned to pillar (5.1.3 / 6.5).
        if a.kind.startswith("mustika"):
            s.mustika = "ground"
            s.jobs[robot] = Job(Action("recover"), s.t + p.recovery)
        else:
            s.jobs[robot] = Job(a, s.t + p.recovery + duration(a, p), j.old_sky)
    elif a.kind == "transfer":
        s.buffer[team][0] += a.earth
        s.buffer[team][1] += a.sky
        s.transfers[team] += a.earth + a.sky
    elif a.kind == "earth":
        s.towers[a.spot].earth.extend([team] * a.earth)
    elif a.kind in ("sky", "flip"):
        s.towers[a.spot].sky = team
    elif a.kind == "mustika_tr":
        s.mustika = f"buffer{team}"
    elif a.kind == "mustika_br":
        s.mustika = f"placed{team}"
        s.mustika_at = s.t
    update_mandate(s)
    if record and a.kind not in ("wait", "recover"):
        s.trace.append({"event": "failure" if failed else "finish", "t": s.t, "robot": robot,
                        "action": vars(a), "score": scores(s), "mandate": s.mandate.copy()})


def advance(s: State, perfs, horizon=180, priority=0, rng=None, record=False):
    pending = [j.end for j in s.jobs if j is not None]
    if not pending:
        raise ValueError("No pending events")
    s.t = min(min(pending), horizon)
    # Same-second order is a scenario parameter, not an official referee rule.
    for team in (priority, 1 - priority):
        for robot in (team * 2, team * 2 + 1):
            if s.jobs[robot] is not None and s.jobs[robot].end == s.t:
                finish(s, robot, perfs[team], rng, record)


def scores(s: State) -> list[int]:
    points = [5 * n for n in s.transfers]
    for spot, tower in zip(SPOTS, s.towers):
        for layer, owner in enumerate(tower.earth):
            points[owner] += (10, 20)[layer] * spot.level
        if tower.sky >= 0:
            points[tower.sky] += 40 * spot.level
    for team in range(2):
        if s.mustika == f"placed{team}":
            points[team] += 250
    return points


def rank(s: State, team: int) -> tuple[int, ...]:
    # 9.3.3/4 attribution follows Earth placer and current Sky color; flagged assumption.
    counts = {1: 0, 2: 0}
    caps = 0
    for spot, tower in zip(SPOTS, s.towers):
        counts[spot.level] += tower.earth.count(team) + int(tower.sky == team)
        caps += int(tower.sky == team)
    return scores(s)[team], int(s.mustika == f"placed{team}"), caps, counts[2], counts[1]


def winner(s: State) -> int:
    """1 red, -1 blue, 0 unresolved by quantitative rules (referee decision)."""
    return (rank(s, 0) > rank(s, 1)) - (rank(s, 0) < rank(s, 1))


def invariant(s: State):
    """Conservation checks include carried objects and objects held during flips."""
    earth = s.earth_stock.copy()
    sky = s.sky_stock + sum(b[1] for b in s.buffer)
    for team in range(2):
        earth[team] += s.buffer[team][0]
    for t in s.towers:
        assert len(t.earth) <= 2
        assert t.sky < 0 or len(t.earth) == 2
        for owner in t.earth:
            earth[owner] += 1
        sky += int(t.sky >= 0)
    for robot, j in enumerate(s.jobs):
        if j:
            earth[robot // 2] += j.action.earth
            sky += j.action.sky + int(j.action.kind == "flip")
    assert earth == [20, 20], earth
    assert sky == 12, sky
    assert s.sky_stock >= 0 and min(s.earth_stock) >= 0
    assert all(min(b) >= 0 for b in s.buffer)


def validate_state(s: State):
    """Validate externally supplied scenarios before search (also under python -O)."""
    def require(condition, message):
        if not condition:
            raise ValueError(message)

    def count(value):
        return type(value) is int and value >= 0

    require(type(s.t) is int and 0 <= s.t <= 180, 'Time must be an integer in [0, 180]')
    require(len(s.towers) == len(SPOTS), 'Exactly ten towers are required')
    require(len(s.jobs) == 4, 'Exactly four robot job slots are required')
    for values in (s.earth_stock, s.buffer, s.transfers, s.mandate, s.mandate_at):
        require(len(values) == 2, 'Exactly two teams are required')
    require(all(type(v) is bool for v in s.mandate), 'Mandates must be booleans')
    require(count(s.sky_stock) and all(count(v) for v in s.earth_stock + s.transfers), 'Invalid stock or transfer count')
    require(all(len(b) == 2 and all(count(v) for v in b) for b in s.buffer), 'Invalid buffer')
    allowed_mustika = {'ground'} | {f'{stage}{team}' for stage in ('tr', 'buffer', 'br', 'placed') for team in range(2)}
    require(s.mustika in allowed_mustika, 'Invalid Mustika location')
    if s.mustika != 'ground':
        require(s.mandate[int(s.mustika[-1])], 'Mustika requires a qualified team')
    earth = [s.earth_stock[i] + s.buffer[i][0] for i in range(2)]
    sky = s.sky_stock + sum(b[1] for b in s.buffer)
    for tower in s.towers:
        require(len(tower.earth) <= 2 and all(type(o) is int and o in (0, 1) for o in tower.earth), 'Invalid Earth layers')
        require(type(tower.sky) is int and tower.sky in (-1, 0, 1), 'Invalid Sky owner')
        require(tower.sky == -1 or len(tower.earth) == 2, 'Sky requires two Earth blocks')
        for owner in tower.earth:
            earth[owner] += 1
        sky += int(tower.sky >= 0)
    locked = set()
    for robot, job in enumerate(s.jobs):
        if job is None:
            continue
        a = job.action
        require(type(job.end) is int and job.end > s.t, 'Pending jobs must end after the scenario time')
        require(a.kind in ('wait', 'ascent', 'recover', 'transfer', 'earth', 'sky', 'flip', 'mustika_tr', 'mustika_br'), 'Invalid job kind')
        require(count(a.earth) and count(a.sky), 'Invalid carried count')
        require(a.earth + a.sky <= (3 if robot % 2 == 0 else 2), 'Carrying limit exceeded')
        if a.kind in ('earth', 'sky', 'flip'):
            require(robot % 2 == 1 and 0 <= a.spot < len(SPOTS), 'Invalid builder target')
            require(SPOTS[a.spot].exclusive in (-1, robot // 2), 'Opponent private spot')
            require(a.spot not in locked, 'Two jobs reserve the same spot')
            locked.add(a.spot)
        if a.kind == 'flip':
            require(job.old_sky in (0, 1) and s.towers[a.spot].sky == -1, 'A flipped Sky must be held')
        earth[robot // 2] += a.earth
        sky += a.sky + int(a.kind == 'flip')
    require(earth == [20, 20] and sky == 12, 'Object quantities must be conserved')
