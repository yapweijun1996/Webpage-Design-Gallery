import gzip,http.server,io,os,sys,functools
EXT={'.js','.mjs','.css','.html','.json','.wasm','.svg','.pack','.webmanifest','.txt'}
class H(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        path=self.translate_path(self.path)
        if os.path.isfile(path) and os.path.splitext(path)[1] in EXT and 'gzip' in self.headers.get('Accept-Encoding',''):
            data=gzip.compress(open(path,'rb').read(),6)
            self.send_response(200); self.send_header('Content-Type',self.guess_type(path)); self.send_header('Content-Encoding','gzip'); self.send_header('Content-Length',str(len(data))); self.end_headers()
            return io.BytesIO(data)
        return super().send_head()
    def log_message(self,*a): pass
os.chdir(sys.argv[2]); http.server.ThreadingHTTPServer(('',int(sys.argv[1])),H).serve_forever()
