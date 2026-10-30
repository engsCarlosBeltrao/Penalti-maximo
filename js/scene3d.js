// Cena 3D da partida: estádio com arquibancada TRIDIMENSIONAL logo atrás do gol, gol com rede deformável, bola com física,
// cobrador e goleiro com esqueleto articulado (FK/IK), uniformes com nome/número mapeados no tecido, câmera cinematográfica.
import { Engine, W, H } from './engine3d.js';
import { sub, add, mul, dot, norm, len, lerp, shade } from './vec.js';
import { humanJoints, kickerPose, keeperPose, cheerPose, dejectedPose, goalToWorld, BALL0, BALL_R, GOAL_W, GOAL_H, SPOT_Z, KICK_T0, sm } from './rig.js';
import { GS } from './gameState.js';
import { Events } from './events.js';
import { pickKicker } from './players.js';
import { Ads } from './advertising.js';
import { AIM_LIM } from './aim.js';
import { drawBall } from './ball.js';
import { hud } from './hud.js';
import { Renderer } from './renderer.js';
import { drawAthlete } from './athlete.js';
import { faceOf } from './face.js';
import { TF, HS, KC, kcol, ballWorld, camTarget, characters } from './frame.js';
import { ROWS, AISLES, byRow, colorize, drawFan, frameStart, clearSprites } from './crowd.js';
export const DBG = { cam: null, t: { s: 0, f: 0, n: 0 } };   // câmera de depuração (testes visuais)
const E = new Engine(), SKIN = ['#f1c27d', '#c68642', '#8d5524', '#ffdbac'], HAIR = ['#1b1b1b', '#3b2a1a', '#6b4423', '#111'], BOOT = ['#14161a', '#f4f4f4', '#ff5a1f', '#2bd96b'], FANC = ['#e63946', '#f1faee', '#ffb703', '#4361ee', '#2ec4b6', '#ff6b9d', '#8d99ae', '#06d6a0'];
const lum = h => { const n = parseInt(h.slice(1), 16); return (.3*(n >> 16) + .59*(n >> 8 & 255) + .11*(n & 255))/255; };
let seed = 7; const rnd = () => (seed = seed*16807 % 2147483647)/2147483647;
let cam = { pos: [0, 3.3, 25], tgt: [0, 1.0, 1], fov: 27 }, shake = 0, last = 0, names = [{}, {}], exS = [0, 0], sad = [0, 0], heat = .25, flags = [], banners = [[], []], smoke = [], flares = [], boardCv = [];
// ---------- torcida e estádio (dados estáticos) ----------
const tufts = []; for (let i = 0; i < 520; i++) tufts.push([(rnd() - .5)*50, 0, 24 - rnd()*27]);
[['gol', e => { exS[e.equipe] = 1; sad[1 - e.equipe] = 1; shake = 1; burst(e.equipe); }], ['defesa', e => { exS[1 - e.equipe] = .7; sad[e.equipe] = .6; shake = .5; }], ['trave', () => { exS = exS.map(v => Math.max(v, .4)); shake = .8; }], ['fora', e => { sad[e.equipe] = .5; }],
 ['partida_encerrada', e => { exS[e.vencedor] = 1; sad[1 - e.vencedor] = 1; burst(e.vencedor); }]].forEach(([k, f]) => Events.on(k, f));
