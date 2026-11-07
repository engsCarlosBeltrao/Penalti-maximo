// GOLEIRO (js/keeper.js): decisão e preparação 1,5 s antes do contato, escolha da ação pela trajetória, colisores dos ossos, detecção contínua,
// resultados do contato, física da bola, probabilidades de referência e várias cobranças seguidas.  node test_keeper.mjs
import fs from 'node:fs';
import * as GK from './js/keeper.js';
import { KEEPER_CLIPS } from './js/keeperClips.js';
import { KICK_CLIPS } from './js/kickClips.js';
import { kickSpec, forceFromAim, typeFromForce, KICK_TYPES, GOAL_REACTIONS, MISS_REACTIONS, KEEPER_CHEER, KEEPER_SAD } from './js/kicks.js';
import { GS } from './js/gameState.js'; import { TEAMS } from './js/teams.js'; import { Game } from './js/game.js'; import { Events } from './js/events.js';
import { characters } from './js/frame.js';
import { BALL_R, GOAL_W } from './js/rig.js';
let ok = 0, bad = 0; const t = (n, c, info = '') => { c ? ok++ : (bad++, console.log('FALHOU:', n, info)); };
const semente = s => () => (s = (s*16807) % 2147483647)/2147483647;
const TIPO = { chapada: [.8, .16], medio: [.62, 0], bomba: [.46, 0] }, pct = v => Math.round(v*100) + '%';
// uma cobrança isolada só com o módulo do goleiro (o mesmo passo fixo do jogo)
function cobra({ gx, gy, tipo = 'medio', lado = 'centro', rng = Math.random, t0 = -1.6, dt = 1/120, dif = 'normal' }) {
  const k = GK.novoGoleiro(); if (lado) GK.escolherLado(k, null, lado, 'teste');
  const b = { gx, gy, t: t0, t0, tf: TIPO[tipo][0], curl: TIPO[tipo][1], res: null }; let res = null, trilha = [];
  while (!res && b.t < 6) { const tA = b.t; b.t += dt;
    if (!b.fis) GK.passo(k, b, tA, b.t, { dif, rng }); else { GK.passoBola(k, b, dt); trilha.push(b.fis.p.slice()); }
    if (b.fis) { if (b.fis.res) res = b.fis.res; } else if (b.t >= b.tf) { const out = gx < 0 || gx > 1 || gy > 1, post = !out && (gx < .035 || gx > .965 || gy > .955); res = out ? 'fora' : post ? 'trave' : 'gol'; } }
  if (!k.contato) k.sem = GK.motivoSemContato(k, b);
  for (let i = 0; i < 90 && b.fis; i++) { b.t += dt; GK.passoBola(k, b, dt); trilha.push(b.fis.p.slice()); }   // continua a física depois do resultado
  return { res, k, b, trilha };
}

// ---------- 1. clipes: 9 categorias + espera + preparação + 6 defesas curtas, avanço limitado ----------
const NOMES = ['gk_espera', 'gk_prepara', ...['esq', 'centro', 'dir'].flatMap(l => ['baixa', 'media', 'alta'].map(h => `gk_${l}_${h}`)), ...['esq', 'dir'].flatMap(l => ['baixa', 'media', 'alta'].map(h => `gk_${l}_curta_${h}`))];
t('17 clipes do goleiro no manifesto', NOMES.every(n => KEEPER_CLIPS[n]), NOMES.filter(n => !KEEPER_CLIPS[n]).join());
t('arquivos GLB dos clipes do goleiro existem', NOMES.every(n => fs.existsSync('assets/models/anim/' + KEEPER_CLIPS[n].arquivo)));
t('preparação: 1,5 s até o contato + 0,5 s de base carregada (2,0 s)', Math.abs(KEEPER_CLIPS.gk_prepara.dur - 2) < .01);
for (const n of NOMES) { const tr = KEEPER_CLIPS[n].trilhas, fw = Math.max(...tr.tronco.map(p => p[2])), pe = Math.min(...tr.pe_l.concat(tr.pe_r).map(p => Math.min(p[1], p[4])));
  t(`${n}: avanço da pelve ≤ 0,55 m (foi ${fw.toFixed(2)})`, fw <= .55); t(`${n}: pés não atravessam o gramado (${pe.toFixed(3)} m)`, pe > -.02); }
