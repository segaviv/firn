#!/usr/bin/env node
// Tiny zero-dependency server for self-hosting Firn (e.g. on your laptop, reachable via Tailscale).
// - serves the static app
// - re-runs the bergfex collector on a schedule so data/conditions.json stays fresh
//
//   node serve.mjs                    # 0.0.0.0:8642, collect every 60 min
//   PORT=9000 HOST=100.x.y.z COLLECT_MINUTES=30 node serve.mjs

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = +(process.env.PORT || 8642);
const HOST = process.env.HOST || '0.0.0.0';
const EVERY = +(process.env.COLLECT_MINUTES || 60);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
// Only these paths are public (keeps collector/, serve.mjs, .git etc. private).
const PUBLIC = [/^\/$/, /^\/index\.html$/, /^\/(css|js|data)\/[\w.-]+$/, /^\/(manifest\.webmanifest|icon\.svg|sw\.js)$/];

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let path = decodeURIComponent(url.pathname);
    if (!PUBLIC.some((re) => re.test(path))) { res.writeHead(404).end('Not found'); return; }
    if (path === '/') path = '/index.html';
    const file = resolve(ROOT, normalize(join('.', path)));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const st = await stat(file);
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache', // tiny files; always revalidate so updates show up immediately
      'Last-Modified': st.mtime.toUTCString(),
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

let running = false;
function collect() {
  if (running) return;
  running = true;
  const p = spawn(process.execPath, [join(ROOT, 'collector/collect.mjs')], { stdio: 'inherit' });
  p.on('exit', () => { running = false; });
}

server.listen(PORT, HOST, () => {
  console.log(`[firn] serving on http://${HOST}:${PORT} (collector every ${EVERY} min)`);
  collect();
  if (EVERY > 0) setInterval(collect, EVERY * 60 * 1000);
});
