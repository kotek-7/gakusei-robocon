"""Loopback-only HTTP API + built Web UI. No remote assets or arbitrary file access."""

import argparse, json, mimetypes
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote
from explorer.runtime import Runtime
from explorer.model.config import metadata, validate
from explorer.model.field import NODES, EDGES
from explorer.search.store import Store
from explorer.presentation import frame, replay

ROOT = Path(__file__).resolve().parents[1]


def make_handler(runtime, static):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def send(self, value, status=200):
            raw = json.dumps(value, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            try:
                u = urlparse(self.path)
                parts = u.path.strip("/").split("/")
                q = parse_qs(u.query)
                number = lambda k, default: int(q.get(k, [default])[0])
                if u.path == "/api/model":
                    self.send({**metadata(), "field": {"nodes": NODES, "edges": EDGES}})
                    return
                if u.path == "/api/searches":
                    self.send(runtime.list())
                    return
                if parts[:2] == ["api", "searches"] and len(parts) >= 3:
                    st = runtime.get(parts[2])
                    op = parts[3] if len(parts) > 3 else ""
                    if not op:
                        self.send(st.summary())
                    elif op == "graph":
                        self.send(
                            st.graph(
                                number("run", 0),
                                max(0, number("offset", 0)),
                                min(200, max(1, number("limit", 100))),
                            )
                        )
                    elif op == "node":
                        data = st.node(number("id", 1))
                        self.send(
                            {
                                **data,
                                "frame": frame(data["state"]),
                                "path": st.witness_path(data["id"]),
                            }
                        )
                    elif op == "export":
                        self.send(st.export())
                    else:
                        self.send({"error": "指定されたデータが見つかりません"}, 404)
                    return
                rel = unquote(u.path).lstrip("/") or "index.html"
                p = (static / rel).resolve()
                if not p.is_relative_to(static.resolve()):
                    self.send({"error": "指定されたデータが見つかりません"}, 404)
                    return
                if not p.is_file():
                    self.send(
                        {
                            "error": "Webビルドがありません。webで npm run build を実行してください。"
                        },
                        404,
                    )
                    return
                raw = p.read_bytes()
                self.send_response(200)
                self.send_header(
                    "Content-Type",
                    mimetypes.guess_type(p.name)[0] or "application/octet-stream",
                )
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
            except (BrokenPipeError, ConnectionResetError):
                return
            except (ValueError, KeyError, TypeError) as e:
                self.send({"error": str(e)}, 400)
            except Exception as e:
                self.send({"error": str(e)}, 500)

        def do_POST(self):
            try:
                origin = self.headers.get("Origin")
                if origin and urlparse(origin).hostname not in (
                    "localhost",
                    "127.0.0.1",
                ):
                    self.send({"error": "このPCのアプリ画面から操作してください"}, 403)
                    return
                if not self.headers.get("Content-Type", "").startswith(
                    "application/json"
                ):
                    self.send({"error": "JSON形式で送信してください"}, 415)
                    return
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 2000000:
                    raise ValueError("要求サイズが範囲外です")
                data = json.loads(self.rfile.read(length))
                parts = urlparse(self.path).path.strip("/").split("/")
                if parts == ["api", "validate"]:
                    self.send(validate(data))
                    return
                if parts == ["api", "searches"]:
                    self.send(Store.create(runtime.directory, data).summary(), 201)
                    return
                if parts[:2] != ["api", "searches"] or len(parts) != 4:
                    self.send({"error": "指定されたデータが見つかりません"}, 404)
                    return
                st = runtime.get(parts[2])
                op = parts[3]
                if op in ("step", "run") and st.summary()["status"] in (
                    "running",
                    "evaluating",
                ):
                    raise ValueError("探索または集計を停止してから操作してください")
                if op == "start":
                    self.send(
                        runtime.start(
                            parts[2], data.get("budget", 1000), data.get("node")
                        )
                    )
                elif op == "pause":
                    self.send(runtime.pause(parts[2]))
                elif op == "evaluate":
                    self.send(runtime.start(parts[2], evaluate=True))
                elif op == "run":
                    st.ensure_run(int(data["index"]))
                    self.send(st.summary())
                elif op == "step":
                    self.send(
                        {"edges": st.step(int(data["node"]), data["red"], data["blue"])}
                    )
                elif op == "replay":
                    self.send(replay(st, data["edges"]))
                else:
                    self.send({"error": "指定されたデータが見つかりません"}, 404)
            except (BrokenPipeError, ConnectionResetError):
                return
            except (ValueError, KeyError, TypeError) as e:
                self.send({"error": str(e)}, 400)
            except Exception as e:
                self.send({"error": str(e)}, 500)

    return Handler


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=4174)
    p.add_argument("--data", type=Path, default=ROOT / ".explorer")
    args = p.parse_args()
    runtime = Runtime(args.data)
    server = ThreadingHTTPServer(
        ("127.0.0.1", args.port), make_handler(runtime, ROOT / "web/dist")
    )
    print(f"Explorer: http://127.0.0.1:{args.port}  data={args.data}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        runtime.close()
        server.server_close()


if __name__ == "__main__":
    main()
