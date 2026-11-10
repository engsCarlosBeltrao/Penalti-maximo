// FRAME: descrição PURA (sem canvas, sem WebGL) do que deve aparecer em cada quadro — poses, bola e câmera.
// É a ÚNICA fonte da animação: o motor 2D/3D procedural (scene3d.js) e o futuro motor Three.js/GLB (js/three/) apenas desenham este quadro.
import { GS } from './gameState.js';
import { pickKicker, keeperOf } from './players.js';
import { lerp } from './vec.js';
import { kickerPose, keeperPose, cheerPose, dejectedPose, goalToWorld, BALL0, BALL_R, SPOT_Z, KICK_T0, CLIP_END, GOAL_W, sm } from './rig.js';
import { faceOf, SKINS, HAIRC } from './face.js';
import { clipStart, clipEnd, ENTRY_S, KEEPER_CHEER, KEEPER_SAD, CORRIDA, CHEGADA, VICTORY_REACTIONS, MISS_REACTIONS, FEST_CLIPS } from './kicks.js';
import { animGoleiro, ballFlight, QUIQUE } from './keeper.js';
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
// REDE (medidas da estrutura visual, js/three/gol.js): fundo 2 m atrás da linha, barra de trás a 2 m de altura e 3,3 m do centro; eixo das traves e
// do travessão como na física (js/fisicaGol.js). Depois do GOL (já confirmado) a bola segue com a velocidade que tinha na linha até BATER na rede;
// a rede a freia como uma mola amortecida (estica para trás, segura e devolve) e a bola cai no chão dentro do gol. Só visual: o resultado não muda.
export const REDE = { D: 2, BH: 2, BW: 3.3, W: 3.72, H: 2.5, w: 11, z: .34 };   // w: rigidez da rede (menor = estica mais); z: amortecimento
export function bolaNaRede(b, T, tf, d) {
  const p0 = ballFlight(b, tf - .01), p1 = ballFlight(b, tf), v = [(p1[0] - p0[0])/.01, (p1[1] - p0[1])/.01, (p1[2] - p0[2])/.01], r = BALL_R, g = 9.81;
  const livre = t => [T[0] + v[0]*t, Math.max(r, T[1] + v[1]*t - g*t*t/2), v[2]*t];
  const dentro = q => { const f = Math.min(1, Math.max(0, -q[2]/REDE.D)), xr = REDE.W - (REDE.W - REDE.BW)*f, yr = REDE.H - (REDE.H - REDE.BH)*f; return q[2] - r > -REDE.D && Math.abs(q[0]) + r < xr && q[1] + r < yr; };
  let tc = 0; while (tc < .6 && dentro(livre(tc + .004))) tc += .004;                                    // instante em que a bola encosta na rede (fundo, teto ou lateral)
  if (d <= tc) return livre(d);
  const pc = livre(tc), vy = Math.max(-6, v[1] - g*tc), vc = [v[0], pc[1] <= r + 1e-6 ? 0 : vy, v[2]], vm = Math.hypot(...vc) || 1, u = vc.map(x => x/vm);
  const om = REDE.w, ze = REDE.z, od = om*Math.sqrt(1 - ze*ze), ve = Math.min(vm, 19)*.92, tau = d - tc, fim = Math.PI/od;
  if (tau < fim) { const s = ve/od*Math.exp(-ze*om*tau)*Math.sin(od*tau);                               // a rede estica (s > 0) e devolve
    return [pc[0] + u[0]*s, Math.max(r, pc[1] + u[1]*s - 1.5*tau*tau), pc[2] + u[2]*s]; }
  const t2 = tau - fim, y0 = Math.max(r, pc[1] - 1.5*fim*fim);                                          // devolvida: cai no chão dentro do gol
  const vr = Math.min(1.6, .1*ve), tr = Math.min(t2, .7), dr = vr*tr - vr*.5*tr*tr/.7;   // rebote: a rede devolve a bola para a frente
  return [pc[0] - u[0]*dr, Math.max(r, y0 - g*t2*t2/2), Math.min(-.35, pc[2] - u[2]*dr)];   // a bola fica dentro do gol
}
export function ballWorld(b, k) {
  if (!b || b.t <= 0) return BALL0.slice(); if (b.fis) return b.fis.p.slice();   // depois do toque no goleiro: física da bola (js/keeper.js), nas luvas ou livre
  const T = goalToWorld(b.gx, b.gy); T[1] = Math.max(BALL_R, T[1]); const tf = flightTime(b);
  if (b.t < tf) return ballFlight(b, b.t);           // voo: avanço com arrasto; altura balística (gravidade real) que passa EXATAMENTE pelo ponto da mira no instante tf; curl da chapada
  const d = b.t - tf;
  if (b.res === 'gol') return bolaNaRede(b, T, tf, d);
  if (b.res === 'defesa') { const sg = Math.sign(k.tx - .5) || (T[0] < 0 ? -1 : 1); return quica(T, [sg*2.6, 2.2, 3.2], d); }
  if (b.res === 'trave') { const sx = -Math.sign(T[0] || 1); return quica(T, [sx*1.2, b.gy > .95 ? -.5 : 2, 4.5], d); }
  const p = quica(T, [(T[0] < 0 ? -1 : 1)*1.5, b.gy > 1 ? 3 : .5, -9], d); p[2] = Math.max(-3.2, p[2]); return p;   // para fora: para nas placas atrás do gol
}
// BOLA LIVRE COM QUIQUES (forma fechada: a posição sai direto do tempo, sem acumular passos): parte de p0 com a velocidade v0, gravidade real; a cada
// toque no gramado volta com QUIQUE.e da velocidade vertical e perde um pouco da horizontal; quando o quique fica fraco, rola até parar.
export function quica(p0, v0, d, { e = QUIQUE.e, atrito = QUIQUE.atrito, min = QUIQUE.min } = {}) {
  const G = 9.81; let p = [p0[0], Math.max(BALL_R, p0[1]), p0[2]], v = v0.slice(), t = d;
  for (let n = 0; n < 12; n++) {
    const y0 = p[1] - BALL_R, tc = (v[1] + Math.sqrt(Math.max(0, v[1]*v[1] + 2*G*y0)))/G;     // tempo até tocar o chão
    if (t < tc) return [p[0] + v[0]*t, BALL_R + y0 + v[1]*t - G*t*t/2, p[2] + v[2]*t];
    p = [p[0] + v[0]*tc, BALL_R, p[2] + v[2]*tc]; t -= tc; const vy = -(v[1] - G*tc)*e; v = [v[0]*atrito, vy, v[2]*atrito];
    if (vy < min) break;
  }
  const c = 1.4, f = (1 - Math.exp(-c*t))/c; return [p[0] + v[0]*f, BALL_R, p[2] + v[2]*f];   // rolando, freada pela grama
}
// CÂMERA DA COBRANÇA (estilo FIFA 17): reta na bola (alinhada com a marca do pênalti e o centro do gol), um pouco acima; mostra ao mesmo tempo o cobrador em primeiro plano, a bola,
// a seta da mira no gramado, o goleiro de frente e o gol centralizado com a arquibancada atrás.
export const CAM_COB = { pos: [0, 3.35, 24.2], tgt: [0, .3, 3], fov: 30 };   // recuada ~3 m (o cobrador menor, mais campo e mais torcida)
// ===================== FESTA DO TÍTULO (cena final) =====================
// PLANO (sorteado uma vez, quando o fim é confirmado — js/game.js): o PROTAGONISTA é quem fez o gol decisivo (ou o goleiro, se a disputa acabou numa
// defesa/erro do adversário), parado perto da marca do pênalti. Seis companheiros correm até ele em linha reta, cada um para um lugar marcado numa
// RODA (raio 0,72 m) — os lugares ficam nas costas e nos lados dele, a frente (onde está a câmera) fica livre; cada um sai a CHEGADA m do seu lugar,
// na direção do protagonista, então os caminhos são raios: nunca se cruzam nem se atravessam. Atrasos e velocidades diferentes (ninguém chega junto).
// Dois companheiros comemoram de frente para a torcida; três derrotados e o goleiro derrotado mostram decepção, longe do grupo.
const RODA_ANG = [180, 140, -140, 100, -100, 62], RODA_R = .72;
const embaralhar = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r()*(i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export function planoFesta(game, r = Math.random) {
  const w = GS.vencedor, A = GS.equipes[w], B = GS.equipes[1 - w], u = GS.ultimaCobranca, golDecisivo = !!u && u.resultado === 'gol' && u.equipe === w;
  const protId = golDecisivo ? pickKicker(A, GS.cobranca, game.escolha?.[w]).id : null, P = [(r() - .5)*.6, 0, 9.3 + r()*.5];
  const time = [...Array(11).keys()].map(n => pickKicker(A, n + 1, protId)).filter(p => !p.gk && p.id !== protId);   // companheiros de linha (sem o protagonista)
  const membros = [...time.slice(0, golDecisivo ? 5 : 6).map(look => ({ look })), ...(golDecisivo ? [{ gk: true }] : [])];
  const angs = embaralhar(RODA_ANG, r); if (golDecisivo) { const k = angs.findIndex(a => Math.abs(a) >= 140); [angs[k], angs[5]] = [angs[5], angs[k]]; }   // o goleiro vem do gol: chega pelas costas
  const roda = membros.map((m, i) => { const th = angs[i]*Math.PI/180, sx = Math.sin(th), sz = Math.cos(th), slot = [P[0] + sx*RODA_R, 0, P[2] + sz*RODA_R];
    const esc = widthOf(m.gk ? keeperLook(A, 'happy') : withFace(m.look)), L = CHEGADA*esc;              // o tamanho de cada um (altura × porte) escala o passo: a corrida dele mede CHEGADA × esc
    const yaw = Math.atan2(-sx, -sz), S = [slot[0] + sx*L, 0, slot[2] + sz*L];                              // sai L m para fora, corre de volta olhando o protagonista e para exatamente no lugar
    return { ...m, S, yaw, clip: Math.abs(angs[i]) < 120 ? 'fest_lado' : 'fest_abraco', pe: r() < .5 ? 'r' : 'l', atraso: m.gk ? .7 + r()*.35 : .1 + r()*.65, vel: .92 + r()*.16 }; });
  const vit = embaralhar(Object.keys(VICTORY_REACTIONS), r), perd = embaralhar(Object.keys(MISS_REACTIONS), r);
  const torcida = time.slice(roda.filter(m => !m.gk).length, roda.filter(m => !m.gk).length + 2).map((look, i) => ({ look, pos: [P[0] + (i ? 2.7 : -2.7), 0, P[2] - 1.4 - r()*.6], yaw: Math.PI + (i ? -.35 : .35), clips: vit.slice(i*2, i*2 + 2) }));
  const derrotados = [1, 2, 3].map((n, i) => ({ look: pickKicker(B, n, null), pos: [[-4.8, 0, 12.6], [4.6, 0, 12.2], [-5.6, 0, 9.8]][i], yaw: [.5, -.6, .9][i], clip: perd[i] }));
  return { P, protId, protGk: !golDecisivo, roda, torcida, derrotados, perdGk: perd[3], ini: vit[4] };
}
function festa(game) {
  const f = game.fin, ft = f.t, w = GS.vencedor, A = GS.equipes[w], B = GS.equipes[1 - w], pl = f.festa || (f.festa = planoFesta(game)), list = [];
  const kitA = { ...A, variant: uniDe(A, w), sh: A.c2 }, kitB = { ...B, variant: uniDe(B, 1 - w), sh: B.c2 };
  const clipe = (clip, t, pos, yaw, pe = 'r', state = 'victory') => ({ clip, pe, t: Math.max(0, t), pos, yaw, blend: .3, state });
  // protagonista: recebe os companheiros
  if (pl.protGk) list.push({ role: 'keeper', P: cheerPose(ft, 3, pl.P, 0), anim: clipe('fest_recebe', ft, pl.P, 0, 'r'), kit: gkKit(A), look: keeperLook(A, 'happy') });
  else list.push({ role: 'mate', P: cheerPose(ft, 0, pl.P, 0), anim: clipe('fest_recebe', ft, pl.P, 0, 'r'), kit: kitA, look: withFace(pickKicker(A, 1, pl.protId)) });
  // a roda: cada um corre até o seu lugar e abraça (o tempo do clipe anda na velocidade de cada um)
  pl.roda.forEach((m, i) => { const t = (ft - m.atraso)*m.vel, an = clipe(m.clip, t, m.S, m.yaw, m.pe);
    if (m.gk) list.push({ role: 'keeper', P: cheerPose(ft, 4, m.S, m.yaw), anim: an, kit: gkKit(A), look: keeperLook(A, 'happy') });
    else list.push({ role: 'mate', P: cheerPose(ft, i + 1, m.S, m.yaw), anim: an, kit: kitA, look: withFace(m.look) }); });
  // dois comemoram de frente para a torcida (duas comemorações seguidas, no lugar)
  pl.torcida.forEach((m, i) => { const d0 = VICTORY_REACTIONS[m.clips[0]] || 4.2, t = ft - .2 - i*.35, c = t < d0 ? m.clips[0] : m.clips[1];
    list.push({ role: 'mate', P: cheerPose(ft, i + 7, m.pos, m.yaw), anim: clipe(c, t < d0 ? t : t - d0, m.pos, m.yaw, i ? 'l' : 'r'), kit: kitA, look: withFace(m.look) }); });
  // derrotados: decepção, longe da festa; o goleiro derrotado no gol
  pl.derrotados.forEach(m => list.push({ role: 'loser', P: dejectedPose(ft, m.pos, m.yaw), anim: clipe(m.clip, ft - .3, m.pos, m.yaw, 'r', 'loser'), kit: kitB, look: withFace(m.look) }));
  const pg = [.6, 0, 1.1]; list.push({ role: 'keeper2', P: dejectedPose(ft, pg, -.3), anim: clipe(pl.perdGk, ft - .5, pg, -.3, 'r', 'loser'), kit: gkKit(B), look: keeperLook(B, 'sad') });
  return list;
}
// câmera de transmissão da festa: perto do protagonista → abre para os companheiros chegando → fecha no grupo abraçado → sobe com a torcida ao fundo
const CAM_FESTA = [[0, [1.0, 1.55, 3.6], [0, 1.35, 0], 36], [1.7, [-2.3, 1.85, 5.8], [0, 1.15, -.3], 41], [3.8, [1.7, 1.4, 4.4], [0, 1.25, -.2], 39],
  [6.3, [-1.3, 2.3, 6.2], [0, 1.3, -.6], 42], [9.4, [.6, 4.3, 9.6], [0, 2.3, -3.2], 45]];
function camFesta(game) {
  const P = (game.fin.festa || (game.fin.festa = planoFesta(game))).P, t = game.fin.t; let k = 0; while (k < CAM_FESTA.length - 2 && t > CAM_FESTA[k + 1][0]) k++;
  const [t0, p0, g0, f0] = CAM_FESTA[k], [t1, p1, g1, f1] = CAM_FESTA[k + 1], u = sm(Math.min(1, Math.max(0, (t - t0)/(t1 - t0))));
  const L = (a, b) => a.map((v, i) => v + (b[i] - v)*u), off = (v, d) => [v[0] + d[0], v[1] + d[1], v[2] + d[2]];
  return { pos: off(P, L(p0, p1)), tgt: off(P, L(g0, g1)), fov: f0 + (f1 - f0)*u };
}
export function camTarget(game, b, bw, res, d) {
  if (!game.m && game.vitrine) return game.vitrine.duelo ? dueloCam(game.vitrine.t ?? 0) : vitrineCam(game.vitrine.t ?? 0);
  if (game.fin) return camFesta(game);
  if (b && res && d > 0) { const T = goalToWorld(b.gx, b.gy); return { pos: [T[0]*.3 + 1.2, 2.7, 19.5], tgt: [T[0]*.5, 1.2, 0], fov: 31 }; }                // gol / defesa: aproxima do gol e da torcida
  if (b && b.t > 0) return { pos: [bw[0]*.12, CAM_COB.pos[1] + .2, CAM_COB.pos[2] + .6], tgt: [bw[0]*.5, bw[1]*.5 + .6, Math.min(1, bw[2]*.3)], fov: CAM_COB.fov - 2 };                                  // acompanha a bola
  if (!b && game.t < .9) { const u = sm(game.t/.9); return { pos: lerp([5, 3.9, 27], CAM_COB.pos, u), tgt: CAM_COB.tgt, fov: CAM_COB.fov + 4*(1 - u) }; }                    // apresentação / preparação
  const base = game.dec ? { pos: [CAM_COB.pos[0], CAM_COB.pos[1] - .1, CAM_COB.pos[2] - 1], tgt: CAM_COB.tgt, fov: CAM_COB.fov - 1.5 } : { ...CAM_COB };                                                             // mira estável
  const ks = game.kick; if (!ks || !ks.clip) return base;
  const st = clipStart(ks.clip).root, sx = ks.pe === 'l' ? -st[0] : st[0], u = b ? Math.min(1, Math.max(0, 1 - b.t/(b.t0 ?? ks.t0))) : 0;                              // e volta ao enquadramento normal conforme ele chega à bola
  const kx = sx*(1 - u), kz = SPOT_Z + (st[2] - SPOT_Z)*(1 - u), e = Math.min(1, Math.max(0, (Math.hypot(kx, kz - SPOT_Z) - 4.4)/4.6));
  return e <= 0 ? base : { pos: [0, base.pos[1] + .6*e, base.pos[2] + 4.5*e], tgt: [0, base.tgt[1] + .3*e, base.tgt[2] + 2*e], fov: base.fov + 9*e };   // sempre RETA na bola e no gol; quem parte de longe: só recua e abre
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
  if (game.fin) return { final: true, list: festa(game) };                                          // FIM CONFIRMADO: festa do vencedor, decepção do derrotado
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
  const list = [{ role: 'kicker', P: kickerPose(m), anim, state, kit: p.gk ? gkKit(kt) : { ...kt, sh: kt.c2, variant: uniDe(kt, GS.cobrador) }, look: lk },   // goleiro na vez de bater: com o uniforme de goleiro
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
