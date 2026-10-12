import importlib.util
import unittest
from abu2027.game import matrix_game, solve
from abu2027.model import Performance, State


@unittest.skipUnless(importlib.util.find_spec('scipy'), 'optional scipy dependency')
class GameTest(unittest.TestCase):
    def test_matching_pennies(self):
        value, p = matrix_game([[1,-1],[-1,1]])
        self.assertAlmostEqual(value,0)
        self.assertAlmostEqual(p[0],0.5)
        self.assertAlmostEqual(p[1],0.5)

    def test_dominated_row(self):
        value, p = matrix_game([[3,2],[1,0]])
        self.assertAlmostEqual(value,2)
        self.assertAlmostEqual(p[0],1)

    def test_empty_wait_game(self):
        p = Performance()
        r = solve(State(t=178),(p,p),active=())
        self.assertTrue(r['complete'])
        self.assertEqual(r['guaranteed_expected_margin'],0)
        self.assertFalse(solve(State(t=178),(p,p),active=(),max_states=1)['complete'])
