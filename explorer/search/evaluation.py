"""Count-preserving graph analysis and simultaneous mixed-action guarantees.

Classification is structural, never a library of named plans. Statistics are
explicitly partial until both graph expansion and history propagation finish.
"""

from collections import defaultdict, Counter
from hashlib import sha256
import json
from .store import connect, dumps
from explorer.model.state import scores, winner

CLASS_VERSION = "events-prefix-3-v1"


def token(event, state, with_time):
    a = event["action"]
    k = a["kind"]
    if k in ("wait", "continue"):
        return None
    # Object identity is retained: no unproved permutation symmetry is assumed.
    body = [
        event["robot"],
        event["phase"],
        k,
        a.get("dest"),
        a.get("spot"),
        a.get("objects"),
    ]
    return dumps(([event["t"]] + body) if with_time else body)


def structural(trace):
    """Remove absolute seconds; keep simultaneous batches and order between them."""
    groups = []
    old = None
    for raw in trace:
        tok = json.loads(raw)
        t = tok[0]
        if t != old:
            groups.append([])
            old = t
        groups[-1].append(dumps(tok[1:]))
    return tuple(tuple(sorted(g)) for g in groups)


def classification(sig):
    # Fixed cut: first three non-wait event batches. Stable across all configs.
    prefix = sig[:3]
    encoded = dumps(prefix)
    return "S-" + sha256(encoded.encode()).hexdigest()[:12], prefix


def matrix_value(a):
    import numpy as np
    from scipy.optimize import linprog

    a = np.asarray(a, dtype=float)
    m, n = a.shape
    res = linprog(
        [0.0] * m + [-1.0],
        A_ub=np.column_stack((-a.T, np.ones(n))),
        b_ub=np.zeros(n),
        A_eq=[[1.0] * m + [0.0]],
        b_eq=[1.0],
        bounds=[(0, 1)] * m + [(None, None)],
        method="highs",
    )
    if not res.success:
        raise ValueError("同時行動ゲームの計算に失敗: " + res.message)
    return float(res.x[-1]), res.x[:-1].tolist()


def margin_with_win(a, b, v):
    import numpy as np
    from scipy.optimize import linprog

    a = np.asarray(a, float)
    b = np.asarray(b, float)
    m, n = a.shape
    res = linprog(
        [0.0] * m + [-1.0],
        A_ub=np.vstack(
            (np.column_stack((-b.T, np.ones(n))), np.column_stack((-a.T, np.zeros(n))))
        ),
        b_ub=np.r_[np.zeros(n), np.full(n, -v + 1e-8)],
        A_eq=[[1.0] * m + [0.0]],
        b_eq=[1.0],
        bounds=[(0, 1)] * m + [(None, None)],
        method="highs",
    )
    if not res.success:
        raise ValueError(res.message)
    return float(res.x[-1]), res.x[:-1].tolist()


