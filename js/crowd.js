// TORCIDA: ~900 pessoas únicas (corpo, cabeça, cabelo, braços, roupa, acessórios) em degraus 3D. Poses: sentado, em pé, aplaudindo,
// braços para o alto (pulando), mãos na cabeça (decepção), bandeira. Cada pessoa reage com atraso e energia próprios. Desenho em lote, 2 níveis de detalhe.
import { shade } from './engine3d.js';
export const ROWS = 13, AISLES = [-7.5, 0, 7.5];
const SK = ['#f6d0a8', '#e8b88a', '#c68642', '#a0693a', '#7a4a2a', '#53341f'], HC = ['#15110e', '#2b1d12', '#4a3020', '#7a5230', '#c9a45c', '#a6401e', '#9aa0a6', '#e8d9b0'], NEUTRAL = ['#e9e9e9', '#1a1a1a', '#6b7280', '#2f5aa8', '#3b7a4a', '#8a2f2f'];
let csd = 12345; const crnd = () => (csd = csd*16807 % 2147483647)/2147483647;
export const fans = [], byRow = Array.from({ length: ROWS }, () => []);
for (let r = 0; r < ROWS; r++) { const half = 13 + r*.9; for (let x = -half; x <= half; x += .6 + crnd()*.12) { if (AISLES.some(a => Math.abs(x - a) < .5)) continue;
  const f = { x: x + (crnd() - .5)*.2, y: .15 + r*.6, z: -4.6 - r*.85 + (crnd() - .5)*.2, r, side: x < 0 ? 0 : 1, skin: SK[crnd()*6 | 0], hs: crnd()*6 | 0, hc: HC[crnd()*8 | 0], b: .88 + crnd()*.3, h: .94 + crnd()*.14, head: .92 + crnd()*.16, pick: crnd(), base: crnd() < .55 ? 0 : crnd() < .75 ? 1 : 2, acc: crnd(), e: crnd(), p: crnd()*6.28, shirt: '#888', trim: '#fff', pants: '#222' };
  f.lod = r <= 3 ? 2 : r <= 6 ? 1 : 0; f.d = Math.abs(f.x)*.05 + r*.04 + crnd()*.25; fans.push(f); byRow[r].push(f); } }
