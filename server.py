import http.server
import urllib.request
import urllib.parse
import sys
import re

PORT = 8080

class IPTVProxyHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/proxy?url='):
            raw_url = self.path[len('/proxy?url='):]
            target_url = urllib.parse.unquote(raw_url)
            try:
                req = urllib.request.Request(
                    target_url,
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    content_type = resp.headers.get('Content-Type', 'application/vnd.apple.mpegurl')
                    data = resp.read()
                    
                    # If it's an M3U8 manifest, rewrite relative segment URLs to route through proxy
                    if '.m3u8' in target_url.lower() or 'mpegurl' in content_type.lower():
                        base_url = target_url.rsplit('/', 1)[0] + '/'
                        text = data.decode('utf-8', errors='ignore')
                        lines = []
                        for line in text.splitlines():
                            stripped = line.strip()
                            if stripped and not stripped.startswith('#'):
                                if not stripped.startswith('http://') and not stripped.startswith('https://'):
                                    abs_line = urllib.parse.urljoin(base_url, stripped)
                                else:
                                    abs_line = stripped
                                lines.append(f'/proxy?url={urllib.parse.quote(abs_line)}')
                            elif stripped.startswith('#EXT-X-KEY:') and 'URI="' in stripped:
                                def replace_key_uri(match):
                                    key_uri = match.group(1)
                                    abs_key = urllib.parse.urljoin(base_url, key_uri)
                                    return f'URI="/proxy?url={urllib.parse.quote(abs_key)}"'
                                line = re.sub(r'URI="([^"]+)"', replace_key_uri, line)
                                lines.append(line)
                            else:
                                lines.append(line)
                        data = '\n'.join(lines).encode('utf-8')

                    self.send_response(200)
                    self.send_header('Content-Type', content_type)
                    self.send_header('Content-Length', str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
            except Exception as e:
                err_msg = f"Proxy Error: {str(e)}"
                print(err_msg, file=sys.stderr)
                try:
                    self.send_response(502)
                    self.send_header('Content-Type', 'text/plain')
                    self.send_header('Content-Length', str(len(err_msg)))
                    self.end_headers()
                    self.wfile.write(err_msg.encode('utf-8'))
                except Exception:
                    pass
            return
        
        # Standard static file handling
        return super().do_GET()

if __name__ == '__main__':
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    server = http.server.ThreadingHTTPServer(("", PORT), IPTVProxyHandler)
    print(f"SURAJ IPTV Threaded Server running at http://localhost:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer shutting down...", flush=True)
        server.shutdown()
        sys.exit(0)
