import unittest
from dataclasses import replace

from abu2027.model import *
from abu2027.search import Policy, choose, policies, simulate, exhaustive, dispatch


class RulesTest(unittest.TestCase):
    def test_transfer_capacity_and_no_double_award(self):
        s, p = State(), Performance()
        self.assertTrue(all(a.earth + a.sky <= 3 for a in legal(s, 0)))
        start(s, 0, Action("transfer", earth=2, sky=1), p)
        invariant(s)
        advance(s, (p, p))
        self.assertEqual(scores(s), [15, 0])
        start(s, 1, Action("earth", 0, earth=2), p)
        advance(s, (p, p))
        self.assertEqual(scores(s), [45, 0])
        self.assertEqual(s.transfers, [3, 0])
        invariant(s)

    def test_mixed_tower_flip_and_mandate_latch(self):
        s, p = State(), Performance()
        s.towers[6] = Tower([0, 1], 1)
        s.towers[0] = Tower([0, 0], 0)
        self.assertEqual(scores(s), [90, 120])
        start(s, 1, Action("flip", 6), p)
        self.assertEqual(scores(s), [90, 40])  # held Sky is excluded
        advance(s, (p, p))
        self.assertEqual(scores(s), [170, 40])
        self.assertTrue(s.mandate[0])
        start(s, 3, Action("flip", 6), p)
        advance(s, (p, p))
        self.assertTrue(s.mandate[0])
        self.assertEqual(scores(s), [90, 120])

    def test_two_private_towers_do_not_unlock(self):
        s = State()
        s.towers[0] = Tower([0, 0], 0)
        s.towers[1] = Tower([0, 0], 0)
        update_mandate(s)
        self.assertFalse(s.mandate[0])
        self.assertNotIn(Action("mustika_tr"), legal(s, 0))

    def test_mustika_stages(self):
        s, p = State(), Performance()
        s.mandate[0] = True
        start(s, 0, Action("mustika_tr"), p)
        self.assertNotIn(Action("mustika_br"), legal(s, 1))
        advance(s, (p, p))
        self.assertEqual(scores(s), [0, 0])
        start(s, 1, Action("mustika_br"), p)
        advance(s, (p, p))
        self.assertEqual(scores(s), [250, 0])

    def test_access_and_stacking(self):
        s = State()
        s.buffer[0] = [20, 12]
        self.assertFalse(any(a.spot in (2, 3) for a in legal(s, 1)))
        self.assertFalse(any(a.kind == "sky" for a in legal(s, 1)))
        self.assertTrue(all(a.earth <= 2 for a in legal(s, 1)))
        s.towers[4] = Tower([1], -1)
        self.assertIn(Action("earth", 4, earth=1), legal(s, 1))
        self.assertNotIn(Action("earth", 4, earth=2), legal(s, 1))

    def test_buzzer_pending_and_exact_completion(self):
        p = Performance()
        s = State(t=179)
        start(s, 0, Action("transfer", earth=3), p)
        advance(s, (p, p))
        self.assertEqual(scores(s), [0, 0])
        s = State(t=180-duration(Action("transfer", earth=3), p))
        start(s, 0, Action("transfer", earth=3), p)
        advance(s, (p, p))
        self.assertEqual(scores(s), [15, 0])

    def test_failure_conservation_and_ball_reset(self):
        p = Performance(success=0)
        s = State()
        start(s, 0, Action("transfer", earth=3), p)
        advance(s, (p, p), rng=random.Random(1))
        invariant(s)
        self.assertEqual(scores(s), [0, 0])
        s = State()
        s.mandate[0] = True
        start(s, 0, Action("mustika_tr"), p)
        advance(s, (p, p), rng=random.Random(1))
        self.assertEqual(s.mustika, "ground")

    def test_simultaneous_mustika_reservation(self):
        p, s = Performance(), State()
        s.mandate = [True, True]
        dispatch(s, {0:Action("mustika_tr"), 2:Action("mustika_tr")}, (p,p), priority=1)
        self.assertEqual(s.mustika, "tr1")
        self.assertEqual(s.jobs[0].action, WAIT)

    def test_tie_is_unresolved(self):
        self.assertEqual(winner(State()), 0)

    def test_all_policies_and_invariants(self):
        ps = policies()
        self.assertEqual(len({p.name for p in ps}), 108)
        for i, policy in enumerate(ps):
            perf = Performance(success=0.9 if i % 2 else 1)
            result = simulate(policy, ps[-i-1], (perf, perf), seed=i, check=True)
            self.assertEqual(result.t, 180)

    def test_mission_policy_targets_shared_after_one_private(self):
        s, p = State(), Performance()
        s.towers[0] = Tower([0,0],0)
        s.buffer[0] = [2,1]
        policy = Policy(('P','S','U'),True,181,'balanced')
        a = choose(s,1,policy,p)
        self.assertEqual(a.spot,4)
        s.towers[6] = Tower([1,1],1)
        self.assertEqual(choose(s,1,policy,p),Action('flip',6))

    def test_team_swap_symmetry(self):
        ps = policies()
        fast = replace(Performance(),transfer=8,earth=8)
        slow = Performance()
        for i in range(0,len(ps),8):
            red, blue = ps[i], ps[-i-1]
            a = simulate(red,blue,(fast,slow),priority=0,check=True)
            b = simulate(blue,red,(slow,fast),priority=1,check=True)
            self.assertEqual(scores(a),scores(b)[::-1])
            self.assertEqual(winner(a),-winner(b))

    def test_idle_skip_preserves_decisions_and_results(self):
        ps = policies()
        for i in range(0,len(ps),5):
            p = Performance(success=0.9)
            a = simulate(ps[i],ps[-i-1],(p,p),seed=i,record=True)
            b = simulate(ps[i],ps[-i-1],(p,p),seed=i,record=True,skip_waits=False)
            self.assertEqual(a.trace,b.trace)
            self.assertEqual(scores(a),scores(b))

    def test_exact_wait_tree_and_cap(self):
        p = Performance()
        result = exhaustive(State(t=178), (p,p), active=())
        self.assertTrue(result['complete'])
        self.assertEqual(result['states'], 3)
        self.assertEqual(result['terminal_scores'], [(0,0)])
        result = exhaustive(State(t=178), (p,p), active=(), max_states=1)
        self.assertFalse(result['complete'])
        with self.assertRaises(ValueError):
            exhaustive(State(), (replace(p,success=0.9),p))


if __name__ == "__main__":
    unittest.main()
