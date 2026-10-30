#!/usr/bin/env node
// Recorta o ESCUDO de cada clube do atlas bruto do pack (peito esquerdo da camisa) → assets/kits/crests/<clube>.png (colorido, fundo transparente, aparado).
// Usado pelo packShirt (js/three/uniform.js) para o escudinho sob a gola e dentro dos algarismos do número, em todas as camisas.
// O fundo é separado pela distância de cor até a mediana da borda da caixa. Caixas conferidas a olho (coordenadas de um atlas 2048x2048).
// Uso: node tools/build-crests.mjs [pasta 3D do pack] [saída = assets/kits/crests]
import fs from 'node:fs';
import path from 'node:path';
import { readPNG, writePNG, make, get } from './png-io.mjs';
const DIR = process.argv[2] || 'C:/Users/Pichau/Desktop/Brasil Kits 26-27/3D', OUT = process.argv[3] || 'assets/kits/crests';
const ID = Object.fromEntries([...fs.readFileSync(new URL('./build-kits.py', import.meta.url), 'utf8').matchAll(/'([\w-]+)':'(\d+)'/g)].map(m => [m[1], m[2]]));   // clube → ID do pack (tabela CLUBS)
// [uniforme de onde recortar, x, y, largura, altura, modo]; o Cruzeiro não tem escudo no peito nesta camisa (só as estrelas).
// modo: 'flood' (padrão: fundo inundado a partir da borda), 'shield'/'ellipse' (escudo sobre listras da mesma cor: forma fixa na caixa justa),
//       'white' (só as partes claras: escudo vazado) e 'red' (só o vermelho: cruz do Vasco)
const BOX = { flamengo: ['home', 1092, 1326, 104, 108, 'white'], corinthians: ['home', 1112, 1326, 92, 112], palmeiras: ['home', 1090, 1294, 108, 118], saopaulo: ['away', 1114, 1340, 96, 118],
  santos: ['home', 1090, 1310, 104, 120], gremio: ['home', 1111, 1330, 89, 83, 'ellipse'], internacional: ['home', 1082, 1286, 100, 104], 'atletico-mg': ['home', 1102, 1262, 100, 132],
  botafogo: ['home', 1074, 1323, 103, 96, 'shield'], fluminense: ['home', 1115, 1303, 95, 105, 'shield'], vasco: ['home', 1106, 1317, 86, 85, 'red'], bahia: ['home', 1106, 1294, 102, 116],
  sport: ['home', 1086, 1312, 90, 78, 'shield'], fortaleza: ['home', 1104, 1330, 82, 90], ceara: ['home', 1090, 1286, 102, 124], 'athletico-pr': ['home', 1092, 1325, 96, 117, 'white'],
  coritiba: ['away', 1106, 1310, 92, 116], bragantino: ['home', 1090, 1294, 128, 132], vitoria: ['home', 1090, 1342, 104, 108] };
const SHAPE = { shield: (u, v) => v < .55 ? 1 : Math.abs(u - .5) < .5*(1 - (v - .55)/.45)**.8 ? 1 : 0, ellipse: (u, v) => (u - .5)**2 + (v - .5)**2 < .25 ? 1 : 0 };
const COLOR = { white: p => sm((Math.min(p[0], p[1], p[2]) - 130)/70), red: p => sm((p[0] - Math.max(p[1], p[2]) - 60)/50) };
const sm = t => { t = Math.min(1, Math.max(0, t)); return t*t*(3 - 2*t); };
fs.mkdirSync(OUT, { recursive: true }); const feitos = [];
for (const [key, [v, bx, by, bw, bh, mode = 'flood']] of Object.entries(BOX)) {
  const f = path.join(DIR, `${ID[key]}_${v}_3d.png`); if (!fs.existsSync(f)) { console.log('… sem atlas', key, f); continue; }
  const a = readPNG(f), s = a.w/2048, x0 = Math.round(bx*s), y0 = Math.round(by*s), w = Math.round(bw*s), h = Math.round(bh*s);
  // fundo pode ser listrado: agrupa as cores da borda (até 4 grupos) e "inunda" a partir da borda tudo o que estiver perto de algum grupo; o que a inundação não alcança é o escudo
  const P = (x, y) => get(a, x0 + x, y0 + y), d3 = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]), border = [];
  for (let x = 0; x < w; x++) border.push(P(x, 0), P(x, h - 1)); for (let y = 0; y < h; y++) border.push(P(0, y), P(w - 1, y));
  const C = []; for (const p of border) { const c = C.find(c => d3(c.m, p) < 70); if (c) { c.n++; c.m = c.m.map((v, k) => v + (p[k] - v)/c.n); } else C.push({ m: p.slice(0, 3), n: 1 }); }
  const bgs = C.filter(c => c.n >= border.length*.06).sort((p, q) => q.n - p.n).slice(0, 4).map(c => c.m), near = p => Math.min(...bgs.map(b => d3(b, p)));
  const seen = new Uint8Array(w*h), q = []; for (let x = 0; x < w; x++) q.push([x, 0], [x, h - 1]); for (let y = 0; y < h; y++) q.push([0, y], [w - 1, y]);
  while (q.length) { const [x, y] = q.pop(); if (x < 0 || y < 0 || x >= w || y >= h || seen[y*w + x]) continue; if (near(P(x, y)) > 60) continue; seen[y*w + x] = 1; q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
  const im = make(w, h, [0, 0, 0, 0]); let mx0 = w, my0 = h, mx1 = -1, my1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = P(x, y), inside = !seen[y*w + x], edge = inside && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(y + dy)*w + x + dx]), i = (y*w + x)*4;
    const al = SHAPE[mode] ? SHAPE[mode]((x + .5)/w, (y + .5)/h) : COLOR[mode] ? COLOR[mode](p) : !inside ? 0 : edge ? sm((near(p) - 30)/60)*.6 + .4 : 1;
    im.d[i] = p[0]; im.d[i + 1] = p[1]; im.d[i + 2] = p[2]; im.d[i + 3] = Math.round(al*255); if (al > .5) { mx0 = Math.min(mx0, x); my0 = Math.min(my0, y); mx1 = Math.max(mx1, x); my1 = Math.max(my1, y); } }
  if (mx1 < 0) { console.log('… escudo não encontrado', key); continue; }
  const cw = mx1 - mx0 + 3, ch = my1 - my0 + 3, out = make(cw, ch, [0, 0, 0, 0]); for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const sx = mx0 - 1 + x, sy = my0 - 1 + y; if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue; out.d.set(im.d.subarray((sy*w + sx)*4, (sy*w + sx)*4 + 4), (y*cw + x)*4); }
  writePNG(path.join(OUT, key + '.png'), out); feitos.push(`${key} ${cw}x${ch}`); }
console.log(`✔ ${feitos.length} escudos em ${OUT}: ${feitos.join(' · ')}`);
