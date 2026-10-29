// Testes do esqueleto 3D e das poses (Node): contato pé-bola, comprimento dos ossos, valores válidos, categorias de defesa.
import { humanJoints, kickerPose, keeperPose, cheerPose, dejectedPose, BALL0, KICK_T0, saveCategory, goalToWorld, GOAL_W } from './js/rig.js';
import { sub, len } from './js/engine3d.js';
let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FALHOU:', n)); };
const fin = J => Object.values(J).every(v => !Array.isArray(v) || v.every(Number.isFinite));
let nan = 0, longBone = 0, under = 0;
for (let tc = KICK_T0; tc <= 1.5; tc += .01) { const P = kickerPose(tc <= .7 ? { mode: 'kick', tc } : { mode: 'react', d: tc - .7, type: 'gol' }), J = humanJoints(P); if (!fin(J)) nan++; if (Math.abs(len(sub(J.hipL, J.knL)) - .43) > .01 || Math.abs(len(sub(J.knL, J.anL)) - .44) > .01 || Math.abs(len(sub(J.hipR, J.knR)) - .43) > .01) longBone++; if (Object.entries(J).some(([k, v]) => Array.isArray(v) && v.length === 3 && !['fwd', 'right', 'up', 'tfwd', 'tright', 'hfwd', 'hup', 'hright'].includes(k) && v[1] < -.001)) under++; }
t('cobrador sem valores inválidos', nan === 0); t('ossos mantêm comprimento (sem esticar)', longBone === 0); t('nada abaixo do gramado', under === 0);
const Jc = humanJoints(kickerPose({ mode: 'kick', tc: 0 })); t('contato: chuteira a ≤ 0,2 m do centro da bola', len(sub(Jc.toeL, BALL0)) < .2);
const Jb = humanJoints(kickerPose({ mode: 'kick', tc: -.12 })); t('recuo: perna de chute atrás da bola antes do golpe', Jb.anL[2] > Jc.anL[2] + .3);
const Jf = humanJoints(kickerPose({ mode: 'kick', tc: .3 })); t('acompanhamento: pé passa da bola em direção ao gol', Jf.anL[2] < BALL0[2] - .5 && Jf.anL[1] > .5);
const Jp = humanJoints(kickerPose({ mode: 'kick', tc: -.05 })); t('pé de apoio no chão durante o golpe', Jp.anR[1] < .12 && Math.abs(Jp.anR[2] - 11.06) < .1);
const feet = []; for (let tc = -.3; tc < .7; tc += .02) feet.push(humanJoints(kickerPose({ mode: 'kick', tc })).pelvis); let jump = 0; for (let i = 1; i < feet.length; i++) jump = Math.max(jump, len(sub(feet[i], feet[i - 1]))); t('sem teletransporte do quadril (≤ 5 m/s)', jump < .1);
// goleiro: 4 categorias com poses diferentes
const base = { x: .5, tx: .5, th: .4, t0: 0 }, pose = (gx, gy, tt, res) => { const k = { ...base, tx: gx, th: gy, x: .5 + (gx - .5)*Math.min(1, tt/.6) }; return keeperPose(k, { t: tt, gx, gy }, res, tt - .7, 0, goalToWorld(gx, gy)); };
const cats = [['alta', .18, .85], ['media', .2, .5], ['baixa', .2, .12], ['central', .5, .35]], P = cats.map(([c, gx, gy]) => ({ c, ...pose(gx, gy, .5) }));
t('categorias escolhidas pela trajetória', P.every(o => o.info.cat === o.c)); const rolls = P.map(o => Math.abs(o.P.roll || 0)), lifts = P.map(o => o.P.lift || 0);
t('baixa é a mais horizontal (maior rolagem)', rolls[2] > rolls[1] && rolls[1] > rolls[0] && rolls[3] === 0); t('alta tem o maior salto, baixa o menor', lifts[0] > lifts[1] && lifts[1] > lifts[2]);
t('central alta salta reto', (o => (o.P.roll || 0) === 0 && o.P.lift > .3)(pose(.5, .88, .35)));
let kn = 0; for (const [c, gx, gy] of cats) for (let tt = -.3; tt < 2.6; tt += .05) { const o = pose(gx, gy, tt, tt >= .7 ? 'defesa' : null), J = humanJoints(o.P); if (!fin(J)) kn++; } t('goleiro sem valores inválidos em todas as fases', kn === 0);
const Rec = pose(.2, .12, 2.4, 'gol'); t('recuperação: volta à posição vertical', Math.abs(Rec.P.roll || 0) < .05);
const Hd = humanJoints(pose(.2, .85, .7, 'defesa').P), T = goalToWorld(.2, .85); t('defesa alta: mão chega perto da bola (≤ 0,45 m)', Math.min(len(sub(Hd.haL, T)), len(sub(Hd.haR, T))) < .45);
const Hm = humanJoints(pose(.2, .85, .7, 'gol').P); const Tm = goalToWorld(.2, .85); t('tentativa frustrada também estica os braços', Math.min(len(sub(Hm.haL, Tm)), len(sub(Hm.haR, Tm))) < 1.2);
t('comemoração e decepção válidas', fin(humanJoints(cheerPose(1, 0, [0, 0, 7], 0))) && fin(humanJoints(dejectedPose(1, [-3, 0, 8], .6))));
t('categoria', saveCategory(.8, .3) === 'alta' && saveCategory(.1, .3) === 'baixa' && saveCategory(.45, .3) === 'media' && saveCategory(.9, .02) === 'central');
console.log(`RIG OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
