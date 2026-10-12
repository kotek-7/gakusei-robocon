import unittest
from abu2027.model import State, Tower, validate_state


class ScenarioTest(unittest.TestCase):
    def test_rejects_missing_towers_even_when_resources_balance(self):
        with self.assertRaises(ValueError):
            validate_state(State(towers=[]))

    def test_rejects_invalid_owner_before_search(self):
        state = State()
        state.towers[0] = Tower([-1])
        with self.assertRaises(ValueError):
            validate_state(state)

    def test_valid_initial_state_and_bad_ball_location(self):
        state = State()
        validate_state(state)
        state.mustika = 'placed0'
        with self.assertRaises(ValueError):
            validate_state(state)
