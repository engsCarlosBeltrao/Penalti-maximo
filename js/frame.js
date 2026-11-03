// FRAME: descrição PURA (sem canvas, sem WebGL) do que deve aparecer em cada quadro — poses, bola e câmera.
// É a ÚNICA fonte da animação: o motor 2D/3D procedural (scene3d.js) e o futuro motor Three.js/GLB (js/three/) apenas desenham este quadro.
import { GS } from './gameState.js';
import { pickKicker, keeperOf } from './players.js';
import { lerp } from './vec.js';
import { kickerPose, keeperPose, cheerPose, dejectedPose, goalToWorld, BALL0, BALL_R, SPOT_Z, KICK_T0, CLIP_END, sm } from './rig.js';
import { faceOf, SKINS, HAIRC } from './face.js';
export const TF = .7, HS = ['short', 'long', 'bald', 'afro'], KC = ['#00c853', '#ff4fd8', '#ffd23f', '#27e1ff', '#ff7a1a'];
export const kcol = t => KC[(t.id + 2) % 5] === t.c1 ? KC[0] : KC[(t.id + 2) % 5];
export function ballWorld(b, k) {
  if (!b || b.t <= 0) return BALL0.slice(); const T = goalToWorld(b.gx, b.gy); T[1] = Math.max(BALL_R, T[1]);
  if (b.t < TF) { const u = b.t/TF, e = 1 - (1 - u)*(1 - u); return [T[0]*e, BALL_R + (T[1] - BALL_R)*e + (.35 + .5*b.gy)*Math.sin(Math.PI*e), SPOT_Z*(1 - e)]; }   // passa EXATAMENTE pelo ponto da mira
  const d = b.t - TF, g = 4.9;
  if (b.res === 'gol') return [T[0] + (T[0]/3.66)*.25*d, Math.max(BALL_R, T[1] - g*d*d*.5), -1.6*(1 - Math.exp(-d*3.5))];
  if (b.res === 'defesa') { const sg = Math.sign(k.tx - .5) || (T[0] < 0 ? -1 : 1); return [T[0] + sg*2.6*d, Math.max(BALL_R, T[1] + 2.2*d - g*d*d), 3.2*d]; }
  if (b.res === 'trave') { const sx = -Math.sign(T[0] || 1); return [T[0] + sx*1.2*d, Math.max(BALL_R, T[1] + (b.gy > .95 ? -.5 : 2)*d - g*d*d), 4.5*d]; }
  return [T[0] + (T[0] < 0 ? -1 : 1)*1.5*d, Math.max(BALL_R, T[1] + (b.gy > 1 ? 3 : .5)*d - g*d*d), Math.max(-3.2, -9*d)];
}
export function camTarget(game, b, bw, res, d) {
  if (game.fin) return { pos: [0, 2.3, 15], tgt: [0, 1.4, 4], fov: 38 };
  if (b && res && d > 0) { const T = goalToWorld(b.gx, b.gy); return { pos: [T[0]*.3 + 1.2, 2.7, 19.5], tgt: [T[0]*.5, 1.2, 0], fov: 31 }; }                // gol / defesa: aproxima do gol e da torcida
  if (b && b.t > 0) return { pos: [bw[0]*.15, 3.1, 24], tgt: [bw[0]*.5, bw[1]*.5 + .6, Math.min(1, bw[2]*.3)], fov: 25 };                                  // acompanha a bola
  if (!b && game.t < .9) { const u = sm(game.t/.9); return { pos: lerp([5, 4.2, 29], [0, 3.3, 25], u), tgt: [0, 1.0, 1], fov: 31 - 4*u }; }                    // apresentação / preparação
  return { pos: [0, 3.3, game.dec ? 23.5 : 25], tgt: [0, 1.0, 1], fov: game.dec ? 25.5 : 27 };                                                                  // mira estável
}
// Aparência individual: o atleta (js/lineups) define pele, cabelo, barba, largura e altura; o resto do rosto vem de faceOf (determinístico). Cache por jogador: o quadro é montado a cada frame.
const faceCache = new Map();
const faceFor = L => { let f = faceCache.get(L.id); if (!f) { const a = L.ap; f = { ...faceOf(L.id), skinI: a.skinI, skin: a.skinHex || SKINS[a.skinI], hairC: a.hairHex || HAIRC[a.hairI], style: a.hair, beard: a.beard, build: a.build, height: a.height,
    mustache: a.mustache, sideburn: a.sideburn, hairC2: a.hairC2, beardC: a.beardC, hl: a.hl, hlAmt: a.hlAmt, tips: a.tips, grey: a.grey, band: a.band };   /* estilo/barba novos (3D) e a versão 2D */ faceCache.set(L.id, f); } return f; };
