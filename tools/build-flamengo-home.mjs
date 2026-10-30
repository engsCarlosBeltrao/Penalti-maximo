#!/usr/bin/env node
// UNIFORME 1 DO FLAMENGO, montado a partir do atlas bruto do pack "Brasil Kits 26-27" (322_home_3d.png) para ficar igual às referências oficiais:
//  • camisa (1024x768, já no mapa final do athlete.glb: kits.json "final": true): frente como no pack (BRB, Adidas, distintivo, escudo, Betano, Ademicon);
//    costas refeitas: CRF pequeno sob a gola, LUBRAX na 1ª faixa vermelha, faixas mais estreitas, sem Assist Card; mangas com CRF (esq.) e Adidas (dir.) atrás e punho vermelho;
//  • shorts (1024x512: perna esq. x 0–512, dir. 512–1024; u = volta na perna com a FRENTE no meio de cada metade, v = cintura→barra): branco, 3 listras vermelhas por fora, escudo na frente da perna esquerda;
//  • meião (512x512: esq. x 0–256, dir. 256–512; frente no meio, v = topo→tornozelo): faixas vermelhas e pretas, Adidas branco na canela;
//  • escudo pequeno (CRF branco, fundo transparente) desenhado dentro dos algarismos do número.
// O mapeamento de shorts/meião é o de tools/add-legwear-uv.mjs. Uso: node tools/build-flamengo-home.mjs [atlas.png] [pasta de saída = assets/kits]
import path from 'node:path';
import { readPNG, writePNG, make, blit, fill, sample } from './png-io.mjs';
const ATLAS = process.argv[2] || 'C:/Users/Pichau/Desktop/Brasil Kits 26-27/3D/322_home_3d.png', OUT = process.argv[3] || 'assets/kits';
const A = readPNG(ATLAS), S = A.w/2048;   // coordenadas abaixo em pixels de um atlas 2048x2048
const R = ([x, y, w, h]) => [x*S, y*S, w*S, h*S];
const sm = t => { t = Math.min(1, Math.max(0, t)); return t*t*(3 - 2*t); };
const white = (r, g, b) => sm((Math.min(r, g, b) - 120)/90);   // máscara das partes brancas (letras/escudo sobre fundo colorido)
// peças do atlas (layout do Football Manager, como em tools/build-kits.py)
const FRONT = [706.56, 1228.8, 634.88, 808.96], BACK = [706.56, 256, 634.88, 768];   // costas ficam de cabeça para baixo no atlas
const SL_L = [0, 0, 706.56, 634.88], SL_R = [1341.44, 0, 706.56, 634.88];
const CREST = [1092, 1326, 104, 108], ADIDAS = [860, 1347, 92, 52], LUBRAX = [875, 955, 315, 60], CREST_RED = [450, 1874, 90, 102];   // CREST_RED: estrela + escudo do shorts (sem o "Wap" logo acima)
const W = 1024, H = 768, BODY = 553, PANEL_H = 508, Y0 = 64;   // Y0: deslocamento que o packShirt aplicava em tempo de execução (agora já embutido)
const MAIN = [30, 30, 30], RED = [212, 18, 24];
// ---------- camisa ----------
const shirt = make(W, H, [...MAIN, 255]);
{ // FRENTE: painel do atlas (512x508) descido Y0 linhas; barra repete a última linha; gola do atlas trocada por tecido (como o build-kits)
  const f = make(512, BODY, [...MAIN, 255]); blit(f, A, R(FRONT), [0, 0, 512, PANEL_H]);
  for (let y = PANEL_H; y < BODY; y++) for (let x = 0; x < 512; x++) { const s = (( PANEL_H - 1)*512 + x)*4, d = (y*512 + x)*4; for (let k = 0; k < 4; k++) f.d[d + k] = f.d[s + k]; }
  const blk = make(64, 46); blit(blk, f, [44, 2, 64, 46], [0, 0, 64, 46]); blit(f, blk, [0, 0, 64, 46], [256 - 64, 0, 64, 46]); blit(f, blk, [0, 0, 64, 46], [256, 0, 64, 46]);   // decote do atlas (±64, deixava traços vermelhos em x≈205/290) coberto com tecido preto do mesmo painel
  blit(shirt, f, [0, 0, 512, BODY], [0, Y0, 512, BODY - Y0]); }   // como o packShirt fazia: o painel inteiro cabe abaixo de Y0 (comprime ~12%; sem isso o ADEMICON ficava abaixo da barra)
{ // COSTAS: faixas recortadas do miolo das faixas do atlas (sem borda do molde), na ordem da camisa oficial
  const sx = 512/BACK[2], sy = PANEL_H/BACK[3];                 // mesma escala do pack (o tecido mantém o tamanho do ponto)
  const red = [BACK[0], 726, BACK[2], 168], blk = [BACK[0], 562, BACK[2], 156], blkLong = [BACK[0], 555, BACK[2], 165];   // y no atlas (peça invertida)
  const bands = [[0, 116, blk], [116, 222, red], [222, 324, blk], [324, 420, red], [420, BODY, blkLong]];   // MESMAS alturas das faixas da frente (preto/vermelho/preto/vermelho/preto): frente e costas se encontram na lateral
  for (const [y0, y1, src] of bands) { const need = (y1 - y0)/sy, s = [src[0], src[1] + Math.max(0, (src[3] - need)/2), src[2], Math.min(src[3], need)]; blit(shirt, A, R(s), [512, y0, 512, y1 - y0], { rot180: true }); }
  const lw = 284, lh = lw*LUBRAX[3]/LUBRAX[2]*sy/sx; blit(shirt, A, R(LUBRAX), [768 - lw/2, 82 - lh/2, lw, lh], { rot180: true, mask: white });    // LUBRAX na faixa preta do alto das costas (nome e número logo abaixo, na faixa vermelha)
  const ch = 20, cw = ch*CREST[2]/CREST[3]*sx/sy; blit(shirt, A, R(CREST), [768 - cw/2, 34 - ch/2, cw, ch], { mask: white });                     // CRF sob a gola, acima do LUBRAX
}
{ // MANGAS: faixa v .74–.98 de cada braço (esq. centro u≈.24, dir. u≈.74), peça do atlas girada (ombro em cima) como no build-kits; punho vermelho; logos atrás
  fill(shirt, [0, BODY, W, H - BODY], MAIN);
  const SW = 287, SY = Math.round(.74*H), SH = Math.round(.24*H), FRAC = .55;
  for (const [piece, cx, mirror] of [[SL_L, 241.7, false], [SL_R, 753.7, true]]) { const [px, py, pw, ph] = R(piece), f = pw*FRAC;
    for (let r = 0; r < SH; r++) for (let c = 0; c < SW; c++) { let x = (r + .5)/SH*f, y = ph - (c + .5)/SW*ph; if (mirror) x = pw - x; const p = sample(A, px + x, py + y), i = ((SY + r)*W + Math.round(cx - SW/2) + c)*4; shirt.d.set([p[0], p[1], p[2], 255], i); }
    for (let r = SY - 6; r < SY; r++) for (let c = 0; c < SW; c++) { const s = (SY*W + Math.round(cx - SW/2) + c)*4, d = (r*W + Math.round(cx - SW/2) + c)*4; for (let k = 0; k < 4; k++) shirt.d[d + k] = shirt.d[s + k]; } }
  fill(shirt, [0, 741, W, 13], RED);                             // acabamento vermelho no fim da manga (v≈.965–.98)
  // atrás da manga: u .157 (esq.) e .657 (dir.); vertical ~15 linhas/cm e horizontal ~9 px/cm. Na manga esquerda o u cresce para o lado de dentro → logo espelhado
  const ch = 58, cw = ch*CREST[2]/CREST[3]*9/15.2; blit(shirt, A, R(CREST), [161 - cw/2, 676 - ch/2, cw, ch], { mask: white, flipX: true });
  const aw = 38, ah = aw*ADIDAS[3]/ADIDAS[2]*15.2/9; blit(shirt, A, R(ADIDAS), [673 - aw/2, 676 - ah/2, aw, ah], { mask: white });
}
writePNG(path.join(OUT, 'flamengo_home.png'), shirt);
// ---------- shorts ----------
const shorts = make(1024, 512, [242, 242, 242, 255]);
{ const knit = [150, 1620, 48, 48]; for (let y = 0; y < 512; y += 48) for (let x = 0; x < 1024; x += 48) blit(shorts, A, R(knit), [x, y, 48, 48]);   // tecido branco do pack (retalho pequeno, sem os vincos do molde)
  for (const [x0, outer] of [[0, 384], [512, 128]]) { const cx = x0 + outer; for (const dx of [-18, 0, 18]) fill(shorts, [Math.round(cx + dx - 6.5), 0, 13, 512], RED); }   // 3 listras na lateral de fora (esq.: +x; dir.: −x)
  const h = 86, w = h*CREST_RED[2]/CREST_RED[3]*8.3/7.2; blit(shorts, A, R(CREST_RED), [297 - w/2, 360 - h/2, w, h]);   // escudo (com estrela) na frente da perna esquerda, perto da barra
}
writePNG(path.join(OUT, 'flamengo_home_shorts.png'), shorts);
// ---------- meião ----------
const socks = make(512, 512, [24, 24, 24, 255]);
{ const redK = [20, 870, 420, 150], blkK = [20, 1062, 240, 32];   // blkK: linhas da faixa preta acima do CRF lateral do atlas
  const band = (y0, y1, src) => { for (let y = y0; y < y1; y += 40) blit(socks, A, R(src), [0, y, 512, Math.min(40, y1 - y)]); };
  band(0, 60, blkK); fill(socks, [0, 18, 512, 8], RED); fill(socks, [0, 36, 512, 8], RED); band(60, 165, redK); band(165, 215, blkK); band(215, 280, redK); band(280, 385, blkK); band(385, 450, redK); band(450, 512, blkK);
  for (const cx of [128, 384]) { const aw = 52, ah = aw*ADIDAS[3]/ADIDAS[2]*8.5/7.5; blit(socks, A, R(ADIDAS), [cx - aw/2, 332 - ah/2, aw, ah], { mask: white }); }
}
writePNG(path.join(OUT, 'flamengo_home_socks.png'), socks);
// ---------- escudo pequeno para o número (escuro: aparece sobre o algarismo branco) ----------
{ const c = make(104, 108, [24, 24, 24, 0]); for (let y = 0; y < 108; y++) for (let x = 0; x < 104; x++) { const p = sample(A, (CREST[0] + x + .5)*S, (CREST[1] + y + .5)*S); c.d[(y*104 + x)*4 + 3] = Math.round(white(p[0], p[1], p[2])*255); }
  writePNG(path.join(OUT, 'flamengo_home_crf.png'), c); }
console.log(`✔ ${OUT}/flamengo_home.png, _shorts.png, _socks.png, _crf.png gerados a partir de ${ATLAS}`);