const lat = n => Math.max(...KEEPER_CLIPS[n].trilhas.mao_l.concat(KEEPER_CLIPS[n].trilhas.mao_r).map(p => p[0])), latN = n => Math.min(...KEEPER_CLIPS[n].trilhas.mao_l.concat(KEEPER_CLIPS[n].trilhas.mao_r).map(p => p[0]));
t('lados do ponto de vista do goleiro: mergulhos "esq" vão para +x, "dir" para −x', ['baixa', 'media', 'alta'].every(h => lat(`gk_esq_${h}`) > 1.8 && latN(`gk_dir_${h}`) < -1.8));
const maos = n => KEEPER_CLIPS[n].trilhas.mao_l.concat(KEEPER_CLIPS[n].trilhas.mao_r);
t('mergulho alto leva as mãos acima de 2 m; baixo abaixo de 0,35 m', Math.max(...maos('gk_esq_alta').map(p => p[1])) > 2 && Math.min(...maos('gk_esq_baixa').map(p => p[1])) < .35);
{ const tr = KEEPER_CLIPS.gk_esq_curta_media.trilhas.tronco, ml = KEEPER_CLIPS.gk_esq_curta_media.trilhas.mao_l, mr = KEEPER_CLIPS.gk_esq_curta_media.trilhas.mao_r, i = 15;
  t('defesa curta: o CORPO vai para o lado (tronco ≥ 0,3 m, sem deitar: pelve ≥ 0,5 m), as duas mãos juntas na frente do peito (≤ 35 cm do tronco, ≤ 30 cm entre elas), termina no lugar novo',
    tr.at(-1)[0] > .25 && Math.max(...tr.map(p => p[0])) > .3 && Math.min(...tr.map(p => p[1])) > .5 && Math.abs(ml[i][0] - tr[i][0]) < .35 && Math.abs(mr[i][0] - tr[i][0]) < .35 && Math.abs(ml[i][0] - mr[i][0]) < .3,
    `tronco ${tr[i][0].toFixed(2)} · mãos ${ml[i][0].toFixed(2)} / ${mr[i][0].toFixed(2)}`); }
t('raiz do goleiro junto da linha do gol (z ≤ 0,25 m)', GK.KEEPER_CFG.raiz[2] <= .25);

// ---------- 2. classificação no plano do gol (configurável) ----------
const cls = [[-2.5, .2, 'dir_baixa'], [-2.5, 1, 'dir_media'], [-2.5, 2, 'dir_alta'], [0, .2, 'centro_baixa'], [0, 1, 'centro_media'], [0, 2, 'centro_alta'], [2.5, .2, 'esq_baixa'], [2.5, 1, 'esq_media'], [2.5, 2, 'esq_alta']];
t('9 categorias pelo ponto de cruzamento', cls.every(([x, y, c]) => GK.classificar(x, y).cat === c));
t('limites configuráveis', GK.classificar(1, 1, { centroX: 1.2, baixaY: .6, altaY: 1.45 }).lado === 'centro');

