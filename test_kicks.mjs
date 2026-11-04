// Cobranças: tipos (chapada/médio/bomba) × estilos (comum, Neymar, Gabigol, Jorginho, Arrascaeta). node test_kicks.mjs
import fs from 'node:fs';
import { KICK_CLIPS } from './js/kickClips.js';
import { ENTRY_S, GOAL_REACTIONS, MISS_REACTIONS, reactionBag, kickSpec, waitSpec, forceFromAim, typeFromForce, FORCE_BANDS, styleOf, footOf, supportedTypes, clipStart, clipEnd, KICK_TYPES, STAR_STYLES } from './js/kicks.js';
import { characters, ballWorld, flightTime, kickerState, chargeOf, widthOf, camTarget } from './js/frame.js';
import { AIM_LIM, AIM_BASE } from './js/aim.js';
import { kickerPose, mirrorPose, goalToWorld, BALL0, BALL_R } from './js/rig.js';
import { PLAYERS, squad } from './js/players.js';
import { GS } from './js/gameState.js'; import { TEAMS } from './js/teams.js'; import { Game } from './js/game.js'; import { Events } from './js/events.js';
const { readModel, readAccessor } = await import('./tools/gltf-io.mjs');
let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FALHOU:', n)); };
const near = (a, b, e = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < e);

// ---- clipes: carregamento, ossos, compatibilidade com o athlete.glb ----
const O = readModel('assets/models/athlete.glb').json, skel = new Set(O.skins[0].joints.map(i => O.nodes[i].name)), rot = j => Object.fromEntries(j.nodes.map(n => [n.name, n.rotation || [0, 0, 0, 1]])), ro = rot(O);
const IDS = Object.keys(KICK_CLIPS);
t('15 clipes: os 5 estilos × chapada/médio/bomba', IDS.length === 15 && ['comum', 'neymar', 'gabigol', 'jorginho', 'arrascaeta'].every(e => ['chapada', 'medio', 'bomba'].every(tp => IDS.includes(`${e}_${tp}`))));
for (const id of IDS) {
  const c = KICK_CLIPS[id], f = 'assets/models/anim/' + c.arquivo; if (!fs.existsSync(f)) { t(`${id}: arquivo ${f}`, false); continue; }
  const C = readModel(f), cj = C.json, A = cj.animations || [], ex = cj.nodes.find(n => n.name === 'Armature').extras || {};
  const tgt = [...new Set(A[0].channels.map(ch => cj.nodes[ch.target.node].name))], rc = rot(cj), dur = Math.max(...A[0].samplers.map(s => readAccessor(C, s.input).flat().pop()));
  t(`${id}: um clipe, 65 ossos do esqueleto original, sem malha/material/pele`, A.length === 1 && tgt.length === 65 && tgt.every(n => skel.has(n)) && !(cj.meshes || []).length && !(cj.materials || []).length && !(cj.skins || []).length);
  t(`${id}: esqueleto de repouso igual ao do athlete.glb (< 0,1°)`, tgt.every(n => Math.acos(Math.min(1, Math.abs(ro[n].reduce((s, v, i) => s + v*rc[n][i], 0))))*360/Math.PI < .1));
  t(`${id}: dados do GLB = manifesto (contato, início, fim, pé)`, ex.chute_id === id && Math.abs(ex.chute_contato_s - c.contato) < 1e-6 && Math.abs(ex.chute_inicio_tc - c.t0) < 1e-6 && ex.chute_fim_tc === c.t1 && ex.chute_pe === c.pe && Math.abs(c.contato + c.t0) < 1e-6 && dur >= c.contato + c.t1 - 1e-3);
  t(`${id}: ponto de toque da chuteira na superfície da bola (±5 mm)`, Math.abs(Math.hypot(ex.chute_toque[0], ex.chute_toque[1] - .11, ex.chute_toque[2]) - .11) < .005);
  t(`${id}: contato pela geometria da chuteira = −1 mm (encosta sem atravessar)`, c.folgaContatoMm <= 0 && c.folgaContatoMm >= -2);
  t(`${id}: pé de apoio não desliza (deriva ≤ 2 mm em todos os apoios)`, c.derivaApoioMm <= 2);
}
// ---- repouso (tools/blender/repouso.py): laço no esqueleto original, destro e canhoto ----
for (const side of ['r', 'l']) { const f = `assets/models/anim/repouso_${side}.glb`, C = readModel(f), cj = C.json, A = cj.animations || [], ex = cj.nodes.find(n => n.name === 'Armature').extras || {};
  const tgt = [...new Set(A[0].channels.map(ch => cj.nodes[ch.target.node].name))], rc = rot(cj), dur = Math.max(...A[0].samplers.map(s_ => readAccessor(C, s_.input).flat().pop()));
  t(`repouso_${side}: um clipe em laço de 4–7 s, 65 ossos do esqueleto original, sem malha`, A.length === 1 && ex.repouso_loop_s >= 4 && ex.repouso_loop_s <= 7 && Math.abs(dur - ex.repouso_loop_s) < .05 && tgt.length === 65 && tgt.every(n => skel.has(n)) && !(cj.meshes || []).length);
  t(`repouso_${side}: esqueleto de repouso igual ao do athlete.glb`, tgt.every(n => Math.acos(Math.min(1, Math.abs(ro[n].reduce((s_, v, i) => s_ + v*rc[n][i], 0))))*360/Math.PI < .1));
  const ch = A[0].channels.find(c => cj.nodes[c.target.node].name === 'pelvis' && c.target.path === 'rotation'), out = readAccessor(C, A[0].samplers[ch.sampler].output);
  t(`repouso_${side}: laço sem emenda (1º quadro = último)`, out[0].every((v, i) => Math.abs(v - out[out.length - 1][i]) < 1e-4)); }
