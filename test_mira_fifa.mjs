// COBRANÇA ESTILO FIFA 17: a seta oscila sozinha O TEMPO TODO (também carregando); segurar enche a seta (base → ponta), sobe a ponta (inclinação =
// altura) e aumenta a força; soltar chuta na direção daquele instante, com essa altura e força. Só aparece com a cobrança liberada; o goleiro continua o mesmo.   node test_mira_fifa.mjs
import { Game, cfg } from './js/game.js';
import { GS } from './js/gameState.js';
import { Events } from './js/events.js';
import { TEAMS } from './js/teams.js';
import { ENTRY_S, KICK_TYPES, fatorVelocidade, forceFromAim, typeFromForce } from './js/kicks.js';
import { AIM_BASE, AIM_LIM, MIRA_CFG, tempoForcaMax } from './js/aim.js';
import { ballWorld } from './js/frame.js';
import { goalToWorld, BALL0 } from './js/rig.js';
import { Arduino } from './js/arduino.js';
import { criarComandos } from './js/hardware/comandos.js';
let ok = 0, bad = 0; const t = (n, c, info = '') => { c ? ok++ : (bad++, console.log('FALHOU:', n, info)); };
const DT = 1/120, passo = s => { for (let i = 0; i < Math.round(s/DT); i++) Game.update(DT); };
const chutes = []; Events.on('chute', e => chutes.push(e));
const A = TEAMS.find(x => x.key === 'flamengo'), B = TEAMS.find(x => x.key === 'corinthians');
const pausaUI = { aberto: false, aberta() { return this.aberto; }, abrir() { if (Game.pausar()) this.aberto = true; }, voltar() { this.aberto = false; Game.retomar(); } };
const nav = { mover: () => true, confirmar: () => true, voltar: () => true }, cmd = criarComandos({ game: Game, nav, pausa: pausaUI, emMenu: () => false });
const vez = () => { while (!(GS.estado === 'AGUARDANDO_COBRANCA' && GS.cobrador === 0)) { passo(.05); if (Game.fin || !Game.m) return false; } return true; };
const nova = () => { GS.equipes = [A, B]; Game.start(A, B, () => {}); passo(ENTRY_S + .05); };

// ---------- configuração organizada ----------
t('ajustes num lugar só (MIRA_CFG): amplitude, força mín/máx, inclinação mín/máx', MIRA_CFG.amplitude > 0 && MIRA_CFG.forcaMax === 1 && MIRA_CFG.inclMax > MIRA_CFG.inclMin);
t('tempo até a força máxima: 1,6 s no padrão (configurável pela velocidade da carga)', Math.abs(tempoForcaMax(cfg.vs) - 1.6) < 1e-9);

// ---------- 1, 8, 13: quando a seta existe ----------
GS.equipes = [A, B]; Game.start(A, B, () => {});
t('1. preparação do cobrador: seta escondida', !Game.miraVisivel()); passo(ENTRY_S - .2); t('1. posicionamento: escondida', !Game.miraVisivel());
passo(.25); t('1. cobrança liberada: aparece', Game.miraVisivel());
Game.pausar(); t('pausa: escondida', !Game.miraVisivel()); Game.retomar(); t('retomou: volta', Game.miraVisivel());

// ---------- 2: oscila sozinha, suave, de um lado ao outro ----------
{ const xs = []; for (let i = 0; i < 360; i++) { Game.update(DT); xs.push(Game.aim.x); }
  const d = xs.slice(1).map((v, i) => v - xs[i]), maxPasso = Math.max(...d.map(Math.abs)), trocas = d.slice(1).filter((v, i) => Math.sign(v) !== Math.sign(d[i]) && v !== 0).length;
  t('2. oscila sem apertar nada (3 s: vai e volta)', Math.min(...xs) < .05 && Math.max(...xs) > .95 && trocas >= 1, `${Math.min(...xs).toFixed(2)}..${Math.max(...xs).toFixed(2)} trocas ${trocas}`);
  t('2. movimento contínuo e suave (sem saltos)', maxPasso < .02, maxPasso.toFixed(4));
  t('2. amplitude: de um pouco fora da trave esquerda a um pouco fora da direita', Math.min(...xs) >= AIM_LIM.xmin - 1e-9 && Math.max(...xs) <= AIM_LIM.xmax + 1e-9); }

