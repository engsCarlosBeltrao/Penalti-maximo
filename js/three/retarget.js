// RETARGETING: converte as poses do rig.js (posições de juntas no mundo) em orientações de ossos de um esqueleto GLB qualquer (T-pose ou A-pose).
// Funciona por DIREÇÕES (não por comprimentos): proporções diferentes do modelo são aceitas; a altura do quadril é corrigida para os pés tocarem o chão.
// Convenção (coincide com glTF): modelo olha para +Z, +Y para cima, +X = lado ESQUERDO do personagem. No rig.js, lado 'L' = lado ANATÔMICO DIREITO.
import { sub, add, mul, norm, qmul, qconj, qrot, qslerp, matCols, matT, matMul, qfromMat, orth, frameXZ } from './math.js';
import { dot, cross, len } from '../vec.js';
import { CANON, PARENT } from './skeletonMap.js';
export const SHOULDER_DROOP = 0;   // rad: queda extra da clavícula com o braço pendurado. O athlete.glb corrigido (tools/fix-neck-shoulders.mjs) já tem o caimento do trapézio na malha: com .5 o ombro caía ~48° parado (pescoço parecia comprido); com 0 fica ~25° parado, ~22° no chute
const UP = [0, 1, 0], FWD = [0, 0, 1], RIGSIDE = { Right: 'L', Left: 'R' }, RIG_ANKLE_REST = .075;
const present = (rest, b) => !!rest.bones[b];
// (osso, filho que define a direção, joint do rig de origem, joint do rig de destino, referência "para frente")
const chains = side => { const r = RIGSIDE[side], j = n => n + r; return [[side + 'UpLeg', side + 'Leg', j('hip'), j('kn'), 'fwd'], [side + 'Leg', side + 'Foot', j('kn'), j('an'), 'fwd'], [side + 'Foot', side + 'ToeBase', j('an'), j('toe'), 'up'], [side + 'Arm', side + 'ForeArm', j('sh'), j('el'), 'tfwd'], [side + 'ForeArm', side + 'Hand', j('el'), j('ha'), 'tfwd']]; };
const aim = (restDir, restRef, tDir, tRef) => { const R = orth(restDir, restRef, UP), T = orth(tDir, tRef, UP); return qfromMat(matMul(matCols(...T), matT(matCols(...R)))); };
// BRAÇO COM COTOVELO-DOBRADIÇA (a mesma regra de tools/blender/bracos.py). Orientar braço e antebraço cada um SOZINHO (aim com o "para frente" do tronco)
// deixava a torção do antebraço em relação ao braço arbitrária (até 179° nas poses do goleiro e de comemoração) e, sem ossos de torção no modelo, o punho
// torcia como papel de bala. Aqui o braço é orientado para que a flexão do cotovelo caia no seu plano, o antebraço é o braço girado em torno do eixo da
// dobradiça e a mão segue o antebraço (o punho não gira em torno do próprio eixo). Com o braço quase reto, a face anterior vai para a frente do tronco.
const qaxis = (ax, a) => { const s = Math.sin(a/2); return [ax[0]*s, ax[1]*s, ax[2]*s, Math.cos(a/2)]; };
export function armHinge(rest, J, side) {
  const r = RIGSIDE[side], d0 = norm(sub(rest.bones[side + 'ForeArm'].pos, rest.bones[side + 'Arm'].pos));
  const ua = norm(sub(J['el' + r], J['sh' + r])), fa = norm(sub(J['ha' + r], J['el' + r])), proj = v => sub(v, mul(ua, dot(ua, v)));
  const bend = Math.acos(Math.min(1, Math.max(-1, dot(ua, fa)))); let afb = proj(J.tfwd); if (len(afb) < 1e-3) afb = proj(UP); afb = norm(afb);
  let ause = afb; const act = proj(fa);
  if (len(act) > 1e-4) { const an = norm(act), w0 = Math.min(1, bend/(25*Math.PI/180)), w = w0*w0*(3 - 2*w0); ause = qrot(qaxis(ua, Math.atan2(dot(ua, cross(afb, an)), dot(afb, an))*w), afb); }
  const Ru = aim(d0, FWD, ua, ause);                     // na T-pose do modelo o cotovelo flexiona para a frente (+Z): face anterior do braço = FWD
  const h = cross(ua, fa), hinge = len(h) > 1e-4 ? norm(h) : norm(cross(ua, ause));   // giro de ua até fa em torno de um eixo ⟂ ao antebraço: direção exata, torção zero
  return [Ru, qmul(qaxis(hinge, bend), Ru)];
}
export function fk(rest, world, hips) {                // posições de todos os ossos canônicos a partir dos quaternions de mundo
  const pos = {}, dq = {}; CANON.forEach(b => { if (!present(rest, b)) return; dq[b] = qmul(world[b], qconj(rest.bones[b].quat)); const p = PARENT[b]; let pp = p; while (pp && !present(rest, pp)) pp = PARENT[pp];
    pos[b] = pp ? add(pos[pp], qrot(dq[pp], sub(rest.bones[b].pos, rest.bones[pp].pos))) : hips; }); return pos;
}
export function solvePose(rest, J) {
  const scale = rest.scale ?? 1, world = {}, d = {}, rq = b => rest.bones[b].quat;
  const fH = frameXZ(J.right, J.fwd), fT = frameXZ(J.tright, J.tfwd), fHd = frameXZ(J.hright, J.hfwd), set = (b, delta) => { if (present(rest, b)) { d[b] = delta; world[b] = qmul(delta, rq(b)); } };
  set('Hips', fH); const sp = ['Spine', 'Spine1', 'Spine2'].filter(b => present(rest, b)); sp.forEach((b, i) => set(b, qslerp(fH, fT, (i + 1)/sp.length)));
  set('Neck', qslerp(fT, fHd, .5)); set('Head', fHd);
  // CAIMENTO DOS OMBROS: com o braço pendurado a clavícula desce (ombro natural, não "ombreira" horizontal da T-pose); braço levantado = sem queda. A camisa (malha skinada) acompanha.
  ['Left', 'Right'].forEach(side => { const b = side + 'Shoulder'; if (!present(rest, b)) return; const r = RIGSIDE[side], e = sub(J['el' + r], J['sh' + r]), hang = Math.min(1, Math.max(0, -e[1]/Math.hypot(e[0], e[1], e[2])*1.15)), tip = Math.sign(rest.bones[b].pos[0] - rest.bones.Hips.pos[0]) || 1, a = -tip*SHOULDER_DROOP*hang*hang*(3 - 2*hang)/2, ax = norm(J.tfwd), s = Math.sin(a), q = [ax[0]*s, ax[1]*s, ax[2]*s, Math.cos(a)];
    set(b, qmul(q, fT)); });
  ['Left', 'Right'].forEach(side => chains(side).forEach(([b, c, a, z, ref]) => { if (!present(rest, b)) return; const parentD = d[b.replace(/UpLeg|Leg|Foot|Arm|ForeArm/, m => m)];  void parentD;
    if (!present(rest, c)) { set(b, d[PARENT[b]] || fT); return; }
    const restDir = norm(sub(rest.bones[c].pos, rest.bones[b].pos)), tDir = norm(sub(J[z], J[a])), tRef = ref === 'fwd' ? J.fwd : ref === 'up' ? J.up : J.tfwd;
    set(b, aim(restDir, ref === 'up' ? UP : FWD, tDir, tRef)); }));
  ['Left', 'Right'].forEach(side => { if (present(rest, side + 'Arm') && present(rest, side + 'ForeArm') && present(rest, side + 'Hand')) { const [Ru, Rf] = armHinge(rest, J, side); set(side + 'Arm', Ru); set(side + 'ForeArm', Rf); }
    set(side + 'Hand', d[side + 'ForeArm']); set(side + 'ToeBase', d[side + 'Foot']); });
  let hips = [J.pelvis[0], J.pelvis[1]*scale, J.pelvis[2]]; let pos = fk(rest, world, hips);
  // correção de altura: o tornozelo mais baixo do modelo deve ficar na mesma altura relativa do tornozelo mais baixo do rig
  const aM = Math.min(pos.LeftFoot[1], pos.RightFoot[1]), aR = Math.min(J.anL[1], J.anR[1]), aRest = Math.min(rest.bones.LeftFoot.pos[1], rest.bones.RightFoot.pos[1]);
  const shiftY = aR*scale + (aRest - RIG_ANKLE_REST*scale) - aM; hips = [hips[0], hips[1] + shiftY, hips[2]];
  return { world, hips, scale };
}
// ---- modelo sintético (T-pose ou A-pose) usado nos testes e no gerador de GLB de teste ----
export function syntheticModel({ arms = 'T', scale = 1, optional = true } = {}) {
  const S = v => [v[0]*scale, v[1]*scale, v[2]*scale], B = {}, q = [0, 0, 0, 1], add3 = (o, v) => [o[0] + v[0], o[1] + v[1], o[2] + v[2]];
  const put = (n, p) => { B[n] = { pos: S(p), quat: q.slice() }; };
  put('Hips', [0, .93, 0]); put('Spine', [0, .99, 0]); if (optional) { put('Spine1', [0, 1.11, 0]); put('Spine2', [0, 1.23, 0]); } put('Neck', [0, 1.39, 0]); put('Head', [0, 1.47, 0]);
  [['Left', 1], ['Right', -1]].forEach(([n, s]) => { const sh = [s*.06, 1.37, 0], arm = [s*.2, 1.37, 0], dir = arms === 'T' ? [s, 0, 0] : [s*.7071, -.7071, 0];
    if (optional) put(n + 'Shoulder', sh); put(n + 'Arm', arm); put(n + 'ForeArm', add3(arm, dir.map(v => v*.3))); put(n + 'Hand', add3(arm, dir.map(v => v*.57)));
    put(n + 'UpLeg', [s*.1, .93, 0]); put(n + 'Leg', [s*.1, .5, 0]); put(n + 'Foot', [s*.1, RIG_ANKLE_REST, 0]); if (optional) put(n + 'ToeBase', [s*.1, .02, .15]); });
  return { scale, bones: B };
}