// ---------- 3. decisão do lado ----------
{ const k = GK.novoGoleiro(), b = { t: -2 }; t('escolha antes do limite vale', GK.escolherLado(k, b, 'esq', 'teste') && k.lado === 'esq');
  t('pode trocar antes do limite', GK.escolherLado(k, b, 'dir', 'teste') && k.lado === 'dir');
  GK.agendar(k, 10, 11.5); t('no limite (1,5 s antes do contato previsto) o lado trava e a preparação começa', k.travado && k.prepIni === 10 && k.prepAntes === 1.5);
  t('troca depois do limite é ignorada e registrada', !GK.escolherLado(k, { t: -.5 }, 'esq', 'teste') && k.lado === 'dir' && k.ignoradas.length === 1); }
{ const k = GK.novoGoleiro(); GK.agendar(k, 0, 5); t('longe do contato: ainda não prepara', k.prepIni == null && !k.travado); GK.agendar(k, 3.5, 5); t('sem escolha → centro, travado no limite', k.travado && k.lado === 'centro' && k.origem === 'sem escolha' && Math.abs(k.prepAntes - 1.5) < 1e-9); }
{ const k = GK.novoGoleiro(); GK.agendar(k, 2, 3.1); t('chute previsto com menos de 1,5 s: prepara na hora com o tempo que existe (1,1 s)', k.prepIni === 2 && Math.abs(k.prepAntes - 1.1) < 1e-9); }
{ const k = GK.novoGoleiro(); GK.agendar(k, 0, 3); GK.agendar(k, 1, 4); t('recalibra quando a corrida muda (contato previsto mais tarde)', k.prepIni == null && k.tContatoPrev === 4); GK.agendar(k, 2.5, 4); t('…e prepara 1,5 s antes do novo instante', k.prepIni === 2.5); }
// lado errado: sem teletransporte nem mergulho para o lado oposto
{ const r = cobra({ gx: .85, gy: .45, lado: 'dir', tipo: 'medio', rng: semente(5) });
  t('lado errado (peso à direita, bola no canto esquerdo): nenhum mergulho para a esquerda', !/gk_esq_(baixa|media|alta)$/.test(r.k.plano.clip), r.k.plano.clip); t('lado errado: gol', r.res === 'gol', r.k.sem); }

// ---------- 4. escolha da ação: a menor que cobre a bola ----------
const plano = (gx, gy, lado = 'centro', tipo = 'chapada', s = 9) => cobra({ gx, gy, lado, tipo, rng: semente(s), dif: 'hard' }).k.plano;
t('bola no corpo (meio, média altura): defesa no centro, sem mergulho', plano(.5, .42).tipo === 'centro');
{ const n = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(sd => plano(.5, .06, 'centro', 'chapada', sd).clip === 'gk_centro_baixa').length; t(`rasteira no meio: defesa baixa no centro na maioria das leituras (${n}/10)`, n >= 7); }
t('meio alto: braços para cima/salto (defesa alta no centro)', plano(.5, .82).clip === 'gk_centro_alta', plano(.5, .82).clip);
{ const p = plano(.62, .4); t('bola a ~0,9 m do corpo: passo(s) para o lado da bola (o corpo vai até ela), sem mergulho', (p.tipo === 'curta' || p.tipo === 'passos') && p.lado === 'esq', p.clip); }
{ const p = plano(.85, .45, 'esq'); t('bola no canto: mergulho', p.tipo === 'mergulho', p.clip); }
{ const p = plano(.85, .1, 'esq'); t('canto baixo: mergulho baixo', p.clip === 'gk_esq_baixa' || p.clip === 'gk_esq_media', p.clip); }
{ const p = plano(.15, .85, 'dir'); t('canto alto direito: mergulho alto à direita', p.clip === 'gk_dir_alta', p.clip); }

