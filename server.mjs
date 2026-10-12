import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'site');
const port = Number(process.argv[2] || 4267);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.bin': 'application/octet-stream', '.txt': 'text/plain; charset=utf-8' };
const compressible = new Set(['.html', '.js', '.json', '.css', '.svg', '.bin', '.txt']);
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = path.resolve(root, '.' + pathname);
    if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const info = await stat(target);
    const file = info.isDirectory() ? path.join(target, 'index.html') : target;
    const ext = path.extname(file);
    let data = await readFile(file);
    const headers = { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
    if (compressible.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { data = gzipSync(data); headers['Content-Encoding'] = 'gzip'; headers.Vary = 'Accept-Encoding'; }
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Amaravati Observatory: http://127.0.0.1:${port}`));
