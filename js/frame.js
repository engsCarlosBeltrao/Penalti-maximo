// FRAME: descrição PURA (sem canvas, sem WebGL) do que deve aparecer em cada quadro — poses, bola e câmera.
// É a ÚNICA fonte da animação: o motor 2D/3D procedural (scene3d.js) e o futuro motor Three.js/GLB (js/three/) apenas desenham este quadro.
import { GS } from './gameState.js';
import { pickKicker, keeperOf } from './players.js';
import { lerp } from './vec.js';
import { kickerPose, keeperPose, cheerPose, dejectedPose, goalToWorld, BALL0, BALL_R, SPOT_Z, KICK_T0, CLIP_END, GOAL_W, sm } from './rig.js';
import { faceOf, SKINS, HAIRC } from './face.js';
import { clipStart, clipEnd, ENTRY_S, KEEPER_CHEER, KEEPER_SAD, CORRIDA } from './kicks.js';
import { animGoleiro, ballFlight } from './keeper.js';
// MÁQUINA DE ESTADOS do cobrador: entering (clipe de entrada: caminha e para no ponto de partida) → idle (clipe de repouso) → charging (segurando a barra:
// o repouso se mistura à pose inicial da cobrança) → runUp → kick (do plantio ao contato) → followThrough → recovery (fim do clipe) →
// goalCelebration (só se o resultado CONFIRMADO for gol) ou missReaction (defesa, trave ou fora). O estado é função do tempo e do resultado: não se
// "ativa" a cada quadro, e uma cobrança nunca tem as duas reações. Só UM clipe controla os ossos por vez.
export const CHARGE_S = .45;
// uniforme do time na partida: o escolhido na seleção (t.uni: home | away | third) ou o padrão (1º time titular, 2º reserva)
export const uniDe = (t, i) => t.uni || (i === 1 ? 'away' : 'home');
export function kickerState(game, b) {
  const ks = game.kick;
  if (!b) return game.t < ENTRY_S ? 'entering' : chargeOf(game) > 0 ? 'charging' : 'idle';
  if (!ks || b.t > ks.t1) return b.res === 'gol' ? 'goalCelebration' : b.res ? 'missReaction' : 'recovery';
  const c = ks.clip; return b.t < (c.plantio ?? -.12) ? 'runUp' : b.t < 1e-9 ? 'kick' : b.t < (c.pouso ?? .4) ? 'followThrough' : 'recovery';
}
export function chargeOf(game) {                                     // 0..1: quanto o cobrador já saiu do repouso para a pose de partida
  if (GS.estado === 'MIRANDO') return sm((game.t - (game.aimT ?? game.t))/CHARGE_S);
  if (GS.estado === 'DEFESA_DO_GOLEIRO' && game.hum && !game.hum()) return sm((CHARGE_S - (game.wait ?? 9))/CHARGE_S);   // CPU: prepara-se antes de partir
  return 0;
}
const phaseOf = id => { let h = 0; for (const ch of String(id)) h = (h*31 + ch.charCodeAt(0)) >>> 0; return (h % 640)/100; };   // fase do laço de repouso por atleta (ninguém sincronizado)
export const TF = .7, HS = ['short', 'long', 'bald', 'afro'], KC = ['#00c853', '#ff4fd8', '#ffd23f', '#27e1ff', '#ff7a1a'];
export const flightTime = b => (b && b.tf) || TF;   // tempo de voo da cobrança (depende do tipo: js/kicks.js)
export const kcol = t => KC[(t.id + 2) % 5] === t.c1 ? KC[0] : KC[(t.id + 2) % 5];
export function ballWorld(b, k) {
  if (!b || b.t <= 0) return BALL0.slice(); if (b.fis) return b.fis.p.slice();   // depois do toque no goleiro: física da bola (js/keeper.js), nas luvas ou livre
  const T = goalToWorld(b.gx, b.gy); T[1] = Math.max(BALL_R, T[1]); const tf = flightTime(b);
  if (b.t < tf) return ballFlight(b, b.t);           // voo: avanço com arrasto; altura balística (gravidade real) que passa EXATAMENTE pelo ponto da mira no instante tf; curl da chapada
  const d = b.t - tf, g = 4.9;
  if (b.res === 'gol') return [T[0] + (T[0]/3.66)*.25*d, Math.max(BALL_R, T[1] - g*d*d*.5), -1.6*(1 - Math.exp(-d*3.5))];
  if (b.res === 'defesa') { const sg = Math.sign(k.tx - .5) || (T[0] < 0 ? -1 : 1); return [T[0] + sg*2.6*d, Math.max(BALL_R, T[1] + 2.2*d - g*d*d), 3.2*d]; }
  if (b.res === 'trave') { const sx = -Math.sign(T[0] || 1); return [T[0] + sx*1.2*d, Math.max(BALL_R, T[1] + (b.gy > .95 ? -.5 : 2)*d - g*d*d), 4.5*d]; }
  return [T[0] + (T[0] < 0 ? -1 : 1)*1.5*d, Math.max(BALL_R, T[1] + (b.gy > 1 ? 3 : .5)*d - g*d*d), Math.max(-3.2, -9*d)];
}
export function camTarget(game, b, bw, res, d) {
  if (!game.m && game.vitrine) return game.vitrine.duelo ? dueloCam(game.vitrine.t ?? 0) : vitrineCam(game.vitrine.t ?? 0);
  if (game.fin) return { pos: [0, 2.3, 15], tgt: [0, 1.4, 4], fov: 38 };
  if (b && res && d > 0) { const T = goalToWorld(b.gx, b.gy); return { pos: [T[0]*.3 + 1.2, 2.7, 19.5], tgt: [T[0]*.5, 1.2, 0], fov: 31 }; }                // gol / defesa: aproxima do gol e da torcida
  if (b && b.t > 0) return { pos: [bw[0]*.15, 3.1, 24], tgt: [bw[0]*.5, bw[1]*.5 + .6, Math.min(1, bw[2]*.3)], fov: 25 };                                  // acompanha a bola
  if (!b && game.t < .9) { const u = sm(game.t/.9); return { pos: lerp([5, 4.2, 29], [0, 3.3, 25], u), tgt: [0, 1.0, 1], fov: 31 - 4*u }; }                    // apresentação / preparação
  const base = { pos: [0, 3.3, game.dec ? 23.5 : 25], tgt: [0, 1.0, 1], fov: game.dec ? 25.5 : 27 };                                                             // mira estável
  const ks = game.kick; if (!ks || !ks.clip) return base;                                                                                                        // cobrador que parte de longe (ex.: Gabigol, ~9 m): a câmera recua e abre para mostrá-lo,
  const st = clipStart(ks.clip).root, sx = ks.pe === 'l' ? -st[0] : st[0], u = b ? Math.min(1, Math.max(0, 1 - b.t/(b.t0 ?? ks.t0))) : 0;                              // e volta ao enquadramento normal conforme ele chega à bola
  const kx = sx*(1 - u), kz = SPOT_Z + (st[2] - SPOT_Z)*(1 - u), e = Math.min(1, Math.max(0, (Math.hypot(kx, kz - SPOT_Z) - 4.4)/4.6));
  return e <= 0 ? base : { pos: [kx*.55*e, base.pos[1] + .6*e, base.pos[2] + 4.5*e], tgt: [kx*.25*e, .85, 1 + 2*e], fov: base.fov + 9*e };
}
// Aparência individual: o atleta (js/lineups) define pele, cabelo, barba, largura e altura; o resto do rosto vem de faceOf (determinístico). Cache por jogador: o quadro é montado a cada frame.
const faceCache = new Map();
const faceFor = L => { let f = faceCache.get(L.id); if (!f) { const a = L.ap; f = { ...faceOf(L.id), skinI: a.skinI, skin: a.skinHex || SKINS[a.skinI], hairC: a.hairHex || HAIRC[a.hairI], style: a.hair, beard: a.beard, build: a.build, height: a.height,
    mustache: a.mustache, sideburn: a.sideburn, hairC2: a.hairC2, beardC: a.beardC, hl: a.hl, hlAmt: a.hlAmt, tips: a.tips, grey: a.grey, band: a.band };   /* estilo/barba novos (3D) e a versão 2D */ faceCache.set(L.id, f); } return f; };