export function colorize(teams) {                      // roupas na cor do clube (mosaico em losango) + neutras; calças escuras
  fans.forEach(f => { const t = teams[f.side]; if (!t.c1) return; const p = f.pick; f.shirt = p < .5 ? t.c1 : p < .62 ? t.c2 : p < .72 ? t.c3 : NEUTRAL[(p*100 | 0) % 6]; f.trim = t.c2; f.pants = ['#1b2233', '#2a2f3a', '#3a3f4b', '#232323'][f.hs % 4]; f.team = t; const fac = 1 - f.r*.022; f.cs = shade(f.shirt, fac); f.ck = shade(f.skin, fac); f.ch = shade(f.hc, fac); f.c1 = shade(t.c1, fac); f.c2 = shade(t.c2, fac); f.ct = shade(f.trim, fac);
    const dx = Math.abs(f.x - (f.side ? 6.5 : -6.5))/4.5, dy = Math.abs(f.r - 5)/3; if (dx + dy < .45) f.shirt = t.c2; else if (dx + dy < .9) f.shirt = t.c3; else if (f.mosaic) f.mosaic = 0; f.mos = dx + dy < .9; });
}
function paint(c, X, Y, k, f, pose, now) {
  const seated = f.base === 0 && pose < 3;
  const b = f.b, h = f.h, shC = f.cs, sk = f.ck, hr = f.ch, lod = f.lod, shoY = Y - .5*h*k, hx = X, hy = shoY - .15*k, rx = .092*f.head*k, ry = .113*f.head*k;
  const up = pose === 3, hands = up ? [[-.34*b, -1.02*h + Math.sin(now*9 + f.p)*.06], [.34*b, -1.02*h + Math.sin(now*9 + f.p + 1)*.06]] : pose === 2 ? [[-.03 - Math.sin(now*10 + f.p)*.04, -.34*h], [.03 + Math.sin(now*10 + f.p)*.04, -.34*h]] : pose === 4 ? [[-.1, -.66*h], [.1, -.66*h]] : seated ? [[-.14*b, -.04*h], [.14*b, -.04*h]] : [[-.25*b, -.04*h], [.25*b, -.04*h]];
  const arm = (s, hd) => { const sx = X + s*.2*b*k, sy = Y - .45*h*k, hX = X + hd[0]*k, hY = Y + hd[1]*k; c.lineCap = 'round';
    if (lod === 2) { const ex = (sx + hX)/2 + s*.05*k, ey = (sy + hY)/2 + (up ? 0 : .06*k); c.strokeStyle = shC; c.lineWidth = .088*k; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke(); c.strokeStyle = sk; c.lineWidth = .068*k; c.beginPath(); c.moveTo(ex, ey); c.lineTo(hX, hY); c.stroke(); c.fillStyle = sk; c.beginPath(); c.arc(hX, hY, .045*k, 0, 7); c.fill(); }
    else { c.strokeStyle = up ? sk : shC; c.lineWidth = .08*k; c.beginPath(); c.moveTo(sx, sy); c.lineTo(hX, hY); c.stroke(); } };
  const front = pose >= 2, drawArms = lod > 0 || up;
  if (!front && drawArms) { arm(-1, hands[0]); arm(1, hands[1]); }
  c.fillStyle = shC; c.beginPath(); c.moveTo(X - .17*b*k, Y); c.lineTo(X - .215*b*k, Y - .43*h*k); c.quadraticCurveTo(X, Y - .58*h*k, X + .215*b*k, Y - .43*h*k); c.lineTo(X + .17*b*k, Y); c.closePath(); c.fill();
  if (lod === 2) { c.fillStyle = 'rgba(0,0,15,.2)'; c.beginPath(); c.moveTo(X + .02*k, Y); c.lineTo(X + .01*k, Y - .54*h*k); c.quadraticCurveTo(X + .12*b*k, Y - .54*h*k, X + .215*b*k, Y - .43*h*k); c.lineTo(X + .17*b*k, Y); c.closePath(); c.fill(); }
  if (lod > 0) { if (f.acc < .12) { c.fillStyle = f.ct; c.fillRect(X - .2*b*k, Y - .3*h*k, .4*b*k, .08*k); } else if (f.acc < .26 && f.team) { c.strokeStyle = f.c1; c.lineWidth = .1*k; c.beginPath(); c.moveTo(X - .17*b*k, shoY + .02*k); c.lineTo(X + .17*b*k, shoY + .02*k); c.stroke(); c.strokeStyle = f.c2; c.lineWidth = .05*k; c.beginPath(); c.moveTo(X - .08*k, shoY); c.lineTo(X - .06*k, Y - .12*h*k); c.stroke(); } }
  if (lod > 0) { c.fillStyle = sk; c.fillRect(X - .045*k, hy + ry*.7, .09*k, .1*k); }
  if (f.hs === 3) { c.fillStyle = hr; c.beginPath(); c.arc(hx, hy - ry*.15, rx*1.35, 0, 7); c.fill(); } else if ((f.hs === 2 || f.hs === 5) && lod > 0) { c.fillStyle = hr; c.beginPath(); c.ellipse(hx, hy + ry*.5, rx*1.1, ry*1.05, 0, 0, 7); c.fill(); }
  c.fillStyle = sk; c.beginPath(); c.ellipse(hx, hy, rx, ry, 0, 0, 7); c.fill();
  if (f.hs !== 4) { c.fillStyle = hr; c.beginPath(); c.ellipse(hx, hy - ry*.2, rx*1.04, ry*.92, 0, Math.PI, 0); c.fill(); }
  if (lod > 0 && f.acc > .86 && f.team) { c.fillStyle = f.c1; c.beginPath(); c.ellipse(hx, hy - ry*.3, rx*1.06, ry*.75, 0, Math.PI, 0); c.fill(); c.fillRect(hx - rx*1.5, hy - ry*.32, rx*1.5, ry*.14); }
  if (lod === 2 && rx > 2.6) { c.fillStyle = '#1b1210'; c.beginPath(); c.arc(hx - rx*.38, hy - ry*.02, Math.max(.6, rx*.1), 0, 7); c.arc(hx + rx*.38, hy - ry*.02, Math.max(.6, rx*.1), 0, 7); c.fill();
    c.strokeStyle = '#6a2b2b'; c.fillStyle = '#4a1818'; c.lineWidth = Math.max(.8, rx*.1); c.beginPath(); if (up) { c.ellipse(hx, hy + ry*.42, rx*.32, ry*.2, 0, 0, 7); c.fill(); } else if (pose === 4) c.arc(hx, hy + ry*.62, rx*.28, Math.PI*1.1, Math.PI*1.9); else { c.moveTo(hx - rx*.25, hy + ry*.45); c.lineTo(hx + rx*.25, hy + ry*.45); } c.stroke(); }
  if (front && drawArms) { arm(-1, hands[0]); arm(1, hands[1]); }
  if (lod === 2 && f.acc > .93 && f.team && pose >= 2) { const x0 = X + .34*b*k, y0 = Y - 1.0*h*k, w = Math.sin(now*5 + f.p)*.14*k; c.strokeStyle = '#ddd'; c.lineWidth = .03*k; c.beginPath(); c.moveTo(x0, y0 + .2*k); c.lineTo(x0, y0 - .85*k); c.stroke();
    c.fillStyle = f.c1; c.beginPath(); c.moveTo(x0, y0 - .85*k); c.lineTo(x0 + .8*k + w, y0 - .8*k + w*.3); c.lineTo(x0 + .8*k + w, y0 - .4*k + w*.3); c.lineTo(x0, y0 - .4*k); c.closePath(); c.fill(); c.fillStyle = f.c2; c.fillRect(x0, y0 - .62*k, .8*k + w, .1*k); }
}

