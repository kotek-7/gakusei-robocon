"""Choice coverage and independent, finite primitive reference enumeration."""

import json
from itertools import product
from tempfile import TemporaryDirectory
import unittest

from explorer.model.config import defaults, config_at
from explorer.model.state import initial, key, scores
from explorer.model.actions import legal, action
from explorer.model.transition import successors
from explorer.search.choices import choices, fixed_choice, matched
from explorer.search.discovery import Planner, discover, setup, new_job, step
from explorer.search.store import Store, connect


def fixture(horizon=2):
    c = defaults()
    v = config_at(c, 0)
    s = initial(c, v)
    s["t"] = 180 - horizon
    for r in (0, 1):
        s["robots"][r].update(pos="transfer0", entered=True)
    for oid in (0, 40):
        s["objects"][oid].update(loc="buffer0", layer=0, slot=oid)
    c.update(scenario="custom", root=s)
    return c


def reference(c):
    """No production choice generator: fixtures cannot reach another operation site.

    Enumerate concrete primitive resource choices; all event waits are retained.
    No arbitrary delay, retry or travel can finish with an effect in these fixtures.
    """
    v = config_at(c, 0)
    seen = set()
    terminals = set()
    queue = [initial(c, v)]
    while queue:
        s = queue.pop()
        k = key(s)
        if k in seen:
            continue
        seen.add(k)
        if s["t"] == c["horizon"]:
            terminals.add(k)
            continue
        opts = []
        for r in range(4):
            if r >= 2:
                opts.append(
                    [
                        action("continue")
                        if s["robots"][r]["job"]
                        else action("wait", seconds=c["horizon"] - s["t"])
                    ]
                )
                continue
            opts.append(
                [
                    a
                    for a in legal(s, r, c, v)
                    if a["kind"] not in ("move", "retry", "delay")
                ]
            )
        for acts in product(*opts):
            a, b = acts[:2]
            if (a["kind"] == "give" or b["kind"] == "receive") and not (
                a["kind"] == "give"
                and b["kind"] == "receive"
                and a["objects"] == b["objects"]
            ):
                continue
            for o in successors(s, acts[:2], acts[2:], c, v):
                queue.append(o["state"])
    return terminals


def exhaust(c):
    with TemporaryDirectory() as d:
        st = Store.create(d, c)
        p = Planner(c, config_at(c, 0))
        with connect(st.path) as db:
            setup(db)
            jid = new_job(db, 0, "baseline")
            count = 0
            while True:
                j = db.execute(
                    "SELECT * FROM discovery_jobs WHERE id=?", (jid,)
                ).fetchone()
                if j["done"]:
                    break
                step(db, st, p, j)
                count += 1
                if count > 50000:
                    raise AssertionError("fixture must be small enough to exhaust")
            states = [
                json.loads(r[0])
                for r in db.execute(
                    "SELECT DISTINCT n.state FROM discovery_states s JOIN nodes n ON n.id=s.node WHERE s.job=?",
                    (jid,),
                )
            ]
            return {key(s) for s in states if s["t"] == c["horizon"]}


def first_candidate(c, minimum=0):
    with TemporaryDirectory() as d:
        st = Store.create(d, c)
        p = Planner(c, config_at(c, 0))
        with connect(st.path) as db:
            setup(db)
            jid = new_job(db, 0, "baseline")
            for _ in range(2000):
                j = db.execute(
                    "SELECT * FROM discovery_jobs WHERE id=?", (jid,)
                ).fetchone()
                result = step(db, st, p, j)
                if result and result[0]["scores"][0] >= minimum:
                    return result
        raise AssertionError("no completed candidate")