// ---- seleção de estilo pelo ID do elenco (não pelo nome) e do tipo ----
const byId = id => PLAYERS.find(p => p.id === id);
t('quatro craques existem no elenco real', Object.keys(STAR_STYLES).every(byId));
t('estilos por ID', styleOf('santos-neymar-jr') === 'neymar' && styleOf('santos-gabriel-barbosa') === 'gabigol' && styleOf('flamengo-jorginho') === 'jorginho' && styleOf('flamengo-giorgian-de-arrascaeta') === 'arrascaeta');
t('nome igual com outro ID não vira craque (seleção não depende do nome exibido)', styleOf('vasco-neymar') === 'comum' && styleOf('Neymar') === 'comum');
const comum = PLAYERS.find(p => p.posCode !== 'GK' && styleOf(p.id) === 'comum');
for (const tp of ['chapada', 'medio', 'bomba']) { const k = kickSpec(comum.id, tp); t(`jogador comum + ${tp} → comum_${tp}`, k.id === `comum_${tp}` && k.tipo === tp && k.estilo === 'comum' && k.pe === 'r' && k.tf === KICK_TYPES[tp].tf); }
for (const [pid, est] of Object.entries(STAR_STYLES)) {
  for (const tp of ['chapada', 'medio', 'bomba']) { const k = kickSpec(pid, tp); t(`${est} + ${tp} → ${est}_${tp}`, k.id === `${est}_${tp}` && k.tipo === tp); }
  const kb = kickSpec(pid, 'bomba'); t(`${est} + bomba → ${est}_bomba (a força alta vale também para os craques)`, kb.id === `${est}_bomba` && kb.estilo === est);
}
t('pé: Gabigol canhoto (clipe espelhado), demais destros', kickSpec('santos-gabriel-barbosa').pe === 'l' && footOf('santos-gabriel-barbosa') === 'l' && ['santos-neymar-jr', 'flamengo-jorginho', 'flamengo-giorgian-de-arrascaeta'].every(id => kickSpec(id).pe === 'r' && footOf(id) === 'r'));
t('supportedTypes', supportedTypes('comum').length === 3 && supportedTypes('neymar').join() === 'chapada,medio,bomba');
// ---- FORÇA da barra → tipo (uma vez, ao soltar) ----
t('força: soltar no início da barra (clique rápido) = chapada', typeFromForce(forceFromAim(AIM_BASE)) === 'chapada' && forceFromAim(AIM_LIM.ymin) === 0);
t('força: barra cheia = 100% = bomba', forceFromAim(AIM_LIM.ymax) === 1 && typeFromForce(1) === 'bomba' && forceFromAim(AIM_LIM.ymax + 1) === 1);
t('fronteiras sem contradição: 35% = chapada, 35,01% = médio, 70% = médio, 70,01% = bomba', typeFromForce(.35) === 'chapada' && typeFromForce(.3501) === 'medio' && typeFromForce(.70) === 'medio' && typeFromForce(.7001) === 'bomba' && typeFromForce(0) === 'chapada');
t('faixas 0–35 / 35–70 / 70–100%', FORCE_BANDS.chapada === .35 && FORCE_BANDS.medio === .70);
{ const yOf = f => AIM_LIM.ymin + f*(AIM_LIM.ymax - AIM_LIM.ymin); for (const [f, tp] of [[.20, 'chapada'], [.50, 'medio'], [.95, 'bomba'], [.35, 'chapada'], [.70, 'medio'], [1, 'bomba']]) t(`força ${Math.round(f*100)}% → ${tp}`, typeFromForce(forceFromAim(yOf(f))) === tp); }
// ---- rotinas diferentes de verdade ----
const Kc = KICK_CLIPS, dist = c => Math.hypot(...c.inicio.S);
for (const e of ['comum', 'neymar', 'gabigol', 'jorginho', 'arrascaeta']) t(`${e}: os três tipos partem do mesmo ponto e ângulo (o tipo só sai da força)`, ['chapada', 'bomba'].every(tp => near(Kc[`${e}_${tp}`].inicio.S, Kc[`${e}_medio`].inicio.S, 1e-4) && Kc[`${e}_${tp}`].inicio.AP === Kc[`${e}_medio`].inicio.AP));
t('chapada com aproximação mais lenta e controlada; bomba com a corrida mais rápida até o plantio', ['comum', 'neymar', 'arrascaeta'].every(e => { const v = tp => Math.hypot(...Kc[`${e}_${tp}`].inicio.S)/(Kc[`${e}_${tp}`].plantio - Kc[`${e}_${tp}`].t0); return v('chapada') < v('medio') && v('medio') <= v('bomba') + .05; }));
t('Gabigol começa longe (~9 m, ângulo ~25,6°)', dist(Kc.gabigol_medio) > 8.5 && Math.abs(Kc.gabigol_medio.inicio.AP + 25.6) < .01);
t('Neymar: aproximação longa em tempo (passos curtos, desacelerando)', -Kc.neymar_medio.t0 > 3 && -Kc.neymar_medio.t0 > -Kc.comum_medio.t0 + 1.5);
t('velocidade do pé no contato: chapada < médio < bomba', Kc.comum_chapada.velPe < Kc.comum_medio.velPe && Kc.comum_medio.velPe < Kc.comum_bomba.velPe && Kc.comum_bomba.velPe > 24 && Kc.comum_chapada.velPe < 16);
{ const rep = id => JSON.parse(fs.readFileSync(`assets/models/anim/cobranca_${id}.json`, 'utf8')).relatorio;
  const jo = rep('jorginho_medio'), gb = rep('gabigol_medio'), ch = rep('comum_chapada');
  t('Jorginho: pulinho real (pelve sobe ≥ 8 cm, dois pés no ar ≥ 0,15 s)', jo.pulinho.subida_pelve_m >= .08 && jo.pulinho.dois_pes_no_ar_s >= .15);
  t('Gabigol: hesitação perceptível (~0,3 s) sem congelar (pelve ainda anda devagar)', gb.hesitacao.duracao_s >= .25 && gb.hesitacao.vel_media_pelve_m_s > .1 && gb.hesitacao.vel_media_pelve_m_s < .6);
  t('chapada: contato com a parte INTERNA do pé (lado medial da chuteira)', ch.contato.tecnica === 'chapa' && ch.contato.ponto_local_pe[0] > .02);
  t('Gabigol canhoto: contato e apoio conferidos depois do espelho', gb.contato_canhoto.chuteira_bola_mm <= 0 && gb.contato_canhoto.chuteira_bola_mm >= -2 && gb.canhoto_deriva_apoio_plantio_mm <= 2);
  for (const id of IDS) { const r = rep(id); t(`${id}: termina equilibrado (pelve parada sobre a base dos pés)`, r.fim.vel_pelve_ultimo_quadro_m_s < .01 && Math.hypot(...r.fim.pelve_menos_meio_dos_pes_m) < .06 && r.fim.pelve_parada_desde_tc != null); }
}
// ---- bola: instante do contato, direção, velocidade por tipo ----
for (const tp of ['chapada', 'medio', 'bomba']) {
  const k = kickSpec(comum.id, tp), b = { gx: .15, gy: .3, tf: k.tf, curl: k.curl }, K = { x: .5, t0: null };
  t(`${tp}: bola parada até o contato e começa a andar no instante t > 0`, near(ballWorld({ ...b, t: 0 }, K), BALL0) && !near(ballWorld({ ...b, t: .002 }, K), BALL0, 1e-4));
  const T = goalToWorld(b.gx, b.gy); t(`${tp}: chega EXATAMENTE ao ponto mirado no tempo de voo do tipo`, near(ballWorld({ ...b, t: k.tf - 1e-9 }, K), [T[0], Math.max(BALL_R, T[1]), 0], 2e-3));
  const p1 = ballWorld({ ...b, t: .01 }, K), v0 = Math.hypot(p1[0] - BALL0[0], p1[1] - BALL0[1], p1[2] - BALL0[2])/.01;
  const R = { chapada: [13, 17.5], medio: [17.5, 22], bomba: [24, 30] }[tp]; t(`${tp}: velocidade inicial ${v0.toFixed(1)} m/s dentro de [${R}]`, v0 >= R[0] && v0 <= R[1]);
}
{ const K = { x: .5, t0: null }, low = { gx: .2, gy: .05, tf: .62 }; let maxY = 0; for (let tt = .01; tt < .62; tt += .01) maxY = Math.max(maxY, ballWorld({ ...low, t: tt }, K)[1]); t('rasteiro rola (não sobe acima de 25 cm)', maxY < .25);
  const hi = { gx: .8, gy: .9, tf: .46 }, a = ballWorld({ ...hi, t: .2 }, K)[1], b2 = ballWorld({ ...hi, t: .4 }, K)[1]; t('bomba alta sobe até o alvo (trajetória balística coerente)', b2 > a);
  const cr = kickSpec(comum.id, 'chapada'), lft = kickSpec('santos-gabriel-barbosa', 'chapada'); t('efeito da chapada curva para lados opostos no destro e no canhoto', cr.curl > 0 && lft.curl < 0);
  t('tempo de voo: bomba < médio < chapada', KICK_TYPES.bomba.tf < KICK_TYPES.medio.tf && KICK_TYPES.medio.tf < KICK_TYPES.chapada.tf && flightTime({ tf: .46 }) === .46 && flightTime({}) === .7); }