// ---------- 3, 4, 5: apertar trava; segurar enche e inclina ----------
Game.down(null);
t('3. apertou: estado de carga e a seta continua', GS.estado === 'MIRANDO' && Game.miraVisivel());
{ const f = [], inc = [], xs = []; for (let i = 0; i < 4; i++) { for (let k = 0; k < 48; k++) { Game.update(DT); xs.push(Game.aim.x); } f.push(Game.aim.forca); inc.push(Game.aim.inclinacao); }
  const d = xs.slice(1).map((v, i) => Math.abs(v - xs[i]));
  t('3. carregando, a seta CONTINUA oscilando de um lado ao outro', Math.max(...xs) - Math.min(...xs) > .5, `${Math.min(...xs).toFixed(2)}..${Math.max(...xs).toFixed(2)}`);
  t('3. …com o mesmo movimento suave', Math.max(...d) < .02);
  t('4. preenchimento cresce sem saltos (0,4 s a 0,4 s)', f.every((v, i) => !i || v > f[i - 1]) && f[0] > .2, f.map(v => v.toFixed(2)).join(' '));
  t('5. a ponta sobe junto (inclinação cresce com a força)', inc.every((v, i) => !i || v > inc[i - 1]) && inc.at(-1) > 30, inc.map(v => v.toFixed(1)).join(' '));
  passo(1); t('7. força tem teto: 100% e inclinação máxima, sem acumular mais', Game.aim.forca === 1 && Game.aim.inclinacao === MIRA_CFG.inclMax); }
Game.cancel(); t('perda de foco: cancela a carga e a seta volta a oscilar', GS.estado === 'AGUARDANDO_COBRANCA' && !Game.aim.hold);

// ---------- 6, 7, 8: soltar = chute com os valores registrados ----------
{ passo(.5); Game.down(null); const x0 = Game.aim.x; passo(.7); const x = Game.aim.x, f = Game.aim.forca, y = Game.aim.y, inc = Game.aim.inclinacao; Game.up(); const b = Game.ball;
  t('8. soltou: a seta some na hora', !Game.miraVisivel());
  t('6. direção registrada = a do instante de SOLTAR (não a de apertar)', b.gx === x && b.mira.gx === x && x !== x0);
  t('6. altura registrada = a da inclinação', b.gy === y && b.mira.inclinacao === inc, `${b.gy} ${y}`);
  t('6. força registrada = a carregada; tipo e velocidade pela força', b.forca === f && b.tipo === typeFromForce(f) && Math.abs(b.tf - KICK_TYPES[b.tipo].tf*fatorVelocidade(f)) < 1e-12);
  // 7. trajetória física até o ponto registrado (sem teletransporte)
  const p0 = ballWorld({ ...b, t: 1e-4 }, Game.keeper), pf = ballWorld({ ...b, t: b.tf - 1e-4 }, Game.keeper), T = goalToWorld(b.gx, b.gy);
  let salto = 0, ant = p0; for (let k = 1; k <= 60; k++) { const q = ballWorld({ ...b, t: b.tf*k/60 - 1e-4 }, Game.keeper); salto = Math.max(salto, Math.hypot(q[0] - ant[0], q[1] - ant[1], q[2] - ant[2])); ant = q; }
  t('7. a bola sai da marca', Math.hypot(p0[0] - BALL0[0], p0[2] - BALL0[2]) < .1);
  t('7. trajetória contínua', salto < .5, salto.toFixed(3));
  t('7. chega exatamente ao ponto da mira (direção e altura)', Math.hypot(pf[0] - T[0], pf[2] - T[2]) < .1 && Math.abs(pf[1] - Math.max(.11, T[1])) < .1);
  while (!b.res) { passo(.02); if (Game.miraVisivel()) { t('8. durante o voo: escondida', false); break; } }
  t('resultado: escondida', !Game.miraVisivel()); }
