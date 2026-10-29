// Renderização em camadas: fundo pré-renderizado (gramado/arquibancada/luzes) → torcida → placas → rede → goleiro → cobrador → bola → traves → mira → HUD.
import { GS } from './gameState.js';
import { Events } from './events.js';
import { pickKicker } from './players.js';
import { Ads } from './advertising.js';
const W = 960, H = 540, G = { l:300, r:660, t:150, b:290 }, S = { x:480, y:470 }, TF = .7, HZ = 148;
const gpt = (gx, gy) => ({ x: G.l + gx*(G.r-G.l), y: G.b - gy*(G.b-G.t) });
const lum = h => { const n = parseInt(h.slice(1), 16); return (.3*(n>>16) + .59*(n>>8&255) + .11*(n&255))/255; };
let seed = 11; const rnd = () => (seed = seed*16807 % 2147483647) / 2147483647;
const SKIN = ['#f1c27d','#c68642','#8d5524','#ffdbac'], HAIR = ['#1b1b1b','#3b2a1a','#6b4423','#111'], FANC = ['#e63946','#f1faee','#ffb703','#4361ee','#2ec4b6','#ff6b9d','#8d99ae','#06d6a0'], KC = ['#00c853','#ff4fd8','#ffd23f','#27e1ff','#ff7a1a'];
let bg, fans = [], ex = 0, cam = { z:1, x:480, y:300 }, last = 0;
[['gol',1],['defesa',.7],['trave',.5]].forEach(([k, v]) => Events.on(k, () => ex = Math.max(ex, v)));

