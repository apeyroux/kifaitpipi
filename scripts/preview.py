"""Serve only the packaged page on the Mac's loopback interface."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser
import argparse

page_path = Path(__file__).resolve().parent.parent / 'kifaitpipi-autonome.html'
parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=0)
args = parser.parse_args()


class Preview(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?')[0] not in ('/', '/index.html'):
            self.send_error(404)
            return
        page = page_path.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(page)))
        self.end_headers()
        self.wfile.write(page)


with ThreadingHTTPServer(('127.0.0.1', args.port), Preview) as server:
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'Ouvrez {url}\nGardez ce terminal ouvert. Ctrl+C pour arrêter.', flush=True)
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
