# Local server that never lets the browser cache, so edits always show up on refresh.
import http.server


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'   # keep-alive: the page pulls ~30 files at once

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 256        # the default of 5 refused connections under a burst, so random textures never loaded
    daemon_threads = True


Server(('', 8382), Handler).serve_forever()
