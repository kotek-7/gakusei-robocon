"""Persist concrete replay witnesses through the shared state graph."""

from explorer.model.state import scores
from .store import connect
from .evaluation import classification, structural, token


def persist(store, run, result, config):
    """Store all arbitration siblings, and the exact selected witness path."""
    path = []
    events = []
    with connect(store.path) as db:
        nid = db.execute("SELECT root FROM runs WHERE id=?", (run,)).fetchone()[0]
        for acts, outcomes, chosen in result["history"]:
            ids = store.add_outcomes(db, run, nid, acts[:2], acts[2:], outcomes, config)
            eid = ids[next(i for i, o in enumerate(outcomes) if o is chosen)]
            nid = db.execute("SELECT dst FROM edges WHERE id=?", (eid,)).fetchone()[0]
            path.append(eid)
            events.extend(chosen["events"])
        db.execute("UPDATE meta SET value='null' WHERE key='evaluation'")
    trace = tuple(
        token(e, None, True)
        for e in sorted(events, key=lambda e: (e["t"], e["phase"], e["robot"]))
        if e["action"]["kind"] not in ("wait", "delay", "continue")
    )
    sid, milestones = classification(structural(trace))
    return {
        "node": nid,
        "path": path,
        "scores": scores(result["state"]),
        "strategy": sid,
        "milestones": milestones,
    }