// ---------- 5. campo de alcance: partes, raspão, quase, bola rápida ----------
{ const vistos = {}, raso = [], quase = []; let s = 1; const sorte = semente(12345); for (let i = 0; i < 10; i++) sorte();
  for (let i = 0; i < 400; i++) { const gx = .1 + sorte()*.8, gy = .05 + sorte()*.85, lado = ['esq', 'dir', 'centro'][i % 3], tipo = ['chapada', 'medio', 'bomba'][i % 3], r = cobra({ gx, gy, lado, tipo, rng: semente(s++) });
    if (r.k.contato) { vistos[r.k.contato.grupo] = true; if (r.k.contato.depth < .15) raso.push(r); } else if (r.k.dmin && r.k.dmin.d > 0 && r.k.dmin.d < .08) quase.push(r); }
  t('contato com a mão', !!vistos.mao); t('contato com o antebraço ou braço', !!(vistos.antebraco || vistos.braco), JSON.stringify(vistos)); t('contato com o tronco', !!vistos.tronco, JSON.stringify(vistos));
  t('contato com perna/pé', !!(vistos.perna || vistos.pe), JSON.stringify(vistos)); t('toque só na ponta (profundidade < 15%)', raso.length > 0);
  t('bola que passa perto (< 8 cm) sem tocar: nenhuma defesa por sorteio', quase.length > 0 && quase.every(r => r.res !== 'defesa' || r.b.gx < 0 || r.b.gx > 1), quase.length); }
{ // bola rápida: a verificação só nos quadros (1/30 s) erraria; a detecção contínua acha
  let achou = 0, perderia = 0;
  for (let i = 0; i < 60; i++) { const r = cobra({ gx: .5, gy: .4, lado: 'centro', tipo: 'bomba', rng: semente(300 + i) }); if (!r.k.contato) continue; achou++;
    const b = { ...r.b }; delete b.fis; let viu = false; for (let tt = 0; tt <= b.tf; tt += 1/30) { const p = GK.ballFlight(b, tt); if (GK.colisoresPlano(r.k, tt).some(c => Math.hypot(...p.map((v, j) => v - GK.pontoMaisProximo(p, c.a, c.b).c[j])) < c.r + BALL_R)) viu = true; }
    if (!viu) perderia++; }
  t('bomba no corpo: contato detectado em todas', achou === 60, achou); t(`detecção contínua acha toques que a amostragem por quadro perderia (${perderia}/60)`, perderia > 0); }
{ const r = cobra({ gx: .5, gy: .85, lado: 'centro', tipo: 'medio', rng: semente(3) }), b = cobra({ gx: .5, gy: .06, lado: 'centro', tipo: 'medio', rng: semente(3) });
  t('bola alta não é defendida pela defesa baixa (e vice-versa): ações diferentes', r.k.plano.altura !== b.k.plano.altura); }

// ---------- 6. resultados do contato e física ----------
{ const rot = {}; let s = 1, tele = 0, chao = 0, preso = 0;
  for (let i = 0; i < 700 && Object.keys(rot).length < 12; i++) { const gx = [.5, .35, .65, .2, .8, .15, .85][i % 7], gy = [.1, .4, .7, .85][i % 4], tipo = ['chapada', 'medio', 'bomba'][i % 3];
    const r = cobra({ gx, gy, tipo, lado: gx < .4 ? 'dir' : gx > .6 ? 'esq' : 'centro', rng: semente(s++) }); if (!r.k.contato) { rot.sem_contato = 1; continue; } rot[r.k.contato.rotulo] = (rot[r.k.contato.rotulo] || 0) + 1;
    const tr = [r.k.contato.p, ...r.trilha]; for (let j = 1; j < tr.length; j++) { const d = Math.hypot(...tr[j].map((v, q) => v - tr[j - 1][q])); if (d > .35) tele++; if (tr[j][1] < BALL_R - 1e-6) chao++; }
    if (r.k.contato.rotulo === 'agarrada') { const d = Math.hypot(...r.trilha[0].map((v, q) => v - r.k.contato.p[q])); if (d > .2) preso++; } }
  for (const x of ['agarrada', 'espalmada', 'rebatida_esquerda', 'rebatida_direita', 'rebatida_frente', 'parcial_gol', 'sem_contato']) t(`resultado "${x}" acontece`, !!rot[x], JSON.stringify(rot));
  t('contato insuficiente / raspão acontece', Object.keys(rot).some(k => k.startsWith('raspao') || k === 'parcial_gol'));
  t('bola continua em jogo depois de uma defesa (rebote para o campo)', Object.keys(rot).some(k => k.startsWith('rebatida') || k.endsWith('_campo')));
  t('bola nunca teletransporta depois do contato (passo ≤ 35 cm)', tele === 0, tele); t('bola nunca atravessa o gramado', chao === 0, chao); t('bola agarrada vai suavemente para as luvas (sem salto > 20 cm)', preso === 0, preso); }
{ let r = null; for (let i = 1; i < 20 && !(r && r.k.contato); i++) r = cobra({ gx: .5, gy: .4, lado: 'centro', tipo: 'chapada', rng: semente(i) }); const c = r.k.contato;
  t('velocidade antes/depois e motivo registrados', c && c.vel > 5 && c.vOutMod != null && /defesa \d+%/.test(c.motivo), c && c.motivo); }

