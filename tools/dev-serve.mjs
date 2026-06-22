#!/usr/bin/env node
/**
 * dev-serve.mjs — local static server that mimics the production Caddy routing
 * (try_files {path} {path}/ {path}.html /index.html) so clean URLs like
 * /relo_dojo/terms resolve to terms.html exactly as on the VPS. DEV ONLY.
 *
 *   node tools/dev-serve.mjs [port]   (default 8100; serves ./site)
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const PORT = Number(process.argv[2]) || 8100;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png' };

async function tryFile(p) {
  try { const s = await stat(p); if (s.isFile()) return p; } catch {}
  return null;
}

createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const base = resolve(ROOT, '.' + url);
  if (!base.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  // Caddy try_files order: {path}, {path}/index.html, {path}.html, /index.html
  let file =
    (extname(base) ? await tryFile(base) : null) ||
    await tryFile(resolve(base, 'index.html')) ||
    await tryFile(base + '.html') ||
    (extname(base) ? null : await tryFile(base)) ||
    await tryFile(resolve(ROOT, 'index.html'));
  if (!file) { res.writeHead(404); return res.end('not found'); }
  const body = await readFile(file);
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(body);
}).listen(PORT, () => console.log(`dev-serve (Caddy-like try_files) → http://localhost:${PORT}  root=${ROOT}`));
