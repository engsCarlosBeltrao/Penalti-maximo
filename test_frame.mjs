// Testa o módulo PURO de quadro (frame.js): papéis, poses por fase, bola e câmera — sem canvas e sem WebGL.
import { characters, ballWorld, camTarget, TF, kcol } from './js/frame.js';
import { kickerPose, keeperPose, KICK_T0, goalToWorld, BALL0 } from './js/rig.js';
import { GS } from './js/gameState.js'; import { TEAMS } from './js/teams.js';
let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FALHOU:', n)); }; const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
GS.equipes = [TEAMS[4], TEAMS[0]]; GS.cobranca = 1; GS.cobrador = 0; GS.vencedor = null;
const game = { m: {}, fin: null, t: 4, escolha: [null, null], hum: () => true }, K = { x: .5, tx: .8, th: .85, t0: 0 };
let fr = characters(game, 5, null, K, undefined, 0, BALL0); t('em espera: kicker + keeper', fr.list.length === 2 && fr.list[0].role === 'kicker' && fr.list[1].role === 'keeper' && !fr.final);
t('em espera: kicker em "idle"', eq(fr.list[0].P, kickerPose({ mode: 'idle', t: 5 })));
game.t = .4; fr = characters(game, 5, null, K, undefined, 0, BALL0); t('início da vez: caminhada ("walkin", reserva do clipe de entrada)', eq(fr.list[0].P, kickerPose({ mode: 'walkin', t: .4, dur: 2.7 })));
for (const tc of [-1.3, -.55, 0, .69, .95]) { const b = { gx: .5, gy: .5, t: tc, res: null }, a = characters(game, 5, b, K, undefined, tc - TF, ballWorld(b, K)).list[0].anim; t(`chute tc=${tc}: cobrador marcado para o clipe do Blender no mesmo instante`, a && a.clip === 'chute' && a.tc === Math.max(KICK_T0, tc)); }
t('depois do fim do clipe (tc > 1 s) volta às poses de reação', !characters(game, 5, { gx: .5, gy: .5, t: 1.2, res: 'gol' }, K, undefined, 1.2 - TF, BALL0).list[0].anim);
t('fora do chute (espera) não usa o clipe', !characters(game, 5, null, K, undefined, 0, BALL0).list[0].anim);
for (const tc of [-.55, -.3, -.1, 0, .2, .69]) { const b = { gx: .8, gy: .85, t: tc, res: null }; fr = characters(game, 5, b, K, undefined, tc - TF, ballWorld(b, K)); t(`chute tc=${tc}: pose do cobrador`, eq(fr.list[0].P, kickerPose({ mode: 'kick', tc: Math.max(KICK_T0, tc) }))); }
let b = { gx: .8, gy: .85, t: 1.1, res: 'gol' }; fr = characters(game, 5, b, K, 'gol', b.t - TF, ballWorld(b, K)); t('reação ao gol (cobrador)', eq(fr.list[0].P, kickerPose({ mode: 'react', d: b.t - TF, type: 'gol' })) && fr.list[1].look.mood === 'sad');
b = { gx: .8, gy: .85, t: 1.1, res: 'defesa' }; fr = characters(game, 5, b, K, 'defesa', b.t - TF, [0, 1, 0]); t('defesa: goleiro feliz e cobrador em "falha"', fr.list[1].look.mood === 'happy' && fr.list[0].P.lean === .3);
t('uniforme do goleiro difere do cobrador', fr.list[1].kit.keeper === true && fr.list[1].kit.glove && fr.list[1].kit.c1 === kcol(TEAMS[0]) && !fr.list[0].kit.keeper);
game.fin = { t: 2 }; GS.vencedor = 0; fr = characters(game, 5, null, K, undefined, 0, BALL0); t('fim: 1 goleiro vencedor + 3 comemorando + 1 derrotado', fr.final && fr.list.map(c => c.role).join() === 'keeper,mate,mate,mate,loser');
t('fim: vencedor veste as cores do vencedor', fr.list.filter(c => c.role === 'mate').every(c => c.kit.c1 === TEAMS[4].c1) && fr.list[4].kit.c1 === TEAMS[0].c1);
GS.equipes = [null, null]; t('sem partida: nada', characters({ m: null }, 0, null, K, undefined, 0, BALL0) === null);
// bola passa pelo ponto da mira no instante de chegada; câmera válida
const T = goalToWorld(.2, .4), p1 = ballWorld({ gx: .2, gy: .4, t: TF - 1e-6, res: null }, K); t('bola passa pelo ponto mirado', Math.hypot(p1[0] - T[0], p1[1] - T[1], p1[2] - T[2]) < .01);
t('bola parte do ponto de pênalti', eq(ballWorld({ gx: .2, gy: .4, t: -.3 }, K), BALL0));
const ct = camTarget({ fin: null, t: 2, dec: false }, null, BALL0, undefined, 0); t('câmera padrão válida', ct.pos.every(Number.isFinite) && ct.fov > 10 && ct.fov < 60);
console.log(`FRAME OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
