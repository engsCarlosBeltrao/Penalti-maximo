#!/usr/bin/env node
// Servidor local do jogo (sem dependências). O motor 3D carrega módulos e o modelo GLB, que o navegador bloqueia quando a página é aberta direto do disco.
// Uso: node tools/servidor.mjs [porta]   (padrão 8080; se estiver ocupada, tenta as seguintes). Abre o navegador sozinho; Ctrl+C encerra.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  // /spotify-abrir?uri=spotify:track:<id>: abre a música no APLICATIVO Spotify do Windows e devolve o foco ao jogo (tools/spotify-abrir.ps1). O cabeçalho
  // X-Penalti só é enviado pelo próprio jogo (outro site não consegue mandá-lo para cá), e o endereço só aceita links do Spotify.
  if (req.url.startsWith('/spotify-abrir')) { const uri = new URL(req.url, 'http://x').searchParams.get('uri') || '';
    if (req.headers['x-penalti'] !== '1' || !/^spotify:(track|playlist):[A-Za-z0-9]{22}$/.test(uri) || process.platform !== 'win32') { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end('{"ok":false}'); }
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'tools', 'spotify-abrir.ps1'), '-Uri', uri], { windowsHide: true, timeout: 10000 }, err => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }); res.end(JSON.stringify({ ok: !err })); }); return; }
  let p; try { p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)); } catch { res.writeHead(400); return res.end(); }
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (p.endsWith(path.sep)) p = path.join(p, 'index.html');
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); return res.end('não encontrado'); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(data); });
});
let port = +(process.argv[2] || 8080);
server.on('error', e => { if (e.code === 'EADDRINUSE' && port < 8100) { port++; server.listen(port, '127.0.0.1'); } else { console.error('Não foi possível iniciar o servidor:', e.message); process.exit(1); } });
server.on('listening', () => { const url = `http://127.0.0.1:${port}/index.html`; console.log(`PÊNALTI MÁXIMO rodando em ${url}  (Ctrl+C para encerrar)`);
  const open = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`; if (!process.argv.includes('--sem-navegador')) exec(open); });
server.listen(port, '127.0.0.1');
