import unittest
from explorer.model.config import defaults, config_at, validate
from explorer.model.state import initial, scores
from explorer.model.actions import legal, concrete_legal, action
from explorer.model.abstraction import signature, outcome_key
from explorer.model.transition import successors


class ResourceModelTest(unittest.TestCase):
    def setUp(self):
        self.c = defaults()
        self.v = config_at(self.c, 0)
        self.s = initial(self.c, self.v)

    def step(self, chosen):
        acts = [
            chosen.get(r, action("wait", seconds=180 - self.s["t"])) for r in range(4)
        ]
        return successors(self.s, acts[:2], acts[2:], self.c, self.v)

    def test_resource_choices_cover_concrete_demands(self):
        for pos in ("sky0", "store0"):
            self.s["robots"][0]["pos"] = pos
            raw = [
                a
                for a in concrete_legal(self.s, 0, self.c, self.v)
                if a["kind"] == "pick"
            ]
            reduced = [
                a for a in legal(self.s, 0, self.c, self.v) if a["kind"] == "pick"
            ]
            self.assertEqual(
                {signature(self.s, a) for a in raw},
                {signature(self.s, a) for a in reduced},
            )
            self.assertLess(len(reduced), len(raw))
            if pos == "sky0":
                self.assertEqual((len(raw), len(reduced)), (298, 3))

    def test_transfer_history_remains_a_choice(self):
        self.s["robots"][0]["pos"] = "sky0"
        self.s["objects"][40]["delivered"][0] = True
        choices = [
            a
            for a in legal(self.s, 0, self.c, self.v)
            if a["kind"] == "pick" and len(a["objects"]) == 1
        ]
        self.assertEqual(len(choices), 2)

    def test_plentiful_stock_has_no_artificial_conflict(self):
        self.s["robots"][0]["pos"] = "sky0"
        self.s["robots"][2]["pos"] = "sky1"
        outs = self.step(
            {
                0: action("pick", objects=[40, 41, 42]),
                2: action("pick", objects=[40, 41, 42]),
            }
        )
        self.assertEqual(len(outs), 1)
        self.assertEqual(outs[0]["cases"], [0, 1])
        self.assertEqual(outs[0]["state"]["t"], 2)
        for r in (0, 2):
            self.assertEqual(
                sum(o["loc"] == f"robot{r}" for o in outs[0]["state"]["objects"]), 3
            )
        self.assertFalse(any(e["phase"] == "blocked" for e in outs[0]["events"]))

    def test_scarce_stock_retains_winner_branches(self):
        self.s["robots"][0]["pos"] = "sky0"
        self.s["robots"][2]["pos"] = "sky1"
        for o in self.s["objects"][41:52]:
            o["loc"] = "buffer0"
        outs = self.step(
            {0: action("pick", objects=[40]), 2: action("pick", objects=[40])}
        )
        self.assertEqual(len(outs), 2)
        self.assertEqual(
            {o["started"]["objects"][40]["loc"] for o in outs}, {"robot0", "robot2"}
        )
        self.assertNotEqual(
            outcome_key(outs[0]["state"]), outcome_key(outs[1]["state"])
        )

    def test_event_jump_and_no_mid_action_retry(self):
        self.s["robots"][0]["pos"] = "sky0"
        self.v["teams"][0]["speeds"]["pick"] = 2
        out = self.step({0: action("pick", objects=[40])})[0]
        self.assertEqual(out["state"]["t"], 4)
        self.assertEqual(legal(out["started"], 0, self.c, self.v), [action("continue")])
        self.assertIsNone(out["state"]["robots"][2]["job"])

    def test_flip_speed_changes_reachable_score(self):
        self.c["scenario"] = "endgame"
        for profile, expected in ((0, [125, 45]), (1, [85, 45]), (2, [85, 45])):
            self.v["teams"][0]["speeds"]["flip"] = profile
            self.s = initial(self.c, self.v)
            self.s["t"] = 178
            out = self.step({1: action("flip", objects=[41], spot=4)})[0]
            self.assertEqual(scores(out["state"]), expected)
            self.assertEqual(out["state"]["t"], 180)

    def test_old_model_is_rejected(self):
        self.c["version"] = "finite-operations-1"
        with self.assertRaises(ValueError):
            validate(self.c)

    def test_classification_groups_travel_and_object_ids_only(self):
        import json
        from explorer.search.evaluation import classification

        def event(kind, objects, dest=None):
            return json.dumps([1, "finish", kind, dest, 6, objects])

        a = ((event("move", None, "sky0"),), (event("place", [40, 41]),))
        b = ((event("move", None, "south0"),), (event("place", [42, 43]),))
        self.assertEqual(classification(a), classification(b))
        self.assertNotEqual(
            classification(a), classification(((event("place", [40]),),))
        )

    def test_late_movement_removed_but_resource_effects_retained(self):
        self.s["t"] = 179
        self.s["robots"][0]["pos"] = "sky0"
        choices = legal(self.s, 0, self.c, self.v)
        self.assertFalse(any(a["kind"] in ("move", "retry") for a in choices))
        self.assertTrue(any(a["kind"] == "pick" for a in choices))
        self.s["objects"][40]["loc"] = "robot0"
        self.c["rules"]["retry_payload"] = "return"
        self.assertTrue(
            any(a["kind"] == "retry" for a in legal(self.s, 0, self.c, self.v))
        )
