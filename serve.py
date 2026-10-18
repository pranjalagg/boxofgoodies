"""Local dev server: like `python3 -m http.server`, but tells the browser not to cache,
so edits to CSS/JS always show up on reload. Listens on localhost only.

    python3 serve.py          # http://localhost:8000
    python3 serve.py 8765
"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler)
    print(f"serving on http://localhost:{port}")
    server.serve_forever()
