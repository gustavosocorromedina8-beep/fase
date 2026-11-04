#!/usr/bin/env python3
"""Servidor local de De Cero a Electricista, solo accesible desde este Mac."""
import http.server, os, sys, threading, time
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        global ultimo
        ultimo = time.time()
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    def log_message(self, *a): pass
H.extensions_map = {**H.extensions_map, '.mjs': 'text/javascript', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm'}
ultimo = time.time()
limite = int(os.environ.get('FASE_INACTIVO', '0'))
def vigilar():
    while time.time() - ultimo < limite: time.sleep(30)
    os._exit(0)
if limite: threading.Thread(target=vigilar, daemon=True).start()
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8123), H).serve_forever()