// ---- quadro: transição espera → clipe → reação, para comuns e craques ----
GS.equipes = [TEAMS.find(x => x.key === 'santos'), TEAMS.find(x => x.key === 'flamengo')]; GS.cobranca = 1; GS.cobrador = 0;
const K = { x: .5, tx: .8, th: .85, t0: 0 };
for (const pid of ['santos-neymar-jr', 'santos-gabriel-barbosa', squad(GS.equipes[0]).find(p => styleOf(p.id) === 'comum' && p.posCode !== 'GK').id]) {
  for (const tp of ['chapada', 'medio']) {
    const ks = kickSpec(pid, tp), game = { m: {}, fin: null, t: 4, escolha: [pid, null], hum: () => true, kick: ks }, idle = characters(game, 5, null, K, undefined, 0, BALL0).list[0], wd = widthOf(idle.look);
    const st = clipStart(ks.clip, wd), en = clipEnd(ks.clip, wd), mir = ks.pe === 'l';
    t(`${ks.id}: largura do atleta (${wd.toFixed(3)}) usada no ponto de partida`, Math.abs(Math.hypot(st.root[0], st.root[2] - 11) - wd*Math.hypot(...ks.clip.inicio.S)) < .03);
    const exp = kickerPose({ mode: 'idle', t: 5, start: st, end: en, mirror: mir });
    t(`${ks.id}: espera (clipe de repouso) no ponto de partida${mir ? ' (espelhado)' : ''}`, JSON.stringify(idle.P) === JSON.stringify(exp) && idle.anim?.idle && idle.state === 'idle' && Math.abs(idle.anim.pos[0] - (mir ? -st.root[0] : st.root[0])) < 1e-9 && idle.anim.pe === ks.pe && idle.anim.ready.w === 0);
    const b0 = { gx: .3, gy: .3, t: ks.t0, t0: ks.t0, tf: ks.tf, res: null }, a0 = characters(game, 5, b0, K, undefined, 0, BALL0).list[0].anim;
    t(`${ks.id}: ao chutar, toca o clipe certo desde o primeiro quadro`, a0 && a0.clip === ks.id && a0.tc === ks.t0);
    const bc = { ...b0, t: 0 }; t(`${ks.id}: contato (tc = 0) com a bola ainda na marca`, characters(game, 5, bc, K, undefined, 0, BALL0).list[0].anim.tc === 0 && near(ballWorld(bc, K), BALL0));
    const be = { ...b0, t: ks.t1 + .05, res: 'gol', reacao: 'gol_salto' }, after = characters(game, 5, be, K, 'gol', be.t - ks.tf, BALL0).list[0];
    const expR = kickerPose({ mode: 'react', d: be.t - ks.tf, type: 'gol', start: st, end: en, mirror: mir });
    t(`${ks.id}: depois do clipe, comemoração (gol) no ponto onde o clipe termina`, after.state === 'goalCelebration' && after.anim?.clip === 'gol_salto' && Math.abs(after.anim.pos[2] - en.root[2]) < 1e-9 && Math.abs(after.anim.pos[0] - (mir ? -en.root[0] : en.root[0])) < 1e-9 && JSON.stringify(after.P) === JSON.stringify(expR));
    const miss = characters(game, 5, { ...be, res: 'defesa', reacao: 'perdeu_mao_rosto' }, K, 'defesa', be.t - ks.tf, BALL0).list[0]; t(`${ks.id}: defesa → reação de frustração (não a comemoração)`, miss.state === 'missReaction' && miss.anim?.clip === 'perdeu_mao_rosto');
  }
}
{ const P = kickerPose({ mode: 'react', d: .2, type: 'gol' }), M = mirrorPose(JSON.parse(JSON.stringify(P))); t('espelho troca lados e reflete x', M.root[0] === -P.root[0] && JSON.stringify(M.hipL) === JSON.stringify(P.hipR) && M.ikL.t[0] === -P.ikR.t[0] && M.yaw === -P.yaw); }
// ---- partidas completas: comum ×3 tipos e cada craque, com goleiro, defesas, resultado, comemoração e lamento ----
const ev = []; Events.on('*', e => ev.push(e));
const HOLD = { chapada: .2, medio: .72, bomba: 1.22 };                // segurar a barra este tempo (s) → força ~20%, ~50%, ~78%
function partida(teamKey, starId, tipo) {
  const A = TEAMS.find(x => x.key === teamKey), B = TEAMS.find(x => x.key !== teamKey); let end = null, kicks = [];
  Game.start(A, B, w => end = w, false, [starId, null]);
  for (let g = 0; g < 12000 && end === null; g++) {   // folga para morte súbita longa
    if (GS.estado === 'AGUARDANDO_COBRANCA' && Game.t >= .9) { Game.down(null); const n = Math.round(HOLD[tipo]/.01); for (let i = 0; i < n; i++) Game.update(.01); Game.up(); if (Game.ball) kicks.push({ ...Game.kick, tf: Game.ball.tf, t0: Game.ball.t0, forca: Game.ball.forca }); }
    if (GS.estado === 'DEFESA_DO_GOLEIRO' && Game.ball) Game.keeperChoose(.5);
    Game.update(.05);
  }
  return { end, kicks };
}
for (const [team, star, tipos] of [['vasco', null, ['chapada', 'medio', 'bomba']], ['santos', 'santos-neymar-jr', ['chapada', 'medio', 'bomba']], ['santos', 'santos-gabriel-barbosa', ['chapada', 'medio', 'bomba']], ['flamengo', 'flamengo-jorginho', ['chapada', 'medio', 'bomba']], ['flamengo', 'flamengo-giorgian-de-arrascaeta', ['chapada', 'medio', 'bomba']]]) {
  for (const tp of tipos) {
    ev.length = 0; const r = partida(team, star, tp), mine = r.kicks;
    const est = star ? STAR_STYLES[star] : 'comum', res = ev.filter(e => ['gol', 'defesa', 'fora', 'trave'].includes(e.tipo)).length;
    t(`${est} + ${tp}: partida completa (resultado único por cobrança, encerramento)`, r.end !== null && res === GS.cobrancasRealizadas && ev.filter(e => e.tipo === 'partida_encerrada').length === 1);
    t(`${est} + ${tp}: força da barra (${tp}) → clipe ${est}_${tp} e tempo de voo do tipo`, mine.length > 0 && mine.every(k => k.tipo === tp && k.tf === KICK_TYPES[tp].tf && typeFromForce(k.forca) === tp && (!star || k.id === `${est}_${tp}`)));
    t(`${est} + ${tp}: evento "chute" informa tipo e estilo`, ev.some(e => e.tipo === 'chute' && e.tipoCobranca === tp && e.estilo === (star ? est : 'comum')));
  }
}
// goleiro e defesa com tempos de voo diferentes: com o mesmo tempo de reação, a bomba deixa o goleiro mais longe
{ GS.equipes = [TEAMS[0], TEAMS[1]]; Game.start(TEAMS[0], TEAMS[1], () => {}); const mk = (tf) => { Game.keeper = { x: .5, tx: .2, th: .3, t0: .3 }; Game.ball = { gx: .2, gy: .3, t: tf, tf, res: null, som: true }; Game.resolve(); return Game.ball.res; };
  t('goleiro alcança a chapada no canto que escolheu', mk(.8) === 'defesa'); Game.start(TEAMS[0], TEAMS[1], () => {}); t('mesmo canto com bomba: goleiro não chega', mk(.46) === 'gol'); }
