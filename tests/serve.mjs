import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url)), prefix = '/new-2048/';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
    let path = decodeURIComponent(url.pathname.slice(prefix.length));
    if (!path || path.endsWith('/')) path += 'index.html';
    const target = resolve(root, path);
    if (!target.startsWith(resolve(root) + sep)) { res.writeHead(403).end(); return; }
    const data = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(data);
  } catch { res.writeHead(404).end(); }
});
server.listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173/new-2048/'));
