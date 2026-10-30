// Esqueleto 3D articulado: cinemática direta (FK) + cinemática inversa de 2 ossos (IK) para pernas e braços.
// Eixos locais: x direita · y cima · z para FRENTE do personagem. Poses do cobrador, do goleiro e comemorações.
import { sub, add, mul, dot, norm, len, lerp } from './engine3d.js';
export const GOAL_W = 7.32, GOAL_H = 2.44, SPOT_Z = 11, BALL_R = .11;
export const BALL0 = [0, BALL_R, SPOT_Z];
export const goalToWorld = (gx, gy) => [(gx - .5)*GOAL_W, gy*GOAL_H, 0];
export const saveCategory = (th, mag) => mag < .06 ? 'central' : th > .62 ? 'alta' : th < .3 ? 'baixa' : 'media';   // central · alta · média · baixa
export const sm = t => { t = Math.min(1, Math.max(0, t)); return t*t*(3 - 2*t); };
const LEN = { thigh: .43, shin: .44, uarm: .3, farm: .27, torso: .5, hipW: .1, shW: .19, head: .115 };
// ---- matrizes 3x3 ----
const rx = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }, ry = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }, rz = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const mm = (a, b) => { const o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i*3 + j] = a[i*3]*b[j] + a[i*3 + 1]*b[3 + j] + a[i*3 + 2]*b[6 + j]; return o; };
const ap = (m, v) => [m[0]*v[0] + m[1]*v[1] + m[2]*v[2], m[3]*v[0] + m[4]*v[1] + m[5]*v[2], m[6]*v[0] + m[7]*v[1] + m[8]*v[2]];
export function ik2(A, T, l1, l2, pole) {             // 2 ossos: devolve [articulação (joelho/cotovelo), ponta alcançada]
  let d = sub(T, A), D = len(d); const mx = l1 + l2 - 1e-3; if (D > mx) { d = mul(d, mx/D); D = mx; } if (D < .05) { d = [0, -.05, 0]; D = .05; }
  const n = mul(d, 1/D), a = (l1*l1 - l2*l2 + D*D)/(2*D), h = Math.sqrt(Math.max(0, l1*l1 - a*a)); let p = sub(pole, mul(n, dot(pole, n))); p = norm(p);
  return [add(A, add(mul(n, a), mul(p, h))), add(A, d)];
}
// P: { root:[x,y,z], yaw, lean, twist, roll, py(altura do quadril), lift, head:[pitch], hipL/hipR:[pitch,abd,knee], armL/armR:[pitch,abd,elbow], ikL/ikR:{t,w}, ikArmL/ikArmR:{t,w} }
export function humanJoints(P) {
  const R0 = ry(P.yaw || 0), Rp = mm(R0, mm(ry(P.twist || 0), rz(0))), Rt = mm(Rp, mm(rx(P.lean || 0), rz(0)));
  const rt = P.root, py = P.py ?? .93, pelvis = [rt[0], py, rt[2]], J = { pelvis };
  const out = [mm(Rp, [1, 0, 0, 0, 1, 0, 0, 0, 1])];
  const leg = (s, h) => { const hip = add(pelvis, ap(Rp, [s*LEN.hipW, 0, 0])), Rh = mm(Rp, mm(rx(-h[0]), rz(s*h[1]))), kn = add(hip, ap(Rh, [0, -LEN.thigh, 0])), Rk = mm(Rh, rx(h[2])), an = add(kn, ap(Rk, [0, -LEN.shin, 0])), toe = add(an, ap(Rk, [0, -.07, .17])); return { hip, kn, an, toe }; };
  const L = leg(-1, P.hipL || [0, .08, .1]), R = leg(1, P.hipR || [0, .08, .1]);
  const chest = add(pelvis, ap(Rt, [0, LEN.torso, 0])), neck = add(pelvis, ap(Rt, [0, LEN.torso + .06, 0])), Rh2 = mm(Rt, rx(P.head?.[0] || 0)), head = add(chest, ap(Rh2, [0, .06 + LEN.head, .01]));
  const arm = (s, a) => { const sh = add(chest, ap(Rt, [s*LEN.shW, -.04, 0])), Ra = mm(Rt, mm(rx(-a[0]), rz(s*a[1]))), el = add(sh, ap(Ra, [0, -LEN.uarm, 0])), Re = mm(Ra, rx(-a[2])), ha = add(el, ap(Re, [0, -LEN.farm, 0])); return { sh, el, ha }; };
  const AL = arm(-1, P.armL || [.2, .15, .5]), AR = arm(1, P.armR || [.2, .15, .5]);
  Object.assign(J, { hipL: L.hip, knL: L.kn, anL: L.an, toeL: L.toe, hipR: R.hip, knR: R.kn, anR: R.an, toeR: R.toe, chest, neck, head, shL: AL.sh, elL: AL.el, haL: AL.ha, shR: AR.sh, elR: AR.el, haR: AR.ha });
  const fwd = ap(Rp, [0, 0, 1]), right = ap(Rp, [1, 0, 0]); J.fwd = fwd; J.right = right; J.up = ap(Rt, [0, 1, 0]); J.tfwd = ap(Rt, [0, 0, 1]); J.tright = ap(Rt, [1, 0, 0]); J.hfwd = ap(Rh2, [0, 0, 1]); J.hup = ap(Rh2, [0, 1, 0]); J.hright = ap(Rh2, [1, 0, 0]);
  const pts = ['pelvis', 'hipL', 'knL', 'anL', 'toeL', 'hipR', 'knR', 'anR', 'toeR', 'chest', 'neck', 'head', 'shL', 'elL', 'haL', 'shR', 'elR', 'haR'];
  // rolagem lateral do corpo inteiro (mergulho) em torno do quadril + elevação (salto)
  if (P.roll) { const c = Math.cos(P.roll), s = Math.sin(P.roll), o = J.pelvis.slice(); pts.forEach(k => { const p = J[k], dx = p[0] - o[0], dy = p[1] - o[1]; J[k] = [o[0] + dx*c - dy*s, o[1] + dx*s + dy*c, p[2]]; }); [J.up, J.tright, J.hfwd, J.hup, J.hright, J.fwd, J.right, J.tfwd].forEach(v => { const x = v[0]; v[0] = x*c - v[1]*s; v[1] = x*s + v[1]*c; }); }
  // pernas por IK (pé em alvo absoluto no mundo; w = mistura FK→IK)
  [['L', -1], ['R', 1]].forEach(([n, s]) => { const ik = P['ik' + n]; if (!ik) return; const hip = J['hip' + n], an0 = J['an' + n], T = lerp(an0, ik.t, ik.w), [kn, an] = ik2(hip, T, LEN.thigh, LEN.shin, J.fwd.map((v, i) => v + (i === 0 ? s*.15 : 0)));
    const tdir = norm(sub(an, kn)); J['kn' + n] = kn; J['an' + n] = an; J['toe' + n] = add(an, add(mul(J.fwd, .17), [0, -.07, 0])); void tdir; });
  // altura: se nenhuma perna está em IK, apoia o pé mais baixo no chão; senão respeita os alvos (já absolutos)
  const lift = P.lift || 0, anyIK = (P.ikL && P.ikL.w > .5) || (P.ikR && P.ikR.w > .5);
  if (!anyIK && !P.free) { const minY = Math.min(J.toeL[1], J.toeR[1], J.anL[1] - .07, J.anR[1] - .07); P._dy = -minY + lift; } else P._dy = lift;
  if (P._dy) Object.keys(J).forEach(k => { if (Array.isArray(J[k]) && J[k].length === 3 && !['fwd', 'right', 'up', 'tfwd', 'tright', 'hfwd', 'hup', 'hright'].includes(k)) J[k] = [J[k][0], J[k][1] + P._dy, J[k][2]]; });
  [['L', -1], ['R', 1]].forEach(([n, s]) => { const ik = P['ikArm' + n]; if (!ik) return; const sh = J['sh' + n], T = lerp(J['ha' + n], ik.t, ik.w), [el, ha] = ik2(sh, T, LEN.uarm, LEN.farm, [s*.6, -.3, -.5]); J['el' + n] = el; J['ha' + n] = ha; });
  Object.keys(J).forEach(k => { const v = J[k]; if (Array.isArray(v) && v[1] < .03 && !['fwd', 'right', 'up', 'tfwd', 'tright', 'hfwd', 'hup', 'hright'].includes(k)) v[1] = .03; });   // nada atravessa o gramado
  return J;
}