// comemoração e lamento no fim da disputa
{ let r = null; Game.start(TEAMS[0], TEAMS[1], w => r = w); let n = 0; while (!Game.fin && n++ < 80) { Game.keeper.t0 = null; Game.ball = { gx: GS.cobrador === 0 ? .85 : -.2, gy: .5, t: .7, tf: .7, res: null, som: true }; Game.resolve(); Game.wait = 0; Game.next(); }
  const fr = characters(Game, 5, null, Game.keeper, undefined, 0, BALL0); t('fim: comemoração (mates) e lamento (loser)', Game.fin && fr.final && fr.list.some(c => c.role === 'mate') && fr.list.some(c => c.role === 'loser')); }
// máquina de estados e decisão ÚNICA do tipo: walkin → idle → charging → runUp → kick → followThrough → recovery → react
{ Game.start(TEAMS.find(x => x.key === 'vasco'), TEAMS[0], () => {}); const seen = [], st = () => kickerState(Game, Game.ball), push = () => { const s_ = st(); if (seen[seen.length - 1] !== s_) seen.push(s_); };
  push(); for (let i = 0; i < 32; i++) { Game.update(.1); push(); }   // entrada (caminhada) de ENTRY_S s
  t('sem botões de tipo: Game.setTipo, tipoSel e kmove não existem mais', typeof Game.setTipo === 'undefined' && !('tipoSel' in Game) && !('kmove' in Game));
  t('antes de soltar, a espera usa o ponto de partida do estilo (médio como referência)', Game.kick.tipo === 'medio');
  Game.down(null); for (let i = 0; i < 10; i++) { Game.update(.05); push(); } const w = chargeOf(Game);
  t('segurando a barra: estado "charging" e o repouso vai para a pose de partida', st() === 'charging' && w > .99);
  Game.up(); const k0 = Game.kick.id, f0 = Game.ball.forca; t('soltar com ~37% de força → médio, decidido no instante em que solta', Game.ball.tipo === 'medio' && Game.kick.tipo === 'medio' && f0 > .35 && f0 <= .70);
  let changed = false; while (Game.ball && !Game.ball.res) { Game.update(.02); push(); if (Game.kick.id !== k0 || Game.ball.forca !== f0) changed = true; }
  for (let i = 0; i < 40; i++) { Game.update(.02); push(); }
  t('o tipo não muda depois que a cobrança começou', !changed);
  t(`sequência de estados completa e em ordem (${seen.join(' → ')})`, ['entering', 'idle', 'charging', 'runUp', 'kick', 'followThrough', 'recovery', Game.ball?.res === 'gol' || seen.includes('goalCelebration') ? 'goalCelebration' : 'missReaction'].every((x, i, arr) => seen.indexOf(x) >= 0 && (i === 0 || seen.indexOf(x) > seen.indexOf(arr[i - 1]))));
}
// as três forças pedidas: 20%, 50% e 95% → três clipes diferentes e velocidades de bola coerentes
{ const yOf = f => AIM_LIM.ymin + f*(AIM_LIM.ymax - AIM_LIM.ymin), K0 = { x: .5, t0: null }, out = {};
  for (const f of [.20, .50, .95]) { Game.start(TEAMS.find(x => x.key === 'vasco'), TEAMS[0], () => {}); Game.update(1); Game.launch(.3, yOf(f)); const b = Game.ball, p1 = ballWorld({ ...b, t: .01 }, K0);
    out[f] = { id: Game.kick.id, v0: Math.hypot(p1[0], p1[1] - BALL_R, p1[2] - 11)/.01, tf: b.tf, velPe: Game.kick.clip.velPe }; }
  t('20% / 50% / 95% → comum_chapada / comum_medio / comum_bomba', out[.2].id === 'comum_chapada' && out[.5].id === 'comum_medio' && out[.95].id === 'comum_bomba');
  t(`velocidade da bola cresce com a força: ${out[.2].v0.toFixed(1)} < ${out[.5].v0.toFixed(1)} < ${out[.95].v0.toFixed(1)} m/s`, out[.2].v0 < out[.5].v0 && out[.5].v0 < out[.95].v0);
  t('e a perna também: velocidade do pé no contato cresce com a força', out[.2].velPe < out[.5].velPe && out[.5].velPe < out[.95].velPe); }