const withFace = L => L.ap ? { ...L, face: faceFor(L) } : L;
// largura do atleta como o loader a aplica (root.scale x/z = build × altura): a mesma conta de js/three/loader.js → apply
export const widthOf = lk => { const f = lk.face || faceOf((lk.nome || '') + (lk.num ?? ''), { hair: lk.hair }); return (f.build || 1)*(f.height || 1); };
// escala do goleiro em campo (largura × altura, como o loader aplica no modelo): os colisores dos ossos usam a mesma
export const keeperScale = game => { const [ta, tb] = GS.equipes; const t = GS.cobrador === 0 ? tb : ta; if (!t) return [1, 1]; const f = keeperLook(t).face || {}, h = f.height || 1; return [(f.build || 1)*h, h]; };
const keeperLook = (t, mood) => { const g = keeperOf(t); return g ? { ...withFace(g), mood } : { skin: t.id % 4, hair: HS[t.id % 4], nome: 'GOL', num: 1, face: faceOf('gk' + t.id), mood }; };   // goleiro do clube (nome/número/aparência próprios) ou genérico se o clube não tiver dados
const gkKit = t => ({ c1: kcol(t), c2: '#141414', c3: '#fff', pat: 'p', sh: '#1b1b1b', keeper: true, long: true, glove: true, key: 'gk' + t.id });
// Personagens do quadro: [{ role, P (pose do rig), kit, look }]. role: kicker | keeper | mate | loser
export function characters(game, now, b, k, res, d, bw) {
  if (!game.m) return game.vitrine ? vitrine(game.vitrine, now) : null;   // menu: jogador em destaque na frente do estádio
  const [ta, tb] = GS.equipes; if (!ta) return null;
  if (game.fin) {                                                                                   // FIM CONFIRMADO: só o vencedor comemora; o derrotado mostra decepção
    const w = GS.vencedor, A = GS.equipes[w], B = GS.equipes[1 - w], ft = game.fin.t, list = [], vit = game.fin.vit || [];
    // COMEMORAÇÃO DE VITÓRIA: cada um com um clipe diferente (10 em js/kicks.js → VICTORY_REACTIONS, sorteados sem repetir), de frente para a câmera;
    // o derrotado com uma reação de lamento. A pose do rig fica só como reserva (sem os clipes carregados).
    const clipe = (n, pos, yaw, pe = 'r') => ({ clip: n, pe, t: ft, pos, yaw, blend: .35, state: 'victory' });
    const posGol = [2.4, 0, 6.4];
    list.push({ role: 'keeper', P: cheerPose(ft, 3, posGol, 0), anim: vit[3] ? clipe(vit[3], posGol, -.15, 'l') : null, kit: gkKit(A), look: keeperLook(A, 'happy') });
    [[-1.3, 0], [0, 1], [1.3, 2]].forEach(([x, i]) => { const pp = pickKicker(A, i + 1, i === 1 ? game.escolha[w] : null), pos = [x, 0, 7.2 - Math.abs(x)*.4];
      list.push({ role: 'mate', P: cheerPose(ft, i, pos, 0), anim: vit[i] ? clipe(vit[i], pos, -x*.08, i % 2 ? 'l' : 'r') : null, kit: { ...A, variant: uniDe(A, w), sh: A.c2 }, look: withFace(pp) }); });
    const posPerd = [-3.6, 0, 8.5];
    list.push({ role: 'loser', P: dejectedPose(ft, posPerd, .6), anim: game.fin.perdeu ? clipe(game.fin.perdeu, posPerd, .6) : null, kit: { ...B, variant: uniDe(B, 1 - w), sh: B.c2 }, look: withFace(pickKicker(B, 1, null)) });
    return { final: true, list };
  }
  const kt = GS.cobrador === 0 ? ta : tb, dt2 = GS.cobrador === 0 ? tb : ta, p = pickKicker(kt, GS.cobranca, game.escolha[GS.cobrador]);
  const ks = game.kick, c = ks && ks.clip, tf = flightTime(b), t0 = ks?.t0 ?? b?.t0 ?? KICK_T0, tClipe = b ? (b.t < 0 ? b.t*(ks ? CORRIDA : 1) : b.t) : 0, state = kickerState(game, b), lk = withFace(p), wd = widthOf(lk);   // cobrança (js/kicks.js): clipe, início/fim, canhoto   // tClipe: tempo do CLIPE do cobrador (a corrida toca CORRIDA× mais rápida)
  const m = !b ? (game.t < ENTRY_S ? { mode: 'walkin', t: game.t, dur: ENTRY_S } : { mode: 'idle', t: now }) : b.t <= tf ? { mode: 'kick', tc: Math.max(t0, tClipe), t0 } : { mode: 'react', d: b.t - tf, type: res === 'gol' ? 'gol' : 'falha' };
  if (c) Object.assign(m, { start: clipStart(c, wd), end: clipEnd(c, wd), mirror: ks.pe === 'l' });
  let anim = null; const mir = ks && ks.pe === 'l', fx = v => [mir ? -v[0] : v[0], 0, v[2]];
  if (c && state === 'entering') { const st = clipStart(c, wd); anim = { clip: 'entrada', state, pe: ks.pe, t: game.t, pos: fx(st.root), yaw: mir ? -st.yaw : st.yaw, blend: 0 }; }   // corte no início da vez
  else if (c && (state === 'goalCelebration' || state === 'missReaction')) anim = { clip: b.reacao || (state === 'goalCelebration' ? 'gol_bracos_abertos' : 'perdeu_cabeca_baixa'), state, pe: ks.pe, t: b.t - ks.t1, pos: fx(clipEnd(c, wd).root), yaw: Math.PI, blend: .3 };
  else if (c && (state === 'idle' || state === 'charging')) { const st = clipStart(c, wd), mir = ks.pe === 'l';   // repouso no ponto de partida (espelhado no canhoto) + mistura para a pose de partida
    anim = { idle: true, state, pe: ks.pe, t: game.t + phaseOf(p.id), pos: [mir ? -st.root[0] : st.root[0], 0, st.root[2]], yaw: mir ? -st.yaw : st.yaw, ready: { clip: ks.id, w: chargeOf(game) } }; }
  else if (b && b.t <= (ks ? ks.t1 : CLIP_END)) anim = { clip: ks ? ks.id : 'chute', tc: Math.max(t0, tClipe), state };
  const kp = keeperPose(k, b, res, d, now, b && b.t > 0 ? bw : null), nk = GS.cobrancasRealizadas || 0;
  // goleiro: depois de levantar, comemora a defesa (ou o erro do cobrador) ou lamenta o gol — clipes do Blender, variando a cada cobrança
  // goleiro (js/keeper.js): espera em laço (+ preparação depois de escolher o lado) → mergulho sincronizado com a bola → reação onde ele terminou o
  // mergulho, já de pé: comemora a defesa (ou o erro do cobrador) ou lamenta o gol. Clipes do Blender; o rig.js só entra se faltar algum clipe.
  const gk = k && k.log ? k : null, kAnim = gk ? animGoleiro(gk, b, { agora: now, tJogo: game.t ?? now, sc: keeperScale(game), nk, cheer: KEEPER_CHEER, sad: KEEPER_SAD }) : null;
  const mood = kAnim ? (kAnim.state === 'keeperSad' ? 'sad' : kAnim.state === 'keeperCheer' ? 'happy' : 'neutral') : kp.info.happy ? 'happy' : kp.info.sad ? 'sad' : 'neutral';
  const list = [{ role: 'kicker', P: kickerPose(m), anim, state, kit: { ...kt, sh: kt.c2, variant: uniDe(kt, GS.cobrador) }, look: lk },
    { role: 'keeper', P: kp.P, anim: kAnim, kit: gkKit(dt2), look: keeperLook(dt2, mood) }];
  return { final: false, list };
}
// VITRINE DO MENU: o cobrador principal do time escolhido de costas para a câmera, no lado direito da tela, olhando o campo (repouso em laço);
// câmera baixa, atrás do ombro, com um balanço lento (profundidade). t: segundos desde que o menu abriu.
export const VITRINE = { pos: [.75, 0, 15.9], yaw: Math.PI - .32 };
export function vitrineCam(t) { const a = Math.sin(t*.21)*.5 + .5, b = Math.sin(t*.13 + 1);
  return { pos: [-.4 + .2*a, 1.55 + .05*b, 18.65 - .2*a], tgt: [-.45 + .15*a, 1.45, 9.5], fov: 35 }; }
