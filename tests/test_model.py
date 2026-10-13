import unittest
from explorer.model.config import (
    defaults,
    config_at,
    count_configs,
    validate as validate_config,
)
from explorer.model.state import initial, validate, scores
from explorer.model.actions import legal, action
from explorer.model.transition import successors


class ModelTest(unittest.TestCase):
    def setUp(self):
        self.c = defaults()
        self.v = config_at(self.c, 0)
        self.s = initial(self.c, self.v)

    def step(self, choices, s=None):
        s = s or self.s
        a = [
            choices.get(
                r,
                action("continue")
                if s["robots"][r]["job"]
                else action("wait", seconds=180 - s["t"]),
            )
            for r in range(4)
        ]
        return successors(s, a[:2], a[2:], self.c, self.v)

    def finish(self, s):
        while any(
            r["job"] and r["job"]["action"]["kind"] != "wait" for r in s["robots"]
        ):
            s = self.step({}, s)[0]["state"]
        return s

    def test_independent_profiles(self):
        self.c["teams"][0]["speeds"]["move"] = [0, 1, 2]
        self.c["teams"][0]["speeds"]["pick"] = [0, 1, 2]
        self.assertEqual(count_configs(self.c), 9)

    def test_nan_rejected(self):
        self.c["profiles"]["pick"][0] = float("nan")
        with self.assertRaises(ValueError):
            validate_config(self.c)

    def test_capability(self):
        self.s["robots"][1]["pos"] = "middle0"
        self.v["teams"][0]["caps"]["stairs2"] = False
        self.assertFalse(
            any(a.get("dest") == "upper0" for a in legal(self.s, 1, self.c, self.v))
        )

    def test_retry_interpretation(self):
        self.s["objects"][0]["loc"] = "robot0"
        self.s["robots"][0]["pos"] = "store0"
        a = action("retry", dest="startA0")
        self.assertEqual(self.step({0: a})[0]["started"]["objects"][0]["loc"], "robot0")
        self.c["rules"]["retry_payload"] = "return"
        self.assertEqual(self.step({0: a})[0]["started"]["objects"][0]["loc"], "store0")

    def test_conflict_branches(self):
        self.s["robots"][0]["pos"] = "sky0"
        self.s["robots"][2]["pos"] = "sky1"
        for o in self.s["objects"][41:52]:
            o["loc"] = "buffer0"
        a = action("pick", objects=[40])
        outs = self.step({0: a, 2: a})
        self.assertEqual(len(outs), 2)
        self.assertEqual(
            {o["started"]["objects"][40]["loc"] for o in outs}, {"robot0", "robot2"}
        )
        for o in outs:
            validate(o["state"])

    def test_wait_wakes(self):
        self.s["robots"][0]["pos"] = "sky0"
        s = self.step(
            {0: action("pick", objects=[40]), 2: action("wait", seconds=180)}
        )[0]["state"]
        self.assertEqual(s["t"], 2)
        self.assertIsNone(s["robots"][2]["job"])

    def test_no_departure_reservation(self):
        self.s["robots"][0]["pos"] = "south0"
        a = next(a for a in legal(self.s, 0, self.c, self.v) if a.get("dest") == "sky0")
        self.assertEqual(
            self.step({0: a})[0]["started"]["objects"][40]["loc"], "groundSky"
        )

    def test_direct_handover(self):
        for r in (0, 1):
            self.s["robots"][r]["pos"] = "transfer0"
        self.s["objects"][0]["loc"] = "robot0"
        s = self.finish(
            self.step(
                {
                    0: action("give", objects=[0], partner=1),
                    1: action("receive", objects=[0], partner=0),
                }
            )[0]["state"]
        )
        self.assertEqual(s["objects"][0]["loc"], "robot1")
        self.assertEqual(s["transfer"][0], 1)

    def test_flip_held_unscored(self):
        for oid, layer in ((20, 0), (21, 1), (40, 2)):
            self.s["objects"][oid].update(loc="tower4", layer=layer, face=1)
        self.s["robots"][1]["pos"] = "spot4-0"
        a = action("flip", objects=[40], spot=4)
        out = self.step({1: a})[0]
        self.assertEqual(scores(out["started"]), [0, 30])
        self.assertEqual(scores(self.finish(out["state"])), [40, 30])

    def test_custom_payload_checks_all_variants(self):
        self.c["scenario"] = "custom"
        self.s["objects"][1]["loc"] = "robot0"
        self.c["root"] = self.s
        self.c["teams"][0]["caps"]["earth"] = [True, False]
        with self.assertRaises(ValueError):
            validate_config(self.c)

    def test_terminal(self):
        self.s["t"] = 180
        self.assertEqual(legal(self.s, 0, self.c, self.v), [])