// câmera: cobrador que parte de longe continua no quadro durante a espera; quem parte perto mantém o enquadramento padrão
{ const { camTarget } = await import('./js/frame.js'); const vis = (cam, p) => { const dx = p[0] - cam.pos[0], dz = cam.pos[2] - p[2], half = Math.atan(Math.tan(cam.fov*Math.PI/360)*16/9); return dz > 0 && Math.abs(Math.atan2(dx, dz)) < half*.95; };
  for (const pid of ['santos-gabriel-barbosa', 'santos-neymar-jr', comum.id]) { const ks = kickSpec(pid, 'medio'), st = clipStart(ks.clip).root, kx = ks.pe === 'l' ? -st[0] : st[0], cam = camTarget({ kick: ks, t: 3, dec: false }, null, BALL0, undefined, 0);
    t(`câmera na espera mostra ${ks.id} (partida a ${Math.hypot(st[0], st[2] - 11).toFixed(1)} m)`, vis(cam, [kx, 0, st[2]])); }
  const base = camTarget({ kick: kickSpec(comum.id, 'medio'), t: 3, dec: false }, null, BALL0, undefined, 0); t('chute médio comum: enquadramento padrão inalterado', base.fov === 27 && base.pos[2] === 25); }
// regressão (vídeo do usuário, 03/11): ao segurar a barra o cobrador "pulava" para a bola. Causa: o PropertyMixer do three só escreve quando o valor
// muda em relação à avaliação anterior DAQUELE mixer; com dois mixers no mesmo osso, reavaliar um clipe no mesmo instante não reescrevia a pose.
{ const THREE = await import('./vendor/three/three.module.js'), { forceWrite } = await import('./js/three/mixerUtil.js');
  const run = fix => { const o = new THREE.Object3D(); o.name = 'pelvis'; const root = new THREE.Object3D(); root.add(o);
    const clip = (n, x) => new THREE.AnimationClip(n, 1, [new THREE.VectorKeyframeTrack('pelvis.position', [0, 1], [x, 0, 0, x, 0, 0])]);
    const mk = c => { const m = new THREE.AnimationMixer(root); m.clipAction(c).play(); return m; }, A = mk(clip('chute', 2)), B = mk(clip('repouso', 0));
    const ev = (m, t) => { if (fix) forceWrite(m); m.setTime(t); };
    const out = []; for (const m of [A, B, A, B]) { ev(m, 0); out.push(o.position.x); } return out.join(','); };
  t('sem a correção um mixer deixa de escrever e o osso fica com a pose do outro clipe (o bug existia)', run(false) !== '2,0,2,0');
  t('com forceWrite cada clipe avaliado escreve sempre a sua pose', run(true) === '2,0,2,0'); }