// ================= POSES =================
const P0 = [-.95, 0, 12.45], P1 = [-.62, 0, 11.8], P2 = [-.38, 0, 11.22], P3 = [-.2, 0, 10.95], PS = [-2.6, 0, 16.6];
const lN = (a, b, t) => a + (b - a)*t, ease = u => Math.pow(Math.min(1, Math.max(0, u)), 1.7);
const base = () => ({ root: P0.slice(), yaw: Math.PI, lean: .05, twist: 0, head: [.25], hipL: [0, .06, .12], hipR: [0, .06, .12], armL: [.3, .2, .6], armR: [.3, .2, .6] });
// Cobrador (chuta com a perna 'L', que fica à direita da tela; apoio em 'R'). tc = tempo relativo ao CONTATO (s).
export const KICK_T0 = -.55;
const BACK = [-.2, .55, 11.8], CONT = [0, .18, 11.29], FOL = [.1, .85, 10], LAND = [.02, .08, 10.78], PF = [-.42, .08, 11.06];
export function kickerPose(m) {
  const P = base();
  if (m.mode === 'walkin') { const u = Math.min(1, m.t/.9), s = Math.sin(u*Math.PI*2*2.2); P.root = lerp(PS, P0, sm(u)); P.lean = .1; P.hipL = [.5*s, .05, Math.max(0, -s)*.9 + .1]; P.hipR = [-.5*s, .05, Math.max(0, s)*.9 + .1]; P.armL = [-.5*s, .15, .5]; P.armR = [.5*s, .15, .5]; }
  else if (m.mode === 'idle') { const t = m.t, s = Math.sin(t*2); P.root = [P0[0] + Math.sin(t*.9)*.04, 0, P0[2]]; P.lean = .03 + s*.015; P.head = [.14 + Math.sin(t*.7)*.07]; P.armL = [.5, .35, 1 + s*.05]; P.armR = [.5, .35, 1 - s*.05]; P.hipL = [.04*Math.sin(t*.9), .1, .1]; P.hipR = [-.04*Math.sin(t*.9), .1, .1]; }
  else if (m.mode === 'kick') {
    const t = m.tc;
    if (t < -.3) { const u = (t - KICK_T0)/.25, s = Math.sin(u*Math.PI*2); P.root = lerp(P0, P1, sm(u)); P.lean = .12; P.hipL = [.5*s, .05, Math.max(0, -s)*.9 + .1]; P.hipR = [-.5*s, .05, Math.max(0, s)*.9 + .1]; P.armL = [-.5*s, .15, .5]; P.armR = [.5*s, .15, .5]; }   // 2 passos de aproximação
    else if (t < -.12) { const u = (t + .3)/.18, e = u*.6 + sm(u)*.4; P.root = lerp(P1, P2, e); P.lean = lN(.12, -.05, e); P.ikR = { t: PF, w: sm(u*2.5) }; P.ikL = { t: lerp([-.25, .3, 11.5], BACK, e), w: sm(u*3) }; P.armR = [lN(.3, 1.2, e), lN(.2, .8, e), .5]; P.armL = [lN(.3, -.6, e), lN(.2, .7, e), .3]; }   // apoia o pé e leva a perna para trás
    else if (t < 0) { const u = (t + .12)/.12, e = ease(u); P.root = P2.slice(); P.twist = lN(0, -.4, sm(u)); P.lean = lN(-.05, .2, sm(u)); P.ikR = { t: PF, w: 1 }; const f = lerp(BACK, CONT, e); f[1] += .25*Math.sin(Math.PI*e); P.ikL = { t: f, w: 1 }; P.armR = [1.2, .8, .5]; P.armL = [-.6, .7, .3]; }   // golpe até o contato
    else if (t < .3) { const u = t/.3, e = sm(u); P.root = add(P2, mul([.08, 0, -.22], e)); P.twist = lN(-.4, -.2, e); P.lean = lN(.2, .25, e); P.ikR = { t: add(PF, [0, 0, -.18*e]), w: 1 }; const f = lerp(CONT, FOL, e); f[1] += .15*Math.sin(Math.PI*e); P.ikL = { t: f, w: 1 }; P.armR = [lN(1.2, .6, e), .8, .5]; P.armL = [lN(-.6, -.2, e), .7, .3]; }   // acompanhamento
    else { const u = (t - .3)/.4, e = sm(u); P.root = lerp(add(P2, [.08, 0, -.22]), P3, e); P.twist = lN(-.2, 0, e); P.lean = lN(.25, .05, e); P.ikR = { t: lerp(add(PF, [0, 0, -.18]), [-.3, .08, 10.9], e), w: 1 }; P.ikL = { t: lerp(FOL, LAND, e), w: 1 }; P.armR = [lN(.6, .3, e), lN(.8, .2, e), .6]; P.armL = [lN(-.2, .3, e), lN(.7, .2, e), .6]; }   // recupera o equilíbrio
  } else {                                              // reação depois da jogada (m.type: 'gol' | 'falha' | 'normal')
    P.root = P3.slice(); P.ikR = { t: [-.3, .08, 10.9], w: 1 }; P.ikL = { t: LAND, w: 1 }; P.lean = .05; const d = m.d || 0;
    if (m.type === 'gol') { const up = d < .9; P.armL = up ? [2.9, .35, .2] : [.3, .2, .6]; P.armR = [.3, .2, .6]; P.lift = Math.max(0, .08 - d*.2); }
    else if (m.type === 'falha') { P.lean = .3; P.head = [.7]; P.armL = [2.5, .25, 2.3]; P.armR = [2.5, .25, 2.3]; }
  }
  return P;
}
// Comemoração coletiva (fim da disputa) e decepção do derrotado
export function cheerPose(t, i, pos, yaw) { const s = Math.sin(t*7 + i*1.3), P = base(); P.root = pos; P.yaw = yaw; P.lift = Math.abs(s)*.28; P.lean = -.05; P.head = [-.2]; P.hipL = [.2, .2, .5]; P.hipR = [.2, .2, .5];
  P.armL = [[2.9, 3, 2.7][i % 3], [.5, .8, .4][i % 3], .2]; P.armR = [[2.9, .6, 2.7][i % 3], [.5, .5, .4][i % 3], [.2, 1.6, .2][i % 3]]; return P; }
