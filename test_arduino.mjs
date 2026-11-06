// ARCADE (Arduino) no jogo, sem hardware: protocolo, botões → menus/pausa/chute (mesma barra de força), LCD com os dados oficiais, queda e
// reconexão — tudo pelo SIMULADOR, que manda as mesmas linhas do firmware.  node test_arduino.mjs
import { checksum, empacota, interpreta, Linhas, textoLCD } from './js/hardware/protocolo.js';
import { vizinho } from './js/hardware/navegacao.js';
import { telas } from './js/hardware/lcd.js';
import { Arduino } from './js/arduino.js';
import { Game } from './js/game.js';
import { GS } from './js/gameState.js';
import { Events } from './js/events.js';
import { TEAMS } from './js/teams.js';
import { ENTRY_S, typeFromForce } from './js/kicks.js';
let ok = 0, bad = 0; const t = (n, c, info = '') => { c ? ok++ : (bad++, console.log('FALHOU:', n, info)); };
const espera = () => new Promise(r => setTimeout(r, 0));

// ---------- protocolo ----------
t('checksum igual ao do firmware (PING → 10)', checksum('PING') === '10');
t('linha válida', interpreta(empacota('UP_PRESS')).cmd === 'UP_PRESS');
t('checksum errado → descartada', !!interpreta('UP_PRESS*00').erro);
t('sem checksum → descartada', !!interpreta('UP_PRESS').erro);
t('comando desconhecido → descartado', !!interpreta(empacota('FOGO')).erro);
t('caractere inválido → descartado', !!interpreta('UP\x01PRESS*10').erro);
t('argumentos (ARCADE_UP|ms)', JSON.stringify(interpreta(empacota('ARCADE_UP|612')).args) === '["612"]');
{ const ls = []; const L = new Linhas(l => ls.push(l)); L.push('UP_PR'); L.push('ESS*' + checksum('UP_PRESS') + '\nDOWN'); t('junta pedaços em linhas inteiras', ls.length === 1 && interpreta(ls[0]).cmd === 'UP_PRESS');
  L.push('X'.repeat(400)); t('lixo sem quebra de linha é jogado fora', L.buf.length === 0 && L.descartes === 1); }
t('texto do LCD: sem acentos, maiúsculo, sem separadores', textoLCD('São José | Grêmio*') === 'SAO JOSE / GREMIO/');

// ---------- navegação (vizinho espacial) ----------
{ const g = [0, 1, 2, 3].map(i => ({ x: (i % 2)*200, y: Math.floor(i/2)*60, w: 180, h: 40 }));   // grade 2×2
  t('direita na grade', vizinho(g, 0, 'RIGHT') === 1); t('baixo na grade', vizinho(g, 0, 'DOWN') === 2); t('esquerda na grade', vizinho(g, 3, 'LEFT') === 2); t('cima na grade', vizinho(g, 3, 'UP') === 1);
  t('sem vizinho: fica onde está', vizinho(g, 1, 'RIGHT') === 1 && vizinho(g, 0, 'UP') === 0); }

// ---------- LCD: telas ----------
{ const s = { tela: 'JOGO', A: 'Santa Jacinta', B: 'São José', sa: 'STJ', sb: 'SJO', pa: 2, pb: 1, cob: 4, bat: 'Santa Jacinta', sbat: 'STJ' };
  const p20 = telas(s, 20, 4); t('20x4: times, placar, cobrança, quem bate', p20.length === 1 && p20[0][0].startsWith('SANTA JA X SAO JOSE') && p20[0][1].startsWith('PLACAR: 2 X 1') && p20[0][2].startsWith('COBRANCA: 4/5') && p20[0][3].startsWith('BATENDO: SANTA JACIN'), JSON.stringify(p20));
  const p16 = telas(s, 16, 2); t('16x2: páginas alternadas com tudo', p16.length === 2 && p16.every(pg => pg.length === 2 && pg.every(l => l.length === 16)) && p16[0][1].includes('4/5') && p16[1][1].includes('STJ'), JSON.stringify(p16));
  t('morte súbita', telas({ ...s, cob: 7 }, 20, 4)[0][2].startsWith('MORTE SUBITA 7'));
  t('pausa', telas({ tela: 'PAUSA', A: 'A', B: 'B', sa: 'AAA', sb: 'BBB', pa: 2, pb: 1 }, 20, 4)[0].join('|').includes('JOGO PAUSADO'));
  t('fim', telas({ tela: 'FIM', A: 'Santa Jacinta', B: 'São José', sa: 'STJ', sb: 'SJO', pa: 4, pb: 2, venc: 0 }, 20, 4)[0].join('|').match(/FIM DE JOGO!.*SANTA JACINTA.*VITORIA: 4 X 2/)); }

