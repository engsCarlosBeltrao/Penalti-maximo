#!/usr/bin/env node
// Testa o firmware do arcade no PC: (1) compila o .ino com imitações do Arduino (g++) e roda arduino/teste_host; (2) se o Arduino IDE 2 estiver
// instalado, compila o firmware de verdade para Uno e Nano (avr-gcc). Pula com aviso o que não estiver instalado.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), host = path.join(ROOT, 'arduino', 'teste_host'), exe = path.join(os.tmpdir(), 'teste_firmware' + (process.platform === 'win32' ? '.exe' : ''));
let bad = 0, ok = 0;
const g = spawnSync('g++', ['-std=c++17', '-Wall', '-I', 'mock', '-o', exe, 'teste_firmware.cpp'], { cwd: host, encoding: 'utf8' });
if (g.error) console.log('·  g++ não encontrado: teste do firmware no PC pulado');
else if (g.status) { bad++; console.log('FALHOU: compilação do teste do firmware\n' + g.stderr.slice(0, 800)); }
else { const r = spawnSync(exe, { encoding: 'utf8' }); process.stdout.write(r.stdout); r.status ? bad++ : ok++; }
const cli = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Arduino IDE', 'resources', 'app', 'lib', 'backend', 'resources', 'arduino-cli.exe');
if (!fs.existsSync(cli)) console.log('·  Arduino IDE 2 não encontrado: compilação para a placa pulada');
else for (const fq of ['arduino:avr:uno', 'arduino:avr:nano:cpu=atmega328']) {
  const r = spawnSync(cli, ['compile', '--fqbn', fq, '--no-color', path.join(ROOT, 'arduino', 'penalti_arcade')], { encoding: 'utf8' });
  const uso = (r.stdout.match(/Sketch uses [^\n]*/) || [''])[0];
  if (r.status) { bad++; console.log(`FALHOU: compilação para ${fq}\n` + (r.stderr || r.stdout).split('\n').filter(l => /error/i.test(l)).slice(0, 8).join('\n')); } else { ok++; console.log(`OK  compila para ${fq} · ${uso}`); }
}
console.log(`FIRMWARE: ${ok} etapa(s) ok | ${bad} com falha`); process.exit(bad ? 1 : 0);
