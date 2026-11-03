// Cobranças: tipos (chapada/médio/bomba) × estilos (comum, Neymar, Gabigol, Jorginho, Arrascaeta). node test_kicks.mjs
import fs from 'node:fs';
import { KICK_CLIPS } from './js/kickClips.js';
import { kickSpec, cpuType, styleOf, footOf, supportedTypes, clipStart, clipEnd, KICK_TYPES, STAR_STYLES } from './js/kicks.js';
import { characters, ballWorld, flightTime } from './js/frame.js';
import { kickerPose, mirrorPose, goalToWorld, BALL0, BALL_R } from './js/rig.js';
import { PLAYERS, squad } from './js/players.js';
import { GS } from './js/gameState.js'; import { TEAMS } from './js/teams.js'; import { Game } from './js/game.js'; import { Events } from './js/events.js';
const { readModel, readAccessor } = await import('./tools/gltf-io.mjs');
let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FALHOU:', n)); };
const near = (a, b, e = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < e);

// ---- clipes: carregamento, ossos, compatibilidade com o athlete.glb ----
const O = readModel('assets/models/athlete.glb').json, skel = new Set(O.skins[0].joints.map(i => O.nodes[i].name)), rot = j => Object.fromEntries(j.nodes.map(n => [n.name, n.rotation || [0, 0, 0, 1]])), ro = rot(O);
const IDS = Object.keys(KICK_CLIPS);
t('11 clipes (comum ×3, cada craque ×2)', IDS.length === 11 && ['comum_chapada', 'comum_medio', 'comum_bomba'].every(i => IDS.includes(i)) && ['neymar', 'gabigol', 'jorginho', 'arrascaeta'].every(e => ['chapada', 'medio'].every(tp => IDS.includes(`${e}_${tp}`))));
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
// ---- seleção de estilo pelo ID do elenco (não pelo nome) e do tipo ----
const byId = id => PLAYERS.find(p => p.id === id);
t('quatro craques existem no elenco real', Object.keys(STAR_STYLES).every(byId));
t('estilos por ID', styleOf('santos-neymar-jr') === 'neymar' && styleOf('santos-gabriel-barbosa') === 'gabigol' && styleOf('flamengo-jorginho') === 'jorginho' && styleOf('flamengo-giorgian-de-arrascaeta') === 'arrascaeta');
t('nome igual com outro ID não vira craque (seleção não depende do nome exibido)', styleOf('vasco-neymar') === 'comum' && styleOf('Neymar') === 'comum');
const comum = PLAYERS.find(p => p.posCode !== 'GK' && styleOf(p.id) === 'comum');
for (const tp of ['chapada', 'medio', 'bomba']) { const k = kickSpec(comum.id, tp); t(`jogador comum + ${tp} → comum_${tp}`, k.id === `comum_${tp}` && k.tipo === tp && k.estilo === 'comum' && k.pe === 'r' && k.tf === KICK_TYPES[tp].tf); }
for (const [pid, est] of Object.entries(STAR_STYLES)) {
  for (const tp of ['chapada', 'medio']) { const k = kickSpec(pid, tp); t(`${est} + ${tp} → ${est}_${tp}`, k.id === `${est}_${tp}` && k.tipo === tp); }
  const kb = kickSpec(pid, 'bomba'); t(`${est} + bomba (não suportada) → médio do próprio estilo, sem virar comum`, kb.id === `${est}_medio` && kb.pedido === 'bomba' && kb.estilo === est);
}
t('pé: Gabigol canhoto (clipe espelhado), demais destros', kickSpec('santos-gabriel-barbosa').pe === 'l' && footOf('santos-gabriel-barbosa') === 'l' && ['santos-neymar-jr', 'flamengo-jorginho', 'flamengo-giorgian-de-arrascaeta'].every(id => kickSpec(id).pe === 'r' && footOf(id) === 'r'));
t('supportedTypes', supportedTypes('comum').length === 3 && supportedTypes('neymar').join() === 'chapada,medio');
{ let i = 0; const seq = [.1, .5, .95, .1, .9]; const r = () => seq[i++ % seq.length]; t('CPU sorteia tipos suportados conforme o estilo', ['chapada', 'medio', 'bomba'].includes(cpuType(comum.id, r)) && ['chapada', 'medio'].includes(cpuType('santos-neymar-jr', () => .99))); }
// ---- rotinas diferentes de verdade ----
const Kc = KICK_CLIPS, dist = c => Math.hypot(...c.inicio.S);
t('chapada: aproximação mais curta que o médio; bomba: mais longa', dist(Kc.comum_chapada) < dist(Kc.comum_medio) && dist(Kc.comum_bomba) > dist(Kc.comum_medio) + 2);
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
    const ks = kickSpec(pid, tp), game = { m: {}, fin: null, t: 2, escolha: [pid, null], hum: () => true, kick: ks }, st = clipStart(ks.clip), en = clipEnd(ks.clip), mir = ks.pe === 'l';
    const idle = characters(game, 5, null, K, undefined, 0, BALL0).list[0], exp = kickerPose({ mode: 'idle', t: 5, start: st, end: en, mirror: mir });
    t(`${ks.id}: espera no ponto de partida do clipe${mir ? ' (espelhado)' : ''}`, JSON.stringify(idle.P) === JSON.stringify(exp) && Math.abs(idle.P.root[0] - (mir ? -st.root[0] : st.root[0])) < .05 && !idle.anim);
    const b0 = { gx: .3, gy: .3, t: ks.t0, t0: ks.t0, tf: ks.tf, res: null }, a0 = characters(game, 5, b0, K, undefined, 0, BALL0).list[0].anim;
    t(`${ks.id}: ao chutar, toca o clipe certo desde o primeiro quadro`, a0 && a0.clip === ks.id && a0.tc === ks.t0);
    const bc = { ...b0, t: 0 }; t(`${ks.id}: contato (tc = 0) com a bola ainda na marca`, characters(game, 5, bc, K, undefined, 0, BALL0).list[0].anim.tc === 0 && near(ballWorld(bc, K), BALL0));
    const be = { ...b0, t: ks.t1 + .05, res: 'gol' }, after = characters(game, 5, be, K, 'gol', be.t - ks.tf, BALL0).list[0];
    const expR = kickerPose({ mode: 'react', d: be.t - ks.tf, type: 'gol', start: st, end: en, mirror: mir });
    t(`${ks.id}: depois do clipe, pose de reação onde o clipe termina`, !after.anim && JSON.stringify(after.P) === JSON.stringify(expR) && Math.abs(after.P.root[2] - en.root[2]) < 1e-9);
  }
}
{ const P = kickerPose({ mode: 'react', d: .2, type: 'gol' }), M = mirrorPose(JSON.parse(JSON.stringify(P))); t('espelho troca lados e reflete x', M.root[0] === -P.root[0] && JSON.stringify(M.hipL) === JSON.stringify(P.hipR) && M.ikL.t[0] === -P.ikR.t[0] && M.yaw === -P.yaw); }
// ---- partidas completas: comum ×3 tipos e cada craque, com goleiro, defesas, resultado, comemoração e lamento ----
const ev = []; Events.on('*', e => ev.push(e));
function partida(teamKey, starId, tipo) {
  const A = TEAMS.find(x => x.key === teamKey), B = TEAMS.find(x => x.key !== teamKey); let end = null, kicks = [];
  Game.tipoSel = [tipo, tipo]; Game.start(A, B, w => end = w, false, [starId, null]);
  for (let g = 0; g < 4000 && end === null; g++) {
    if (GS.estado === 'AGUARDANDO_COBRANCA' && !Game.kmove) { Game.aim.start(); GS.estado = 'MIRANDO'; for (let i = 0; i < 20; i++) Game.update(.016); Game.up(); if (Game.ball) kicks.push({ ...Game.kick, tf: Game.ball.tf, t0: Game.ball.t0 }); }
    if (GS.estado === 'DEFESA_DO_GOLEIRO' && Game.ball) Game.keeperChoose(.5);
    Game.update(.05);
  }
  return { end, kicks };
}
for (const [team, star, tipos] of [['vasco', null, ['chapada', 'medio', 'bomba']], ['santos', 'santos-neymar-jr', ['chapada', 'medio']], ['santos', 'santos-gabriel-barbosa', ['chapada', 'medio']], ['flamengo', 'flamengo-jorginho', ['chapada', 'medio']], ['flamengo', 'flamengo-giorgian-de-arrascaeta', ['chapada', 'medio']]]) {
  for (const tp of tipos) {
    ev.length = 0; const r = partida(team, star, tp), mine = r.kicks.filter(k => k.pedido === tp);
    const est = star ? STAR_STYLES[star] : 'comum', res = ev.filter(e => ['gol', 'defesa', 'fora', 'trave'].includes(e.tipo)).length;
    t(`${est} + ${tp}: partida completa (resultado único por cobrança, encerramento)`, r.end !== null && res === GS.cobrancasRealizadas && ev.filter(e => e.tipo === 'partida_encerrada').length === 1);
    t(`${est} + ${tp}: cobranças do jogador usam ${est}_${tp} com tempo de voo do tipo`, mine.length > 0 && mine.every(k => (k.estilo === est || !star) && k.tipo === tp && k.tf === KICK_TYPES[tp].tf) && (!star || mine.some(k => k.id === `${est}_${tp}`)));
    t(`${est} + ${tp}: evento "chute" informa tipo e estilo`, ev.some(e => e.tipo === 'chute' && e.tipoCobranca === tp && e.estilo === (star ? est : 'comum')));
  }
}
// goleiro e defesa com tempos de voo diferentes: com o mesmo tempo de reação, a bomba deixa o goleiro mais longe
{ GS.equipes = [TEAMS[0], TEAMS[1]]; Game.start(TEAMS[0], TEAMS[1], () => {}); const mk = (tf) => { Game.keeper = { x: .5, tx: .2, th: .3, t0: .3 }; Game.ball = { gx: .2, gy: .3, t: tf, tf, res: null, som: true }; Game.resolve(); return Game.ball.res; };
  t('goleiro alcança a chapada no canto que escolheu', mk(.8) === 'defesa'); Game.start(TEAMS[0], TEAMS[1], () => {}); t('mesmo canto com bomba: goleiro não chega', mk(.46) === 'gol'); }
