// Testes de lógica (Node): node test.mjs
import { Aim } from './js/aim.js'; import { Game } from './js/game.js'; import { GS, getLcd } from './js/gameState.js'; import { Events } from './js/events.js'; import { Cup } from './js/tournament.js'; import { TEAMS } from './js/teams.js'; import { squad } from './js/players.js'; import { Ads } from './js/advertising.js';
let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FALHOU:', n)); };
// mira nova: oscila sozinha; clique rápido = rasteiro; segurar = sobe com x variando
{ const q = new Aim(); q.reset(); q.run(); const x0 = q.x; q.update(.2, .9, .6); t('oscila sem clique', q.x !== x0 && q.y === .14); const xa = q.x; q.start(); q.update(.5, .9, .6); t('segurar sobe e x continua variando', q.y > .3 && q.x !== xa); const pt = q.release(); t('release congela', !q.ativa && pt.gy > .3); }
// 1-3 mira
const a = new Aim(); a.start(); const xs = []; let y0 = a.y; for (let i = 0; i < 400; i++) { a.update(.016, .9, .6); xs.push(a.x); }
t('sobe', a.y > y0); t('oscila', Math.min(...xs) < .1 && Math.max(...xs) > .9); const p = a.release(); a.update(1, .9, .6); t('congela', a.x === p.gx && a.y === p.gy);
// fps independente
const f1 = new Aim(), f2 = new Aim(); f1.start(); f2.start(); for (let i = 0; i < 60; i++) f1.update(1/60, .5, .4); for (let i = 0; i < 30; i++) f2.update(1/30, .5, .4); t('fps', Math.abs(f1.y - f2.y) < 1e-6);
// partida completa: eventos e placar únicos
const ev = []; Events.on('*', e => ev.push(e.tipo)); let ended = null; const A = TEAMS[0], B = TEAMS[1];
Game.start(A, B, (w, s) => ended = { w, s });
for (let g = 0; g < 3000 && !ended; g++) { // simula entradas sem DOM
  if (GS.estado === 'AGUARDANDO_COBRANCA') { Game.aim.start(); GS.estado = 'MIRANDO'; for (let i = 0; i < 40; i++) Game.update(.016); Game.up(); }
  if (GS.estado === 'DEFESA_DO_GOLEIRO' && Game.ball) Game.keeperChoose(.5);
  Game.update(.05); }
t('terminou', !!ended); t('soma cobrancas', GS.cobrancasRealizadas === ev.filter(e => ['gol','defesa','fora','trave'].includes(e)).length);
t('placar = gols', GS.placar[0] + GS.placar[1] === ev.filter(e => e === 'gol').length); t('placar_alterado = gols', ev.filter(e => e === 'placar_alterado').length === ev.filter(e => e === 'gol').length);
t('encerrou 1x', ev.filter(e => e === 'partida_encerrada').length === 1); t('vencedor', GS.vencedor !== null && GS.placar[GS.vencedor] > GS.placar[GS.vencedor ^ 1]); t('lcd 16', getLcd().every(l => l.length === 16));
// campeonato completo
for (let r = 0; r < 20; r++) { const c = new Cup(r % 16); let n = 0; while (c.champion === null && n++ < 20) { const nx = c.alive && c.nextForMe(); if (!nx) break; c.playerResult(Math.random() < .5 ? 5 : 3, 4); } t('campeao definido', c.champion !== null || !c.alive); }
const c = new Cup(0); c.playerResult(5, 3); t('hist', c.hist.length === 8);
// 2 pessoas, elencos, anúncios
Game.start(A, B, () => {}, true); t('2p: turno 0 humano', GS.estado === 'AGUARDANDO_COBRANCA'); Game.update(1); Game.aim.start(); GS.estado = 'MIRANDO'; Game.update(.3); Game.up(); for (let i = 0; i < 160 && GS.cobrador !== 1; i++) Game.update(.05); t('2p: turno 1 humano', GS.cobrador === 1 && GS.estado === 'AGUARDANDO_COBRANCA');
t('20 clubes', TEAMS.length === 20); t('elenco >=5', TEAMS.every(c => squad(c).length >= 5)); t('Campo Real ativo', Ads.current('main', 0, 0).ad.id === 'campo-real');

// morte súbita forçada: 5x5 todos gols, depois A converte e B erra
{ let r = null; Game.start(A, B, (w, sc) => r = { w, sc }); let n = 0;
  while (!r && n++ < 60) { Game.keeper.t0 = null; Game.ball = { gx: (GS.cobrador === 1 && GS.cobranca >= 6) ? -.2 : .85, gy: .5, t: .7, res: null, som: true }; Game.resolve(); Game.wait = 0; Game.next(); if (Game.fin) Game.update(5); }
  t('morte subita', !!r && GS.cobrancasRealizadas === 12 && r.w === true && r.sc[0] === 6 && r.sc[1] === 5); }
// comemoração de vitória só no fim confirmado
{ const evs = []; Events.on('*', e => evs.push(e.tipo)); let r = null; Game.start(A, B, (w, sc) => r = { w, sc }); let sawFinMid = false, n = 0;
  while (!r && n++ < 80) { sawFinMid ||= !!Game.fin && GS.cobrancasRealizadas < 3; Game.keeper.t0 = null; Game.ball = { gx: (GS.cobrador === 1) ? -.2 : .85, gy: .5, t: .7, res: null, som: true }; Game.resolve(); Game.wait = 0; Game.next(); if (Game.fin) { t('fin só após decidir', Game.m && GS.vencedor !== null); const f1 = Game.fin; Game.update(.1); t('callback só depois da comemoração', !r && Game.fin === f1); Game.update(5); } }
  t('sem fin no meio', !sawFinMid); t('vitoria 1x após encerrar', evs.filter(x => x === 'vitoria').length === 1 && evs.indexOf('vitoria') > evs.lastIndexOf('partida_encerrada') - 1); t('decidida antes da 5ª', GS.cobrancasRealizadas < 10 && !!r); }
// goleiro: defesa exige alcance horizontal E vertical
{ Game.start(A, B, () => {}); const mk = (gx, gy, tx, th) => { Game.keeper = { x: tx, tx, th, t0: 0 }; Game.ball = { gx, gy, t: .7, res: null, som: true }; Game.resolve(); return Game.ball.res; };
  t('defesa alcancavel', mk(.5, .35, .5, .35) === 'defesa'); Game.start(A, B, () => {}); t('gol canto alto', mk(.03 + .03, .9, .5, .3) !== 'defesa'); }
// elencos
import('./js/players.js').then(({ PLAYERS, squad, pickKicker }) => {
  t('estrelas verificadas', PLAYERS.filter(p => p.isStar).length >= 5); t('todo jogador tem fonte e data', PLAYERS.every(p => p.source && p.verifiedAt && p.clubId));
  t('Fluminense >=15 reais', squad(TEAMS.find(c => c.key === 'fluminense')).filter(p => !p.pending).length >= 15); t('Santos Neymar 10', pickKicker(TEAMS.find(c => c.key === 'santos'), 1, PLAYERS.find(p => p.nickname === 'Neymar').id).num === 10);
  t('Arrascaeta camisa 10 (2 fontes)', PLAYERS.find(p => p.nickname === 'Arrascaeta').jerseyNumber === 10); t('Flamengo: todos com número', PLAYERS.filter(p => p.clubId === 'flamengo').every(p => p.jerseyNumber != null));
  const rep = TEAMS.map(c => `${c.sigla}:${squad(c).filter(p => !p.pending).length}`).join(' '); console.log('Reais por clube:', rep); finish(); });
function finish() {
console.log(`OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0); }