function buildBg() {                                   // feito UMA vez (texturas pesadas não são recalculadas por quadro)
  bg = document.createElement('canvas'); bg.width = W*2; bg.height = H*2; const c = bg.getContext('2d'); c.scale(2,2);   // 2x para ficar nítido em telas HiDPI
  let g = c.createLinearGradient(0,0,0,122); g.addColorStop(0,'#080d1a'); g.addColorStop(1,'#1b2640'); c.fillStyle = g; c.fillRect(0,0,W,122);
  for (let y = 10; y < 120; y += 8) { c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(0,y,W,1); }
  for (let x = 0; x <= W; x += 160) { c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(x,0,3,122); }          // setores
  const N = 24; for (let i = 0; i < N; i++) { const y0 = HZ + (H-HZ)*Math.pow(i/N, 1.7), y1 = HZ + (H-HZ)*Math.pow((i+1)/N, 1.7); c.fillStyle = i % 2 ? '#34994a' : '#2a8040'; c.fillRect(0, y0, W, y1-y0+1); }  // faixas de corte em perspectiva
  for (let i = 0; i < 45; i++) { const x = rnd()*W, y = HZ + rnd()*(H-HZ), r = 40 + rnd()*90, q = c.createRadialGradient(x,y,0,x,y,r); q.addColorStop(0, rnd() < .5 ? 'rgba(20,80,30,.16)' : 'rgba(170,230,100,.09)'); q.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = q; c.fillRect(x-r,y-r,2*r,2*r); }
  for (let i = 0; i < 9000; i++) { const y = HZ + rnd()*(H-HZ), d = (y-HZ)/(H-HZ), x = rnd()*W; c.strokeStyle = rnd() < .5 ? 'rgba(190,255,150,.14)' : 'rgba(0,40,0,.18)'; c.lineWidth = .6 + d*1.2; c.beginPath(); c.moveTo(x,y); c.lineTo(x + (rnd()-.5)*3*d, y - 2 - d*10); c.stroke(); }   // fibras
  g = c.createRadialGradient(480,290,40,480,300,570); g.addColorStop(0,'rgba(255,255,210,.24)'); g.addColorStop(1,'rgba(0,10,0,.42)'); c.fillStyle = g; c.fillRect(0,HZ,W,H-HZ);       // luz dos refletores
  c.strokeStyle = 'rgba(255,255,255,.93)'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath();
  c.moveTo(110,G.b); c.lineTo(850,G.b); c.moveTo(235,G.b); c.lineTo(150,500); c.lineTo(810,500); c.lineTo(725,G.b); c.moveTo(365,G.b); c.lineTo(335,350); c.lineTo(625,350); c.lineTo(595,G.b); c.stroke();
  c.beginPath(); c.ellipse(480,500,110,26,0,0,Math.PI); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(S.x,S.y+14,5,2.5,0,0,7); c.fill();   // área, arco e marca do pênalti
  [100,380,580,860].forEach(x => { const q = c.createRadialGradient(x,8,0,x,8,70); q.addColorStop(0,'rgba(255,255,235,.95)'); q.addColorStop(.25,'rgba(255,250,200,.35)'); q.addColorStop(1,'rgba(255,250,200,0)'); c.fillStyle = q; c.fillRect(x-70,0,140,100); });
  for (let r = 0; r < 13; r++) for (let x = 4; x < W; x += 11) fans.push({ x: x + rnd()*5, y: 18 + r*7.8, c: rnd()*8|0, s: rnd()*4|0, p: rnd()*6.28, f: rnd() < .025 });
}
function drawFans(c, t, a) {                            // torcida em lote: 1 path por cor (≈1000 torcedores)
  FANC.forEach((col, k) => { c.fillStyle = col; c.beginPath(); fans.forEach(f => { if (f.c !== k) return; const b = Math.sin(t*3 + f.p) + a*Math.abs(Math.sin(t*9 + f.p))*5; c.rect(f.x, f.y - b, 6, 7); }); c.fill(); });
  SKIN.forEach((col, k) => { c.fillStyle = col; c.beginPath(); fans.forEach(f => { if (f.s !== k) return; const b = Math.sin(t*3 + f.p) + a*Math.abs(Math.sin(t*9 + f.p))*5; c.moveTo(f.x+6, f.y-b-3); c.arc(f.x+3, f.y-b-3, 3, 0, 7); }); c.fill(); });
  if (a > .08) { c.strokeStyle = '#e8b98a'; c.lineWidth = 1.5; c.beginPath(); fans.forEach(f => { if (f.p % 2 > 1.2) return; const b = Math.abs(Math.sin(t*9 + f.p))*5*a; c.moveTo(f.x+1, f.y-b+1); c.lineTo(f.x-2, f.y-b-9-Math.sin(t*12+f.p)*2); }); c.stroke(); }
  fans.filter(f => f.f).forEach(f => { c.fillStyle = '#ddd'; c.fillRect(f.x+5, f.y-22, 1, 20); c.fillStyle = FANC[(f.p*3|0)%8]; c.fillRect(f.x+6, f.y-22, 14, 8 + Math.sin(t*4+f.p)*1.5); });   // bandeiras
  const g = c.createLinearGradient(0,0,0,122); g.addColorStop(0,'rgba(0,0,12,.5)'); g.addColorStop(1,'rgba(0,0,12,.18)'); c.fillStyle = g; c.fillRect(0,0,W,122);   // arquibancada mais escura que o campo
}
function ads(c, t) {                                    // placas entre arquibancada e gramado (config em advertising.js)
  for (let k = 0; k < 4; k++) { const x = k*240, r = Ads.current('main', t, k); c.fillStyle = r ? r.ad.backgroundColor : '#0d1b2a'; c.fillRect(x+2,122,236,24);
    if (r) { c.globalAlpha = r.alpha; if (r.image) { const q = Math.min(232/r.image.naturalWidth, 22/r.image.naturalHeight); c.drawImage(r.image, x+120-r.image.naturalWidth*q/2, 123, r.image.naturalWidth*q, r.image.naturalHeight*q); }
      else { c.fillStyle = r.ad.textColor; c.textAlign = 'center'; c.font = '800 12px Arial'; let tx = r.ad.sponsor.toUpperCase(); if (c.measureText(`${tx} · ${r.ad.text}`).width < 228) tx += ` · ${r.ad.text}`; c.fillText(tx, x+120, 138); } c.globalAlpha = 1; }
    c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(x+2,122,236,3); }
  c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(0,146,W,5);
}
function net(c, d, res, b) {                            // malha com profundidade; deforma no impacto
  const bl = G.l+18, br = G.r-18, bt = G.t+14, bb = G.b-10, amp = res === 'gol' && d > 0 ? Math.max(0, 1-d/.8)*Math.cos(d*22) : 0, ix = b ? b.gx : .5, iy = b ? b.gy : .5;
  c.fillStyle = 'rgba(8,16,12,.4)'; c.fillRect(bl,bt,br-bl,bb-bt);
  const P = (u, v) => { const w = Math.exp(-((u-ix)**2 + (v-iy)**2)/.06)*amp; return [bl + (br-bl)*u + (u-ix)*w*40, bt + (bb-bt)*(1-v) + w*14]; };
  c.strokeStyle = 'rgba(235,240,245,.5)'; c.lineWidth = 1; c.beginPath();
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 10; j++) { const [x, y] = P(i/24, j/10); j ? c.lineTo(x,y) : c.moveTo(x,y); }
  for (let j = 0; j <= 10; j++) for (let i = 0; i <= 24; i++) { const [x, y] = P(i/24, j/10); i ? c.lineTo(x,y) : c.moveTo(x,y); }
  for (let k = 0; k <= 6; k++) { const a = k/6; c.moveTo(G.l+a*(G.r-G.l), G.t); c.lineTo(bl+a*(br-bl), bt); c.moveTo(G.l, G.t+a*(G.b-G.t)); c.lineTo(bl, bt+a*(bb-bt)); c.moveTo(G.r, G.t+a*(G.b-G.t)); c.lineTo(br, bt+a*(bb-bt)); }
  c.stroke(); c.strokeStyle = '#9aa4ad'; c.lineWidth = 2; c.beginPath(); c.moveTo(G.l,G.b); c.lineTo(bl,bb); c.lineTo(br,bb); c.lineTo(G.r,G.b); c.stroke();
}
function frame(c, hit) {                                // postes e travessão com volume, sombra e fixações
  const t = 9; c.fillStyle = 'rgba(0,0,0,.25)'; [G.l, G.r].forEach(x => { c.beginPath(); c.moveTo(x-4,G.b); c.lineTo(x+4,G.b); c.lineTo(x+40,G.b+11); c.lineTo(x+32,G.b+11); c.fill(); });
  const bar = (x, y, w, h, v) => { c.fillStyle = '#f5f7fa'; c.fillRect(x,y,w,h); c.fillStyle = 'rgba(0,0,0,.28)'; v ? c.fillRect(x+w*.55,y,w*.45,h) : c.fillRect(x,y+h*.55,w,h*.45); c.fillStyle = 'rgba(255,255,255,.9)'; v ? c.fillRect(x,y,w*.25,h) : c.fillRect(x,y,w,h*.2); };
  bar(G.l-t/2, G.t-t/2, t, G.b-G.t+t/2, 1); bar(G.r-t/2, G.t-t/2, t, G.b-G.t+t/2, 1); bar(G.l-t/2, G.t-t/2, G.r-G.l+t, t, 0);
  c.fillStyle = '#555'; [[G.l,G.t],[G.r,G.t],[G.l,G.b],[G.r,G.b]].forEach(([x, y]) => c.fillRect(x-2.5,y-2.5,5,5));   // pontos de fixação
  if (hit) { c.fillStyle = `rgba(255,255,255,${hit})`; c.beginPath(); c.arc(hit.x, hit.y, 16, 0, 7); c.fill(); }
}
function fillShirt(c, k, x0, y0, w, h) {                // padrão de camisa por clube (clip no path atual)
  c.save(); c.clip(); c.fillStyle = k.c1; c.fillRect(x0,y0,w,h); c.fillStyle = k.c2;
  if (k.pat === 'v') for (let x = x0 + w*.1; x < x0 + w; x += w*.2) c.fillRect(x,y0,w*.1,h);
  else if (k.pat === 'h') for (let y = y0 + h*.08; y < y0 + h; y += h*.22) c.fillRect(x0,y,w,h*.11);
  else if (k.pat === 's') { c.fillRect(x0,y0+h*.38,w,h*.2); c.fillStyle = k.c3; c.fillRect(x0,y0+h*.38,w,h*.04); c.fillRect(x0,y0+h*.54,w,h*.04); }
  else if (k.pat === 'd') { c.translate(x0+w/2, y0+h/2); c.rotate(-.9); c.fillRect(-w,-h*.11,2*w,h*.22); }
  else if (k.pat === 'f') c.fillRect(x0+w/2,y0,w/2,h);
  c.restore();
}
const leg = (c, k, hx, ang, sy) => { c.save(); c.translate(hx,-50); c.rotate(ang); c.scale(1,sy); c.fillStyle = k.c2; c.fillRect(-6,0,12,18); c.fillStyle = k.c1; c.fillRect(-4.5,18,9,24); c.fillStyle = k.c2; c.fillRect(-4.5,24,9,3); c.fillStyle = '#111'; c.fillRect(-5,42,11,6); c.restore(); };
const arm = (c, k, sx, ang) => { c.save(); c.translate(sx,-96); c.rotate(ang); c.fillStyle = k.c1; c.fillRect(-4,0,8,12); c.fillStyle = k.c2; c.fillRect(-4,9,8,3); c.fillStyle = k.skin; c.fillRect(-3,12,6,17); c.beginPath(); c.arc(0,30,3.5,0,7); c.fill(); c.restore(); };
function kicker(c, x, y, k, p, po) {                    // visto de costas: nome e número na camisa
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x+12, y+2, 28, 6, 0, 0, 7); c.fill();
  c.save(); c.translate(x, y - po.jump); c.scale(1.35,1.35); c.translate(0, po.slump || 0); k = { ...k, skin: SKIN[p.num % 4] };
  const sw = po.walk ? Math.sin(po.walk)*.5 : 0, kk = po.kick, ka = kk == null ? sw : kk < .4 ? -.9 + 1.9*kk/.4 : 1.0*(1 - (kk-.4)/.6);
  leg(c,k,-7, kk == null ? -sw : .15, 1); leg(c,k,7, ka, kk == null ? 1 : 1 - .35*Math.sin(Math.min(1,kk)*Math.PI));
  arm(c,k,-18, po.cheer ? -2.7 : -.25 - sw*.5); arm(c,k,18, po.cheer ? 2.7 : .25 - sw*.5);
  c.beginPath(); c.moveTo(-17,-100); c.lineTo(17,-100); c.lineTo(15,-52); c.lineTo(-15,-52); c.closePath(); fillShirt(c,k,-17,-100,34,48);
  c.fillStyle = k.c2; c.fillRect(-6,-101,12,3); c.fillStyle = k.skin; c.fillRect(-4,-105,8,5);
  c.fillStyle = HAIR[p.num % 4]; c.beginPath(); c.arc(0,-114,10.3,0,7); c.fill(); c.fillStyle = k.skin; c.fillRect(-10.5,-112,3,5); c.fillRect(7.5,-112,3,5);
  const ink = lum(k.c1) > .55 ? '#101820' : '#fff'; c.textAlign = 'center'; c.fillStyle = ink; c.font = '700 6.5px Arial'; c.fillText(p.nome, 0, -91); c.font = '900 21px Arial'; c.fillText(p.num, 0, -70);
  c.restore();
}
function keeper(c, x, y, k, num, po) {                  // visto de frente: luvas, camisa diferenciada, mergulho
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x+8, y+3, 26, 5, 0, 0, 7); c.fill();
  c.save(); c.translate(x, y - po.lift); c.rotate(po.ang); c.scale(.92,.92);
  c.fillStyle = k.sh; c.fillRect(-12,-52,10,18); c.fillRect(2,-52,10,18); c.fillStyle = k.c1; c.fillRect(-11,-34,8,26); c.fillRect(3,-34,8,26); c.fillStyle = '#111'; c.fillRect(-12,-8,11,7); c.fillRect(1,-8,11,7);
  c.beginPath(); c.moveTo(-18,-100); c.lineTo(18,-100); c.lineTo(15,-52); c.lineTo(-15,-52); c.closePath(); c.fillStyle = k.c1; c.fill(); c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(-18,-100,5,48);
  c.fillStyle = '#fff'; c.font = '900 12px Arial'; c.textAlign = 'center'; c.fillText(num, 0, -72);
  [-1, 1].forEach(s => { c.save(); c.translate(s*18,-96); c.rotate(s*(po.up ? 2.6 : .75)); c.fillStyle = k.c1; c.fillRect(-4,0,8,12); c.fillStyle = '#ffd23f'; c.fillRect(-4,20,8,3); c.fillStyle = '#f1c27d'; c.fillRect(-3,12,6,9); c.fillStyle = '#fff'; c.beginPath(); c.arc(0,28,7,0,7); c.fill(); c.restore(); });
  c.fillStyle = '#e0ac69'; c.beginPath(); c.arc(0,-112,10,0,7); c.fill(); c.fillStyle = '#222'; c.beginPath(); c.arc(0,-116,10,Math.PI,0); c.fill(); c.fillRect(-4,-111,2,2); c.fillRect(2,-111,2,2);
  c.restore();
}
function ballAt(b, k) {
  if (!b) return { x:S.x, y:S.y, s:1, gy:S.y+14 };
  const tg = gpt(b.gx, b.gy), u = Math.min(1, Math.max(0, b.t)/TF), e = 1 - (1-u)*(1-u), d = b.t - TF; let x = S.x + (tg.x-S.x)*e, y = S.y + (tg.y-S.y)*e - Math.sin(Math.PI*u)*50, s = 1 - .55*e; const gyr = S.y + 14 + (G.b - S.y - 14)*e;
  if (b.res && d > 0) { if (b.res === 'gol') { const q = Math.min(d,.6); x += (b.gx-.5)*10*q; y = Math.min(G.b-12, y + q*q*160); s = .45 - .07*q; }
    else if (b.res === 'defesa') { const sg = Math.sign(k.tx-.5) || (b.gx < .5 ? -1 : 1); x += sg*70*d; y += -30*d + d*d*320; }
    else if (b.res === 'trave') { x += (.5-b.gx)*60*d; y += d*d*260 - 10*d; s += .25*d; } else { y -= (b.gy > 1 ? 40 : 0)*d; x += (b.gx-.5)*40*d; s -= .1*d; } }
  return { x, y, s, gy: b.res === 'gol' ? G.b - 4 : gyr };
}
export function drawScene(c, game) {
  if (!bg) buildBg(); const now = performance.now()/1000, dt = Math.min(.05, now - last || .016); last = now; ex = Math.max(0, ex - dt*.5);
  const b = game.ball, k = game.keeper, res = b?.res, d = b ? b.t - TF : 0;
  // câmera suave (só visual; a mira usa coordenadas do gol)
  const tg = res ? gpt(b.gx, b.gy) : null, T = res && d > 0 ? { z:1.14, x:tg.x*.6 + 480*.4, y:tg.y + 90 } : b ? { z:1.06, x:480, y:330 } : { z:GS.estado === 'MIRANDO' ? 1.04 : 1, x:480, y:310 }, f = 1 - Math.exp(-4*dt);
  cam.z += (T.z-cam.z)*f; cam.x += (T.x-cam.x)*f; cam.y += (T.y-cam.y)*f; const hx = W/2/cam.z, hy = H/2/cam.z, fx = Math.min(W-hx, Math.max(hx, cam.x)), fy = Math.min(H-hy, Math.max(hy, cam.y));
  const k0 = c.canvas.width/W; c.setTransform(k0,0,0,k0,0,0); c.save(); c.clearRect(0,0,W,H); c.translate(W/2,H/2); c.scale(cam.z,cam.z); c.translate(-fx,-fy);
  c.drawImage(bg,0,0,W,H); drawFans(c, now, ex); ads(c, now);
  net(c, d, res, b); const [ta, tb] = GS.equipes;
  if (ta && game.m) {
    const kt = GS.cobrador === 0 ? ta : tb, dt2 = GS.cobrador === 0 ? tb : ta, p = pickKicker(kt, GS.cobranca, game.escolha[GS.cobrador]), P = ballAt(b, k);
    const kx = k.x, dive = (kx-.5)*2, kc = KC[(dt2.id+2) % 5] === dt2.c1 ? KC[0] : KC[(dt2.id+2) % 5];
    const kpo = { ang: dive*1.1 * (res === 'gol' && d > .3 ? 1 : 1), lift: Math.abs(dive)*14, up: !!k.t0 && !(res === 'gol') || res === 'defesa' };
    keeper(c, gpt(kx,0).x, G.b-5, { c1: kc, sh: '#1b1b1b' }, 1, kpo);
    const rd = res && d > 0 ? d : 0, po = { jump: 0 };
    if (!b) { po.walk = game.t < .9 ? game.t*14 : 0; if (game.t < .9) po.walkX = 1; } else { po.kick = Math.min(1.01, (b.t + .2)/.5); if (po.kick > 1) po.kick = null; }
    if (res === 'gol' && rd) { po.cheer = true; po.jump = Math.abs(Math.sin(rd*9))*10; } else if (res && rd) po.slump = 4;
    const kk = { ...kt, sh: kt.c2 }, ox = !b && game.t < .9 ? -(1 - game.t/.9)*110 : 0;
    kicker(c, S.x - 48 + ox, S.y + 14, kk, p, po);
    if (res === 'gol') drawBall(c, P, b);
    frame(c, res === 'trave' && d > 0 && d < .25 ? .8 - d*3 : 0);
    if (res !== 'gol') drawBall(c, P, b);
  } else frame(c, 0);
  if (game.m && game.hum() && !b && (GS.estado === 'MIRANDO' || GS.estado === 'AGUARDANDO_COBRANCA')) { const q = gpt(game.aim.x, game.aim.y); c.strokeStyle = '#ff2d55'; c.lineWidth = 3; c.beginPath(); c.arc(q.x,q.y,16,0,7); c.moveTo(q.x-24,q.y); c.lineTo(q.x+24,q.y); c.moveTo(q.x,q.y-24); c.lineTo(q.x,q.y+24); c.stroke(); }
  c.restore(); hud(c, game, res, b);
}
function drawBall(c, P, b) {
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(P.x + 6*P.s, P.gy, 14*P.s, 4.5*P.s, 0, 0, 7); c.fill();
  c.save(); c.translate(P.x, P.y); c.rotate(b ? b.t*14 : 0); c.scale(P.s, P.s); const g = c.createRadialGradient(-4,-4,1,0,0,13); g.addColorStop(0,'#fff'); g.addColorStop(1,'#cfd6dd'); c.fillStyle = g; c.beginPath(); c.arc(0,0,13,0,7); c.fill();
  c.fillStyle = '#16202a'; c.beginPath(); for (let i = 0; i < 5; i++) { const a = i*1.2566; c.lineTo(Math.cos(a)*4.5, Math.sin(a)*4.5); } c.fill(); for (let i = 0; i < 5; i++) { const a = i*1.2566 + .6; c.beginPath(); c.arc(Math.cos(a)*11, Math.sin(a)*11, 3, 0, 7); c.fill(); } c.restore();
}
function hud(c, game, res, b) {
  const [a, bb] = GS.equipes; if (!a) return; c.fillStyle = 'rgba(0,0,0,.78)'; c.fillRect(250,6,460,64); c.font = '700 18px system-ui'; c.textAlign = 'left'; c.fillStyle = a.c1; c.fillRect(256,12,8,52); c.fillStyle = '#fff'; c.fillText(a.nome,272,30); c.textAlign = 'right'; c.fillText(bb.nome,694,30); c.fillStyle = bb.c1; c.fillRect(696,12,8,52);
  c.textAlign = 'center'; c.font = '900 34px Impact, sans-serif'; c.fillStyle = '#ffe66d'; c.fillText(`${GS.placar[0]} - ${GS.placar[1]}`,480,38); c.font = '13px system-ui'; c.fillStyle = '#aaa'; c.fillText(`Cobrança ${GS.cobranca}`,480,62);
  const m = game.m; if (!m) return; [0,1].forEach(q => { const n = Math.max(5, m.marks[q].length); for (let i = 0; i < n; i++) { const v = m.marks[q][i]; c.fillStyle = v === 'g' ? '#38b000' : v === 'd' ? '#4cc9f0' : v === 'x' ? '#e63946' : '#555'; c.beginPath(); c.arc(q ? 700 - i*16 : 260 + i*16, 62, 5, 0, 7); c.fill(); } });
  const kt = GS.cobrador === 0 ? a : bb, p = pickKicker(kt, GS.cobranca, game.escolha[GS.cobrador]); c.fillStyle = 'rgba(0,0,0,.75)'; c.fillRect(10,500,230,30); c.fillStyle = kt.c1; c.fillRect(10,500,6,30); c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = '700 14px system-ui'; c.fillText(`${game.two ? 'JOGADOR ' + (GS.cobrador+1) + ' · ' : ''}${p.star ? '★ ' : ''}${p.nome} — ${p.num}${p.pending ? ' (elenco pendente)' : ''}`.slice(0, 34), 24, 520);
  if (res) { c.font = '900 64px Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = { gol:'#ffe66d', defesa:'#4cc9f0', fora:'#ccc', trave:'#ff9f1c' }[res]; c.strokeStyle = '#000'; c.lineWidth = 6; const tx = { gol:'GOL!', defesa:'DEFESA!', fora:'PARA FORA', trave:'NA TRAVE!' }[res]; c.strokeText(tx,480,420); c.fillText(tx,480,420); }
  else { c.font = '600 16px system-ui'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText('', 0, 0); if (GS.estado === 'AGUARDANDO_COBRANCA') c.fillText('Segure o botão do mouse e solte para chutar', 560, 522); else if (GS.estado === 'DEFESA_DO_GOLEIRO') c.fillText('Defenda! ← esquerda · ↑ centro · → direita', 560, 522); }
}
