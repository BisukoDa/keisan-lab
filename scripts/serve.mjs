// dist/ を basePath 付きでローカル配信するプレビュー用サーバー（node scripts/serve.mjs [port]）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DIST, basePath } from './lib.mjs';

const port = Number(process.argv[2] ?? 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' };

http
  .createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (basePath && p.startsWith(basePath)) p = p.slice(basePath.length) || '/';
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(DIST, p);
    if (!file.startsWith(DIST) || !fs.existsSync(file)) {
      res.writeHead(404, { 'content-type': types['.html'] });
      return res.end(fs.readFileSync(path.join(DIST, '404.html')));
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  })
  .listen(port, () => console.log(`http://localhost:${port}${basePath}/`));
