// HUMOR DA TORCIDA por lado (js/torcidaEstado.js): cada evento da partida leva cada torcida ao estado certo; nunca a torcida de quem sofreu comemora;
// transições (a festa não é cortada pela próxima cobrança, volta ao normal), pausa, fim de jogo. Também numa partida real (Game + eventos).   node test_torcida_humor.mjs
import { criaTorcidaEstado, HUMOR, EVENTOS } from './js/torcidaEstado.js';
import { Game } from './js/game.js';
import { GS } from './js/gameState.js';
import { Events } from './js/events.js';
import { Humor } from './js/torcidaHumor.js';
import { TEAMS } from './js/teams.js';
let ok = 0, bad = 0; const t = (n, c, info = '') => { c ? ok++ : (bad++, console.log('FALHOU:', n, info)); };
const barra = () => { const h = {}; return { on: (n, f) => (h[n] ??= []).push(f), emit: (n, d = {}) => (h[n] || []).forEach(f => f({ tipo: n, ...d })) }; };
const { CALMO, TENSAO, EUFORIA, FRUSTRACAO, DECEPCAO, FESTA } = HUMOR, comemora = h => h === EUFORIA || h === FESTA;
t('nomes pedidos mapeados para os eventos reais', EVENTOS.GOAL_SCORED === 'gol' && EVENTOS.GOALKEEPER_SAVE === 'defesa' && EVENTOS.PENALTY_MISSED.includes('fora') && EVENTOS.PENALTY_MISSED.includes('trave') && EVENTOS.MATCH_START === 'partida_iniciada' && EVENTOS.PENALTY_START === 'cobranca_mudou' && EVENTOS.MATCH_END === 'partida_encerrada');
// ---------- cada resultado, cobrado por cada lado ----------
const casos = [
  ['gol', 'gol do time que cobrou', q => [EUFORIA, FRUSTRACAO]],
  ['defesa', 'defesa do goleiro adversário', q => [DECEPCAO, EUFORIA]],
  ['fora', 'pênalti para fora', q => [DECEPCAO, EUFORIA]],
  ['trave', 'pênalti na trave', q => [DECEPCAO, EUFORIA]]];
for (const [ev, nome, esperado] of casos) for (const q of [0, 1]) {
  const E = barra(), H = criaTorcidaEstado(E); E.emit('chute', { equipe: q }); E.emit(ev, { equipe: q });
  const [doCobrador, doOutro] = esperado(q), h = H.lados.map(l => l.humor);
  t(`${nome} (cobrou o lado ${q ? 'DIREITO' : 'ESQUERDO'}): torcida de quem cobrou`, h[q] === doCobrador, h.join());
  t(`${nome} (cobrou o lado ${q ? 'DIREITO' : 'ESQUERDO'}): torcida do outro lado`, h[1 - q] === doOutro, h.join());
  t(`${nome}: só UMA torcida comemora`, h.filter(comemora).length === 1);
  if (ev === 'gol') t('gol: quem sofreu NUNCA comemora', !comemora(h[1 - q])); else t(`${ev}: o time que errou NUNCA comemora`, !comemora(h[q]));
}
{ const E = barra(), H = criaTorcidaEstado(E); E.emit('fora', { equipe: 0 }); const a = H.lados[1].I; const E2 = barra(), H2 = criaTorcidaEstado(E2); E2.emit('gol', { equipe: 1 }); const b = H2.lados[1].I;
  t('o adversário perder o pênalti gera comemoração mais intensa que o próprio gol', a > b, `${a} × ${b}`); }
