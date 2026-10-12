"""Optional exact finite simultaneous-game solver (requires scipy)."""
from copy import deepcopy
from functools import lru_cache
from itertools import product

from .model import WAIT, legal, advance, scores
from .search import dispatch, state_key


def matrix_game(matrix):
    """Maximize guaranteed expected score margin using a mixed strategy."""
    import numpy as np
    from scipy.optimize import linprog
    a = np.asarray(matrix, dtype=float)
    rows, columns = a.shape
    result = linprog([0.] * rows + [-1.],
                     A_ub=np.column_stack((-a.T, np.ones(columns))),
                     b_ub=np.zeros(columns), A_eq=[[1.] * rows + [0.]], b_eq=[1.],
                     bounds=[(0., 1.)] * rows + [(None, None)], method='highs')
    if not result.success:
        raise RuntimeError(result.message)
    p = result.x[:-1]
    value = float(result.x[-1])
    if abs(p.sum() - 1) > 1e-7 or float((p @ a).min()) < value - 1e-6:
        raise RuntimeError('Invalid equilibrium certificate')
    return value, p.tolist()


def solve(root, perfs, *, horizon=180, priority=0, active=(1,3), max_states=100000):
    """All actions/outcomes in the specified deterministic perfect-state game.

    Mixed behavioral strategies, score margin utility, fixed collision priority.
    Numerical LP tolerance applies. No claim about unmodeled physical actions.
    """
    if any(p.success != 1 for p in perfs):
        raise ValueError('Deterministic performance required')
    if horizon < root.t or max_states < 1:
        raise ValueError('Invalid bound')
    states = {state_key(root):deepcopy(root)}
    visits = 0
    root_info = {}

    @lru_cache(None)
    def value(key):
        nonlocal visits
        visits += 1
        if visits > max_states:
            raise OverflowError('state budget exhausted')
        s = states[key]
        if s.t >= horizon:
            points = scores(s)
            return float(points[0]-points[1])
        robot_sets, options = [], []
        for team in range(2):
            idle = [r for r in (team*2,team*2+1) if s.jobs[r] is None]
            robot_sets.append(idle)
            options.append(list(product(*[legal(s,r) if r in active else [WAIT] for r in idle])))
        matrix = []
        for red in options[0]:
            row = []
            for blue in options[1]:
                child = deepcopy(s)
                choices = dict(zip(robot_sets[0],red)) | dict(zip(robot_sets[1],blue))
                dispatch(child,choices,perfs,priority)
                advance(child,perfs,horizon,priority)
                ck = state_key(child)
                states.setdefault(ck,child)
                row.append(value(ck))
            matrix.append(row)
        v, distribution = matrix_game(matrix)
        if key == state_key(root):
            root_info.update({'red_actions':[[vars(a) for a in choice] for choice in options[0]],
                              'red_probabilities':distribution,'payoff_matrix':matrix,
                              'blue_actions':[[vars(a) for a in choice] for choice in options[1]]})
        return v
    try:
        v = value(state_key(root))
    except OverflowError:
        return {'complete':False,'visited':visits,'max_states':max_states,'priority':priority}
    return {'complete':True,'visited':visits,'max_states':max_states,'priority':priority,
            'guaranteed_expected_margin':v,'objective':'expected red minus blue score; not win probability',
            'scope':'finite fully observed simultaneous macro game', **root_info}


if __name__ == '__main__':
    import json
    from dataclasses import replace
    from pathlib import Path
    from .model import Performance
    from .experiment import endgame
    p = replace(Performance(),flip=1,upper=1)
    results = [solve(endgame(),(p,p),priority=i) for i in (0,1)]
    Path('results/baseline/endgame_equilibrium.json').write_text(json.dumps(results,indent=2)+'\n')
    print([{k:r[k] for k in ('complete','visited','priority','guaranteed_expected_margin') if k in r} for r in results])
