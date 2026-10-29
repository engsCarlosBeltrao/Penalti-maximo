// ATLETA 3D procedural (malhas, não cápsulas): torso cilíndrico com a camisa MAPEADA ao redor (nome/número curvam com o corpo),
// membros afilados com sombreamento, shorts/meias/chuteiras, cabeça elipsoidal com rosto 3D e cabelos com volume. Cada atleta tem aparência própria.
import { sub, add, mul, dot, norm, lerp, shade } from './engine3d.js';
import { CRESTS } from './teams.js';
export const SKINS = ['#f6d0a8', '#e8b88a', '#c68642', '#a0693a', '#7a4a2a', '#53341f'], HAIRC = ['#15110e', '#2b1d12', '#4a3020', '#7a5230', '#c9a45c', '#a6401e', '#9aa0a6', '#e8d9b0'], BOOTS = ['#14161a', '#f4f4f4', '#ff5a1f', '#2bd96b', '#2f7bff', '#ffd23f'];
export const STYLES = ['short', 'buzz', 'long', 'afro', 'curly', 'bald', 'bun'];
const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rngOf = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; }; };
const faces = new Map();
export function faceOf(key, hint = {}) {               // aparência determinística por atleta (rosto, cabelo, pele, porte)
  const id = String(key) + (hint.hair || ''); let f = faces.get(id); if (f) return f; const r = rngOf(hash(id));
  const skin = r() < .5 ? 1 + (r()*3 | 0) : (r()*6 | 0), style = hint.hair && STYLES.includes(hint.hair) ? hint.hair : STYLES[r()*STYLES.length | 0];
  f = { skin: SKINS[skin], skinI: skin, hairC: HAIRC[skin >= 4 ? (r()*3 | 0) : (r()*8 | 0)], style, build: .92 + r()*.16, height: .96 + r()*.08, eyeW: .034 + r()*.012, nose: .8 + r()*.45, brow: .7 + r()*.7, mouth: .8 + r()*.5, ear: .8 + r()*.5, eyeC: ['#3b2a1a', '#2a4a6b', '#3d5a2f', '#1b1b1b'][r()*4 | 0], boot: BOOTS[r()*BOOTS.length | 0], head: .94 + r()*.12 }; faces.set(id, f); return f;
}
// ---- camisa: textura que dá a volta no tronco (frente em u=.25, costas em u=.75; a costura fica na lateral) ----
const shirts = new Map(), crestImgs = new Map();
function crestImg(key) { if (!CRESTS.includes(key) || typeof Image === 'undefined') return null; let i = crestImgs.get(key); if (!i) { i = new Image(); i.onload = () => { for (const k of [...shirts.keys()]) if (k.startsWith(key + '|')) shirts.delete(k); }; i.src = `assets/crests/${key}.png`; crestImgs.set(key, i); } return i.complete && i.naturalWidth ? i : null; }
const lumOf = h => { const n = parseInt(h.slice(1), 16); return (.3*(n >> 16) + .59*(n >> 8 & 255) + .11*(n & 255))/255; };
export function shirtTex(kit, p) {
  const key = [kit.key || kit.c1, kit.pat, kit.keeper ? 'k' : '', p.nome, p.num, !!crestImg(kit.key)].join('|'); let cv = shirts.get(key); if (cv) return cv; if (typeof document === 'undefined') return null;
  cv = document.createElement('canvas'); cv.width = 512; cv.height = 192; const c = cv.getContext('2d'); c.fillStyle = kit.c1; c.fillRect(0, 0, 512, 192); c.fillStyle = kit.c2;
  if (kit.pat === 'v') for (let x = 16; x < 512; x += 64) c.fillRect(x, 0, 32, 192); else if (kit.pat === 'h') for (let y = 12; y < 192; y += 42) c.fillRect(0, y, 512, 21);
  else if (kit.pat === 's') { c.fillRect(0, 70, 512, 38); c.fillStyle = kit.c3; c.fillRect(0, 70, 512, 6); c.fillRect(0, 102, 512, 6); } else if (kit.pat === 'd') { c.save(); c.translate(128, 96); c.rotate(-.9); c.fillRect(-300, -22, 600, 44); c.restore(); c.save(); c.translate(384, 96); c.rotate(.9); c.fillRect(-300, -22, 600, 44); c.restore(); } else if (kit.pat === 'f') c.fillRect(0, 0, 256, 192);
  const ink = lumOf(kit.c1) > .55 ? '#101820' : '#fff', stroke = ink === '#fff' ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.5)'; c.textAlign = 'center'; c.fillStyle = ink; c.strokeStyle = stroke; c.lineWidth = 4;
  const num = p.noNum ? '?' : String(p.num);
  c.font = '900 80px Arial'; c.strokeText(num, 384, 126); c.fillText(num, 384, 126); c.font = '700 20px Arial'; c.fillText((p.nome || '').slice(0, 11), 384, 50);   // COSTAS: nome em cima, número grande
  if (!kit.keeper) { c.font = '900 30px Arial'; c.strokeText(num, 96, 70); c.fillText(num, 96, 70); }                                                     // FRENTE: número pequeno
  c.fillStyle = kit.c2; c.fillRect(0, 0, 512, 7);                                                                             // gola
  if (kit.keeper) { shirts.set(key, cv); return cv; }
  const ci = crestImg(kit.key), cx = 168, cy = 62;                                                                                                          // ESCUDO no peito esquerdo (lado direito de quem olha)
  if (ci) c.drawImage(ci, cx - 17, cy - 21, 34, 42); else { c.fillStyle = shade(kit.c2, .85); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(cx - 16, cy - 20); c.lineTo(cx + 16, cy - 20); c.lineTo(cx + 16, cy + 4); c.quadraticCurveTo(cx + 16, cy + 18, cx, cy + 24); c.quadraticCurveTo(cx - 16, cy + 18, cx - 16, cy + 4); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.font = '900 13px Arial'; c.fillText((kit.sigla || '').slice(0, 3), cx, cy + 5); }
  shirts.set(key, cv); return cv;
}
// ---- malha cilíndrica (torso/shorts): triângulos com recorte de faces traseiras, textura por padrão e luz por normal ----
const LIGHT = norm([-.45, .85, .55]);
function drawTri(c, s, t, pat, col) {
  c.save(); if (pat) { const [x0, y0] = s[0], [x1, y1] = s[1], [x2, y2] = s[2], [u0, v0] = t[0], [u1, v1] = t[1], [u2, v2] = t[2], d = u0*(v1 - v2) + u1*(v2 - v0) + u2*(v0 - v1); if (Math.abs(d) < 1e-6) { c.restore(); return; }
    const a = (x0*(v1 - v2) + x1*(v2 - v0) + x2*(v0 - v1))/d, b = (y0*(v1 - v2) + y1*(v2 - v0) + y2*(v0 - v1))/d, cc = (x0*(u2 - u1) + x1*(u0 - u2) + x2*(u1 - u0))/d, dd = (y0*(u2 - u1) + y1*(u0 - u2) + y2*(u1 - u0))/d,
      e = (x0*(u1*v2 - u2*v1) + x1*(u2*v0 - u0*v2) + x2*(u0*v1 - u1*v0))/d, f = (y0*(u1*v2 - u2*v1) + y1*(u2*v0 - u0*v2) + y2*(u0*v1 - u1*v0))/d;
    c.transform(a, b, cc, dd, e, f); c.fillStyle = pat; c.beginPath(); c.moveTo(u0, v0); c.lineTo(u1, v1); c.lineTo(u2, v2); c.closePath(); c.fill(); c.stroke(); }
  else { c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.moveTo(s[0][0], s[0][1]); c.lineTo(s[1][0], s[1][1]); c.lineTo(s[2][0], s[2][1]); c.closePath(); c.fill(); c.stroke(); }
  c.restore();
}
function cyl(E, o) {
  const rings = o.rx.length, seg = o.seg || 16, V = [], N = [], Q = [];
  for (let i = 0; i < rings; i++) { const c0 = lerp(o.p0, o.p1, i/(rings - 1)); V.push([]); N.push([]); Q.push([]);
    for (let k = 0; k < seg; k++) { const th = 2*Math.PI*k/seg, s = Math.sin(th), co = Math.cos(th), pos = add(c0, add(mul(o.R, o.rx[i]*s), mul(o.F, o.rz[i]*co))); V[i].push(pos); N[i].push(norm(add(mul(o.R, s/o.rx[i]), mul(o.F, co/o.rz[i])))); Q[i].push(E.proj(pos)); } }
  if (Q.some(r => r.some(q => !q))) return; const z = dot(sub(lerp(o.p0, o.p1, .5), E.pos), E.f), tex = o.tex, pos0 = E.pos;
  E.push(z, c => { if (o.tex) { c.fillStyle = o.col; c.beginPath(); for (let i = 0; i < rings - 1; i++) for (let k = 0; k < seg; k++) { const k2 = (k + 1) % seg, n = norm(add(add(N[i][k], N[i][k2]), add(N[i + 1][k], N[i + 1][k2]))); if (dot(n, sub(pos0, V[i][k])) <= 0) continue; const a = Q[i][k], b = Q[i][k2], d = Q[i + 1][k], e = Q[i + 1][k2]; c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(e[0], e[1]); c.lineTo(d[0], d[1]); c.closePath(); } c.fill(); c.strokeStyle = o.col; c.lineWidth = 1.5; c.stroke(); } const pat = tex ? (tex.__p ??= c.createPattern(tex, 'repeat')) : null, W = tex ? tex.width : 1, Hh = tex ? tex.height : 1;
    const AL = [.3, .2, .1, .035, 0], BK = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()], HI = new Path2D(); let anyHi = false;
    for (let i = 0; i < rings - 1; i++) for (let k = 0; k < seg; k++) { const k2 = (k + 1) % seg, n = norm(add(add(N[i][k], N[i][k2]), add(N[i + 1][k], N[i + 1][k2]))), cen = V[i][k]; if (dot(n, sub(pos0, cen)) <= 0) continue;
      const lam = Math.max(0, dot(n, LIGHT)), lv = lam < .2 ? 0 : lam < .42 ? 1 : lam < .65 ? 2 : lam < .85 ? 3 : 4, u0 = (k/seg + .25)*W, u1 = (k/seg + 1/seg + .25)*W, v0 = (1 - i/(rings - 1))*Hh, v1 = (1 - (i + 1)/(rings - 1))*Hh;
      const a = Q[i][k], b = Q[i][k2], d = Q[i + 1][k], e = Q[i + 1][k2]; drawTri(c, [a, b, d], [[u0, v0], [u1, v0], [u0, v1]], pat, o.col); drawTri(c, [b, e, d], [[u1, v0], [u1, v1], [u0, v1]], pat, o.col);
      for (const P of [BK[lv]]) { P.moveTo(a[0], a[1]); P.lineTo(b[0], b[1]); P.lineTo(e[0], e[1]); P.lineTo(d[0], d[1]); P.closePath(); } if (lam > .88) { anyHi = true; HI.moveTo(a[0], a[1]); HI.lineTo(b[0], b[1]); HI.lineTo(e[0], e[1]); HI.lineTo(d[0], d[1]); HI.closePath(); } }
    BK.forEach((P, i) => { if (AL[i] > 0) { c.fillStyle = `rgba(0,0,12,${AL[i]})`; c.fill(P); } }); if (anyHi) { c.fillStyle = 'rgba(255,255,240,.08)'; c.fill(HI); } });
}
// ---- cabeça: elipsoide + orelhas + cabelo com volume + rosto 3D (só aparece quando virado para a câmera) ----
function head(E, J, F, mood, keeper) {
  const hc = J.head, q = E.proj(hc); if (!q) return; const qu = E.proj(add(hc, mul(J.hup, .1))); if (!qu) return; const k = q[3], ang = Math.atan2(qu[0] - q[0], -(qu[1] - q[1])), a = .092*F.head*k, b = .118*F.head*k;
  const cv = norm(sub(E.pos, hc)), facing = dot(J.hfwd, cv), side = dot(J.hfwd, E.r) > 0 ? 1 : -1, hr = F.hairC, st = F.style;
  const lm = (r, u, f2) => { const p = E.proj(add(hc, add(add(mul(J.hright, r), mul(J.hup, u)), mul(J.hfwd, f2)))); return p ? [p[0] - q[0], p[1] - q[1]] : [0, 0]; };
  const eyeL = lm(-F.eyeW, .02, .085), eyeR = lm(F.eyeW, .02, .085), noseT = lm(0, -.012, .108*F.nose), mouthP = lm(0, -.047, .09), earL = lm(-.092, 0, 0), earR = lm(.092, 0, 0);
  E.push(q[2] - .02, c => {
    c.save(); c.translate(q[0], q[1]); c.rotate(ang);                                    // referencial local da cabeça (px)
    if (st === 'afro') { c.fillStyle = shade(hr, .85); c.beginPath(); c.ellipse(side*-.1*a*(Math.abs(facing) < .3 ? 1 : 0), -b*.12, a*1.38, b*1.24, 0, 0, 7); c.fill(); }
    if (st === 'long' && facing < .1) { c.fillStyle = shade(hr, .9); c.beginPath(); c.ellipse(0, b*.55, a*1.05, b*1.0, 0, 0, 7); c.fill(); }
    if (st === 'bun') { c.fillStyle = shade(hr, .9); c.beginPath(); c.arc(0, -b*1.15, a*.5, 0, 7); c.fill(); }
    c.fillStyle = shade(F.skin, .8); [earL, earR].forEach(e => { c.beginPath(); c.ellipse(Math.cos(-ang)*e[0] - Math.sin(-ang)*e[1], Math.sin(-ang)*e[0] + Math.cos(-ang)*e[1], a*.2*F.ear, b*.24*F.ear, 0, 0, 7); c.fill(); });   // orelhas
    const g = c.createRadialGradient(-a*.35, -b*.4, a*.1, 0, 0, b*1.05); g.addColorStop(0, shade(F.skin, 1.12)); g.addColorStop(1, shade(F.skin, .74)); c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, a, b, 0, 0, 7); c.fill();               // cabeça
    c.fillStyle = shade(F.skin, .85); c.beginPath(); c.ellipse(0, b*.62, a*.78, b*.42, 0, 0, Math.PI); c.fill();                                                                                                        // maxilar
    const hairG = (x0, y0, r0) => { const gg = c.createRadialGradient(x0 - a*.3, y0 - b*.4, 1, x0, y0, r0); gg.addColorStop(0, shade(hr, 1.35)); gg.addColorStop(1, shade(hr, .7)); return gg; };
    const bald = st === 'bald';
    if (facing < .18 && !bald) {                                                         // de costas / de lado: o cabelo cobre a nuca e o topo
      const sx = facing > -.25 ? -side*a*.22 : 0; c.fillStyle = hairG(0, -b*.2, b*1.2); c.beginPath(); c.ellipse(sx, -b*.12, a*(st === 'afro' ? 1.2 : 1.07), b*(st === 'buzz' ? .98 : 1.04), 0, 0, 7); c.fill(); if (st === 'buzz') { c.fillStyle = 'rgba(200,170,140,.18)'; c.fill(); }
      if (st === 'long') { c.fillRect(-a*1.02 + sx, 0, a*2.04, b*.8); } if (st === 'curly') { for (let i = 0; i < 9; i++) { const t = i/8*Math.PI + Math.PI; c.beginPath(); c.arc(Math.cos(t)*a*1.04 + sx, Math.sin(t)*b*1.0 - b*.05, a*.3, 0, 7); c.fill(); } }
    } else if (!bald) {                                                                  // de frente: franja/topo com linha do cabelo
      const low = st === 'buzz' ? -b*.62 : -b*.42; c.fillStyle = hairG(0, -b*.6, b*1.2); c.beginPath(); c.moveTo(-a*1.0, -b*.05); c.quadraticCurveTo(-a*1.1, -b*1.15, 0, -b*1.12); c.quadraticCurveTo(a*1.1, -b*1.15, a*1.0, -b*.05); c.lineTo(a*.82, low); c.quadraticCurveTo(0, low - b*.22, -a*.82, low); c.closePath(); c.fill();
      if (st === 'long') { c.fillRect(-a*1.06, -b*.2, a*.28, b*1.1); c.fillRect(a*.78, -b*.2, a*.28, b*1.1); } if (st === 'curly') { for (let i = 0; i < 9; i++) { const t = i/8*Math.PI + Math.PI; c.beginPath(); c.arc(Math.cos(t)*a*1.02, Math.sin(t)*b*1.0 - b*.1, a*.28, 0, 7); c.fill(); } }
    }
    c.restore();
    if (facing > .22) {                                                                  // ROSTO
      const t0 = Math.min(1, (facing - .22)/.3); c.globalAlpha = t0;
      c.strokeStyle = 'rgba(40,20,10,.55)'; c.lineWidth = Math.max(1, b*.07*F.brow); c.lineCap = 'round'; [[eyeL, -1], [eyeR, 1]].forEach(([e, s]) => { c.beginPath(); c.moveTo(q[0] + e[0] - s*a*.28, q[1] + e[1] - b*.2 + (mood === 'sad' ? s*b*.05 : 0)); c.lineTo(q[0] + e[0] + s*a*.28, q[1] + e[1] - b*.24 - (mood === 'sad' ? s*b*.05 : 0)); c.stroke(); });   // sobrancelhas
      [eyeL, eyeR].forEach(e => { c.fillStyle = '#f4f1ea'; c.beginPath(); c.ellipse(q[0] + e[0], q[1] + e[1], a*.2, b*.09, ang, 0, 7); c.fill(); c.fillStyle = F.eyeC; c.beginPath(); c.arc(q[0] + e[0] + side*a*.02, q[1] + e[1], Math.max(.8, b*.075), 0, 7); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(q[0] + e[0] + side*a*.02, q[1] + e[1], Math.max(.5, b*.038), 0, 7); c.fill(); c.strokeStyle = 'rgba(60,30,20,.6)'; c.lineWidth = 1; c.beginPath(); c.ellipse(q[0] + e[0], q[1] + e[1], a*.2, b*.09, ang, Math.PI*1.05, Math.PI*1.95); c.stroke(); });   // olhos
      c.strokeStyle = 'rgba(70,35,20,.5)'; c.lineWidth = Math.max(1, b*.05); c.beginPath(); c.moveTo(q[0] + noseT[0]*.9, q[1] + eyeL[1]*.9 + b*.05); c.lineTo(q[0] + noseT[0] - a*.04, q[1] + noseT[1]); c.stroke();                           // nariz
      c.fillStyle = shade(F.skin, .6); c.beginPath(); c.ellipse(q[0] + noseT[0], q[1] + noseT[1] + b*.03, a*.14*F.nose, b*.05, 0, 0, 7); c.fill(); c.fillStyle = shade(F.skin, 1.25); c.beginPath(); c.arc(q[0] + noseT[0] - a*.03, q[1] + noseT[1] - b*.05, b*.03, 0, 7); c.fill();
      c.strokeStyle = '#6a2b2b'; c.fillStyle = '#4a1818'; c.lineWidth = Math.max(1, b*.055); c.beginPath(); const mx = q[0] + mouthP[0], my = q[1] + mouthP[1], mw = a*.3*F.mouth;                                                  // boca
      if (mood === 'happy') { c.ellipse(mx, my, mw, b*.1, 0, 0, Math.PI); c.fill(); } else if (mood === 'sad') c.arc(mx, my + b*.12, mw*.9, Math.PI*1.15, Math.PI*1.85); else { c.moveTo(mx - mw*.8, my); c.quadraticCurveTo(mx, my + b*.04, mx + mw*.8, my); } c.stroke(); c.globalAlpha = 1;
    }
  });
}
// ---- atleta completo ----
export function drawAthlete(E, J, kit, look) {
  const F = look.face || faceOf(look.nome + look.num), skin = F.skin, sleeve = kit.sleeve || kit.c1, build = F.build, ht = F.height;
  E.ground([J.pelvis[0], 0, J.pelvis[2]], .6, .3, '#000', .32, 2e3);
  ['L', 'R'].forEach(n => { const hip = J['hip' + n], kn = J['kn' + n], an = J['an' + n], toe = J['toe' + n], mid = lerp(hip, kn, .5), mid2 = lerp(hip, kn, .62), calf = lerp(kn, an, .3), cuff = lerp(kn, an, .72), heel = add(an, mul(J.fwd, -.03));
    E.limb(hip, mid2, .09*build, .094*build, kit.sh); E.limb(mid2, kn, .072*build, .062*build, skin);                         // coxa: calção que se abre + pele
    E.limb(kn, an, .066*build, .047*build, kit.c1); E.limb(lerp(kn, an, .1), lerp(kn, an, .17), .066*build, .066*build, kit.c2);   // meia com panturrilha e faixa
    E.limb(an, toe, .054, .042, F.boot); E.limb(add(an, mul(J.right, .03)), add(toe, mul(J.right, .02)), .01, .01, kit.keeper ? '#fff' : kit.c2); void cuff; void heel; });   // chuteira com detalhe lateral
  cyl(E, { p0: add(J.pelvis, [0, -.1, 0]), p1: add(J.pelvis, [0, .06, 0]), R: J.tright, F: J.tfwd, rx: [.15*build, .148*build], rz: [.1, .096], seg: 10, col: kit.sh });   // shorts
  const dn = norm(sub(J.chest, J.pelvis)), t0 = add(J.pelvis, mul(dn, .02)), t1 = sub(J.chest, mul(dn, .01)), tx = shirtTex(kit, look);
  cyl(E, { p0: t0, p1: t1, R: J.tright, F: J.tfwd, rx: [.15*build, .17*build, .195*build, .192*build], rz: [.098, .105, .114, .102], seg: 12, tex: tx, col: kit.c1 });                  // tronco (camisa mapeada)
  ['L', 'R'].forEach(n => { const s = J['sh' + n], el = J['el' + n], ha = J['ha' + n], dirH = norm(sub(ha, el));
    E.ellip(add(s, mul(J.tright, n === 'L' ? .015 : -.015)), .05*build, .05*build, J.up, sleeve);                                                                                                                                                                  // ombro
    E.limb(s, lerp(s, el, .8), .06*build, .052*build, sleeve); E.limb(lerp(s, el, .78), el, .052*build, .05*build, kit.c2); E.limb(el, ha, .045, .034, kit.long ? kit.c1 : skin);   // braço
    if (kit.glove) { E.ellip(add(ha, mul(dirH, .06)), .075, .085, dirH, '#f3f3f3'); E.limb(lerp(el, ha, .78), ha, .05, .05, kit.c2); } else E.ellip(add(ha, mul(dirH, .035)), .04, .052, dirH, skin); });                    // luvas / mãos
  E.limb(add(J.chest, mul(J.up, .0)), add(J.neck, mul(J.up, .03)), .052, .046, shade(skin, .85));
  head(E, J, F, look.mood, kit.keeper);
}