// comemoração e lamento no fim da disputa
{ let r = null; Game.start(TEAMS[0], TEAMS[1], w => r = w); let n = 0; while (!Game.fin && n++ < 80) { Game.keeper.t0 = null; Game.ball = { gx: GS.cobrador === 0 ? .85 : -.2, gy: .5, t: .7, tf: .7, res: null, som: true }; Game.resolve(); Game.wait = 0; Game.next(); }
  const fr = characters(Game, 5, null, Game.keeper, undefined, 0, BALL0); t('fim: comemoração (mates) e lamento (loser)', Game.fin && fr.final && fr.list.some(c => c.role === 'mate') && fr.list.some(c => c.role === 'loser')); }
// troca de tipo antes de mirar: caminha até o novo ponto (não teleporta) e não deixa mirar durante a caminhada
{ Game.tipoSel = ['medio', 'medio']; Game.start(TEAMS.find(x => x.key === 'vasco'), TEAMS[0], () => {}); Game.update(1.2); const a = clipStart(Game.kick.clip).root; t('troca de tipo aceita na espera', Game.setTipo('bomba') && Game.kick.tipo === 'bomba');
  t('troca de tipo gera caminhada até o novo ponto de partida', !!Game.kmove && Math.abs(Game.kmove.from[2] - a[2]) < 1e-9 && Game.kmove.dur >= .5); Game.down(null); t('não mira durante a caminhada', GS.estado === 'AGUARDANDO_COBRANCA');
  for (let i = 0; i < 60; i++) Game.update(.05); t('caminhada termina', !Game.kmove); Game.down(null); t('depois mira normalmente', GS.estado === 'MIRANDO'); }