// ---- entrada, comemoração e frustração (tools/blender/reacoes.py) ----
for (const [n, dur] of [['entrada', ENTRY_S], ...Object.entries(GOAL_REACTIONS), ...Object.entries(MISS_REACTIONS)]) for (const side of ['r', 'l']) {
  const C = readModel(`assets/models/anim/${n}_${side}.glb`), cj = C.json, A = cj.animations || [], ex = cj.nodes.find(n_ => n_.name === 'Armature').extras || {};
  const tgt = [...new Set(A[0].channels.map(ch => cj.nodes[ch.target.node].name))], d = Math.max(...A[0].samplers.map(s_ => readAccessor(C, s_.input).flat().pop()));
  t(`${n}_${side}: um clipe de ${dur} s (= constante do jogo), 65 ossos do esqueleto original, sem malha`, A.length === 1 && Math.abs(d - dur) < .02 && ex.clipe_duracao_s === dur && ex.clipe_pe === side && tgt.length === 65 && tgt.every(n_ => skel.has(n_)) && !(cj.meshes || []).length); }
{ GS.equipes = [TEAMS.find(x => x.key === 'vasco'), TEAMS[0]]; GS.cobrador = 0; GS.cobranca = 1;
  const ks = kickSpec(comum.id, 'medio'), g = { m: {}, fin: null, escolha: [null, null], hum: () => true, kick: ks, t: 1 }, st = s_ => characters(g, 5, s_, K, s_?.res, 0, BALL0).list[0];
  t('início da vez: entrada pelo clipe (corte, sem misturar com a pose anterior)', st(null).state === 'entering' && st(null).anim?.clip === 'entrada' && st(null).anim.blend === 0);
  g.t = ENTRY_S + .1; t('depois da entrada: repouso', st(null).state === 'idle');
  const b = { gx: .3, gy: .3, t: ks.t1 + .5, t0: ks.t0, tf: ks.tf };
  t('reação só depois do resultado: sem resultado, continua em "recovery"', st({ ...b, res: null }).state === 'recovery');
  const tipos = ['gol', 'defesa', 'fora', 'trave'].map(r => st({ ...b, res: r }).state); t('gol → comemoração; defesa, fora e trave → frustração', tipos.join() === 'goalCelebration,missReaction,missReaction,missReaction');
  const seq = [.1, .5, 1, 2, 3].map(dt => st({ ...b, t: ks.t1 + dt, res: 'gol' }).state); t('comemorando, nunca volta à caminhada nem troca de reação', seq.every(x => x === 'goalCelebration'));
  t('tempo do clipe de reação começa no fim da cobrança', st({ ...b, t: ks.t1 + .8, res: 'gol' }).anim.t === .8 || Math.abs(st({ ...b, t: ks.t1 + .8, res: 'gol' }).anim.t - .8) < 1e-9); }
