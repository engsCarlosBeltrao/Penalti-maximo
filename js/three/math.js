// Matemática pura (sem Three.js) usada para aplicar as poses do rig.js a um esqueleto GLB. Quaternions = [x, y, z, w]; matrizes 3x3 por linha.
import { sub, add, mul, dot, cross, norm, len } from '../vec.js';
export { sub, add, mul, dot, cross, norm, len };
export const qmul = (a, b) => [a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1], a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0], a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3], a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]];
export const qconj = q => [-q[0], -q[1], -q[2], q[3]];
export const qnorm = q => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0]/l, q[1]/l, q[2]/l, q[3]/l]; };
export const qrot = (q, v) => { const u = [q[0], q[1], q[2]], t = mul(cross(u, v), 2); return add(add(v, mul(t, q[3])), cross(u, t)); };
export function qslerp(a, b, t) {
  let c = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3], bb = b; if (c < 0) { c = -c; bb = [-b[0], -b[1], -b[2], -b[3]]; }
  if (c > .9995) return qnorm([a[0] + (bb[0] - a[0])*t, a[1] + (bb[1] - a[1])*t, a[2] + (bb[2] - a[2])*t, a[3] + (bb[3] - a[3])*t]);
  const th = Math.acos(c), s = Math.sin(th), w1 = Math.sin((1 - t)*th)/s, w2 = Math.sin(t*th)/s; return [a[0]*w1 + bb[0]*w2, a[1]*w1 + bb[1]*w2, a[2]*w1 + bb[2]*w2, a[3]*w1 + bb[3]*w2];
}
export const matCols = (a, b, c) => [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]];
export const matT = m => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
export const matMul = (a, b) => { const o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i*3 + j] = a[i*3]*b[j] + a[i*3 + 1]*b[3 + j] + a[i*3 + 2]*b[6 + j]; return o; };
export function qfromMat(m) {
  const tr = m[0] + m[4] + m[8]; let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1)*2; q = [(m[7] - m[5])/s, (m[2] - m[6])/s, (m[3] - m[1])/s, s/4]; }
  else if (m[0] > m[4] && m[0] > m[8]) { const s = Math.sqrt(1 + m[0] - m[4] - m[8])*2; q = [s/4, (m[1] + m[3])/s, (m[2] + m[6])/s, (m[7] - m[5])/s]; }
  else if (m[4] > m[8]) { const s = Math.sqrt(1 + m[4] - m[0] - m[8])*2; q = [(m[1] + m[3])/s, s/4, (m[5] + m[7])/s, (m[2] - m[6])/s]; }
  else { const s = Math.sqrt(1 + m[8] - m[0] - m[4])*2; q = [(m[2] + m[6])/s, (m[5] + m[7])/s, s/4, (m[3] - m[1])/s]; }
  return qnorm(q);
}
// Base ortonormal com o 1º eixo = a e o 2º = componente de b perpendicular a a (com mistura para "alt" quando b fica quase paralelo a a, evitando saltos de torção)
export function orth(a, b, alt = [0, 1, 0]) {
  a = norm(a); const d = Math.abs(dot(a, norm(b))), w = Math.min(1, Math.max(0, (d - .8)/.17)); let r = norm(add(mul(norm(b), 1 - w), mul(norm(alt), w)));
  let y = sub(r, mul(a, dot(r, a))); if (len(y) < 1e-4) { y = sub([1, 0, 0], mul(a, a[0])); if (len(y) < 1e-4) y = [0, 0, 1]; } y = norm(y); return [a, y, cross(a, y)];
}
export const frameXZ = (x, z) => { const X = norm(x); let Z = sub(z, mul(X, dot(X, z))); Z = norm(Z); return qfromMat(matCols(X, cross(Z, X), Z)); };   // quaternion da base (x, y = z×x, z)