const withFace = L => L.ap ? { ...L, face: faceFor(L) } : L;
const keeperLook = (t, mood) => { const g = keeperOf(t); return g ? { ...withFace(g), mood } : { skin: t.id % 4, hair: HS[t.id % 4], nome: 'GOL', num: 1, face: faceOf('gk' + t.id), mood }; };   // goleiro do clube (nome/número/aparência próprios) ou genérico se o clube não tiver dados
const gkKit = t => ({ c1: kcol(t), c2: '#141414', c3: '#fff', pat: 'p', sh: '#1b1b1b', keeper: true, long: true, glove: true, key: 'gk' + t.id });
// Personagens do quadro: [{ role, P (pose do rig), kit, look }]. role: kicker | keeper | mate | loser
export function characters(game, now, b, k, res, d, bw) {
  const [ta, tb] = GS.equipes; if (!ta || !game.m) return null;
  if (game.fin) {                                                                                   // FIM CONFIRMADO: só o vencedor comemora; o derrotado mostra decepção
    const w = GS.vencedor, A = GS.equipes[w], B = GS.equipes[1 - w], ft = game.fin.t, run = sm(ft/1.4), list = [];
    list.push({ role: 'keeper', P: { root: [0, 0, .55], yaw: 0, lean: 0, head: [-.2], hipL: [.2, .25, .5], hipR: [.2, .25, .5], armL: [2.9, .5, .2], armR: [2.9, .5, .2], lift: Math.abs(Math.sin(ft*6))*.35 }, kit: gkKit(A), look: keeperLook(A, 'happy') });
    [[-1.3, 0], [0, 1], [1.3, 2]].forEach(([x, i]) => { const pp = pickKicker(A, i + 1, i === 1 ? game.escolha[w] : null), pos = lerp([x*.3, 0, 3], [x, 0, 7.2 - Math.abs(x)*.4], run); list.push({ role: 'mate', P: cheerPose(ft, i, pos, 0), kit: { ...A, variant: w === 1 ? 'away' : 'home', sh: A.c2 }, look: withFace(pp) }); });
    list.push({ role: 'loser', P: dejectedPose(ft, [-3.6, 0, 8.5], .6), kit: { ...B, variant: w === 1 ? 'home' : 'away', sh: B.c2 }, look: withFace(pickKicker(B, 1, null)) });
    return { final: true, list };
  }
  const kt = GS.cobrador === 0 ? ta : tb, dt2 = GS.cobrador === 0 ? tb : ta, p = pickKicker(kt, GS.cobranca, game.escolha[GS.cobrador]);
  const m = !b ? (game.t < .9 ? { mode: 'walkin', t: game.t } : { mode: 'idle', t: now }) : b.t <= TF ? { mode: 'kick', tc: Math.max(KICK_T0, b.t) } : { mode: 'react', d: b.t - TF, type: res === 'gol' ? 'gol' : 'falha' };
  const kp = keeperPose(k, b, res, d, now, b && b.t > 0 ? bw : null);
  return { final: false, list: [{ role: 'kicker', P: kickerPose(m), anim: b && b.t <= CLIP_END ? { clip: 'chute', tc: Math.max(KICK_T0, b.t) } : null, kit: { ...kt, sh: kt.c2, variant: GS.cobrador === 1 ? 'away' : 'home' }, look: withFace(p) },
    { role: 'keeper', P: kp.P, kit: gkKit(dt2), look: keeperLook(dt2, kp.info.happy ? 'happy' : kp.info.sad ? 'sad' : 'neutral') }] };
}