// ---------- integração completa com o simulador ----------
let agora = 0; const relogio = () => agora;
const pausaUI = { aberto: false, aberta() { return this.aberto; }, abrir() { if (Game.pausar()) this.aberto = true; }, fechar() { this.aberto = false; Game.retomar(); }, voltar() { this.fechar(); } };
let menuAberto = true; const navLog = [];
Arduino.iniciar({ game: Game, pausa: pausaUI, raizes: () => [], emMenu: () => menuAberto, relogio, intervalo: 0 });
Arduino.nav = { mover: d => { navLog.push(d); return true; }, confirmar: () => { navLog.push('OK'); return true; }, voltar: () => { navLog.push('VOLTAR'); return true; } };   // os menus reais (DOM) são testados no navegador
Arduino.cmd = (await import('./js/hardware/comandos.js')).criarComandos({ game: Game, nav: Arduino.nav, pausa: pausaUI, emMenu: () => menuAberto });
const passo = (s, dt = 1/120) => { for (let i = 0; i < Math.round(s/dt); i++) { agora += dt; Game.update(dt); Arduino.tick(); } };
await Arduino.conectar({ simulador: true }); await espera(); const sim = Arduino.sim;
t('conecta pelo simulador e recebe HELLO (tamanho do LCD)', Arduino.estado === 'conectado' && Arduino.lcd.cols === 20 && Arduino.lcd.rows === 4);
// menus
for (const b of ['UP', 'DOWN', 'LEFT', 'RIGHT']) sim.aperta(b); sim.aperta('ADVANCE'); sim.aperta('BACK'); sim.repete('DOWN');
t('1–3. direcionais, avançar e voltar chegam aos menus', navLog.join() === 'UP,DOWN,LEFT,RIGHT,OK,VOLTAR,DOWN', navLog.join());
// partida
const ev = []; Events.on('*', e => ev.push(e)); menuAberto = false; GS.equipes = [TEAMS[0], TEAMS[1]]; Game.start(TEAMS[0], TEAMS[1], () => {}); passo(.5);
t('11. LCD mostra os times da partida', sim.lcd.join('|').includes(textoLCD(TEAMS[0].nome).slice(0, 10)) && sim.lcd.join('|').includes(textoLCD(TEAMS[1].sigla)), sim.lcd.join('|'));
t('LCD: próxima cobrança (time e cobrador) enquanto o cobrador entra', sim.lcd[0].startsWith('PROXIMA COBRANCA'), sim.lcd.join('|'));
passo(ENTRY_S);
t('LCD: em jogo, placar e cobrança 1/5', sim.lcd.join('|').includes('PLACAR: 0 X 0') && sim.lcd.join('|').includes('COBRANCA: 1/5'), sim.lcd.join('|'));
// 7–9: força pelo tempo apertado
const HOLD = { chapada: .2, medio: .72, bomba: 1.22 }, tipos = {};
for (const [tp, h] of Object.entries(HOLD)) {
  while (GS.estado !== 'AGUARDANDO_COBRANCA' || Game.t < ENTRY_S) passo(.1);
  const nChutes = ev.filter(e => e.tipo === 'chute').length;
  sim.arcadeDown(agora); t(`${tp}: apertar NÃO chuta (só começa a encher a força)`, GS.estado === 'MIRANDO' && !Game.ball);
  passo(h); sim.arcadeUp(agora); tipos[tp] = Game.ball?.tipo;
  t(`${tp}: soltar chuta uma vez`, ev.filter(e => e.tipo === 'chute').length === nChutes + 1);
  sim.arcadeUp(agora); sim.arcadeDown(agora); sim.arcadeUp(agora);   // soltura repetida / novo aperto com a bola em jogo
  t(`10. ${tp}: soltura repetida e novo aperto durante o voo não geram outra cobrança`, ev.filter(e => e.tipo === 'chute').length === nChutes + 1);
  const placar0 = [...GS.placar], cob0 = GS.cobranca;
  // espera o resultado e a vez do adversário (CPU) e volta à vez do jogador
  while (!(Game.ball && Game.ball.res)) passo(.05);
  const res = Game.ball.res; passo(.3);
  if (res === 'gol') t(`12. LCD atualiza o placar depois do gol (${tp})`, sim.lcd.join('|').includes(`${GS.placar[0]} X ${GS.placar[1]}`) && GS.placar[0] === placar0[0] + 1, sim.lcd.join('|'));
  t(`LCD mostra o resultado (${res})`, sim.lcd[0].startsWith({ gol: 'GOL!', defesa: 'DEFESA', fora: 'PARA FORA', trave: 'NA TRAVE' }[res]), sim.lcd.join('|'));
  while (GS.cobrador !== 0 || Game.ball) { passo(.05); if (Game.fin) break; }
  if (GS.cobranca !== cob0) t(`13. LCD atualiza o número da cobrança (${GS.cobranca})`, (() => { passo(ENTRY_S + .1); return sim.lcd.join('|').includes(`COBRANCA: ${GS.cobranca}/5`); })(), sim.lcd.join('|'));
}
t('7. toque rápido = chapada (fraco)', tipos.chapada === 'chapada', JSON.stringify(tipos)); t('8. pressão intermediária = médio', tipos.medio === 'medio'); t('9. pressão longa = bomba (forte)', tipos.bomba === 'bomba');
// 4–6: pausa
if (!Game.fin) {
  while (GS.estado !== 'AGUARDANDO_COBRANCA' || Game.t < ENTRY_S) passo(.1);
  sim.arcadeDown(agora); passo(.3); sim.arcadeUp(agora); passo(.15);
  const b = Game.ball, tb = b.t, gt = Game.t; sim.aperta('ADVANCE');
  t('4. AVANÇAR na partida pausa', Game.paused && pausaUI.aberta());
  passo(1);
  t('5. pausado: a bola e o cronômetro não andam', b.t === tb && Game.t === gt, `${b.t} ${tb}`);
  t('14. LCD mostra a pausa', sim.lcd[0].startsWith('JOGO PAUSADO'), sim.lcd.join('|'));
  sim.arcadeDown(agora); sim.arcadeUp(agora); t('arcade na pausa não chuta nem retoma sozinho', Game.paused && Game.ball === b);
  sim.aperta('BACK'); t('VOLTAR na pausa volta ao jogo (sem sair da partida)', !Game.paused && !!Game.m);
  sim.aperta('ADVANCE'); t('pausa de novo', Game.paused); sim.aperta('ADVANCE');   // pausaUI de teste: AVANÇAR confirma o item em foco (CONTINUAR) → aqui pelo nav real seria clique; simula
  pausaUI.fechar(); passo(.05); t('6. retomada continua de onde parou', !Game.paused && b.t > tb && b.t < tb + .1, `${b.t} ${tb}`);
}
// 15–16: queda e reconexão
{ while (GS.estado !== 'AGUARDANDO_COBRANCA' || Game.t < ENTRY_S) { passo(.1); if (Game.fin) break; }
  if (!Game.fin) { sim.arcadeDown(agora); passo(.2); t('carregando antes da queda', GS.estado === 'MIRANDO');
    sim.cair(); passo(.1);
    t('15. queda da ligação: estado desconectado e a carga é cancelada (sem chute fantasma)', Arduino.estado === 'desconectado' && GS.estado === 'AGUARDANDO_COBRANCA' && !Game.ball, `${Arduino.estado} ${GS.estado}`);
    passo(1); t('15. o jogo continua rodando sem o Arduino', Game.t > ENTRY_S && !!Game.m);
    const n0 = Arduino.lcd.enviadas; passo(3.2); await espera();
    t('16. reconecta sozinho e volta a receber botões', Arduino.estado === 'conectado'); passo(.1);
    t('16. ao reconectar o LCD recebe a tela atual de novo', Arduino.lcd.enviadas > n0 && sim.lcd.join('|').includes('PLACAR'), sim.lcd.join('|'));
    sim.ruido('lixo\x00\x01sem fim'); sim.ruido('\nUP_PRESS*00\n'); t('ruído e linhas corrompidas são descartados sem efeito', Arduino.con.invalidas >= 2); } }
// fim da partida no LCD
{ let n = 0; while (!Game.fin && n++ < 60) { Game.keeper && (Game.keeper.t0 = null); Game.ball = { gx: GS.cobrador === 0 ? .85 : -.2, gy: .5, t: .7, tf: .7, res: null, som: true }; Game.resolve(); Game.wait = 0; Game.next(); }
  passo(.2); t('14. LCD mostra o fim de jogo com o vencedor e o placar', sim.lcd[0].startsWith('FIM DE JOGO!') && sim.lcd.join('|').includes(`${Math.max(...GS.placar)} X ${Math.min(...GS.placar)}`), sim.lcd.join('|')); }
// o LCD não é bombardeado: mensagens só quando muda
{ const n0 = Arduino.lcd.enviadas; passo(2); t('LCD só recebe mensagem quando a tela muda (nada repetido a cada quadro)', Arduino.lcd.enviadas === n0, `${Arduino.lcd.enviadas - n0}`); }
t('nenhuma linha com checksum errado chegou ao Arduino simulado', sim.erros === 0, sim.erros);
console.log(`ARDUINO OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