class ChoiceSearchTest(unittest.TestCase):
    def test_independent_reference_terminal_sets(self):
        for seconds in (1, 2, 3):
            c = fixture(seconds)
            self.assertEqual(exhaust(c), reference(c))

    def test_quantity_mixed_and_direct_choices_both_teams(self):
        c = fixture()
        v = config_at(c, 0)
        p = Planner(c, v)
        s = initial(c, v)
        for team in (0, 1):
            tr, br = team * 2, team * 2 + 1
            for r in (tr, br):
                s["robots"][r].update(pos=f"transfer{team}", entered=True)
            for oid in (team * 20, 40 + team):
                s["objects"][oid]["loc"] = f"buffer{team}"
            picks = [a for a, _ in choices(p, s, br) if a["kind"] == "pick"]
            self.assertTrue(any(len(a["objects"]) == 1 for a in picks))
            self.assertTrue(
                any(
                    {s["objects"][i]["kind"] for i in a["objects"]} == {"E", "S"}
                    for a in picks
                )
            )
            s["objects"][team * 20]["loc"] = f"robot{tr}"
            a = choices(p, s, tr)
            b = choices(p, s, br)
            self.assertTrue(any(x["kind"] == "drop" for x, _ in a))
            self.assertTrue(
                any(
                    x["kind"] == "give"
                    and y["kind"] == "receive"
                    and matched([x, y, x, y])
                    for (x, _), (y, _) in product(a, b)
                )
            )

    def test_partial_construction_and_prefetch_independent(self):
        c = defaults()
        v = config_at(c, 0)
        s = initial(c, v)
        p = Planner(c, v)
        s["robots"][1].update(pos="spot0-0", entered=True)
        s["objects"][0]["loc"] = "robot1"
        s["objects"][1].update(loc="tower0", layer=0)
        br = choices(p, s, 1)
        self.assertTrue(any(a["kind"] == "place" for a, _ in br))
        self.assertTrue(any(i and i.get("dest") == "spot4-0" for _, i in br))
        s["robots"][1]["job"] = {
            "action": action("place", objects=[0], spot=0),
            "start": 0,
            "end": 4,
            "from": "spot0-0",
        }
        tr = choices(p, s, 0)
        self.assertTrue(any(i and i.get("dest") == "store0" for _, i in tr))
        self.assertTrue(any(i and i.get("dest") == "sky0" for _, i in tr))

    def test_mixed_pickup_after_visiting_other_source(self):
        c = defaults()
        v = config_at(c, 0)
        s = initial(c, v)
        p = Planner(c, v)
        s["robots"][0]["pos"] = "sky0"
        s["objects"][0]["loc"] = "robot0"
        self.assertTrue(
            any(
                a["kind"] == "pick"
                and all(s["objects"][i]["kind"] == "S" for i in a["objects"])
                for a, _ in choices(p, s, 0)
            )
        )

    def test_capacity_addition_keeps_small_load_choices_and_optimum(self):
        sets = []
        best = []
        for capacity in (1, 2):
            c = fixture(1)
            c["teams"][0]["caps"]["capacity_br"] = [capacity]
            v = config_at(c, 0)
            s = initial(c, v)
            p = Planner(c, v)
            sets.append(
                {json.dumps(a, sort_keys=True) for a, i in choices(p, s, 1) if not i}
            )
            terminals = exhaust(c)
            best.append(max(scores(json.loads(k))[0] for k in terminals))
        self.assertLessEqual(sets[0], sets[1])
        self.assertLessEqual(best[0], best[1])

    def test_automatic_quantity_direct_mixed_and_parallel_results(self):
        from tests.choice_scenarios import local

        small = first_candidate(local("small"))
        self.assertEqual(small[0]["scores"][0], 20)
        direct_off = first_candidate(local("direct", False))
        direct_on = first_candidate(local("direct", True))
        self.assertGreater(direct_on[0]["scores"][0], direct_off[0]["scores"][0])
        self.assertTrue(
            any(i.get("action", {}).get("kind") == "give" for i in direct_on[1][0])
        )
        mixed_off = first_candidate(local("mixed", False))
        mixed_on = first_candidate(local("mixed", True))
        self.assertEqual(
            (mixed_off[0]["scores"][0], mixed_on[0]["scores"][0]), (30, 70)
        )
        prefetch = first_candidate(local("prefetch"), 145)
        self.assertGreater(prefetch[0]["scores"][0], 140)
        switched = first_candidate(local("switch"), 150)
        self.assertGreaterEqual(switched[0]["scores"][0], 150)

    def test_arbitration_siblings_get_continuations(self):
        from explorer.search.choices import instruction

        c = defaults()
        v = config_at(c, 0)
        s = initial(c, v)
        s["t"] = 179
        for r in (0, 2):
            s["robots"][r]["pos"] = f"sky{r // 2}"
        # All requests compete for the same last free sky block.
        for o in s["objects"][41:52]:
            o["loc"] = "buffer0"
        c.update(scenario="custom", root=s)
        scripts = {}
        for team in (0, 1):
            r = team * 2
            a = next(
                a
                for a in legal(s, r, c, v)
                if a["kind"] == "pick" and len(a["objects"]) == 1
            )
            scripts[str(team)] = [[instruction(s, r, a, None)], []]
        with TemporaryDirectory() as d:
            st = Store.create(d, c)
            p = Planner(c, v)
            with connect(st.path) as db:
                setup(db)
                jid = new_job(db, 0, "compare", scripts=scripts)
                j = db.execute(
                    "SELECT * FROM discovery_jobs WHERE id=?", (jid,)
                ).fetchone()
                step(db, st, p, j)
                self.assertEqual(
                    db.execute("SELECT count(*) FROM discovery_links").fetchone()[0], 2
                )
                self.assertEqual(
                    db.execute(
                        "SELECT count(*) FROM discovery_states WHERE parent IS NOT NULL AND done=0"
                    ).fetchone()[0],
                    2,
                )

    def test_fixed_procedure_does_not_substitute_another_action(self):
        c = fixture()
        p = Planner(c, config_at(c, 0))
        s = initial(c, p.v)
        script = [
            {
                "kind": "operation",
                "at": "spot0-0",
                "action": {"kind": "place", "spot": 0},
                "demand": "[]",
            }
        ]
        opts, index, blocked = fixed_choice(p, s, 1, None, script, 0)
        self.assertEqual(index, 0)
        self.assertTrue(blocked)
        self.assertEqual(opts[0][0]["kind"], "wait")

    def test_resume_preserves_cursor_commitments_and_links(self):
        c = defaults()
        with TemporaryDirectory() as d:
            st = Store.create(d, c)
            discover(st, 0.2)
            with connect(st.path) as db:
                before = {
                    r["id"]: r["cursor"]
                    for r in db.execute("SELECT * FROM discovery_states")
                }
                self.assertTrue(
                    any(
                        json.loads(r[0])["commitments"] != [None] * 4
                        for r in db.execute("SELECT context FROM discovery_states")
                    )
                )
            discover(Store(st.path), 0.2)
            with connect(st.path) as db:
                after = {
                    r["id"]: r["cursor"]
                    for r in db.execute("SELECT * FROM discovery_states")
                }
                self.assertTrue(all(after[k] >= v for k, v in before.items()))
                self.assertTrue(
                    db.execute("SELECT count(*) FROM discovery_links").fetchone()[0]
                )
            self.assertFalse(st.summary()["complete"])


if __name__ == "__main__":
    unittest.main()