// ---------- transições ----------
{ const E = barra(), H = criaTorcidaEstado(E);
  E.emit('partida_iniciada'); t('início: as duas torcidas saúdam os times', H.lados.every(l => l.humor === EUFORIA));
  H.update(5); E.emit('cobranca_mudou', { cobrador: 0 }); t('cobrança: tensão dos dois lados', H.lados.every(l => l.humor === TENSAO));
  E.emit('chute', { equipe: 0 }); t('chute: tensão máxima', H.lados.every(l => l.humor === TENSAO && l.I === 1));
  E.emit('gol', { equipe: 0 }); E.emit('cobranca_mudou', { cobrador: 1 }); t('a próxima cobrança não corta a festa', H.lados[0].humor === EUFORIA && H.lados[1].humor === FRUSTRACAO);
  H.update(12); E.emit('chute', { equipe: 1 }); t('o adversário vai bater: quem fez o gol CONTINUA comemorando, o outro fica tenso', H.lados[0].humor === EUFORIA && H.lados[1].humor === TENSAO);
  E.emit('fora', { equipe: 1 }); t('o adversário errou: a comemoração continua', H.lados[0].humor === EUFORIA && H.lados[1].humor === DECEPCAO);
  H.update(30); t('a comemoração não acaba sozinha (30 s depois)', H.lados[0].humor === EUFORIA && H.energia(0) >= .45);
  E.emit('cobranca_mudou', { cobrador: 1 }); H.update(6); E.emit('chute', { equipe: 1 }); E.emit('gol', { equipe: 1 });
  t('o adversário fez o gol: a comemoração PARA e a outra torcida começa', H.lados[0].humor === FRUSTRACAO && H.lados[1].humor === EUFORIA);
  H.update(10); t('frustração passa e volta ao normal; a nova comemoração continua', H.lados[0].humor === CALMO && H.lados[1].humor === EUFORIA);
  E.emit('pausa'); const t0 = H.lados[0].t; H.update(3); t('pausa: o humor congela', H.lados[0].t === t0 && H.pausado); E.emit('retomada'); t('retomada', !H.pausado);
  E.emit('partida_encerrada', { vencedor: 1 }); H.update(60); t('fim: o campeão festeja sem parar, o eliminado fica frustrado', H.lados[1].humor === FESTA && H.lados[0].humor === FRUSTRACAO);
  E.emit('cobranca_mudou', { cobrador: 0 }); t('depois do fim nada muda o humor (até reiniciar)', H.lados[1].humor === FESTA);
  E.emit('partida_reiniciada'); t('reinício: as duas calmas', H.lados.every(l => l.humor === CALMO));
  const lv = []; E.emit('gol', { equipe: 0 }); [0, 1].forEach(l => lv.push(H.energia(l))); t('energia sonora: o lado que comemora fica mais alto', lv[0] > lv[1] + .3, lv.join()); }
// ---------- numa partida de verdade (Game + eventos + humor compartilhado) ----------
{ const A = TEAMS.find(x => x.key === 'flamengo'), B = TEAMS.find(x => x.key === 'corinthians'); let erros = 0, n = 0, contagem = {};
  const confere = e => { const q = e.equipe, h = Humor.lados.map(l => l.humor); n++; contagem[e.tipo] = (contagem[e.tipo] || 0) + 1;
    if (e.tipo === 'gol' ? !(h[q] === EUFORIA && h[1 - q] === FRUSTRACAO) : !(h[q] === DECEPCAO && h[1 - q] === EUFORIA)) erros++; };
  ['gol', 'defesa', 'fora', 'trave'].forEach(n => Events.on(n, confere));   // registrado depois do humor: confere o estado já atualizado
  for (let p = 0; p < 4; p++) { GS.equipes = [A, B]; Game.start(A, B, () => {}, true); let g = 0;
    while (Game.m && !Game.fin && g++ < 60000) { if (GS.estado === 'AGUARDANDO_COBRANCA' && Game.t > 3) { Game.down(null); for (let i = 0; i < 40 + (g % 60); i++) Game.update(.01); Game.up(); } Game.update(1/60); } }
  t(`partidas reais: ${n} cobranças, cada torcida reagiu do lado certo em todas`, n > 20 && erros === 0, `${erros} erros · ${JSON.stringify(contagem)}`); }
console.log(`TORCIDA OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
