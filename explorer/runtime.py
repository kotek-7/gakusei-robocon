"""A browser-independent local job runner. SQLite commits are checkpoints."""

import threading, json, time
from pathlib import Path
from explorer.search.store import Store, connect
from explorer.search.evaluation import analyze
from explorer.model.config import count_configs


class Runtime:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.jobs = {}
        self.lock = threading.Lock()
        # A process restart never silently resumes CPU work, but no frontier is lost.
        for p in self.directory.glob("*.sqlite3"):
            st = Store(p)
            st.config()
            if st.summary()["status"] in ("running", "evaluating"):
                st.set_meta("status", "paused")
                progress = st.summary().get("evaluationProgress")
                if progress and progress["state"] == "running":
                    st.set_meta("evaluationProgress", {**progress, "state": "interrupted"})
                st.set_meta("job", None)

    def get(self, id):
        if len(id) != 32 or any(c not in "0123456789abcdef" for c in id):
            raise ValueError("探索IDが不正です")
        p = self.directory / (id + ".sqlite3")
        if not p.is_file():
            raise ValueError("保存済み探索が存在しません")
        return Store(p)

    def list(self):
        return sorted(
            [Store(p).summary() for p in self.directory.glob("*.sqlite3")],
            key=lambda x: x["created"],
            reverse=True,
        )

    def pause(self, id):
        with self.lock:
            if id in self.jobs:
                self.jobs[id][0].set()
        return self.get(id).summary()

    def start(self, id, budget=1000, node=None, evaluate=False, discovery_seconds=None):
        if type(budget) is not int or not 1 <= budget <= 1000000:
            raise ValueError("計算予算は1〜1000000の整数です")
        if discovery_seconds is not None and (
            type(discovery_seconds) is not int or not 1 <= discovery_seconds <= 86400
        ):
            raise ValueError("候補探索の時間は1〜86400秒の整数です")
        st = self.get(id)
        with self.lock:
            if id in self.jobs and self.jobs[id][1].is_alive():
                raise ValueError("この探索は実行中です")
            stop = threading.Event()

            def work():
                started = time.monotonic()
                last_update = 0
                last_phase = None
                def update_progress(value):
                    nonlocal last_update, last_phase
                    now = time.monotonic()
                    phase_key = (value["phase"], value["run"])
                    if phase_key != last_phase or now - last_update >= 0.25:
                        st.set_meta("evaluationProgress", {
                            **value, "elapsed": now - started,
                            "state": "complete" if value["phase"] == "complete" else "running",
                        })
                        last_update, last_phase = now, phase_key

                def end_progress(state):
                    if evaluate:
                        value = st.summary().get("evaluationProgress")
                        if value:
                            st.set_meta("evaluationProgress", {
                                **value, "state": state, "elapsed": time.monotonic() - started,
                            })

                try:
                    st.set_meta("status", "evaluating" if evaluate else "running")
                    st.set_meta("error", None)
                    st.set_meta("job", "evaluation" if evaluate else "discovery" if discovery_seconds is not None else "exact")
                    if discovery_seconds is not None:
                        from explorer.search.discovery import discover

                        discover(st, discovery_seconds, stop)
                    elif evaluate:
                        analyze(st, cancel=stop, progress=update_progress)
                    else:
                        used = 0
                        c = st.config()
                        while used < budget and not stop.is_set():
                            if node is None:
                                with connect(st.path) as db:
                                    next_index = db.execute(
                                        "SELECT coalesce(max(id),-1)+1 FROM runs"
                                    ).fetchone()[0]
                                    schedule = (
                                        json.loads(
                                            db.execute(
                                                "SELECT value FROM meta WHERE key='schedule'"
                                            ).fetchone()[0]
                                        )
                                        if db.execute(
                                            "SELECT 1 FROM meta WHERE key='schedule'"
                                        ).fetchone()
                                        else 0
                                    )
                                # Alternate introducing a configuration and advancing existing ones.
                                if schedule % 2 == 0 and next_index < count_configs(c):
                                    st.ensure_run(next_index)
                                with connect(st.path) as db:
                                    pending = [
                                        r[0]
                                        for r in db.execute(
                                            "SELECT DISTINCT run FROM nodes WHERE expanded=0 ORDER BY run"
                                        )
                                    ]
                                if not pending:
                                    if next_index >= count_configs(c):
                                        break
                                    st.ensure_run(next_index)
                                    pending = [next_index]
                                current = pending[(schedule // 2) % len(pending)]
                                st.set_meta("schedule", schedule + 1)
                            else:
                                current = None
                            made = st.batch(
                                min(100, budget - used), node=node, run=current
                            )
                            used += made
                            if not made and node is not None:
                                break
                    st.set_meta(
                        "status", "complete" if st.summary()["complete"] else "paused"
                    )
                except InterruptedError:
                    end_progress("cancelled")
                    st.set_meta("status", "paused")
                except Exception as e:
                    end_progress("error")
                    st.set_meta("error", str(e))
                    st.set_meta("status", "error")
                finally:
                    st.set_meta("job", None)

            thread = threading.Thread(
                target=work, daemon=True, name="explore-" + id[:8]
            )
            self.jobs[id] = (stop, thread)
            thread.start()
        return st.summary()

    def close(self):
        for stop, thread in self.jobs.values():
            stop.set()
        for stop, thread in self.jobs.values():
            thread.join(timeout=30)