// ---- MÃOS em TODOS os clipes do Blender: torção do antebraço em relação ao braço e da mão em relação ao antebraço (em torno do eixo do osso filho) ----
// rel = Lc·Lc0⁻¹ no referencial de repouso do pai; eixo = direção do filho nesse referencial. Sem ossos de torção no modelo, torção alta = punho "papel de bala".
{ const qm = (a, b) => [a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1], a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0], a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3], a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]];
  const qc = q => [-q[0], -q[1], -q[2], q[3]], qv = (q, v) => qm(qm(q, [...v, 0]), qc(q)).slice(0, 3), node = n => O.nodes.find(x => x.name === n);
  const PAIRS = ['l', 'r'].flatMap(s => [[`lowerarm_${s}`], [`hand_${s}`]]);   // osso filho (o pai é o anterior da cadeia)
  const AX = Object.fromEntries(PAIRS.map(([c]) => [c, qv(node(c).rotation || [0, 0, 0, 1], [0, 1, 0])]));   // eixo do osso (+Y local) no referencial do pai
  const files = fs.readdirSync('assets/models/anim').filter(f => /^(cobranca_|repouso_|entrada_|gol_|perdeu_)[a-z_]+\.glb$/.test(f) && !/^(gol|perdeu)_[rl]\.glb$/.test(f)); let worst = 0, wn = '', worstP = 0, wnP = ''; const PALMA = /^(perdeu_maos_cabeca|perdeu_mao_rosto|perdeu_maos_cintura|perdeu_olha_chao|gol_aponta)_/;   // gestos com a palma virada (pronação dividida cotovelo/punho)
  for (const f of files) { const C = readModel('assets/models/anim/' + f), cj = C.json, A = cj.animations[0];
    for (const [c] of PAIRS) { const ch = A.channels.find(x => x.target.path === 'rotation' && cj.nodes[x.target.node].name === c); if (!ch) continue; const L0 = node(c).rotation || [0, 0, 0, 1];
      for (const q of readAccessor(C, A.samplers[ch.sampler].output)) { const r = qm(q, qc(L0)), p = r[0]*AX[c][0] + r[1]*AX[c][1] + r[2]*AX[c][2]; let g = Math.abs(2*Math.atan2(p, r[3])*180/Math.PI); g = g > 180 ? 360 - g : g;
        if (PALMA.test(f)) { if (g > worstP) { worstP = g; wnP = `${f} ${c}`; } } else if (g > worst) { worst = g; wn = `${f} ${c}`; } } } }
  t(`mãos: ${files.length} clipes (15 cobranças, repouso, entrada, 10 reações × destro/canhoto); sem gesto de palma, torção do antebraço e do punho ≤ 2° (pior ${worst.toFixed(2)}° — ${wn})`, files.length >= 39 && worst <= 2);
  t(`mãos: gestos com a palma virada (cabeça, rosto, cintura, peito, joelhos): pronação dividida, ≤ 48° por articulação (pior ${worstP.toFixed(1)}° — ${wnP}; antes da correção: 159°)`, worstP > 5 && worstP <= 48); }