// ---------- 7. probabilidades de referência (medidas; contato de mão/tronco bem coberto = centro da luva ≥ 45%) ----------
function grupo(alvos, tipo, N) { let n = 0, def = 0, cont = 0, defC = 0, bom = 0, defB = 0; let s = 11;
  for (const [gx, gy, lado] of alvos) for (let i = 0; i < N; i++) { const r = cobra({ gx, gy, tipo, lado, rng: semente(s++) }), c = r.k.contato; n++; if (r.res === 'defesa') def++;
    if (c) { cont++; if (r.res === 'defesa') defC++; if (c.depth >= .45 && (c.grupo === 'mao' || c.grupo === 'tronco')) { bom++; if (r.res === 'defesa') defB++; } } }
  return { def: def/n, cont: cont/n, defC: cont ? defC/cont : 0, defB: bom ? defB/bom : 0, bom }; }
const N = 50, R = {};
R.fraco = grupo([[.82, .1, 'esq'], [.8, .45, 'esq'], [.82, .8, 'esq'], [.18, .1, 'dir'], [.2, .45, 'dir'], [.18, .8, 'dir']], 'chapada', N);
R.forteAlto = grupo([[.82, .8, 'esq'], [.18, .8, 'dir'], [.75, .85, 'esq'], [.25, .85, 'dir']], 'bomba', N);
R.meio = grupo([[.5, .4, 'centro'], [.5, .15, 'centro'], [.45, .6, 'centro'], [.55, .3, 'centro']], 'medio', N);
R.meioAlto = grupo([[.5, .85, 'centro'], [.45, .8, 'centro']], 'medio', N);
R.oposto = grupo([[.85, .45, 'dir'], [.15, .45, 'esq'], [.82, .15, 'dir']], 'medio', N);
R.meio40 = grupo([[.5, .4, 'centro']], 'medio', N); R.meioDeslocado = grupo([[.5, .4, 'esq'], [.5, .4, 'dir']], 'medio', N);
for (const [k, v] of Object.entries(R)) console.log(`  ${k.padEnd(14)} defesa ${pct(v.def)} · contato ${pct(v.cont)} · defesa com contato ${pct(v.defC)} · com contato bem coberto ${pct(v.defB)} (${v.bom})`);
t('chute fraco no canto, lado certo, bem coberto: ~89% (80–97%)', R.fraco.defB >= .8 && R.fraco.defB <= .97, pct(R.fraco.defB));
t('chute forte no alto, lado certo, bem coberto: ~38% (25–55%)', R.forteAlto.defB >= .25 && R.forteAlto.defB <= .55, pct(R.forteAlto.defB));
t('meio com goleiro centralizado, bola na altura do peito: muito alta (≥ 80%)', R.meio40.def >= .8, pct(R.meio40.def)); t('meio centralizado, contato bem coberto ≥ 90%', R.meio.defB >= .9, pct(R.meio.defB));
t('canto oposto ao escolhido: baixa (≤ 10%)', R.oposto.def <= .1, pct(R.oposto.def));
t('meio com goleiro deslocado para um lado: não melhor que centralizado (mesma bola, margem de amostragem 8%)', R.meioDeslocado.def <= R.meio40.def + .08, `${pct(R.meioDeslocado.def)} × ${pct(R.meio40.def)}`);
t('bola fora do alcance: nenhuma defesa sem contato', (() => { for (let i = 0; i < 40; i++) { const r = cobra({ gx: .97, gy: .93, lado: 'esq', tipo: 'bomba', rng: semente(i + 1) }); if (r.res === 'defesa' && !r.k.contato) return false; } return true; })());

