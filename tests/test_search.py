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
        self.c["horizon"] = 5

    def test_naive_equivalence(self):
        st = Store.create(self.tmp.name, self.c)
        v = config_at(self.c, 0)
        s = initial(self.c, v)
        expected = set()
        edges = 0
        for a in team_choices(s, 0, self.c, v):
            for b in team_choices(s, 1, self.c, v):
                for out in successors(s, a, b, self.c, v):
                    validate(out["state"])
                    expected.add(key(out["state"]))
                    edges += 1
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
