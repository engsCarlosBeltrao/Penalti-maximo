// BOTÃO ARCADE × FORÇA DO CHUTE: o botão físico usa a MESMA barra (Game.aim) e a MESMA função de chute (Game.down/Game.up) que o mouse.
// Para vários tempos de pressão: carrega ao apertar, a barra sobe enquanto segura, chuta só ao soltar, força = a do mouse no mesmo tempo, tipos certos.
// node test_arcade_forca.mjs
import { Arduino } from './js/arduino.js';
import { Game, cfg } from './js/game.js';
import { GS } from './js/gameState.js';
import { Events } from './js/events.js';
import { TEAMS } from './js/teams.js';
import { ENTRY_S, forceFromAim, typeFromForce, FORCE_BANDS } from './js/kicks.js';
import { AIM_LIM, AIM_BASE } from './js/aim.js';
let ok = 0, bad = 0; const t = (n, c, info = '') => { c ? ok++ : (bad++, console.log('FALHOU:', n, info)); };
let agora = 0; const DT = 1/120, relogio = () => agora;
const pausa = { aberta: () => false, abrir() {}, voltar() {} };
Arduino.iniciar({ game: Game, pausa, raizes: () => [], emMenu: () => false, relogio, intervalo: 0 });
await Arduino.conectar({ simulador: true }); await new Promise(r => setTimeout(r, 0)); const sim = Arduino.sim;
const chutes = []; Events.on('chute', e => chutes.push(e));
const passo = s => { for (let i = 0; i < Math.round(s/DT); i++) { agora += DT; Game.update(DT); Arduino.tick(); } };
function pronto() { GS.equipes = [TEAMS[0], TEAMS[1]]; Game.start(TEAMS[0], TEAMS[1], () => {}); passo(ENTRY_S + .05); if (GS.estado !== 'AGUARDANDO_COBRANCA') throw new Error('não ficou pronto: ' + GS.estado); }
// um chute segurando por `seg` s: pelo botão físico (simulador → serial → comandos) ou pelo mouse (Game.down/up direto)
function chute(seg, via) {
  pronto(); const n0 = chutes.length, ys = [];
  if (via === 'arcade') sim.arcadeDown(agora); else Game.down(null);
  const carregou = GS.estado === 'MIRANDO' && !Game.ball;
  const passos = Math.round(seg/DT);
  for (let i = 0; i < passos; i++) { agora += DT; Game.update(DT); Arduino.tick(); if (i % 12 === 0) ys.push(Game.aim.barra); }
  const semChuteSegurando = !Game.ball && chutes.length === n0, yAntes = Game.aim.forca;
  if (via === 'arcade') sim.arcadeUp(agora); else Game.up();
  const b = Game.ball;
  return { carregou, semChuteSegurando, ys, yAntes, chutouNaSoltura: !!b && chutes.length === n0 + 1, forca: b?.forca, tipo: b?.tipo, gy: b?.gy };
}
const tempos = [.03, .1, .2, .3, .45, .6, .72, .9, 1.1, 1.22, 1.4, 1.6, 2.0];
const linhas = [], esperado = s => forceFromAim(Math.min(AIM_LIM.ymax, AIM_BASE + cfg.vs*s));
let ant = -1;
for (const s of tempos) {
  const a = chute(s, 'arcade'), m = chute(s, 'mouse');
  linhas.push(`${s.toFixed(2).padStart(5)} s → força ${(a.forca*100).toFixed(1).padStart(5)}% ${a.tipo.padEnd(8)} (mouse: ${(m.forca*100).toFixed(1)}% ${m.tipo}; esperado ${(esperado(s)*100).toFixed(1)}%)`);
  t(`${s} s: começa a carregar ao APERTAR (sem chutar)`, a.carregou && a.semChuteSegurando);
  t(`${s} s: a barra sobe enquanto segura`, a.ys.every((y, i) => i === 0 || y >= a.ys[i - 1] - 1e-12) && (s < .2 || a.ys.at(-1) > a.ys[0]), a.ys.map(y => y.toFixed(3)).join(' '));
  t(`${s} s: chuta SÓ ao soltar, uma vez`, a.chutouNaSoltura);
  t(`${s} s: chuta com a força da barra no instante da soltura`, Math.abs(a.forca - a.yAntes) < 1e-9);
  t(`${s} s: mesma força do mouse no mesmo tempo (mesma mecânica)`, Math.abs(a.forca - m.forca) < 1e-9 && a.tipo === m.tipo, `${a.forca} × ${m.forca}`);
  t(`${s} s: força = tempo real de pressão (± 1 passo de 1/120 s)`, Math.abs(a.forca - esperado(s)) <= cfg.vs*DT/(AIM_LIM.ymax - AIM_LIM.ymin) + 1e-9, `${a.forca} × ${esperado(s)}`);
  t(`${s} s: quanto mais tempo, mais forte (até o máximo)`, a.forca >= ant - 1e-12); ant = a.forca;
  t(`${s} s: tipo pela força (${typeFromForce(a.forca)})`, a.tipo === typeFromForce(a.forca));
}
const tipoDe = s => linhas.find(l => l.startsWith(s.toFixed(2).padStart(5)))?.match(/% (\w+)/)[1];
t('toque rápido (0,1 s) = chapada (fraco)', tipoDe(.1) === 'chapada'); t('tempo intermediário (0,72 s) = médio', tipoDe(.72) === 'medio'); t('segurar até perto do máximo (1,4 s) = bomba (forte)', tipoDe(1.4) === 'bomba');
t('segurar além do máximo para no máximo (100%)', Math.abs(chute(2.5, 'arcade').forca - 1) < 1e-9);
// soltura duplicada, aperto novo durante o voo, aperto antes da vez: nenhuma cobrança extra
{ pronto(); const n0 = chutes.length; sim.arcadeDown(agora); passo(.5); sim.arcadeUp(agora); sim.arcadeUp(agora); sim.arcadeDown(agora); passo(.2); sim.arcadeUp(agora); passo(.3);
  t('soltura repetida e novo aperto com a bola no ar: só UMA cobrança', chutes.length === n0 + 1); }
