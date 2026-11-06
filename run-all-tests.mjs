#!/usr/bin/env node
// Roda os testes automaticos (Node) que existirem. Funciona em qualquer pasta: acha a raiz do projeto e pula (com aviso) o que nao existir.
// Uso: node run-all-tests.mjs   (ou node tools/run-all-tests.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const root = [process.cwd(), HERE, path.join(HERE, '..')].find((d) => fs.existsSync(path.join(d, 'test.mjs')) || fs.existsSync(path.join(d, 'index.html'))) || process.cwd();
const files = ['test.mjs', 'test_music.mjs', 'test_rig.mjs', 'test_frame.mjs', 'test_retarget.mjs', 'test_glb.mjs', 'test_prepare.mjs', 'test_setup.mjs', 'test_layouts.mjs', 'test_keeper.mjs', 'test_arduino.mjs', 'test_arcade_forca.mjs'];
console.log('Pasta do projeto: ' + path.resolve(root));
let bad = 0, rodou = 0;
for (const f of files) {
  if (!fs.existsSync(path.join(root, f))) { console.log('·  ' + f.padEnd(20) + ' ausente (pulado)'); continue; }
  rodou++;
  const r = spawnSync('node', [f], { encoding: 'utf8', cwd: root, timeout: 280000 }), last = (r.stdout.trim().split('\n').pop() || '').trim();
  console.log((r.status === 0 ? 'OK ' : 'ERRO') + ' ' + f.padEnd(20) + ' ' + last);
  if (r.status) { bad++; console.log(r.stdout.split('\n').filter((l) => l.includes('FALHOU')).join('\n'), (r.stderr || '').slice(0, 400)); }
}
console.log(rodou + ' suite(s) executada(s), ' + bad + ' com falha.');
process.exit(bad ? 1 : 0);
