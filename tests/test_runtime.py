import unittest, threading, json, urllib.request, urllib.error
from tempfile import TemporaryDirectory
from http.server import ThreadingHTTPServer
from explorer.runtime import Runtime
from explorer.server import make_handler
from explorer.model.config import defaults
from explorer.search.store import Store
from pathlib import Path


class RuntimeTest(unittest.TestCase):
    def test_round_robin_configs_and_restart(self):
        with TemporaryDirectory() as d:
            runtime = Runtime(d)
            c = defaults()
            c["horizon"] = 1
            c["teams"][0]["speeds"]["move"] = [0, 1, 2]
            st = Store.create(d, c)
            runtime.start(st.path.stem, 1000)
            runtime.jobs[st.path.stem][1].join(15)
            self.assertIsNone(st.summary()["error"])
            self.assertTrue(st.summary()["complete"])
            self.assertEqual(st.summary()["runs"], 3)
            Runtime(d)
            self.assertTrue(Store(st.path).summary()["complete"])

    def test_api_validation_and_session_persistence(self):
        with TemporaryDirectory() as d:
            runtime = Runtime(d)
            server = ThreadingHTTPServer(
                ("127.0.0.1", 0), make_handler(runtime, Path(d))
            )
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                url = f"http://127.0.0.1:{server.server_port}"
                c = defaults()
                c["horizon"] = 1
                req = urllib.request.Request(
                    url + "/api/searches",
                    json.dumps(c).encode(),
                    {"Content-Type": "application/json"},
                )
                s = json.load(urllib.request.urlopen(req))
                self.assertEqual(s["nodes"], 1)
                bad = urllib.request.Request(
                    url + "/api/searches",
                    json.dumps(c).encode(),
                    {
                        "Content-Type": "application/json",
                        "Origin": "https://example.com",
                    },
                )
                with self.assertRaises(urllib.error.HTTPError) as e:
                    urllib.request.urlopen(bad)
                self.assertEqual(e.exception.code, 403)
                self.assertEqual(
                    len(json.load(urllib.request.urlopen(url + "/api/searches"))), 1
                )
            finally:
                server.shutdown()
                server.server_close()
                runtime.close()

    def test_candidate_job_round_robin_and_invalid_budget(self):
        with TemporaryDirectory() as d:
            runtime = Runtime(d)
            c = defaults()
            c["horizon"] = 1
            c["teams"][0]["speeds"]["move"] = [0, 1, 2]
            st = Store.create(d, c)
            with self.assertRaises(ValueError):
                runtime.start(st.path.stem, discovery_seconds=0)
            runtime.start(st.path.stem, discovery_seconds=1)
            runtime.jobs[st.path.stem][1].join(10)
            self.assertIsNone(st.summary()["error"])
            report = st.summary()["discovery"]
            self.assertEqual(len(report["runs"]), 3)
            self.assertTrue(all(r["candidates"] for r in report["runs"]))
            self.assertFalse(report["complete"])
            self.assertEqual(Runtime(d).get(st.path.stem).summary()["discovery"], report)
            runtime.close()

    def test_live_evaluation_progress_and_cancellation(self):
        from unittest.mock import patch
        ready = threading.Event()
        release = threading.Event()
        with TemporaryDirectory() as d:
            runtime = Runtime(d)
            st = Store.create(d, defaults())
            def evaluate(store, cancel, progress):
                progress({"phase": "histories", "done": 3, "total": 10,
                          "run": 0, "completedRuns": 0, "totalRuns": 1})
                ready.set()
                release.wait(5)
                if cancel.is_set():
                    raise InterruptedError()
            with patch("explorer.runtime.analyze", side_effect=evaluate):
                try:
                    runtime.start(st.path.stem, evaluate=True)
                    self.assertTrue(ready.wait(5))
                    snapshot = runtime.get(st.path.stem).summary()
                    self.assertEqual(snapshot["evaluationProgress"]["done"], 3)
                    self.assertEqual(snapshot["evaluationProgress"]["state"], "running")
                    runtime.pause(st.path.stem)
                finally:
                    release.set()
                    runtime.close()
            snapshot = st.summary()
            self.assertEqual(snapshot["evaluationProgress"]["state"], "cancelled")
            self.assertEqual(snapshot["status"], "paused")
            self.assertIsNone(snapshot["job"])

    def test_restart_marks_evaluation_interrupted(self):
        with TemporaryDirectory() as d:
            st = Store.create(d, defaults())
            st.set_meta("status", "evaluating")
            st.set_meta("evaluationProgress", {"state": "running", "done": 2})
            runtime = Runtime(d)
            self.assertEqual(st.summary()["evaluationProgress"]["state"], "interrupted")
            self.assertEqual(st.summary()["status"], "paused")
            runtime.close()
