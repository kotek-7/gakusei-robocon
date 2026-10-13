import unittest
from tempfile import TemporaryDirectory
from explorer.model.config import defaults, config_at
from explorer.model.state import initial, key, validate
from explorer.model.actions import team_choices
from explorer.model.transition import successors
from explorer.search.store import Store, connect
from explorer.search.evaluation import analyze, matrix_value
from explorer.presentation import replay


class SearchTest(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.c = defaults()
        self.c["horizon"] = 2

    def test_naive_equivalence(self):
        st = Store.create(self.tmp.name, self.c)
        v = config_at(self.c, 0)
        s = initial(self.c, v)
        expected = {key(s)}
        todo = [s]
        edges = 0
        while todo:
            current = todo.pop()
            if current["t"] >= self.c["horizon"]:
                continue
            for a in team_choices(current, 0, self.c, v):
                for b in team_choices(current, 1, self.c, v):
                    for out in successors(current, a, b, self.c, v):
                        validate(out["state"])
                        k = key(out["state"])
                        if k not in expected:
                            expected.add(k)
                            todo.append(out["state"])
                        edges += 1
        expected.remove(key(s))
        while st.batch(10):
            pass
        with connect(st.path) as db:
            actual = {r[0] for r in db.execute("SELECT key FROM nodes WHERE id!=1")}
        self.assertEqual(actual, expected)
        self.assertEqual(st.summary()["edges"], edges)
        self.assertTrue(st.summary()["complete"])

    def test_resume(self):
        a = Store.create(self.tmp.name, self.c)
        b = Store.create(self.tmp.name, self.c)
        a.batch(3)
        self.assertFalse(a.summary()["complete"])
        a = Store(a.path)
        while a.batch(10):
            pass
        while b.batch(100):
            pass
        for table in ("nodes", "edges"):
            self.assertEqual(a.export()[table], b.export()[table])

    def test_replay(self):
        st = Store.create(self.tmp.name, self.c)
        st.batch(10)
        with connect(st.path) as db:
            dst = db.execute(
                "SELECT dst FROM edges ORDER BY id DESC LIMIT 1"
            ).fetchone()[0]
        data = replay(st, st.witness_path(dst))
        self.assertEqual(data["frames"][-1]["scores"], st.node(dst)["scores"])
        self.assertEqual(len(data["frames"][-1]["objects"]), 53)

    def test_partial(self):
        st = Store.create(self.tmp.name, self.c)
        st.batch(2)
        r = analyze(st)["runs"][0]
        self.assertFalse(r["statisticsComplete"])
        self.assertIsNone(r["guarantee"])

    def test_complete(self):
        st = Store.create(self.tmp.name, self.c)
        while st.batch(100):
            pass
        r = analyze(st)["runs"][0]
        self.assertTrue(r["statisticsComplete"])
        self.assertEqual(r["guarantee"]["winLower"], 0)
        self.assertEqual(r["guarantee"]["winUpper"], 1)

    def test_wait_only_trace_is_counted_once(self):
        self.c["horizon"] = 2
        st = Store.create(self.tmp.name, self.c)
        from explorer.model.actions import action

        aa = [action("wait", seconds=2)] * 2
        st.step(1, aa, aa)
        r = analyze(st)["runs"][0]
        self.assertEqual(r["paths"], "1")
        self.assertEqual(r["strategies"][0]["paths"], "1")
        self.assertEqual(r["rawGraphPaths"], "1")

    def test_evaluation_cancellation_keeps_checkpoint(self):
        from threading import Event

        st = Store.create(self.tmp.name, self.c)
        st.batch(2)
        stop = Event()
        stop.set()
        before = st.export()["edges"]
        with self.assertRaises(InterruptedError):
            analyze(st, cancel=stop)
        self.assertEqual(st.export()["edges"], before)
        self.assertIsNone(st.summary()["evaluation"])

    def test_replay_rejects_disconnected_edges(self):
        st = Store.create(self.tmp.name, self.c)
        st.batch(2)
        ids = [e["id"] for e in st.export()["edges"]]
        with self.assertRaises(ValueError):
            replay(st, ids)

    def test_no_sequential_peeking(self):
        v, p = matrix_value([[1, 0], [0, 1]])
        self.assertAlmostEqual(v, 0.5)
        self.assertAlmostEqual(p[0], 0.5)

    def test_evaluation_progress_is_readable_and_does_not_change_result(self):
        st = Store.create(self.tmp.name, self.c)
        while st.batch(100):
            pass
        expected = analyze(st)
        updates = []
        def progress(value):
            st.set_meta("evaluationProgress", value)
            self.assertEqual(st.summary()["evaluationProgress"], value)
            updates.append(value)
        actual = analyze(st, progress=progress)
        self.assertEqual(actual, expected)
        self.assertEqual(updates[0]["phase"], "loading")
        self.assertEqual(updates[-1]["phase"], "complete")
        self.assertEqual(updates[-1]["completedRuns"], 1)
        self.assertIn("guarantees", {u["phase"] for u in updates})
        for value in updates:
            if value["total"] is not None:
                self.assertLessEqual(value["done"], value["total"])

    def test_cancel_during_progress_preserves_previous_evaluation(self):
        from threading import Event
        st = Store.create(self.tmp.name, self.c)
        st.batch(2)
        analyze(st)
        previous = st.summary()["evaluation"]
        stop = Event()
        def progress(value):
            if value["phase"] == "histories":
                stop.set()
        with self.assertRaises(InterruptedError):
            analyze(st, cancel=stop, progress=progress)
        self.assertEqual(st.summary()["evaluation"], previous)
