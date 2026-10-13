import json
from tempfile import TemporaryDirectory
from threading import Event
import unittest

from explorer.model.actions import action, legal
from explorer.model.config import defaults, config_at
from explorer.model.state import initial, scores
from explorer.model.transition import successors
from explorer.search.discovery import Planner, discover, persist
from explorer.search.evaluation import classification
from explorer.search.store import Store
from explorer.presentation import replay


class DiscoveryTest(unittest.TestCase):
    def test_start_discovers_score_without_prescribed_goals_and_replays(self):
        c = defaults()
        c["teams"][0]["speeds"]["move"] = [0]
        p = Planner(c, config_at(c, 0))
        result = p.simulate()
        self.assertGreaterEqual(scores(result["state"])[0], 490)
        self.assertTrue(result["state"]["mandate"][0])
        with TemporaryDirectory() as d:
            st = Store.create(d, c)
            evidence = persist(st, 0, result, c)
            self.assertEqual(
                replay(st, evidence["path"])["frames"][-1]["scores"], evidence["scores"]
            )
            self.assertFalse(st.summary()["complete"])
            self.assertGreater(len(evidence["milestones"]), 3)
            # Generated counter order is a legal full match, not score subtraction.
            targets = list(
                dict.fromkeys(
                    g["spot"] for g in result["plan"] if "spot" in g and g["spot"] >= 4
                )
            )
            counter = p.simulate(result["plan"], counter=targets)
            self.assertLess(scores(counter["state"])[0], evidence["scores"][0])

    def test_local_l2_candidate_generated_from_resource_state(self):
        c = defaults()
        c["teams"][0]["speeds"]["move"] = [0]
        v = config_at(c, 0)
        s = initial(c, v)
        s["t"] = 170
        s["robots"][1].update(pos="middle0", entered=True)
        for ids, spot in [([0, 1], 4), ([2, 3], 6)]:
            for layer, oid in enumerate(ids):
                s["objects"][oid].update(
                    loc=f"tower{spot}", layer=layer, delivered=[True, False]
                )
        s["objects"][40].update(loc="robot1", delivered=[True, False])
        s["transfer"][0] = 5
        c.update(scenario="custom", root=s)
        result = Planner(c, v).simulate()
        self.assertEqual(scores(result["state"]), [195, 0])
        c["teams"][0]["caps"]["stairs2"] = [False]
        result = Planner(c, config_at(c, 0)).simulate()
        self.assertEqual(scores(result["state"]), [155, 0])

    def test_delay_reproduces_later_completion_and_is_not_woken(self):
        c = defaults()
        c["scenario"] = "endgame"
        c["teams"][0]["speeds"]["flip"] = [0]
        v = config_at(c, 0)
        s = initial(c, v)
        for t in range(174, 178):
            acts = []
            for r in range(4):
                if s["robots"][r]["job"]:
                    a = action("continue")
                elif r == 1:
                    a = action("delay", seconds=1)
                elif r == 3 and t == 174:
                    a = next(a for a in legal(s, r, c, v) if a["kind"] == "flip")
                else:
                    a = action("wait", seconds=180 - s["t"])
                acts.append(a)
            s = successors(s, acts[:2], acts[2:], c, v)[0]["state"]
            self.assertEqual(s["t"], t + 1)
        acts = [
            action("wait", seconds=2),
            next(a for a in legal(s, 1, c, v) if a["kind"] == "flip"),
            action("wait", seconds=2),
            action("wait", seconds=2),
        ]
        s = successors(s, acts[:2], acts[2:], c, v)[0]["state"]
        self.assertEqual(s["t"], 180)
        self.assertEqual(scores(s)[0] - scores(s)[1], 80)

    def test_resume_preserves_candidates_and_does_not_claim_completeness(self):
        c = defaults()
        c["horizon"] = 1
        with TemporaryDirectory() as d:
            st = Store.create(d, c)
            discover(st, 1)
            before = st.summary()["discovery"]
            stop = Event()
            stop.set()
            discover(st, 1, stop)
            after = Store(st.path).summary()["discovery"]
            self.assertEqual(before["runs"], after["runs"])
            self.assertFalse(after["complete"])
            self.assertEqual(
                after["runs"][0]["candidates"][0]["baseline"]["scores"], [0, 0]
            )

    def test_classification_uses_late_milestones(self):
        def e(spot):
            return (json.dumps([1, "finish", "place", None, spot, [40]]),)

        common = (e(0), e(0), e(0))
        self.assertNotEqual(
            classification(common + (e(4),))[0], classification(common + (e(6),))[0]
        )

    def test_earth_only_capability_still_builds(self):
        c = defaults()
        c["teams"][0]["caps"]["sky"] = [False]
        v = config_at(c, 0)
        p = Planner(c, v)
        self.assertTrue(
            any(
                g["kind"] == "build" and g["height"] == 2
                for g in p.goals(initial(c, v), 0)
            )
        )

    def test_generated_flip_times_completion_at_match_end(self):
        c = defaults()
        c["scenario"] = "endgame"
        c["teams"][0]["speeds"]["flip"] = [0]
        result = Planner(c, config_at(c, 0)).simulate()
        flips = [
            e
            for _, _, o in result["history"]
            for e in o["events"]
            if e["robot"] == 1 and e["action"]["kind"] == "flip"
        ]
        self.assertEqual(
            [(e["phase"], e["t"]) for e in flips], [("start", 178), ("finish", 180)]
        )