// ---------- 8. no jogo: preparação 1,5 s antes do pé na bola (corridas curtas e longas), várias cobranças seguidas ----------
GS.equipes = [TEAMS[0], TEAMS[1]];
function cobrancaCPU(gy, lado, w = 0) {   // jogador defende; CPU cobra com a mira dada (a força sai de gy → tipo → duração da corrida)
  Game.rng = semente(77); Game.start(TEAMS[0], TEAMS[1], () => {}); Game.next(); if (GS.cobrador !== 1) Game.setTurn(1);
  Game.testeGoleiro({ gx: .3, gy, lado }); let prep = null, contato = null;
  for (let i = 0; i < 2400 && !(Game.ball && Game.ball.res); i++) { Game.update(1/120); const k = Game.keeper; if (prep == null && k.prepIni != null) prep = Game.t; if (contato == null && k.tContatoReal != null) contato = k.tContatoReal; }
  return { prep, contato, k: Game.keeper, t0: Game.ball?.t0 };
}
{ const vistos = new Set();
  for (const gy of [.15, .5, .95]) { const r = cobrancaCPU(gy, 'esq'); vistos.add(r.t0); console.log(`  [tempo] CPU cobra, corrida ${(-r.t0).toFixed(2)} s: preparação em t=${r.prep?.toFixed(3)} s, pé na bola em t=${r.contato?.toFixed(3)} s → ${(r.contato - r.prep).toFixed(3)} s antes`);
    t(`CPU (corrida ${(-r.t0).toFixed(2)} s): preparação começa 1,5 s antes do pé na bola (${(r.contato - r.prep).toFixed(3)} s)`, r.prep != null && Math.abs(r.contato - r.prep - 1.5) < .02, r.k.log.slice(-6).join(' | ')); }
  const t0s = [...new Set(Object.values(KICK_CLIPS).map(c => c.t0))].sort((a, b) => a - b);
  console.log(`  corridas dos clipes: ${t0s.map(v => (-v).toFixed(2)).join(', ')} s`); }
// jogador cobra (CPU defende): o instante só é conhecido ao soltar; se a corrida dura menos de 1,5 s, prepara na hora
for (const id of ['comum_medio', 'gabigol_medio', 'neymar_medio', 'jorginho_medio']) {
  const c = KICK_CLIPS[id]; if (!c) continue; Game.rng = semente(3); Game.start(TEAMS[0], TEAMS[1], () => {}); Game.update(3);
  Game.ball = { gx: .3, gy: .4, t: c.t0, t0: c.t0, tf: .62, curl: 0, tipo: 'medio', res: null, som: false }; GS.estado = 'CHUTANDO'; GK.escolherLado(Game.keeper, null, 'dir', 'CPU', Game.t);
  let prep = null; for (let i = 0; i < 600 && Game.keeper.tContatoReal == null; i++) { Game.update(1/120); if (prep == null && Game.keeper.prepIni != null) prep = Game.t; }
  const antes = Game.keeper.tContatoReal - prep, alvo = Math.min(1.5, -c.t0); console.log(`  [tempo] jogador cobra (${id}), corrida ${(-c.t0).toFixed(2)} s: preparação em t=${prep.toFixed(3)} s, pé na bola em t=${Game.keeper.tContatoReal.toFixed(3)} s → ${antes.toFixed(3)} s antes`);
  t(`jogador cobra (${id}, corrida ${(-c.t0).toFixed(2)} s): preparação ${antes.toFixed(3)} s antes do contato (alvo ${alvo.toFixed(2)})`, Math.abs(antes - alvo) < .02); }
