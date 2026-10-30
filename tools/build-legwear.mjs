#!/usr/bin/env node
// Meião de TODOS os uniformes (o calção fica só na cor; o mapeamento dele continua aqui), tirados das peças do atlas bruto do pack e reamostrados para o mapa de tools/add-legwear-uv.mjs:
//  shorts 512x256 (perna esq. u 0–.5, dir. .5–1, frente no meio de cada metade, v = cintura→barra) e meião 256x256 (mesmo esquema, v = topo→tornozelo).
// No atlas (layout do Football Manager) cada perna é uma peça: calção embaixo (esq. com o escudo, dir. com a marca do fornecedor), meião no meio das laterais.
// Grava assets/kits/<clube>_<uniforme>_socks.png e acrescenta socksFile no kits.json (o Flamengo titular tem os seus, de build-flamengo-home.mjs).
// Uso: node tools/build-legwear.mjs [pasta 3D do pack] [--so clube_uniforme,...]
import fs from 'node:fs';
import path from 'node:path';
import { readPNG, writePNG, make, sample } from './png-io.mjs';
const DIR = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'C:/Users/Pichau/Desktop/Brasil Kits 26-27/3D', OUT = 'assets/kits', KITS = path.join(OUT, 'kits.json');
const si = process.argv.indexOf('--so'), ONLY = si > 0 ? new Set(process.argv[si + 1].split(',')) : null;
const ID = Object.fromEntries([...fs.readFileSync(new URL('./build-kits.py', import.meta.url), 'utf8').matchAll(/'([\w-]+)':'(\d+)'/g)].map(m => [m[1], m[2]]));
// peças (atlas 2048x2048) e onde fica a FRENTE da perna em cada uma (fração da largura); v0/v1: faixa útil da peça (tira o recorte do cós/barra e o pé do meião)
export const PIECES = { shorts: { L: [0, 1540, 707, 508], R: [1341, 1540, 707, 508], front: .66, v0: .06, v1: .94, size: [512, 256] },
  socks: { L: [0, 850, 470, 600], R: [1578, 850, 470, 600], front: .62, v0: .03, v1: .80, size: [256, 256] } };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), d3 = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
// base: cor do calção/meião (kits.json) — o fundo do atlas fora do molde (cantos da peça) vira essa cor, senão aparece como faixa atrás da perna
export function legTexture(atlas, kind, base) {
  const P = PIECES[kind], [W, H] = P.size, s = atlas.w/2048, out = make(W, H), bc = hex(base), bgs = {};
  for (const side of ['L', 'R']) { const [px, py, pw, ph] = P[side]; bgs[side] = [[2, 2], [pw - 3, 2], [2, ph - 3], [pw - 3, ph - 3]].map(([x, y]) => sample(atlas, (px + x)*s, (py + y)*s)).filter(c => d3(c, bc) > 70); }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const left = x < W/2, lu = (x - (left ? 0 : W/2) + .5)/(W/2), th = (lu - .5)*2*Math.PI;   // th: ângulo na perna (0 = frente, + = para o lado +x)
    const side = left ? 'L' : 'R', [px, py, pw, ph] = P[side], f = left ? P.front : 1 - P.front; let u = f + th/(2*Math.PI); u -= Math.floor(u);   // u cresce com th: texto legível de frente e de costas; peça da perna direita é o espelho da esquerda
    const v = P.v0 + (y + .5)/H*(P.v1 - P.v0); let p = sample(atlas, (px + u*pw)*s, (py + v*ph)*s); if (bgs[side].some(c => d3(c, p) < 45)) p = bc; out.d.set([p[0], p[1], p[2], 255], (y*W + x)*4); }
  return out;
}
const entry = process.argv[1] && process.argv[1].endsWith('build-legwear.mjs');
if (entry) {
  const raw = fs.readFileSync(KITS, 'utf8'), meta = JSON.parse(raw), feitos = [];
  for (const [key, vs] of Object.entries(meta)) for (const [v, e] of Object.entries(vs)) { const tag = `${key}_${v}`; if (ONLY && !ONLY.has(tag)) continue; if (key === 'flamengo' && v === 'home') continue;   // titular do Flamengo: arte própria
    const f = path.join(DIR, `${ID[key]}_${v}_3d.png`); if (!fs.existsSync(f)) { console.log('… sem atlas', tag); continue; } const a = readPNG(f);
    for (const kind of ['socks']) { const file = `${OUT}/${tag}_${kind}.png`; writePNG(file, legTexture(a, kind, e[kind])); e[kind + 'File'] = file; } delete e.shortsFile; feitos.push(tag); }   // calção fica só na cor do kits.json (decisão do usuário: sem listras/arte); o mapeamento de calção segue em PIECES/legTexture
  fs.writeFileSync(KITS, JSON.stringify(meta, null, 1) + (raw.endsWith('\n') ? '\n' : ''));
  console.log(`✔ meião de ${feitos.length} uniformes: ${feitos.join(' ')}`);
}
