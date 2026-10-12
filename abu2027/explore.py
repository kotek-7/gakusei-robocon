"""Load a declared scenario and enumerate states or solve its finite game."""
import argparse
import json
from pathlib import Path
from .model import State, Tower, Job, Action, Performance, invariant
from .search import exhaustive


def load_scenario(path):
    data = json.loads(path.read_text())
    raw = dict(data['state'])
    raw['towers'] = [Tower(**t) for t in raw['towers']]
    raw['jobs'] = [None if j is None else Job(Action(**j['action']), j['end'], j.get('old_sky',-1))
                   for j in raw.get('jobs',[None]*4)]
    s = State(**raw)
    invariant(s)
    perfs = tuple(Performance(**p) for p in data['performances'])
    if len(perfs) != 2:
        raise ValueError('Exactly two performance profiles are required')
    return s, perfs, data.get('active_robots',[0,1,2,3])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('scenario',type=Path)
    parser.add_argument('--mode',choices=['reachable','game'],default='reachable')
    parser.add_argument('--horizon',type=int,default=180)
    parser.add_argument('--priority',type=int,choices=[0,1],default=0)
    parser.add_argument('--max-states',type=int,default=10000)
    parser.add_argument('--output',type=Path,required=True)
    args = parser.parse_args()
    s,perfs,active = load_scenario(args.scenario)
    if args.mode == 'game':
        from .game import solve
        search = solve
    else:
        search = exhaustive
    result = search(s,perfs,horizon=args.horizon,priority=args.priority,
                    active=tuple(active),max_states=args.max_states)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps({'scenario':json.loads(args.scenario.read_text()),
                                     'mode':args.mode,'result':result},ensure_ascii=False,indent=2)+'\n')
    print(f"complete={result['complete']}; {args.output}")


if __name__=='__main__':
    main()
