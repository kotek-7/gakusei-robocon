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
