"""Temporary HTTP backend for the Nginx image smoke test, not a product service."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = (os.environ["MARKER"] + " " + self.path).encode()
        self.send_response(200)
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        size = int(self.headers["Content-Length"])
        assert len(self.rfile.read(size)) == size
        self.do_GET()


ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