// aperto ANTES de o cobrador ficar pronto: não vale (como o clique do mouse), e não começa a carregar depois sozinho
{ GS.equipes = [TEAMS[0], TEAMS[1]]; Game.start(TEAMS[0], TEAMS[1], () => {}); passo(1); const n0 = chutes.length; sim.arcadeDown(agora); passo(ENTRY_S); 
  t('aperto antes da hora não carrega (nem quando a cobrança libera com o botão ainda apertado)', GS.estado === 'AGUARDANDO_COBRANCA');
  sim.arcadeUp(agora); t('…e soltar não chuta', chutes.length === n0 && !Game.ball);
  sim.arcadeDown(agora); passo(.72); sim.arcadeUp(agora); t('o aperto seguinte funciona com o tempo real (0,72 s → médio)', Game.ball?.tipo === 'medio' && Math.abs(Game.ball.forca - forceFromAim(AIM_BASE + cfg.vs*.72)) < .01); }
// latência: o evento é tratado no mesmo instante em que a linha chega (não espera o próximo quadro)
{ pronto(); const y0 = Game.aim.barra; sim.arcadeDown(agora); t('ARCADE_DOWN tratado na chegada: já está MIRANDO, barra na base', GS.estado === 'MIRANDO' && Game.aim.barra === AIM_BASE);
  passo(.6); const fS = Game.aim.forca; sim.arcadeUp(agora); t('ARCADE_UP tratado na chegada: chuta com a força daquele instante', !!Game.ball && Math.abs(Game.ball.forca - fS) < 1e-12, `${y0}`); }
console.log('Tempo segurado → força (botão ARCADE pelo protocolo serial):\n  ' + linhas.join('\n  '));
console.log(`Faixas: chapada ≤ ${FORCE_BANDS.chapada*100}% · médio ≤ ${FORCE_BANDS.medio*100}% · bomba acima; barra cheia em ${((AIM_LIM.ymax - AIM_BASE)/cfg.vs).toFixed(2)} s`);
console.log(`ARCADE OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