// câmera: cobrador que parte de longe continua no quadro durante a espera; quem parte perto mantém o enquadramento padrão
{ const { camTarget } = await import('./js/frame.js'); const vis = (cam, p) => { const dx = p[0] - cam.pos[0], dz = cam.pos[2] - p[2], half = Math.atan(Math.tan(cam.fov*Math.PI/360)*16/9); return dz > 0 && Math.abs(Math.atan2(dx, dz)) < half*.95; };
  for (const pid of ['santos-gabriel-barbosa', 'santos-neymar-jr', comum.id]) { const ks = kickSpec(pid, 'medio'), st = clipStart(ks.clip).root, kx = ks.pe === 'l' ? -st[0] : st[0], cam = camTarget({ kick: ks, t: 3, dec: false }, null, BALL0, undefined, 0);
    t(`câmera na espera mostra ${ks.id} (partida a ${Math.hypot(st[0], st[2] - 11).toFixed(1)} m)`, vis(cam, [kx, 0, st[2]])); }
  const base = camTarget({ kick: kickSpec(comum.id, 'medio'), t: 3, dec: false }, null, BALL0, undefined, 0); t('chute médio comum: enquadramento padrão inalterado', base.fov === 27 && base.pos[2] === 25); }
console.log(`KICKS OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
