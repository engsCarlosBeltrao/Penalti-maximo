// Testes do retargeting e do mapeamento de ossos (Node, sem Three.js): as poses do rig.js aplicadas a esqueletos T-pose/A-pose/escalados.
import { solvePose, fk, syntheticModel } from './js/three/retarget.js'; import { resolveBones, normalizeName, CANON } from './js/three/skeletonMap.js';
import { humanJoints, kickerPose, keeperPose, cheerPose, dejectedPose, goalToWorld, KICK_T0, BALL0 } from './js/rig.js'; import { sub, norm, len, dot } from './js/vec.js'; import { qmul, qconj } from './js/three/math.js';
let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FALHOU:', n)); };
// ---- nomes de ossos ----
const mixamo = CANON.map(c => 'mixamorig:' + c).map(n => n.replace('LeftToeBase', 'LeftToeBase')); let r = resolveBones(mixamo); t('Mixamo: todos os 22 ossos', r.ok && r.missing.length === 0);
r = resolveBones(['Hips', 'Spine', 'Chest', 'UpperChest', 'Neck', 'Head', 'LeftShoulder', 'LeftUpperArm', 'LeftLowerArm', 'LeftHand', 'RightShoulder', 'RightUpperArm', 'RightLowerArm', 'RightHand', 'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot', 'LeftToes', 'RightUpperLeg', 'RightLowerLeg', 'RightFoot', 'RightToes']); t('Unity/Humanoid: todos os ossos', r.ok && r.missing.length === 0);
r = resolveBones(['pelvis', 'spine', 'spine.001', 'spine.002', 'neck', 'head', 'shoulder.L', 'upper_arm.L', 'forearm.L', 'hand.L', 'shoulder.R', 'upper_arm.R', 'forearm.R', 'hand.R', 'thigh.L', 'shin.L', 'foot.L', 'toe.L', 'thigh.R', 'shin.R', 'foot.R', 'toe.R']); t('Blender (.L/.R): todos os ossos', r.ok && r.missing.length === 0);
r = resolveBones(mixamo.filter(n => !/Spine1|Spine2|Shoulder|ToeBase/.test(n))); t('ossos opcionais podem faltar', r.ok && r.missing.length > 0);
r = resolveBones(mixamo.filter(n => !/LeftLeg/.test(n)).concat('mixamorig:LeftLeg_x')); t('osso obrigatório ausente é detectado', !r.ok && r.requiredMissing.includes('LeftLeg'));
r = resolveBones(['A', 'B'], {}); t('esqueleto desconhecido → inválido', !r.ok);
r = resolveBones(['Quadril', 'X'], { Hips: 'Quadril' }); t('override manual (skeleton-map.json)', r.map.Hips === 'Quadril');
t('"shoulder" sem lado não vira "Right"', normalizeName('Shoulder') === 'Shoulder' && normalizeName('forearm') === 'ForeArm' && normalizeName('Head') === 'Head');
// ---- retargeting ----
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b)))))*180/Math.PI, RS = { Right: 'L', Left: 'R' };
const SEG = [['UpLeg', 'Leg', 'hip', 'kn'], ['Leg', 'Foot', 'kn', 'an'], ['Arm', 'ForeArm', 'sh', 'el'], ['ForeArm', 'Hand', 'el', 'ha']];
const poses = []; for (let tc = KICK_T0; tc <= .7; tc += .05) poses.push(['chute ' + tc.toFixed(2), kickerPose({ mode: 'kick', tc })]);
poses.push(['walkin', kickerPose({ mode: 'walkin', t: .45 })], ['idle', kickerPose({ mode: 'idle', t: 3 })], ['gol', kickerPose({ mode: 'react', d: .3, type: 'gol' })], ['falha', kickerPose({ mode: 'react', d: .3, type: 'falha' })], ['cheer0', cheerPose(1, 0, [0, 0, 7], 0)], ['cheer1', cheerPose(1, 1, [0, 0, 7], 0)], ['derrotado', dejectedPose(1, [-3, 0, 8], .6)]);
const kk = (gx, gy, tt, res) => keeperPose({ x: .5 + (gx - .5)*Math.min(1, tt/.6), tx: gx, th: gy, t0: 0 }, { t: tt, gx, gy }, res, tt - .7, 0, goalToWorld(gx, gy)).P;
for (const [n, gx, gy] of [['alta', .18, .85], ['média', .8, .5], ['baixa', .2, .12], ['central', .5, .35], ['central alta', .5, .9]]) for (const tt of [0, .2, .4, .7, 1.2, 2.2]) poses.push([`goleiro ${n} t=${tt}`, kk(gx, gy, tt, tt >= .7 ? 'defesa' : null)]);
const models = [['T-pose', syntheticModel()], ['A-pose', syntheticModel({ arms: 'A' })], ['sem ossos opcionais', syntheticModel({ optional: false })], ['escala 1,1', syntheticModel({ scale: 1.1 })]];
for (const [mn, M] of models) {
  let maxAng = 0, maxAnk = 0, maxHand = 0, maxGround = 0, nan = 0, worst = '';
  for (const [pn, P] of poses) { const J = humanJoints(P), S = solvePose(M, J), pos = fk(M, S.world, S.hips); if (!Object.values(S.world).every(q => q.every(Number.isFinite)) || !S.hips.every(Number.isFinite)) { nan++; continue; }
    for (const side of ['Left', 'Right']) { const rs = RS[side]; for (const [b, c, a, z] of SEG) { if (!pos[side + c] || !pos[side + b]) continue; const e = ang(sub(pos[side + c], pos[side + b]), sub(J[z + rs], J[a + rs])); if (e > maxAng) { maxAng = e; worst = `${pn} ${side}${b}`; } }
      if (M.scale === 1) { maxAnk = Math.max(maxAnk, len(sub(pos[side + 'Foot'], J['an' + rs]))); maxHand = Math.max(maxHand, len(sub(pos[side + 'Hand'], J['ha' + rs]))); } }
    maxGround = Math.max(maxGround, Math.abs(Math.min(pos.LeftFoot[1], pos.RightFoot[1]) - Math.min(J.anL[1], J.anR[1])*M.scale)); }
  t(`${mn}: valores válidos em ${poses.length} poses`, nan === 0); t(`${mn}: direção dos segmentos ≤ 1,5° (pior ${maxAng.toFixed(2)}° em ${worst})`, maxAng < 1.5);
  t(`${mn}: altura do pé ≈ rig (erro máx ${(maxGround*100).toFixed(1)} cm ≤ 4 cm)`, maxGround < .04);
  if (M.scale === 1) { t(`${mn}: tornozelos ≤ 4 cm do rig (máx ${(maxAnk*100).toFixed(1)} cm)`, maxAnk < .04); t(`${mn}: mãos ≤ 15 cm do rig (máx ${(maxHand*100).toFixed(1)} cm)`, maxHand < .15); }
}
// lado correto: no contato, o pé DIREITO anatômico (rig 'L') está na bola e o esquerdo longe
{ const M = syntheticModel(), J = humanJoints(kickerPose({ mode: 'kick', tc: 0 })), S = solvePose(M, J), p = fk(M, S.world, S.hips); t('contato: RightFoot do modelo está na bola', len(sub(p.RightFoot, J.anL)) < .04 && len(sub(p.RightFoot, BALL0)) < .35); t('contato: LeftFoot do modelo é o pé de apoio (longe da bola)', len(sub(p.LeftFoot, BALL0)) > .3); }
// ---- mãos: o antebraço não gira em torno do próprio eixo em relação ao braço, nem a mão em relação ao antebraço (cotovelo-dobradiça, js/three/retarget.js) ----
{ const twist = (M, S, c, p) => { const dq = b => qmul(S.world[b], qconj(M.bones[b].quat)), rel = qmul(qconj(dq(p)), dq(c)), ax = norm(sub(M.bones[c === 'LeftHand' || c === 'RightHand' ? c : c].pos, M.bones[p].pos));
    const pr = rel[0]*ax[0] + rel[1]*ax[1] + rel[2]*ax[2], a = Math.abs(2*Math.atan2(pr, rel[3])*180/Math.PI); return a > 180 ? 360 - a : a; };
  for (const [mn, M] of models) { let w = 0, wn = '';
    for (const [pn, P] of poses) { const S = solvePose(M, humanJoints(P));
      for (const side of ['Left', 'Right']) for (const [c, p] of [[side + 'ForeArm', side + 'Arm'], [side + 'Hand', side + 'ForeArm']]) { const v = twist(M, S, c, p); if (v > w) { w = v; wn = `${pn} ${c}`; } } }
    t(`${mn}: torção do antebraço e do punho ≤ 1° em ${poses.length} poses (goleiro, comemoração, lamento, chute; pior ${w.toFixed(2)}° — ${wn})`, w <= 1); } }
console.log(`RETARGET OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
