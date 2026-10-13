"""Discover strategies without supplying goals; verify stored witnesses by replay."""

import argparse
import json
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from explorer.model.config import defaults, config_at
from explorer.model.state import initial, scores, key
from explorer.model.transition import successors
from explorer.search.store import Store
from explorer.search.discovery import discover
from explorer.presentation import replay


def local():
    c = defaults()
    s = initial(c, config_at(c, 0))
    s["t"] = 170
    s["robots"][1].update(pos="middle0", entered=True)
    for ids, spot in [([0, 1], 4), ([2, 3], 6)]:
        for layer, oid in enumerate(ids):
            s["objects"][oid].update(
                loc=f"tower{spot}", layer=layer, delivered=[True, False]
            )
    s["objects"][40].update(loc="robot1", delivered=[True, False])
    s["transfer"][0] = 5
    c.update(name="自動候補探索・残り10秒・L2能力と走行速度", scenario="custom", root=s)
    c["teams"][0]["speeds"]["move"] = [0, 1, 2]
    c["teams"][0]["caps"]["stairs2"] = [False, True]
    return c


def verify(store, run, evidence):
    c = store.config()
    v = config_at(c, run)
    s = initial(c, v)
    for eid in evidence["path"]:
        edge = store.edge(eid)
        target = store.node(edge["dst"])["state"]
        outcomes = successors(s, edge["red"], edge["blue"], c, v)
        assert any(key(o["state"]) == key(target) for o in outcomes)
        s = target
    assert scores(s) == evidence["scores"]
    assert s["t"] == c["horizon"]
    assert replay(store, evidence["path"])["frames"][-1]["scores"] == evidence["scores"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--data", type=Path, default=Path(".explorer-strategy-discovery-3")
    )
    parser.add_argument(
        "--output", type=Path, default=Path("results/discovery-review-2026-10-13.json")
    )
    args = parser.parse_args()
    output = []
    for case, seconds in [("fast", 60), ("standard", 10), ("local", 12)]:
        c = local() if case == "local" else defaults()
        if case != "local":
            c["name"] = (
                f"自動候補探索・{'速い' if case == 'fast' else '標準'}走行・{seconds}秒"
            )
            c["teams"][0]["speeds"]["move"] = [0 if case == "fast" else 1]
        store = Store.create(args.data, c)
        start = time.monotonic()
        discover(store, seconds)
        elapsed = time.monotonic() - start
        summary = store.summary()
        print(case, store.path.stem, elapsed, flush=True)
        checked = 0
        for run in summary["discovery"]["runs"]:
            # Check every baseline and first tested counter. The simulator has
            # already validated each primitive of every additional response.
            for candidate in run["candidates"]:
                for evidence in [candidate["baseline"], *candidate["responses"][:1]]:
                    verify(store, run["run"], evidence)
                    checked += 1
            print(
                " C",
                run["run"],
                "first",
                run["firstCandidateSeconds"],
                "candidates",
                len(run["candidates"]),
                "best",
                max(
                    (a["baseline"]["scores"][0] for a in run["candidates"]),
                    default=None,
                ),
                flush=True,
            )
        output.append(
            {
                "case": case,
                "seconds": seconds,
                "wallSeconds": elapsed,
                "recheckedPaths": checked,
                "summary": summary,
            }
        )
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
