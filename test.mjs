// Testes de lógica (Node): node test.mjs
import { Aim } from './js/aim.js'; import { Game } from './js/game.js'; import { GS, getLcd } from './js/gameState.js'; import { Events } from './js/events.js'; import { Cup } from './js/tournament.js'; import { TEAMS } from './js/teams.js'; import { squad } from './js/players.js'; import { Ads } from './js/advertising.js';
let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FALHOU:', n)); };
// mira (seta 3D, FIFA 17): oscila sozinha o tempo todo; segurar enche força e altura (inclinação); soltar devolve a direção daquele instante
{ const q = new Aim(); q.reset(); q.run(); const x0 = q.x; q.update(.2, .9, .6); t('oscila sem clique', q.x !== x0 && q.y === .14); q.start(); const xa = q.x; q.update(.5, .9, .6); t('segurar: continua oscilando, altura e força sobem', q.x !== xa && q.y > .3 && q.forca > .3 && q.inclinacao > 10); const xs = q.x, pt = q.release(); t('release devolve a direção do instante de soltar, altura e força', !q.ativa && pt.gx === xs && pt.gy > .3 && pt.forca > .3); }
// 1-3 mira
const a = new Aim(); a.run(); const xs = []; for (let i = 0; i < 400; i++) { a.update(.016, .9, .6); xs.push(a.x); } let y0 = a.y; a.start(); for (let i = 0; i < 400; i++) a.update(.016, .9, .6);
t('sobe', a.y > y0); t('oscila de um lado ao outro', Math.min(...xs) < .1 && Math.max(...xs) > .9); t('força tem teto (100%)', a.forca === 1); const p = a.release(); a.update(1, .9, .6); t('congela', a.x === p.gx && a.y === p.gy);
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
Game.start(A, B, () => {}, true); t('2p: turno 0 humano', GS.estado === 'AGUARDANDO_COBRANCA'); Game.update(1); Game.aim.start(); GS.estado = 'MIRANDO'; Game.update(.3); Game.up(); for (let i = 0; i < 240 && GS.cobrador !== 1; i++) Game.update(.05);   /* espera o fim da reação coletiva (RESULT_WAIT) */ t('2p: turno 1 humano', GS.cobrador === 1 && GS.estado === 'AGUARDANDO_COBRANCA');
t('20 clubes', TEAMS.length === 20); t('elenco >=5', TEAMS.every(c => squad(c).length >= 5)); t('patrocinadores das placas: os 5 ativos, cada um com a sua arte', ['copo-cola', 'brahmaia', 'naike', 'gramado-real', 'perdebet'].every(id => Ads.lista('main').some(a => a.id === id && /^assets\/ads\/.+\.webp$/.test(a.image))) && Ads.current('main', 0, 0).ad.id === 'copo-cola' && Ads.current('main', 7.1, 0).ad.id === 'brahmaia');

// morte súbita forçada: 5x5 todos gols, depois A converte e B erra
{ let r = null; Game.start(A, B, (w, sc) => r = { w, sc }); let n = 0;
  while (!r && n++ < 60) { Game.keeper.t0 = null; Game.ball = { gx: (GS.cobrador === 1 && GS.cobranca >= 6) ? -.2 : .85, gy: .5, t: .7, res: null, som: true }; Game.resolve(); Game.wait = 0; Game.next(); if (Game.fin) Game.update(10); }
  t('morte subita', !!r && GS.cobrancasRealizadas === 12 && r.w === true && r.sc[0] === 6 && r.sc[1] === 5); }
// comemoração de vitória só no fim confirmado
{ const evs = []; Events.on('*', e => evs.push(e.tipo)); let r = null; Game.start(A, B, (w, sc) => r = { w, sc }); let sawFinMid = false, n = 0;
  while (!r && n++ < 80) { sawFinMid ||= !!Game.fin && GS.cobrancasRealizadas < 3; Game.keeper.t0 = null; Game.ball = { gx: (GS.cobrador === 1) ? -.2 : .85, gy: .5, t: .7, res: null, som: true }; Game.resolve(); Game.wait = 0; Game.next(); if (Game.fin) { t('fin só após decidir', Game.m && GS.vencedor !== null); const f1 = Game.fin; Game.update(.1); t('callback só depois da comemoração', !r && Game.fin === f1); Game.update(10); } }
  t('sem fin no meio', !sawFinMid); t('vitoria 1x após encerrar', evs.filter(x => x === 'vitoria').length === 1 && evs.indexOf('vitoria') > evs.lastIndexOf('partida_encerrada') - 1); t('decidida antes da 5ª', GS.cobrancasRealizadas < 10 && !!r); }
// goleiro: a defesa exige CONTATO físico com os colisores dos ossos (js/keeper.js; detalhes em test_keeper.mjs)
{ const GK = await import('./js/keeper.js'), mk = (gx, gy, tipo, seed) => { let s = seed; const rng = () => (s = (s*16807) % 2147483647)/2147483647, k = GK.novoGoleiro(), b = { gx, gy, t: -1.6, t0: -1.6, tf: tipo === 'bomba' ? .46 : .8, curl: 0, res: null };
    while (b.t < b.tf && !b.fis) { const tA = b.t; b.t += 1/120; GK.passo(k, b, tA, b.t, { rng }); } return k; };
  t('defesa alcancavel: bola no corpo encontra o goleiro', [1, 2, 3].every(s => !!mk(.5, .35, 'chapada', s).contato)); t('gol canto alto: sem contato', [1, 2, 3].every(s => !mk(.06, .9, 'bomba', s).contato)); }
// elencos
import('./js/players.js').then(({ PLAYERS, squad, pickKicker }) => {
  t('estrelas verificadas', PLAYERS.filter(p => p.isStar).length >= 5); t('todo jogador tem fonte e data', PLAYERS.every(p => p.source && p.verifiedAt && p.clubId));
  t('Fluminense >=15 reais', squad(TEAMS.find(c => c.key === 'fluminense')).filter(p => !p.pending).length >= 15); t('Santos Neymar 10', pickKicker(TEAMS.find(c => c.key === 'santos'), 1, PLAYERS.find(p => p.nickname === 'Neymar').id).num === 10);
  t('Arrascaeta camisa 10 (2 fontes)', PLAYERS.find(p => p.nickname === 'Arrascaeta').jerseyNumber === 10); t('Flamengo: todos com número', PLAYERS.filter(p => p.clubId === 'flamengo').every(p => p.jerseyNumber != null));
  const rep = TEAMS.map(c => `${c.sigla}:${squad(c).filter(p => !p.pending).length}`).join(' '); console.log('Reais por clube:', rep); finish(); });
function finish() {
console.log(`OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0); }