export function dejectedPose(t, pos, yaw) { const P = base(); P.root = pos; P.yaw = yaw; P.lean = .5; P.head = [1]; P.hipL = [.9, .1, 1.5]; P.hipR = [.9, .1, 1.5]; P.armL = [1.9, .1, 2.7]; P.armR = [1.9, .1, 2.7]; return P; }   // cabisbaixo, mãos no rosto
// Goleiro: espera → antecipação → reação (4 categorias) → contato/tentativa → queda → recuperação
export function keeperPose(k, b, res, d, now, ballW) {
  const xw = (k.x - .5)*GOAL_W, P = { root: [xw, 0, .55], yaw: 0, lean: .22, twist: 0, head: [.1], hipL: [.5, .24, .95], hipR: [.5, .24, .95], armL: [1, .75, 1], armR: [1, .75, 1] }, info = { cat: 'espera', T: null };
  const sw = Math.sin(now*1.6); P.root[0] += sw*.1; P.hipL[0] = .5 + Math.max(0, sw)*.25; P.hipR[0] = .5 + Math.max(0, -sw)*.25; P.armL[0] = 1 + Math.sin(now*2.2)*.12; P.armR[0] = 1 - Math.sin(now*2.2)*.12;   // passinhos laterais de espera
  if (b && b.t > -.2 && (k.t0 == null || b.t < k.t0)) { const c = sm((b.t + .2)/.2); P.hipL[2] += .35*c; P.hipR[2] += .35*c; P.lean += .08*c; }                                          // antecipação: agacha
  if (!b || k.t0 == null) return { P, info };
  const dir = Math.sign(k.tx - .5) || 1, th = k.th ?? .4, cat = saveCategory(th, Math.abs(k.tx - .5)); info.cat = cat;
  const p = Math.min(1, Math.max(0, (b.t - k.t0)/.6)), e = 1 - (1 - p)*(1 - p), s1 = Math.sin(p*Math.PI);
  let A = 0, lift = 0, tgt = goalToWorld(k.tx, th); if (res === 'defesa' && ballW) tgt = lerp(tgt, ballW, sm(p*1.3));
  P.hipL[0] = .2; P.hipR[0] = .2; P.root[0] = xw;
  const crouch = cat === 'central' && th <= .62;
  if (cat === 'alta') { A = .5; lift = s1*.55; P.hipL = [-.3, .3, .8]; P.hipR = [-.3, .3, .8]; P.lean = .05; }
  else if (cat === 'media') { A = 1.05; lift = s1*.42; P.hipL = [-.1, .4, .6]; P.hipR = [-.1, .4, .9]; P.lean = .1; }
  else if (cat === 'baixa') { A = 1.4; lift = s1*.16; P.hipL = [-.2, .3, .7]; P.hipR = [-.2, .3, .9]; P.lean = .05; }
  else if (!crouch) { lift = s1*.55; P.hipL = [-.2, .2, .7]; P.hipR = [-.2, .2, .7]; P.lean = 0; }                                                                // central alta: salto reto
  else { P.hipL = [.9*e + .3, .3, 1.5*e + .5]; P.hipR = [.9*e + .3, .3, 1.5*e + .5]; P.lean = .25 + .35*e; }                                                          // central: agachamento e encaixe
  P.roll = -dir*A*e; P.lift = lift; info.T = tgt;
  if (d > 0) {                                                                                                                                                         // queda e recuperação
    P.lift = lift*Math.max(0, 1 - d/.3); const rec = sm((d - 1.0)/.7); P.roll = -dir*A*(1 - rec); P.root[0] = lN(xw, 0, rec);
    if (rec > 0) { P.hipL = [.5, .24, .95]; P.hipR = [.5, .24, .95]; P.lean = .22; }
    info.T = rec > .3 ? null : tgt; if (res === 'gol' && d > .4) info.sad = true; if (res === 'defesa' && d > .4) info.happy = true;
  }
  P.ikArmL = P.ikArmR = info.T ? { t: info.T, w: sm(p*2.2) } : null; if (!info.T) { delete P.ikArmL; delete P.ikArmR; } else { P.ikArmL = { t: add(info.T, [-.12, 0, 0]), w: sm(p*2.2) }; P.ikArmR = { t: add(info.T, [.12, 0, 0]), w: sm(p*2.2) }; }
  return { P, info };
}