// a animação: espera em prontidão → preparação (clipe gk_prepara) → ação; nada de mergulho antes do chute
{ Game.rng = semente(9); Game.start(TEAMS[0], TEAMS[1], () => {}); Game.next(); if (GS.cobrador !== 1) Game.setTurn(1); Game.testeGoleiro({ gx: .8, gy: .4, lado: 'esq' });
  const estados = []; let mergulhoAntes = false;
  for (let i = 0; i < 2400 && !(Game.ball && Game.ball.res); i++) { Game.update(1/120); if (i % 6) continue; const fr = characters(Game, Game.t, Game.ball, Game.keeper, Game.ball?.res, 0, [0, 0, 0]), kp = fr.list.find(c => c.role === 'keeper');
    const st = kp.anim.state; if (estados[estados.length - 1] !== st) estados.push(st); if (st === 'keeperDive' && Game.ball && Game.ball.t < 0 && (Game.ball.t < -.21 || !Game.keeper.plano.pre || GK.ctDe(Game.keeper, Game.ball.t) > .4)) mergulhoAntes = true; }
  t(`estados do goleiro em ordem: ${estados.join(' → ')}`, estados.join() === 'keeperWait,keeperPrep,keeperDive'); t('antes do chute só a SAÍDA (≤ 0,2 s antes, fase inicial do movimento), nunca o mergulho completo', !mergulhoAntes); }
// reação depois de terminar a ação (onde ele terminou, já de pé)
{ const r = cobra({ gx: .82, gy: .45, lado: 'esq', tipo: 'chapada', rng: semente(4) }), k = r.k, info = GK.CLIP_INFO[k.plano.clip], tFim = k.plano.tIni + (info.dur - .35 - k.plano.off)/k.plano.ritmo;
  for (const res of ['gol', 'defesa']) { const b = { ...r.b, res }; const g = GK.animGoleiro(k, { ...b, t: tFim + .2 }, { cheer: KEEPER_CHEER, sad: KEEPER_SAD }), d = GK.animGoleiro(k, { ...b, t: tFim - .5 }, { cheer: KEEPER_CHEER, sad: KEEPER_SAD });
    t(`${res}: durante a ação o clipe do goleiro; depois, ${res === 'gol' ? 'lamenta' : 'comemora'} no lugar onde terminou`, d.state === 'keeperDive' && (res === 'gol' ? g.clip in MISS_REACTIONS : g.clip in GOAL_REACTIONS) && Math.abs(g.pos[0]) > .5); } }
// partida inteira com o goleiro: sem travar, um resultado por cobrança, estado zerado a cada vez
{ const ev = []; Events.on('*', e => ev.push(e)); let fim = null; Game.rng = semente(21); Game.start(TEAMS[2], TEAMS[3], w => fim = w); let ant = null, reaproveitado = false, erros = 0;
  for (let i = 0; i < 40000 && fim === null; i++) {
    if (GS.estado === 'AGUARDANDO_COBRANCA' && Game.t >= .9) { Game.down(null); for (let j = 0; j < 60; j++) Game.update(1/120); Game.up(); }
    if (GS.estado === 'DEFESA_DO_GOLEIRO' && !Game.ball && Game.keeper && !Game.keeper.lado) Game.keeperChoose([.1, .5, .9][i % 3]);
    try { Game.update(1/60); } catch (e) { erros++; console.log(e); break; }
    if (Game.keeper !== ant) { if (ant && Game.keeper && (Game.keeper.plano || Game.keeper.contato)) reaproveitado = true; ant = Game.keeper; } }
  const res = ev.filter(e => ['gol', 'defesa', 'fora', 'trave'].includes(e.tipo));
  t('partida completa com o goleiro novo (sem erros)', fim !== null && erros === 0); t('um resultado por cobrança', res.length === GS.cobrancasRealizadas, `${res.length}/${GS.cobrancasRealizadas}`);
  t('estado do goleiro zerado a cada cobrança', !reaproveitado); t('eventos trazem o resumo do goleiro (lado, ação, contato ou motivo)', res.every(e => e.goleiro && e.goleiro.lado && (e.goleiro.contato || e.goleiro.motivo)));
  console.log(`  partida: ${res.map(e => e.tipo[0]).join('')} · defesas ${res.filter(e => e.tipo === 'defesa').length}/${res.length}`); }
console.log(`GOLEIRO OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