// --- sprites: torcedor em repouso é pintado uma vez num canvas e depois desenhado com 1 drawImage ---
let made = 0;
export const frameStart = () => { made = 0; };
const KREF = [45, 70, 110];
function sprite(f) {
  const K = KREF[f.lod], w = Math.ceil(1.1*K), h = Math.ceil(1.3*K), cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
  paint(c, w/2, 1.05*K, K, f, f.base, 0); return { cv, w, h, ax: w/2, ay: 1.05*K, K };
}
export function clearSprites() { fans.forEach(f => { f.sp = null; }); }
export function drawFan(c, E, f, now, exS, sad) {
  const m = Math.max(0, exS[f.side]*(.5 + .5*f.e) - f.d*.1), sdn = sad[f.side]*(.4 + .6*f.e), pose = m > .5 ? 3 : m > .18 ? 2 : sdn > .3 ? 4 : f.base;
  const hop = pose === 3 ? Math.abs(Math.sin(now*8 + f.p))*.22*m : 0, seated = f.base === 0 && pose < 3, q = E.proj([f.x, f.y + (seated ? .45 : .8) + hop, f.z]); if (!q) return;
  const k = q[3], X = q[0], Y = q[1]; if (X < -40 || X > 1000 || Y < -120 || Y > 600) return;
  if (pose === f.base && pose < 2 && typeof document !== 'undefined') { let sp = f.sp; if (!sp && made < 140) { sp = f.sp = sprite(f); made++; } if (sp) { const sc = k/sp.K; c.drawImage(sp.cv, X - sp.ax*sc, Y - sp.ay*sc, sp.w*sc, sp.h*sc); return; } }
  paint(c, X, Y, k, f, pose, now);
}

export function ensureSprite(f) { if (!f.sp && typeof document !== 'undefined') f.sp = sprite(f); return f.sp; }   // usado pelo motor Three.js (sprites 3D)