// ---- 5 comemorações e 5 frustrações: sacola sem repetição imediata, sorteio UMA vez por cobrança ----
t('pelo menos 5 comemorações e 5 reações de frustração, todas distintas', Object.keys(GOAL_REACTIONS).length >= 5 && Object.keys(MISS_REACTIONS).length >= 5 && new Set([...Object.keys(GOAL_REACTIONS), ...Object.keys(MISS_REACTIONS)]).size === 10);
for (const [nm, tab] of [['gol', GOAL_REACTIONS], ['frustração', MISS_REACTIONS]]) { let seed = 7; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647, bag = reactionBag(Object.keys(tab), rnd), seq = Array.from({ length: 200 }, bag);
  const rep = seq.some((x, i) => i && x === seq[i - 1]), full = [0, 5, 10, 195].every(k => new Set(seq.slice(k, k + 5)).size === 5 || k % 5), cnt = Object.keys(tab).map(k => seq.filter(x => x === k).length);
  t(`sacola de ${nm}: 200 sorteios sem repetição imediata`, !rep); t(`sacola de ${nm}: cada bloco de 5 usa as 5 reações (uniforme: ${cnt.join('/')})`, full && cnt.every(c => c === 40)); }
{ let end = null; Game.start(TEAMS.find(x => x.key === 'vasco'), TEAMS[0], w => end = w); const vistos = { gol: [], perdeu: [] }; let troca = 0, sem = 0;
  for (let g = 0; g < 20000 && end === null; g++) { if (GS.estado === 'AGUARDANDO_COBRANCA' && Game.t >= ENTRY_S) { Game.down(null); for (let i = 0; i < 50; i++) Game.update(.01); Game.up(); }
    if (GS.estado === 'DEFESA_DO_GOLEIRO' && Game.ball) Game.keeperChoose(Math.random());
    const b = Game.ball; if (b && b.res) { if (!b.reacao) sem++; else if (b._r0 && b._r0 !== b.reacao) troca++; if (!b._r0 && b.reacao) { b._r0 = b.reacao; vistos[b.res === 'gol' ? 'gol' : 'perdeu'].push(b.reacao); }
      const st = kickerState(Game, b), a = characters(Game, 5, b, K, b.res, 0, BALL0)?.list?.[0]?.anim; if ((st === 'goalCelebration' || st === 'missReaction') && a && a.clip !== b.reacao) troca++; }
    Game.update(.05); }
  const ok_ = (v, tab) => v.every(x => x in tab) && v.every((x, i) => !i || x !== v[i - 1]);
  t(`partida: cada cobrança recebeu UMA reação, nunca trocada (${vistos.gol.length} gols, ${vistos.perdeu.length} perdidas)`, end !== null && sem === 0 && troca === 0);
  t(`partida: reações do tipo certo e sem repetição imediata (gol: ${vistos.gol.join(', ')} | perdeu: ${vistos.perdeu.join(', ')})`, ok_(vistos.gol, GOAL_REACTIONS) && ok_(vistos.perdeu, MISS_REACTIONS)); }
// ---- goleiro: comemora a defesa/erro ou lamenta o gol; nenhum outro jogador entra em cena durante a disputa ----
{ GS.equipes = [TEAMS.find(x => x.key === 'vasco'), TEAMS[0]]; GS.cobrador = 0; GS.cobranca = 2; GS.cobrancasRealizadas = 3;
  const ks = kickSpec(comum.id, 'medio'), g = { m: {}, fin: null, escolha: [null, null], hum: () => true, kick: ks, t: 6 }, KP = { x: .5, tx: .2, th: .4, t0: 0 };
  const fr = (res, d) => { const b = { gx: .2, gy: .3, t: ks.tf + d, t0: ks.t0, tf: ks.tf, res, reacao: res === 'gol' ? 'gol_salto' : 'perdeu_maos_cabeca' }; return characters(g, 5, b, KP, res, d, BALL0); };
  for (const res of ['gol', 'defesa', 'fora', 'trave']) {
    const kp = fr(res, 2.0).list.find(c => c.role === 'keeper');
    t(`${res}: goleiro ${res === 'gol' ? 'lamenta' : 'comemora'} depois de levantar`, kp.anim && (res === 'gol' ? kp.anim.clip in MISS_REACTIONS : kp.anim.clip in GOAL_REACTIONS) && !fr(res, 1.0).list.find(c => c.role === 'keeper').anim);
    t(`${res}: só cobrador e goleiro em cena (sem jogadores no meio de campo)`, [1, 2, 3, 3.9].every(d => fr(res, d).list.length === 2));
    const cam = camTarget(g, { gx: .2, gy: .3, t: ks.tf + 3, tf: ks.tf, res }, BALL0, res, 3); t(`${res}: a câmera continua no gol (sem corte para o meio de campo)`, !cam.cut && cam.tgt[2] < 2); } }
// repetição: várias cobranças seguidas, a vez seguinte sempre recomeça pela entrada e o jogo segue
{ let end = null; Game.start(TEAMS.find(x => x.key === 'vasco'), TEAMS[0], w => end = w); const st = () => kickerState(Game, Game.ball); let turns = 0, entr = 0, both = 0, last = null;
  for (let g = 0; g < 9000 && end === null; g++) { if (GS.estado === 'AGUARDANDO_COBRANCA' && Game.t >= ENTRY_S) { Game.down(null); for (let i = 0; i < 50; i++) Game.update(.01); Game.up(); turns++; }
    if (GS.estado === 'DEFESA_DO_GOLEIRO' && Game.ball) Game.keeperChoose(.5); const s_ = st(); if (s_ === 'entering' && last !== 'entering') entr++; if (Game.ball && Game.ball.res && s_ === 'goalCelebration' && Game.ball.res !== 'gol') both++; last = s_; Game.update(.05); }
  t(`repetição: partida inteira (${turns} cobranças do jogador), cada vez começa pela entrada, sem reação trocada`, end !== null && entr >= turns && both === 0); }
console.log(`KICKS OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