export function vitrine(v, now) { if (v.duelo) return duelo(v, now); const t = v.time; if (!t) return null; const p = pickKicker(t, 1, v.escolha ?? null);
  return { final: true, vitrine: true, list: [{ role: 'kicker', P: kickerPose({ mode: 'idle', t: now }), state: 'idle',
    anim: { idle: true, state: 'idle', pe: 'r', t: now + phaseOf(p.id), pos: VITRINE.pos, yaw: VITRINE.yaw, ready: { clip: null, w: 0 } }, kit: { ...t, sh: t.c2, variant: 'home' }, look: withFace(p) }] }; }
// SELEÇÃO DE TIMES: os dois cobradores principais lado a lado, de frente para a câmera, cada um com o clube e o uniforme que está sendo escolhido
// (v.duelo = [{ time, uni, escolha, tConf }, ...]); ao confirmar, o jogador comemora (soco no ar) e volta ao repouso. Corpo inteiro: camisa, calção e meião.
export const DUELO = { x: 1.25, z: 14.2 };
export function dueloCam(t) { const b = Math.sin(t*.25); return { pos: [.12*b, 1.05, 20.4], tgt: [0, .98, 14], fov: 30 }; }
function duelo(v, now) {
  const list = v.duelo.map((l, i) => { if (!l || !l.time) return null; const p = pickKicker(l.time, 1, l.escolha ?? null), sg = i ? 1 : -1, pos = [sg*DUELO.x, 0, DUELO.z], yaw = -sg*.28, dt = (v.t ?? 0) - (l.tConf ?? -99);
    const anim = dt >= 0 && dt < 2.9 ? { clip: 'def_soco_ar', pe: 'r', t: dt, pos, yaw, blend: .3, state: 'victory' } : { idle: true, state: 'idle', pe: 'r', t: now + phaseOf(p.id) + i*1.7, pos, yaw, ready: { clip: null, w: 0 } };
    return { role: 'mate', P: kickerPose({ mode: 'idle', t: now }), state: 'idle', anim, kit: { ...l.time, sh: l.time.c2, variant: l.uni || 'home' }, look: withFace(p) }; }).filter(Boolean);
  return { final: true, vitrine: true, list };
}
