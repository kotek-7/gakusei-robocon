"""Synthetic scheduling regressions, with automatic search and replay validation.

The 10 m/s movement profile isolates scheduling effects; these are not real robot
performance estimates or proof that a fixture is reachable from the match start.
"""

import argparse
import json
from pathlib import Path
import runpy
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tests.choice_scenarios import local
from explorer.search.discovery import discover
from explorer.search.store import Store


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seconds", type=int, default=3)
    parser.add_argument(
        "--output", type=Path, default=Path("results/choice-scenarios-2026-10-13.json")
    )
    args = parser.parse_args()
    verify = runpy.run_path(str(Path(__file__).with_name("discovery-benchmark.py")))[
        "verify"
    ]
    results = []
    for name, enabled in [
        ("small", True),
        ("direct", False),
        ("direct", True),
        ("mixed", False),
        ("mixed", True),
        ("switch", True),
        ("prefetch", True),
    ]:
        c = local(name, enabled)
        c["name"] = f"選択肢検証・{name}・{enabled}"
        store = Store.create(".explorer-strategy-choices-4", c)
        started = time.monotonic()
        discover(store, max(8, args.seconds) if name == "prefetch" else args.seconds)
        elapsed = time.monotonic() - started
        report = store.summary()
        candidates = report["discovery"]["runs"][0]["candidates"]
        best = max(candidates, key=lambda a: a["baseline"]["scores"][0])
        verify(store, 0, best["baseline"])
        events = [
            e
            for i in best["baseline"]["path"]
            for e in store.edge(i)["events"]
            if e["phase"] == "finish"
        ]
        results.append(
            {
                "case": name,
                "enabled": enabled,
                "wallSeconds": elapsed,
                "id": store.path.stem,
                "config": c,
                "candidates": len(candidates),
                "best": best,
                "events": events,
            }
        )
        print(
            name,
            enabled,
            best["baseline"]["scores"],
            len(candidates),
            elapsed,
            flush=True,
        )
        args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
