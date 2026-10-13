"""Enumerate conflict outcomes of specified flip/wait examples, not all strategies.

Both teams use the default model; only the opening BR choices are prescribed.
Subsequent actions finish their current operation and wait until the final buzzer.
"""

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from explorer.model.config import defaults, config_at
from explorer.model.state import scores, winner
from explorer.search.store import Store

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
base = args.output
result = []
for seconds in [6, 2]:
    for enabled, profile in [(False, 1), (True, 0), (True, 1), (True, 2)]:
        for opponent in ["wait", "flip"]:
            c = defaults()
            c["scenario"] = "endgame"
            c["name"] = (
                f"行動指定・残り{seconds}秒・赤反転{enabled}段階{profile}・青{opponent}"
            )
            if seconds == 2:
                from explorer.model.state import initial

                root = initial(c, config_at(c, 0))
                root["t"] = 178
                c["scenario"] = "custom"
                c["root"] = root
            c["teams"][0]["caps"]["flip"] = [enabled]
            c["teams"][0]["speeds"]["flip"] = [profile]
            s = Store.create(base / "specified-actions", c)
            todo = [(s.graph()["root"], True, [])]
            ends = []
            begin = time.monotonic()
            while todo:
                nid, first, path = todo.pop()
                d = s.node(nid)
                if d["state"]["t"] == 180:
                    ends.append(
                        {
                            "node": nid,
                            "path": path,
                            "scores": scores(d["state"]),
                            "winner": winner(d["state"]),
                        }
                    )
                    continue
                actions = []
                for r, options in enumerate(d["actions"]):
                    kind = (
                        "flip"
                        if first
                        and ((r == 1 and enabled) or (r == 3 and opponent == "flip"))
                        else "continue"
                        if d["state"]["robots"][r]["job"]
                        else "wait"
                    )
                    actions.append(next(a for a in options if a["kind"] == kind))
                eids = s.step(nid, actions[:2], actions[2:])
                for eid in eids:
                    e = s.edge(eid)
                    todo.append((e["dst"], False, path + [eid]))
            result.append(
                {
                    "secondsRemaining": seconds,
                    "redFlip": enabled,
                    "redDuration": c["profiles"]["flip"][profile] if enabled else None,
                    "opponentAction": opponent,
                    "blueDuration": 4,
                    "elapsed": time.monotonic() - begin,
                    "id": s.path.stem,
                    "outcomes": ends,
                }
            )
(base / "specified-actions.json").write_text(
    json.dumps(result, ensure_ascii=False, indent=2)
)
for r in result:
    print(
        {k: v for k, v in r.items() if k not in ["id", "outcomes", "elapsed"]}
        | {"scores": [o["scores"] for o in r["outcomes"]]}
    )