def analyze(store, history_limit=30000, cancel=None):
    def check_cancel():
        if cancel and cancel.is_set():
            raise InterruptedError("Evaluation paused")

    config = store.config()
    all_results = []
    with connect(store.path) as db:
        db.execute("BEGIN")
        for run in db.execute("SELECT * FROM runs ORDER BY id"):
            check_cancel()
            nodes = {
                r["id"]: {"s": json.loads(r["state"]), "done": bool(r["expanded"])}
                for r in db.execute("SELECT * FROM nodes WHERE run=?", (run["id"],))
            }
            out = defaultdict(list)
            for e in db.execute(
                "SELECT * FROM edges WHERE run=? ORDER BY id", (run["id"],)
            ):
                out[e["src"]].append(
                    {
                        k: json.loads(e[k]) if k in ("red", "blue", "events") else e[k]
                        for k in ("id", "src", "dst", "red", "blue", "events")
                    }
                )
            order = sorted(nodes, key=lambda n: (nodes[n]["s"]["t"], n))
            complete = all(n["done"] for n in nodes.values())
            raw_counts = defaultdict(int)
            raw_counts[run["root"]] = 1
            paths = defaultdict(dict)
            paths[run["root"]][()] = None
            exact = set()
            groups = {}
            strategies = {}
            hist_complete = True
            total_hist = 1
            for nid in order:
                check_cancel()
                nd = nodes[nid]
                terminal = nd["s"]["t"] >= config["horizon"]
                traces = paths.pop(nid, {})
                if terminal:
                    sc = scores(nd["s"])
                    w = winner(nd["s"])
                    for trace, last in traces.items():
                        if trace in exact:
                            continue
                        exact.add(trace)
                        sig = structural(trace)
                        sid, prefix = classification(sig)
                        gk = dumps(sig)
                        # A group may contain different timed outcomes; keep the whole distribution.
                        group = groups.setdefault(
                            gk,
                            {
                                "strategy": sid,
                                "outcomes": Counter(),
                                "count": 0,
                                "node": nid,
                            },
                        )
                        group["outcomes"][(sc[0], sc[1], w)] += 1
                        group["count"] += 1
                        st = strategies.setdefault(
                            sid,
                            {
                                "id": sid,
                                "prefix": prefix,
                                "groups": set(),
                                "paths": 0,
                                "points": Counter(),
                                "wins": 0,
                                "unresolved": 0,
                                "node": nid,
                            },
                        )
                        st["groups"].add(gk)
                        st["paths"] += 1
                        st["points"][(sc[0], sc[1])] += 1
                        st["wins"] += w == 1
                        st["unresolved"] += w == 0
                for e in out[nid]:
                    raw_counts[e["dst"]] += raw_counts[nid]
                    if not hist_complete:
                        continue
                    tokens = tuple(
                        token(x, nd["s"], True)
                        for x in sorted(
                            e["events"], key=lambda x: (x["t"], x["phase"], x["robot"])
                        )
                        if x["action"]["kind"] not in ("wait", "continue")
                    )
                    for trace in traces:
                        # Sort a full event stream to merge simultaneous events spanning edges.
                        new = tuple(
                            sorted(
                                trace + tokens,
                                key=lambda s: (
                                    json.loads(s)[0],
                                    json.loads(s)[2],
                                    json.loads(s)[1],
                                    s,
                                ),
                            )
                        )
                        if new not in paths[e["dst"]]:
                            paths[e["dst"]][new] = e["id"]
                            total_hist += 1
                            if total_hist > history_limit:
                                hist_complete = False
                                break
            stats = []
            for st in strategies.values():
                equal_group_win = 0
                equal_group_unresolved = 0
                distribution = defaultdict(float)
                for gk in st["groups"]:
                    g = groups[gk]
                    for (a, b, w), num in g["outcomes"].items():
                        weight = num / g["count"] / len(st["groups"])
                        equal_group_win += weight * (w == 1)
                        equal_group_unresolved += weight * (w == 0)
                        distribution[a - b] += weight
                stats.append(
                    {
                        "id": st["id"],
                        "prefix": st["prefix"],
                        "groups": len(st["groups"]),
                        "paths": str(st["paths"]),
                        "groupWinFraction": equal_group_win,
                        "pathWinFraction": st["wins"] / st["paths"],
                        "unresolvedFraction": equal_group_unresolved,
                        "distribution": sorted(distribution.items()),
                        "scores": [
                            {"red": a, "blue": b, "count": str(n)}
                            for (a, b), n in sorted(st["points"].items())
                        ],
                        "node": st["node"],
                    }
                )
            run_distribution = defaultdict(float)
            run_win = run_unresolved = 0.0
            for group in groups.values():
                for (a, b, w), count in group["outcomes"].items():
                    weight = count / group["count"] / len(groups)
                    run_distribution[a - b] += weight
                    run_win += weight * (w == 1)
                    run_unresolved += weight * (w == 0)
            result = {
                "groupWinFraction": run_win if groups else None,
                "unresolvedFraction": run_unresolved if groups else None,
                "distribution": sorted(run_distribution.items()),
                "run": run["id"],
                "variant": json.loads(run["variant"]),
                "complete": complete,
                "statisticsComplete": complete and hist_complete,
                "historyLimited": not hist_complete,
                "rawGraphPaths": str(
                    sum(
                        raw_counts[n]
                        for n in nodes
                        if nodes[n]["s"]["t"] >= config["horizon"]
                    )
                ),
                "paths": str(len(exact)),
                "groups": len(groups),
                "strategies": sorted(stats, key=lambda s: s["id"]),
                "guarantee": None,
                "windowEnd": config["horizon"],
            }
            if complete:
                vals = {}
                policy = {}
                for nid in reversed(order):
                    check_cancel()
                    s = nodes[nid]["s"]
                    if s["t"] >= config["horizon"]:
                        w = winner(s)
                        sc = scores(s)
                        vals[nid] = (
                            float(w == 1),
                            float(w != -1),
                            float(sc[0] - sc[1]),
                        )
                        continue
                    rows = sorted({dumps(e["red"]) for e in out[nid]})
                    cols = sorted({dumps(e["blue"]) for e in out[nid]})
                    cells = defaultdict(list)
                    for e in out[nid]:
                        cells[dumps(e["red"]), dumps(e["blue"])].append(vals[e["dst"]])
                    if any((a, b) not in cells for a in rows for b in cols):
                        raise ValueError("Complete node is missing joint actions")
                    lower = [
                        [min(v[0] for v in cells[a, b]) for b in cols] for a in rows
                    ]
                    upper = [
                        [min(v[1] for v in cells[a, b]) for b in cols] for a in rows
                    ]
                    margin = [
                        [min(v[2] for v in cells[a, b]) for b in cols] for a in rows
                    ]
                    vl, dist = matrix_value(lower)
                    vu, _ = matrix_value(upper)
                    vm, dist = margin_with_win(lower, margin, vl)
                    vals[nid] = (vl, vu, vm)
                    if nid == run["root"]:
                        policy = {
                            "actions": [json.loads(a) for a in rows],
                            "probabilities": dist,
                        }
                result["guarantee"] = {
                    "winLower": vals[run["root"]][0],
                    "winUpper": vals[run["root"]][1],
                    "marginLower": vals[run["root"]][2],
                    **policy,
                    "meaning": "同時行動の勝敗保証。不確定競合は不利なケース。得点差は勝敗保証を維持する保守的下限。",
                }
            all_results.append(result)
    report = {
        "classification": CLASS_VERSION,
        "cut": 3,
        "runs": all_results,
        "meaning": "展開群を等重み、群内の厳密展開は等重み。実大会の勝率ではない。未完了の値は発見済み展開の統計。",
    }
    check_cancel()
    store.set_meta("evaluation", report)
    return report
