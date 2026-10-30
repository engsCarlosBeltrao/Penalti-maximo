// UNIFORMES SEM UM MODELO POR TIME: um único GLB recebe, em tempo de execução, cores (materiais), estampa da camisa (textura gerada), nome, número,
// escudo, cor de pele/cabelo/chuteira. A camisa é desenhada num canvas e usada como textura do material "Shirt".
// Dois formatos de UV do modelo são suportados: 'wrap' (padrão do jogo: u dá a volta no tronco) e 'atlas' (regiões retangulares descritas em assets/models/uniform-layout.json).
import { shirtTex } from '../athlete.js';
import { CRESTS } from '../teams.js';
export const DEFAULT_ATLAS = {
  type: 'atlas', size: [1024, 1024],                                   // retângulos [x, y, largura, altura] em PIXELS do atlas (origem no canto superior esquerdo, como no glTF)
  regions: { front: [0, 0, 512, 640], back: [512, 0, 512, 640], sleeveL: [0, 640, 256, 192], sleeveR: [256, 640, 256, 192], collar: [512, 640, 512, 64] },
  print: {                                                             // posições RELATIVAS (0–1) dentro da região indicada
    name: { region: 'back', rect: [.12, .07, .76, .1] }, numberBack: { region: 'back', rect: [.2, .2, .6, .46] },
    numberFront: { region: 'front', rect: [.1, .16, .2, .14] }, crest: { region: 'front', rect: [.64, .13, .22, .24] } }
};
export const LAYOUTS = { wrap: { type: 'wrap' }, atlas: DEFAULT_ATLAS };
const lum = h => { const n = parseInt(h.slice(1), 16); return (.3*(n >> 16) + .59*(n >> 8 & 255) + .11*(n & 255))/255; };
function paintPattern(c, kit, x, y, w, h) {                            // listras/faixas do clube dentro de uma região
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = kit.c2;
  if (kit.pat === 'v') for (let i = w*.06; i < w; i += w*.125) c.fillRect(x + i, y, w*.0625, h); else if (kit.pat === 'h') for (let j = h*.06; j < h; j += h*.22) c.fillRect(x, y + j, w, h*.11);
  else if (kit.pat === 's') { c.fillRect(x, y + h*.38, w, h*.2); c.fillStyle = kit.c3; c.fillRect(x, y + h*.38, w, h*.03); c.fillRect(x, y + h*.55, w, h*.03); }
  else if (kit.pat === 'd') { c.translate(x + w/2, y + h/2); c.rotate(-.9); c.fillRect(-w, -h*.11, 2*w, h*.22); } else if (kit.pat === 'f') c.fillRect(x + w/2, y, w/2, h);
  c.restore();
}
function fitText(c, text, rx, ry, rw, rh, weight, ink, stroke) {      // escreve o texto no maior tamanho que cabe no retângulo
  let fs = rh; c.font = `${weight} ${fs}px Arial`; while (c.measureText(text).width > rw && fs > 6) c.font = `${weight} ${--fs}px Arial`;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = ink; if (stroke) { c.strokeStyle = stroke; c.lineWidth = Math.max(2, fs*.06); c.strokeText(text, rx + rw/2, ry + rh/2); } c.fillText(text, rx + rw/2, ry + rh/2);
}
function crest(c, kit, rx, ry, rw, rh, img) {
  if (img) { c.drawImage(img, rx, ry, rw, rh); return; }                                              // escudo oficial (assets/crests/<key>.png), se existir
  c.save(); c.translate(rx, ry); c.scale(rw/32, rh/44); c.fillStyle = kit.c2 || '#222'; c.strokeStyle = lum(kit.c2 || '#222') > .6 ? '#111' : '#fff'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(32, 0); c.lineTo(32, 24); c.quadraticCurveTo(32, 38, 16, 44); c.quadraticCurveTo(0, 38, 0, 24); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.font = '900 13px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText((kit.sigla || '').slice(0, 3), 16, 20); c.restore();   // escudo genérico (provisório)
}
// ---- Camisa para o modelo 3D (UV "wrap"): textura 1024x576 com tecido, painéis laterais, costuras, escudo, patrocinador, número e nome ----
// Mapa: u dá a volta no tronco (frente em u=.25 → x=256; costas em u=.75 → x=768; costuras laterais em x=0 e x=512), v=0 na gola, corpo até y=496; faixa 496–576 = mangas.
const SH = (h, k) => { const n = parseInt(h.slice(1), 16), f = c => Math.max(0, Math.min(255, Math.round(c*k))); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; };
// Mapa vertical do corpo no GLB (tools/prepare-athlete.mjs, torsoUV): v=0 no topo da camisa (ombros, y≈1.52 m) e v=.72 na barra (y≈.849 m).
// Os atlas do pack foram desenhados para um topo mais baixo (y≈1.431 m); packShirt() reposiciona o painel para o escudo/patrocinadores caírem na altura certa do peito.
const BACK_DROP = 1;
const UVY = { top: 1.52, packTop: 1.4309, bot: .8491 };
export const WRAP = { W: 1024, H: 768, body: 553 };   // layout atual: corpo v 0–.72, mangas v .74–.98 (esq. u≈.25 · dir. u≈.75)
const LEG = { W: 1024, H: 576, body: 496 };            // layout interno do uniforme procedural (redistribuído em WRAP no fim)
function patternWrap(c, kit, W, B) {
  c.fillStyle = kit.c1; c.fillRect(0, 0, W, LEG.H);
  c.fillStyle = kit.c2;
  if (kit.pat === 'v') for (let x = 32; x < W; x += 128) c.fillRect(x, 0, 64, LEG.H);                                  // listras verticais (continuam nas mangas)
  else if (kit.pat === 'h') for (let y = 36; y < B; y += 124) c.fillRect(0, y, W, 62);                                     // faixas horizontais
  else if (kit.pat === 's') { c.fillRect(0, 196, W, 92); c.fillStyle = kit.c3; c.fillRect(0, 196, W, 10); c.fillRect(0, 278, W, 10); }   // faixa central
  else if (kit.pat === 'd') for (const x0 of [0, 512]) { c.beginPath(); c.moveTo(x0, 40); c.lineTo(x0, 170); c.lineTo(x0 + 512, B); c.lineTo(x0 + 512, B - 130); c.closePath(); c.fill(); }   // faixa diagonal
  else if (kit.pat === 'f') c.fillRect(256, 0, 512, B);                                                                    // metade (lado esquerdo do jogador)
  else { c.fillStyle = 'rgba(0,0,0,.05)'; for (let x = 0; x < W; x += 64) c.fillRect(x, 0, 32, LEG.H); }                  // liso: listras tom-sobre-tom, comum em camisas modernas
}
function fabricWrap(c, kit, W, B) {
  const g = c.createLinearGradient(0, 0, 0, B); g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.12)'); c.fillStyle = g; c.fillRect(0, 0, W, B);   // luz de cima
  const k = document.createElement('canvas'); k.width = k.height = 8; const kc = k.getContext('2d'); kc.strokeStyle = 'rgba(0,0,0,.10)'; kc.lineWidth = 1; kc.beginPath(); kc.moveTo(0, 8); kc.lineTo(8, 0); kc.moveTo(-4, 4); kc.lineTo(4, -4); kc.moveTo(4, 12); kc.lineTo(12, 4); kc.stroke();
  kc.strokeStyle = 'rgba(255,255,255,.07)'; kc.beginPath(); kc.moveTo(0, 0); kc.lineTo(8, 8); kc.stroke(); c.fillStyle = c.createPattern(k, 'repeat'); c.fillRect(0, 0, W, LEG.H);                              // malha/tricô
  for (const sx of [0, 512, 1024]) { const sg = c.createLinearGradient(sx - 70, 0, sx + 70, 0); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(.5, 'rgba(0,0,0,.16)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.fillRect(sx - 70, 0, 140, B); }   // painéis laterais mais escuros
  c.fillStyle = 'rgba(0,0,0,.13)'; for (const sx of [0, 512, 1024]) for (let y = 120; y < B - 20; y += 14) for (let x = sx - 40; x <= sx + 40; x += 14) c.fillRect(x + ((y/14) % 2)*7, y, 3, 3);    // furinhos de ventilação
  c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 2; c.setLineDash([9, 5]); for (const sx of [1, 512, 1023]) { c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx, B); c.stroke(); } c.beginPath(); c.moveTo(0, B - 16); c.lineTo(LEG.W, B - 16); c.stroke(); c.setLineDash([]);   // costuras (laterais e barra)
}
// redistribui o canvas 1024x576 (corpo 0–496, mangas 496–576) no layout WRAP (corpo 0–553, faixas de manga 568–753)
function relayout(src) { const cv = document.createElement('canvas'); cv.width = WRAP.W; cv.height = WRAP.H; const c = cv.getContext('2d'); c.drawImage(src, 0, 0, LEG.W, LEG.body, 0, 0, WRAP.W, WRAP.body); c.drawImage(src, 0, LEG.body, LEG.W, LEG.H - LEG.body, 0, Math.round(.74*WRAP.H), WRAP.W, Math.round(.24*WRAP.H)); c.drawImage(src, 0, LEG.body - 1, LEG.W, 1, 0, WRAP.body, WRAP.W, Math.round(.74*WRAP.H) - WRAP.body); return cv; }
export function wrapShirt(kit, look, crestImg = null) {
  if (typeof document === 'undefined') return null;
  const { W, H, body: B } = LEG, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  patternWrap(c, kit, W, B); fabricWrap(c, kit, W, B);
  const ink = lum(kit.c1) > .55 && kit.pat !== 'h' && kit.pat !== 'v' || lum(kit.c1) > .8 ? '#111820' : '#ffffff', alt = ink === '#fff' || ink === '#ffffff' ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.55)', num = look.noNum ? '' : String(look.num ?? '');
  // faixa atrás dos números/nome só quando o fundo é listrado (legibilidade), no tom do clube
  const plate = (x, y, w, h) => { if (kit.pat === 'v' || kit.pat === 'h' || kit.pat === 'd' || kit.pat === 's') { c.fillStyle = SH(kit.c1, .94); c.globalAlpha = .92; c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, 10) : c.rect(x, y, w, h); c.fill(); c.globalAlpha = 1; } };
  // COSTAS: nome (acima) e número grande, centrados em x=768
  if (num) fitText(c, num, 768 - 110, 136, 220, 200, '900', ink, alt);
  if (look.nome) fitText(c, look.nome.slice(0, 12).toUpperCase(), 768 - 138, 68, 276, 40, '800', ink, alt);
  // FRENTE: escudo no peito esquerdo do jogador (x≈340), número pequeno no direito, patrocinador no centro
  if (!kit.keeper) { crest(c, kit, 288, 66, 66, 84, crestImg); if (num) fitText(c, num, 164, 84, 56, 60, '900', ink, alt); }
  const spons = kit.sponsor || look.sponsor; if (spons && !kit.keeper) { plate(256 - 120, 196, 240, 64); fitText(c, String(spons).toUpperCase().slice(0, 16), 256 - 108, 204, 216, 48, '800', ink, null); }
  return relayout(cv);
}
// Costuras laterais da camisa do pack: as imagens trazem, junto das bordas da frente e das costas, o contorno do molde do atlas de origem, e frente e costas
// nem sempre se encontram na mesma altura (faixas "quebradas" na lateral). Numa faixa de SEAM px de cada lado da costura, o tecido vira um degradê entre a cor
// da frente e a das costas tiradas logo depois da faixa. A cor de referência é a MEDIANA (por luminância) de uma janela de 16 colunas × 13 linhas: uma
// coluna só pegava o traço fino do contorno e espalhava riscos escuros pelo degradê. Só as laterais mudam: escudo, patrocinadores, nome e número ficam como estão.
const SEAM = 60;
function seamBlend(c) {
  const { W, body: B } = WRAP, im = c.getImageData(0, 0, W, B), d = im.data, px = (x, y) => (y*W + x)*4;
  const ref = (x0, dir) => { const r = []; for (let y = 0; y < B; y++) { const s = [];   // dir: +1 = janela à direita de x0, -1 = à esquerda
      for (let k = Math.max(0, y - 6); k <= Math.min(B - 1, y + 6); k++) for (let j = 0; j < 16; j++) { const i = px(((x0 + dir*j) % W + W) % W, k); s.push([d[i]*.3 + d[i+1]*.59 + d[i+2]*.11, d[i], d[i+1], d[i+2]]); }
      s.sort((a, b) => a[0] - b[0]); r.push(s[s.length >> 1].slice(1)); } return r; };
  for (const [xa, xb] of [[512 - SEAM, 512 + SEAM], [W - SEAM, W + SEAM]]) {   // costura direita (frente → costas em x=512) e esquerda (costas → frente em x=0); x dá a volta (mod W)
    const A = ref(xa - 1, -1), Z = ref(xb, 1);
    for (let y = 0; y < B; y++) for (let x = xa; x < xb; x++) { const t = (x - xa + .5)/(xb - xa), s = t*t*(3 - 2*t), i = px(x % W, y); for (let k = 0; k < 3; k++) d[i + k] = A[y][k] + (Z[y][k] - A[y][k])*s; } }
  c.putImageData(im, 0, 0);
}
// Camisa do pack (frente/costas já prontas, com escudo e patrocinadores): só acrescenta NOME e NÚMERO nas costas, na cor que contrasta com o tecido atrás.
export function packShirt(pack, look) {
  if (typeof document === 'undefined') return null;
  let backOff = 0;
  const { W, H } = WRAP, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); c.drawImage(pack.img, 0, 0, W, H);
  { const uv = pack.uv && pack.uv.top ? pack.uv : null;   // sem info no GLB (GLB antigo): o atlas já foi desenhado para esse mapa, não reposiciona
    const top = uv ? uv.top : UVY.packTop, bot = uv ? uv.bot : UVY.bot, k = (UVY.packTop - bot)/(top - bot), y0 = Math.round(Math.max(0, (top - UVY.packTop)/(top - bot))*WRAP.body*k);
    const body = document.createElement('canvas'); body.width = W; body.height = WRAP.body; body.getContext('2d').drawImage(cv, 0, 0, W, WRAP.body, 0, 0, W, WRAP.body);
    // frente (x<512) usa y0; costas (x>=512) descem um pouco mais (a gola de trás é mais alta e cortava o patrocinador do topo)
    let bd = BACK_DROP; try { const bw = 220, dd = body.getContext('2d').getImageData(512 + 146, 0, bw, 34).data, m = new Array(3).fill(0); const mc = (pack.main || '#222222').replace('#', ''), mr = parseInt(mc.slice(0, 2), 16), mg = parseInt(mc.slice(2, 4), 16), mb = parseInt(mc.slice(4, 6), 16);
      for (let y = 0; y < 34; y++) { let n = 0; for (let x = 0; x < bw; x++) { const i = (y*bw + x)*4; if (Math.abs(dd[i] - mr) + Math.abs(dd[i+1] - mg) + Math.abs(dd[i+2] - mb) > 90) n++; } if (n > 14) { bd = BACK_DROP + 10; break; } } } catch (e) { /* canvas tainted */ }   // patrocinador colado no topo das costas: desce mais para sair de baixo da gola
    let striped = false; try { const sds = []; for (const ry of [150, 180, 210, 240, 270, 300]) { const rw = body.getContext('2d').getImageData(512 + 80, ry, 352, 1).data; let m = 0, q = 0; for (let i = 0; i < rw.length; i += 4) { const l = rw[i]*.3 + rw[i+1]*.59 + rw[i+2]*.11; m += l; q += l*l; } const n = rw.length/4; m /= n; sds.push(Math.sqrt(Math.max(0, q/n - m*m))); } sds.sort((a, b) => a - b); striped = (sds[2] + sds[3])/2 > 28; } catch (e) { /* canvas tainted */ }   // listras verticais? então a faixa que sobra no topo continua as listras (em vez de uma cor lisa)
    backOff = y0 + (uv ? bd : 0);
    [[0, y0], [512, backOff]].forEach(([x, yy]) => { c.fillStyle = pack.main || '#222'; c.fillRect(x, 0, 512, yy + 1); if (x === 512 && striped && yy > 0) c.drawImage(body, x, 150, 512, yy + 1, x, 0, 512, yy + 1); c.drawImage(body, x, 0, 512, WRAP.body, x, yy, 512, WRAP.body - yy); }); }
  try { seamBlend(c); } catch (e) { /* canvas tainted: mantém as laterais como vieram */ }
  const num = look.noNum ? '' : String(look.num ?? ''); let L = .5; try { const d = c.getImageData(768 - 100, 200, 200, 220).data; let t = 0; for (let i = 0; i < d.length; i += 4) t += (d[i]*.3 + d[i+1]*.59 + d[i+2]*.11)/255; L = t/(d.length/4); } catch (e) { /* canvas tainted */ }
  const ink = L > .55 ? '#101820' : '#ffffff', alt = L > .55 ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.55)';
  // posição de nome e número se adapta aos patrocinadores desta camisa: acha as linhas "ocupadas" na faixa central das costas e fica no espaço livre
  let nameY = 104, numTop = 140, numBot = 418;
  try { const X0 = 768 - 110, BW = 220, d = c.getImageData(X0, 0, BW, 500).data, sd = [];
    for (let y = 0; y < 500; y++) { let m = 0, q = 0; for (let x = 0; x < BW; x++) { const i = (y*BW + x)*4, l = d[i]*.3 + d[i+1]*.59 + d[i+2]*.11; m += l; q += l*l; } m /= BW; sd.push(Math.sqrt(Math.max(0, q/BW - m*m))); }
    const ml = []; for (let y = 0; y < 500; y++) { let m = 0; for (let x = 0; x < BW; x++) { const i = (y*BW + x)*4; m += d[i]*.3 + d[i+1]*.59 + d[i+2]*.11; } ml.push(m/BW); }
    const ref = sd.slice(230, 400).sort((a, b) => a - b)[85], busy = y => sd[y] > ref*1.6 + 9 || (y > 60 && y < 230 && Math.abs(ml[y] - ml[y + 5]) > 40);   // faixa/borda de cor forte também conta como ocupada
    let r1 = -1; for (let y = 70; y < 215; y++) if (busy(y)) r1 = y;                                  // último patrocinador no alto das costas
    let r2 = 470; for (let y = 470; y >= 340; y--) if (busy(y)) r2 = y;                                // primeiro patrocinador de baixo
    if (r1 >= 0) nameY = Math.min(Math.max(104, r1 + 4), 224); if (pack.sb) nameY = Math.min(Math.max(nameY, pack.sb + backOff + 7), 224);   // sb = linha (no atlas) onde termina o patrocinador das costas (assets/kits/kits.json) — o nome fica logo abaixo dele
    numTop = nameY + 36; numBot = Math.min(Math.max(r2 - 8, numTop + 150), 440);
  } catch (e) { /* canvas tainted: mantém a posição padrão */ }
  if (num) fitText(c, num, 768 - 140, numTop, 280, numBot - numTop, '900', ink, alt);
  if (look.nome) { let ni = ink, na = alt; try { const dn = c.getImageData(768 - 120, nameY, 240, 38).data; let t = 0; for (let i = 0; i < dn.length; i += 4) t += (dn[i]*.3 + dn[i+1]*.59 + dn[i+2]*.11)/255; const Ln = t/(dn.length/4); ni = Ln > .55 ? '#101820' : '#ffffff'; na = Ln > .55 ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.55)'; } catch (e) { /* canvas tainted */ }   // cor do nome pela luminância sob o nome (não pela média das costas)
    fitText(c, look.nome.slice(0, 14).toUpperCase(), 768 - 120, nameY, 240, 38, '800', ni, na); }
  return cv;
}
// Compõe a textura da camisa (canvas) para o layout informado. look: { nome, num, noNum }
export function composeShirt(layout, kit, look, crestImg = null, pack = null) {
  if (pack && pack.img && (!layout || layout.type === 'wrap')) return packShirt(pack, look);
  if (!layout || layout.type === 'wrap') return wrapShirt(kit, look, crestImg);
  const [W, H] = layout.size, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); c.fillStyle = kit.c1; c.fillRect(0, 0, W, H);
  ['front', 'back', 'sleeveL', 'sleeveR'].forEach(r => { const g = layout.regions[r]; if (g) paintPattern(c, kit, ...g); }); if (layout.regions.collar) { const g = layout.regions.collar; c.fillStyle = kit.c2; c.fillRect(...g); }
  const ink = lum(kit.c1) > .55 ? '#101820' : '#fff', stroke = ink === '#fff' ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.5)', num = look.noNum ? '?' : String(look.num ?? ''), P = layout.print || {};
  const box = p => { const g = layout.regions[p.region], [a, b, w, h] = p.rect; return [g[0] + a*g[2], g[1] + b*g[3], w*g[2], h*g[3]]; };
  if (P.name && look.nome) fitText(c, look.nome.slice(0, 11), ...box(P.name), '700', ink, null);
  if (P.numberBack && num) fitText(c, num, ...box(P.numberBack), '900', ink, stroke); if (P.numberFront && num && !kit.keeper) fitText(c, num, ...box(P.numberFront), '900', ink, stroke);
  if (P.crest && !kit.keeper) crest(c, kit, ...box(P.crest), crestImg); return cv;
}
// Regras de cor por material (nomes lógicos). Texturas-base dos materiais do modelo devem ser neutras (branco/cinza) para a cor multiplicar corretamente.
export function uniformColors(kit, look, face, pack = null) {
  return { shirt: '#ffffff' /* a cor vem da textura composta */, shorts: pack ? pack.shorts : kit.sh, socks: pack ? pack.socks : kit.c1, skin: face.skin, hair: face.hairC, boots: face.boot, gloves: kit.keeper ? '#f3f3f3' : face.skin, eyes: '#ffffff', trim: pack ? pack.trim : (kit.c2 || kit.c1), sole: lum(face.boot) > .5 ? '#15171b' : '#f2f2f2' };
}
// Escolhe qual malha de cabelo mostrar (Hair_short, Hair_long, …); sem variantes: mantém a única.
export function hairVisibility(names, style) {
  const hair = names.filter(n => /^hair/i.test(n)); if (hair.length <= 1) return Object.fromEntries(hair.map(n => [n, true]));
  if (style === 'bald') return Object.fromEntries(hair.map(n => [n, false]));                            // careca: nenhuma malha de cabelo
  const pick = hair.find(n => new RegExp(`^hair_${style}$`, 'i').test(n)) || hair.find(n => new RegExp(`${style}`, 'i').test(n)) || hair.find(n => /short/i.test(n)) || hair[0]; return Object.fromEntries(hair.map(n => [n, n === pick]));
}
// Barbas: malhas Beard_stubble | Beard_short | Beard_full | Beard_mustache ('none' esconde todas). A "full" também mostra o bigode embutido.
export function beardVisibility(names, kind) {
  const b = names.filter(n => /^beard/i.test(n)); if (!kind || kind === 'none') return Object.fromEntries(b.map(n => [n, false]));
  const want = new Set([`beard_${kind}`.toLowerCase()]); if (kind === 'short' || kind === 'full') want.add('beard_mustache'); return Object.fromEntries(b.map(n => [n, want.has(n.toLowerCase())]));
}
export const crestImageFor = key => { if (!CRESTS.includes(key) || typeof Image === 'undefined') return null; const i = new Image(); i.src = `assets/crests/${key}.png`; return i.complete && i.naturalWidth ? i : null; };