function burst(s) { const t = names[s]; for (let i = 0; i < 18 && smoke.length < 120; i++) smoke.push({ x: (s ? 1 : -1)*(2 + rnd()*10), y: 2 + rnd()*3, z: -6 - rnd()*5, vy: .5 + rnd()*.6, vx: (rnd() - .5)*.3, r: .5 + rnd()*.5, life: 2.8, col: rnd() < .6 ? t.c1 : t.c2 }); }
function bannerTex(t, txt) {
  if (typeof document === 'undefined') return null;                                  // (testes em Node não desenham)                          // faixa: texto legível (não deformado), cores do clube
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 84; const c = cv.getContext('2d'); c.fillStyle = t.c1; c.fillRect(0, 0, 512, 84); c.fillStyle = t.c2; c.fillRect(0, 62, 512, 22); c.fillRect(0, 0, 512, 8);
  c.fillStyle = lum(t.c1) > .55 ? '#111' : '#fff'; c.textAlign = 'center'; let fs = 44; c.font = `900 ${fs}px Arial`; while (c.measureText(txt).width > 480 && fs > 16) c.font = `900 ${--fs}px Arial`; c.fillText(txt, 256, 52); return cv;
}
export function setTeams(a, b) {
  names = [a, b]; exS = [0, 0]; sad = [0, 0]; heat = .25; smoke.length = 0;
  colorize(names); clearSprites();
  banners = [a, b].map((t, s) => [`VAMOS, ${t.nome.toUpperCase()}!`, 'ATÉ O FIM!', 'NOSSA PAIXÃO!', 'JAMAIS ABANDONAREMOS!'].sort(() => rnd() - .5).slice(0, 3).map((txt, i) => ({ tex: bannerTex(t, txt), x: (s ? 1 : -1)*[10.2, 4.4, 8.6][i], r: [1, 4, 7][i], w: [4.4, 3.8, 4.2][i] })));
  flags = []; [0, 1].forEach(s => { for (let i = 0; i < 7; i++) flags.push({ s, x: (s ? 1 : -1)*(1.5 + rnd()*11), r: 1 + (rnd()*8 | 0), p: rnd()*6, t: names[s] }); });
  flares = []; [0, 1].forEach(s => [0, 1, 2, 3].forEach(i => flares.push({ s, x: (s ? 1 : -1)*(2.5 + i*3 + rnd()*1.5), y: 1.6 + (i % 2)*1.4, z: -5.5 - (i % 2)*1.6, ph: rnd()*6 })));
}
// ---------- personagem: malha procedural em js/athlete.js ----------
const human = (J, kit, look) => DBG.noAth ? 0 : drawAthlete(E, J, kit, { ...look, face: look.face || faceOf((look.nome || '') + (look.num ?? ''), { hair: look.hair }) });
// ---------- bola ----------
// ---------- gol e rede ----------
function goal(c, b, res, d) {
  const w = GOAL_W/2, bw = 3.3, bz = -2, bh = 2, amp = res === 'gol' && d > 0 ? Math.max(0, 1 - d/.8)*Math.cos(d*22) : 0, T = b ? goalToWorld(b.gx, b.gy) : [0, 1, 0];
  const bp = (u, v) => { const x = -bw + 2*bw*u, y = bh*v, dd = Math.exp(-(((x - T[0])/1.3)**2 + ((y - T[1])/.9)**2))*amp; return [x + (x - T[0])*dd*.25, y - dd*.25, bz - dd*.55]; };
  const net = (z, fn) => { E.push(z, cc => { cc.strokeStyle = 'rgba(235,240,245,.5)'; cc.lineWidth = 1; cc.beginPath(); fn(cc); cc.stroke(); }); };
  net(E.proj([0, 1, bz]) ? E.proj([0, 1, bz])[2] + .2 : 1, cc => { for (let i = 0; i <= 26; i++) for (let j = 0; j <= 10; j++) { const q = E.proj(bp(i/26, j/10)); if (!q) continue; j ? cc.lineTo(q[0], q[1]) : cc.moveTo(q[0], q[1]); } for (let j = 0; j <= 10; j++) for (let i = 0; i <= 26; i++) { const q = E.proj(bp(i/26, j/10)); if (!q) continue; i ? cc.lineTo(q[0], q[1]) : cc.moveTo(q[0], q[1]); } });
  const side = s => { const zq = E.proj([s*w, 1, -1]); net(zq ? zq[2] : 1, cc => { for (let k = 0; k <= 8; k++) { const a = [s*w, 2.44*k/8*(1), 0], bb = [s*bw, bh*k/8, bz], p = E.proj(a), q = E.proj(bb); if (p && q) { cc.moveTo(p[0], p[1]); cc.lineTo(q[0], q[1]); } } for (let k = 0; k <= 6; k++) { const a = [s*(w - (w - bw)*k/6), 0 + (2.44 + (bh - 2.44)*k/6)*0, -2*k/6], p0 = E.proj([s*(w - (w - bw)*k/6), 0, -2*k/6]), p1 = E.proj([s*(w - (w - bw)*k/6), 2.44 + (bh - 2.44)*k/6, -2*k/6]); void a; if (p0 && p1) { cc.moveTo(p0[0], p0[1]); cc.lineTo(p1[0], p1[1]); } } }); };
  side(-1); side(1);
  const tq = E.proj([0, 2.2, -1]); net(tq ? tq[2] : 1, cc => { for (let k = 0; k <= 14; k++) { const x = -w + 2*w*k/14, xb = -bw + 2*bw*k/14, p = E.proj([x, 2.44, 0]), q = E.proj([xb, bh, bz]); if (p && q) { cc.moveTo(p[0], p[1]); cc.lineTo(q[0], q[1]); } } });
  const white = '#f5f7fa', gray = '#9aa4ad';
  E.capsule([-w, 0, 0], [-w, GOAL_H, 0], .065, white); E.capsule([w, 0, 0], [w, GOAL_H, 0], .065, white); E.capsule([-w, GOAL_H, 0], [w, GOAL_H, 0], .065, white);
  E.capsule([-bw, 0, bz], [-bw, bh, bz], .03, gray); E.capsule([bw, 0, bz], [bw, bh, bz], .03, gray); E.capsule([-bw, bh, bz], [bw, bh, bz], .03, gray);
  [-1, 1].forEach(s => { E.capsule([s*w, GOAL_H, 0], [s*bw, bh, bz], .03, gray); E.capsule([s*w, 0, 0], [s*bw, 0, bz], .03, gray); });
  [-1, 1].forEach(s => E.quad([[s*w - .04, 0, .01], [s*w + .04, 0, .01], [s*w + 1.1, 0, .5], [s*w + 1.0, 0, .5]], 'rgba(0,0,0,.3)', 99));   // sombra dos postes no gramado
}
// ---------- chão, arquibancada, placas ----------
const poly = (c, pts) => { const q = pts.map(p => E.proj(p)); if (q.some(v => !v)) return false; c.beginPath(); c.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) c.lineTo(q[i][0], q[i][1]); c.closePath(); return true; };
function polyC(c, pts) {                                // polígono com recorte no plano próximo da câmera (Sutherland–Hodgman)
  const cs = pts.map(p => { const d = sub(p, E.pos); return [dot(d, E.r), dot(d, E.u), dot(d, E.f)]; }), out = [], N = .3;
  for (let i = 0; i < cs.length; i++) { const a = cs[i], b = cs[(i + 1) % cs.length], ai = a[2] >= N, bi = b[2] >= N; if (ai) out.push(a); if (ai !== bi) { const t = (N - a[2])/(b[2] - a[2]); out.push([a[0] + (b[0] - a[0])*t, a[1] + (b[1] - a[1])*t, N]); } }
  if (out.length < 3) return false; c.beginPath(); out.forEach((q, i) => { const k = E.focal/q[2], x = W/2 + q[0]*k, y = H/2 - q[1]*k; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); return true;
}
const line = (c, pts) => { c.beginPath(); let st = false; pts.forEach(p => { const q = E.proj(p); if (!q) return; st ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); st = true; }); c.stroke(); };
function texNow(c, img, TL, TR, BL) { const a = E.proj(TL), b = E.proj(TR), d = E.proj(BL); if (!a || !b || !d) return; c.save(); c.transform((b[0] - a[0])/img.width, (b[1] - a[1])/img.width, (d[0] - a[0])/img.height, (d[1] - a[1])/img.height, a[0], a[1]); c.drawImage(img, 0, 0); c.restore(); }
function drawBackground(c, now) {
  let g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#04070f'); g.addColorStop(.5, '#0c1730'); g.addColorStop(1, '#101c34'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const zm = Math.min(24, E.pos[2] - .3);
  polyC(c, [[-60, 0, -3.6], [60, 0, -3.6], [60, 0, 40], [-60, 0, 40]]); c.fillStyle = '#237a38'; c.fill();                                       // gramado
  for (let i = 0; i < 18; i++) { const zz = 40 - i*2.6, z0 = zz, z1 = zz - 2.6; if (zz < -3.6) break; if (i % 2) continue; if (polyC(c, [[-60, 0, Math.max(z1, -3.6)], [60, 0, Math.max(z1, -3.6)], [60, 0, z0], [-60, 0, z0]])) { c.fillStyle = '#2d8f43'; c.fill(); } }   // faixas de corte em perspectiva real
  c.lineWidth = 1; tufts.forEach(t => { if (t[2] > zm) return; const a = E.proj(t), b = E.proj([t[0] + .03, .1, t[2]]); if (!a || !b) return; c.strokeStyle = (t[0]*7 | 0) % 2 ? 'rgba(190,255,150,.22)' : 'rgba(0,40,0,.3)'; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); });
  g = c.createRadialGradient(480, 330, 60, 480, 330, 620); g.addColorStop(0, 'rgba(255,255,210,.16)'); g.addColorStop(1, 'rgba(0,10,0,.28)'); c.fillStyle = g; c.fillRect(0, 250, W, 290);                // luz dos refletores
  c.strokeStyle = 'rgba(255,255,255,.93)'; c.lineWidth = 2.4; c.lineCap = 'round';
  line(c, [[-34, .01, 0], [34, .01, 0]]); line(c, [[-9.16, .01, 0], [-9.16, .01, 5.5], [9.16, .01, 5.5], [9.16, .01, 0]]); line(c, [[-20.16, .01, 0], [-20.16, .01, 16.5], [20.16, .01, 16.5], [20.16, .01, 0]]);
  const arc = []; for (let a = -.93; a <= .93; a += .06) arc.push([Math.sin(a)*9.15, .01, SPOT_Z + Math.cos(a)*9.15]); line(c, arc);
  { const q = E.proj([0, .01, SPOT_Z]), qx = E.proj([.11, .01, SPOT_Z]), qz = E.proj([0, .01, SPOT_Z - .11]); if (q && qx && qz) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(q[0], q[1], Math.abs(qx[0] - q[0]), Math.abs(qz[1] - q[1]), 0, 0, 7); c.fill(); } }   // marca do pênalti (achatada no chão)
  // arquibancada 3D: degraus, torcedores (com profundidade real), faixas, bandeiras, fumaça
  poly(c, [[-45, 0, -22], [45, 0, -22], [45, 20, -22], [-45, 20, -22]]); c.fillStyle = '#0a0f1d'; c.fill();
  for (let r = ROWS - 1; r >= 0; r--) { const y = .15 + r*.6, z = -4.6 - r*.85, half = 14 + r*.9;
    if (poly(c, [[-half, y - .6, z + .85], [half, y - .6, z + .85], [half, y, z + .85], [-half, y, z + .85]])) { c.fillStyle = r % 2 ? '#1c2438' : '#222b42'; c.fill(); }
    if (poly(c, [[-half, y, z + .85], [half, y, z + .85], [half, y, z], [-half, y, z]])) { c.fillStyle = '#2a3452'; c.fill(); }
    if (!DBG.noCrowd) byRow[r].forEach(f => drawFan(c, E, f, now, exS, sad));
    AISLES.forEach(ax => { if (poly(c, [[ax - .45, y - .55, z + .85], [ax + .45, y - .55, z + .85], [ax + .45, y, z + .4], [ax - .45, y, z + .4]])) { c.fillStyle = r % 2 ? '#3a4560' : '#434f6c'; c.fill(); } });
    banners.forEach((bs, s) => bs.forEach(bn => { if (bn.r !== r) return; const x = bn.x, y0 = y + .85; texNow(c, bn.tex, [x - bn.w/2, y0 + .75, z + .5], [x + bn.w/2, y0 + .75, z + .5], [x - bn.w/2, y0, z + .5]); void s; }));
    flags.forEach(fl => { if (fl.r !== r) return; const x = fl.x, y0 = y + 1.2, w = Math.sin(now*4 + fl.p)*.3; const p0 = E.proj([x, y, z]), p1 = E.proj([x, y0 + .9, z]); if (!p0 || !p1) return; c.strokeStyle = '#ddd'; c.lineWidth = .04*p0[3]; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke();
      if (poly(c, [[x, y0 + .9, z], [x + 1.1 + w, y0 + .85 + w*.2, z], [x + 1.1 + w, y0 + .35 + w*.2, z], [x, y0 + .4, z]])) { c.fillStyle = fl.t.c1; c.fill(); } if (poly(c, [[x, y0 + .65, z], [x + 1.1 + w, y0 + .6 + w*.2, z], [x + 1.1 + w, y0 + .4 + w*.2, z], [x, y0 + .4, z]])) { c.fillStyle = fl.t.c2; c.fill(); } });
  }
  // placas de publicidade (plano 3D logo atrás da linha de fundo)
  for (let k = 0; k < 6; k++) { const r = Ads.current('main', now, k); let cv = boardCv[k]; if (!cv) { cv = boardCv[k] = document.createElement('canvas'); cv.width = 384; cv.height = 64; } const x = cv.getContext('2d'); x.fillStyle = r ? r.ad.backgroundColor : '#0d1b2a'; x.fillRect(0, 0, 384, 64); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, 0, 384, 5);
    if (r) { x.globalAlpha = r.alpha; if (r.image) { const q = Math.min(370/r.image.naturalWidth, 54/r.image.naturalHeight); x.drawImage(r.image, 192 - r.image.naturalWidth*q/2, 5, r.image.naturalWidth*q, r.image.naturalHeight*q); } else { x.fillStyle = r.ad.textColor; x.textAlign = 'center'; let fs = 26; x.font = `800 ${fs}px Arial`; const tx = r.ad.sponsor.toUpperCase(); while (x.measureText(tx).width > 360 && fs > 12) x.font = `800 ${--fs}px Arial`; x.fillText(tx, 192, 41); } x.globalAlpha = 1; }
    texNow(c, cv, [-18 + k*6, 1, -3.6], [-12 + k*6, 1, -3.6], [-18 + k*6, .1, -3.6]); }
}
let bgLayer = null, bgKey = '', bgT = -9, lastKey = '';
function drawStadium(c, now, dt, game) {               // fundo estático em camada de cache: refeita ao mover a câmera, ao reagir a torcida ou a cada 0,12 s
  const calm = exS[0] + exS[1] + sad[0] + sad[1] < .02, key = [E.pos[0], E.pos[1], E.pos[2], E.tgt[0], E.tgt[1], E.tgt[2], E.fov, c.canvas.width].map(v => v.toFixed(3)).join(), stable = key === lastKey; lastKey = key;
  if (calm && stable && !DBG.noCache && typeof document !== 'undefined') {
    if (!bgLayer || bgLayer.width !== c.canvas.width || bgLayer.height !== c.canvas.height) { bgLayer = document.createElement('canvas'); bgLayer.width = c.canvas.width; bgLayer.height = c.canvas.height; bgKey = ''; }
    if (key !== bgKey || now - bgT > .12) { const lc = bgLayer.getContext('2d'), k0 = bgLayer.width/W; lc.setTransform(k0, 0, 0, k0, 0, 0); lc.clearRect(0, 0, W, H); drawBackground(lc, now); bgKey = key; bgT = now; }
    c.drawImage(bgLayer, 0, 0, W, H);
  } else { bgKey = ''; drawBackground(c, now); }
  drawEffects(c, now, dt, game);
}
function drawEffects(c, now, dt, game) {
  // fumaça colorida e sinalizadores (apenas efeitos visuais, só na arquibancada)
  heat += ((game.fin ? 1 : game.dec ? .6 : .25) - heat)*(1 - Math.exp(-2*dt));
  flares.forEach(f => { const q = E.proj([f.x, f.y, f.z]); if (!q) return; const pulse = 1 + .25*Math.sin(now*9 + f.ph), rad = .5*q[3]*pulse, t = names[f.s]; if (!t.c1) return; const gr = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], rad); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.3, t.c1 + 'cc'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(q[0] - rad, q[1] - rad, rad*2, rad*2);
    if (smoke.length < 120 && rnd() < heat*dt*4) smoke.push({ x: f.x, y: f.y, z: f.z, vy: .5 + rnd()*.4, vx: (rnd() - .5)*.3, r: .35 + rnd()*.3, life: 2.8, col: rnd() < .6 ? t.c1 : t.c2 }); });
  for (let i = smoke.length - 1; i >= 0; i--) { const p = smoke[i]; p.life -= dt; if (p.life <= 0) { smoke.splice(i, 1); continue; } p.y += p.vy*dt; p.x += p.vx*dt; p.r += .3*dt; const q = E.proj([p.x, p.y, p.z]); if (!q) continue; c.globalAlpha = Math.max(0, p.life/2.8)*.22; c.fillStyle = p.col; c.beginPath(); c.arc(q[0], q[1], p.r*q[3], 0, 7); c.fill(); } c.globalAlpha = 1;
  [[-16, 13, -12], [16, 13, -12], [-9, 15, -16], [9, 15, -16]].forEach(p => { const q = E.proj(p); if (!q) return; const rad = 70, gr = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], rad); gr.addColorStop(0, 'rgba(255,255,235,.95)'); gr.addColorStop(.25, 'rgba(255,250,200,.35)'); gr.addColorStop(1, 'rgba(255,250,200,0)'); c.fillStyle = gr; c.fillRect(q[0] - rad, q[1] - rad, rad*2, rad*2); });   // refletores
}
// ---------- câmera cinematográfica ----------
// ---------- cena ----------
export function drawScene(c, game) {
  const now = performance.now()/1000, dt = Math.min(.05, now - last || .016); last = now; exS = exS.map(v => Math.max(0, v - dt*.5)); sad = sad.map(v => Math.max(0, v - dt*.4));
  const b = game.fin ? null : game.ball, k = game.keeper, res = b?.res, d = b ? b.t - TF : 0, bw = ballWorld(b, k), T = camTarget(game, b, bw, res, d), f = 1 - Math.exp(-3*dt);
  if (DBG.cam) Object.assign(cam, { pos: DBG.cam.pos.slice(), tgt: DBG.cam.tgt.slice(), fov: DBG.cam.fov }); else {
  cam.pos = lerp(cam.pos, T.pos, f); cam.tgt = lerp(cam.tgt, T.tgt, f); cam.fov += (T.fov - cam.fov)*f; } shake = Math.max(0, shake - dt*2.2);
  const k0 = c.canvas.width/W; c.setTransform(k0, 0, 0, k0, 0, 0); E.pos = shake ? add(cam.pos, [(rnd() - .5)*shake*.12, (rnd() - .5)*shake*.12, 0]) : cam.pos; E.tgt = cam.tgt; E.fov = cam.fov; E.begin(c);
  frameStart(); const pt0 = performance.now(); drawStadium(c, now, dt, game); DBG.t.s += performance.now() - pt0;
  const fr = characters(game, now, b, k, res, d, bw);
  goal(c, fr ? b : null, fr ? res : null, fr ? d : 0);
  if (fr) {
    fr.list.forEach(ch => human(humanJoints(ch.P), ch.kit, ch.look));
    if (!fr.final) {
      const q = E.proj(bw); if (q) { const rad = BALL_R*1.35*q[3], gq = E.proj([bw[0], 0, bw[2]]); E.push(q[2], cc => drawBall(cc, { x: q[0], y: q[1], s: rad/13, gy: gq ? gq[1] : q[1] }, b)); }
      if (res === 'trave' && d > 0 && d < .25) E.sphere(bw, .35, 'rgba(255,255,255,.6)', false);
    }
  }
  const pt1 = performance.now(); E.flush(); DBG.t.f += performance.now() - pt1; DBG.t.n++;
  if (game.m && !game.fin && game.hum() && !b && (GS.estado === 'MIRANDO' || GS.estado === 'AGUARDANDO_COBRANCA')) drawAim(c, game.aim, GS.estado === 'MIRANDO');
  hud(c, game, res, b);
}
function drawAim(c, aim, hold) {                       // linha no plano do gol que oscila; marcador de altura sobe ao segurar; anel = ponto final
  const x = (aim.x - .5)*GOAL_W, y = aim.y*GOAL_H, a = E.proj([x, 0, .05]), t = E.proj([x, GOAL_H, .05]), q = E.proj([x, y, .05]); if (!a || !t || !q) return; const k = q[3];
  c.save(); c.lineCap = 'round'; c.strokeStyle = 'rgba(255,230,109,.65)'; c.lineWidth = 2.5; c.shadowColor = '#ffe66d'; c.shadowBlur = 8; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(t[0], t[1]); c.stroke(); c.shadowBlur = 0;
  c.fillStyle = '#ffe66d'; c.beginPath(); c.moveTo(t[0] - 7, t[1] - 16); c.lineTo(t[0] + 7, t[1] - 16); c.lineTo(t[0], t[1] - 6); c.fill();
  c.strokeStyle = hold ? '#ff2d55' : 'rgba(255,255,255,.9)'; c.lineWidth = 2.5; c.beginPath(); c.arc(q[0], q[1], (hold ? .3 : .22)*k, 0, 7); c.stroke();
  if (hold) { c.fillStyle = '#ff2d55'; c.beginPath(); c.moveTo(q[0], q[1] - 5); c.lineTo(q[0] + 5, q[1]); c.lineTo(q[0], q[1] + 5); c.lineTo(q[0] - 5, q[1]); c.fill(); }
  const bx = E.proj([GOAL_W/2 + .9, 0, 0]), bt = E.proj([GOAL_W/2 + .9, GOAL_H, 0]); if (bx && bt) { const f = (aim.y - AIM_LIM.ymin)/(AIM_LIM.ymax - AIM_LIM.ymin), hh = bx[1] - bt[1]; c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(bx[0], bt[1], 9, hh); c.fillStyle = hold ? '#ff2d55' : '#ffe66d'; c.fillRect(bx[0], bx[1] - hh*f, 9, hh*f); c.strokeStyle = '#fff'; c.lineWidth = 1; c.strokeRect(bx[0], bt[1], 9, hh); }
  c.restore();
}

Renderer.set({ name: 'procedural', drawScene, setTeams });   // registra este motor como o padrão