// vez da CPU (o jogador defende): nunca aparece
{ while (GS.cobrador !== 1) passo(.05); let apareceu = false; while (GS.cobrador === 1 && !Game.fin) { passo(.05); if (Game.miraVisivel()) apareceu = true; }
  t('vez do adversário / escolha do goleiro: nunca aparece', !apareceu); }
vez(); t('13. próxima cobrança: escondida até liberar', !Game.miraVisivel()); passo(ENTRY_S + .05); t('13. …aparece de novo, sem carga e oscilando', Game.miraVisivel() && !Game.aim.hold && Game.aim.y === AIM_BASE);
{ const x0 = Game.aim.x; passo(.2); t('13. oscilando de novo', Game.aim.x !== x0); }

// ---------- chutes fracos, médios, fortes; rasteiros e altos ----------
const altura = {};
for (const [seg, tp] of [[.12, 'chapada'], [.75, 'medio'], [1.3, 'bomba']]) {
  if (!vez()) nova(); else passo(ENTRY_S + .05);
  Game.down(null); passo(seg); Game.up(); const b = Game.ball; altura[tp] = b.gy;
  t(`${tp}: ${seg} s apertado → ${tp}`, b.tipo === tp, `${b.tipo} ${(b.forca*100).toFixed(0)}%`);
  while (!b.res) passo(.02);
}
t('fraco = rasteiro (bola baixa)', altura.chapada < .25, altura.chapada.toFixed(2)); t('médio = meia altura', altura.medio > .4 && altura.medio < .7, altura.medio.toFixed(2)); t('forte = alto', altura.bomba > .85, altura.bomba.toFixed(2));

// ---------- 12: goleiro intacto (escolha da CPU, contato físico) ----------
{ const res = {}; let n = 0;
  for (let k = 0; k < 60 && n < 20; k++) { if (!Game.m || Game.fin) nova(); else if (!vez()) continue; else passo(ENTRY_S + .05);
    while (Math.abs(Game.aim.x - .35) > .03) Game.update(DT); Game.down(null); passo(.3); Game.up(); const b = Game.ball, kp = Game.keeper;   // aperta com a seta perto do meio e solta 0,3 s depois
    t('12. o goleiro da CPU escolhe o lado sem olhar a seta', !!kp.lado && kp.origem === 'CPU');
    while (!b.res) passo(.02); res[b.res] = (res[b.res] || 0) + 1; n++;
    if (b.res === 'defesa') t('12. defesa só com contato físico registrado', !!kp.contato && !!kp.contato.parte); }
  t('12. chutes no meio: o goleiro defende alguns (colisão real)', (res.defesa || 0) > 0, JSON.stringify(res)); console.log('chutes pela região central:', JSON.stringify(res)); }

// ---------- 9, 10, 11: teclado (ESPAÇO = mesmo down/up), arcade e Arduino pelo protocolo ----------
{ nova(); const n0 = chutes.length; const x0 = Game.aim.x;
  cmd.comando('ARCADE_DOWN'); t('10/11. ARCADE_DOWN começa a carga', GS.estado === 'MIRANDO');
  cmd.comando('ARCADE_DOWN'); passo(.72); t('10/11. aperto repetido não reinicia a carga nem chuta', chutes.length === n0 && Game.aim.carga > .7);
  const xAntes = Game.aim.x; cmd.comando('LEFT_PRESS'); t('10/11. direcional durante a carga não interfere na seta', Game.aim.x === xAntes);
  const xS = Game.aim.x; cmd.comando('ARCADE_UP'); cmd.comando('ARCADE_UP');
  t('10/11. soltou: UMA cobrança com o tempo real (0,72 s → médio) na direção do instante de soltar', chutes.length === n0 + 1 && Game.ball.tipo === 'medio' && Game.ball.gx === xS);
  cmd.comando('PAUSE_PRESS'); t('PAUSA continua funcionando', Game.paused); cmd.comando('RESUME_PRESS'); t('DESPAUSA também', !Game.paused); }
console.log(`MIRA FIFA OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
