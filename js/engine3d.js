// Mini motor 3D próprio (sem dependências): câmera em perspectiva real, projeção, fila de profundidade (algoritmo do pintor)
// e primitivas (esfera, cápsula, quadrilátero, textura mapeada em plano). Coordenadas: x direita · y cima · z em direção à câmera.
export const W = 960, H = 540;
import { sub, add, mul, dot, cross, norm, len, lerp, shade } from './vec.js';
export class Engine {
  constructor() { this.pos = [0, 2.8, 22]; this.tgt = [0, 1.15, 0]; this.fov = 30; this.items = []; this.c = null; }
  begin(c) { this.c = c; this.items.length = 0; const f = norm(sub(this.tgt, this.pos)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f); this.f = f; this.r = r; this.u = u; this.focal = (H/2)/Math.tan(this.fov*Math.PI/360); }
  proj(p) {                                           // → [x, y, profundidade, escala px/m] ou null atrás da câmera
    const d = sub(p, this.pos), z = dot(d, this.f); if (z < .2) return null; const k = this.focal/z;
    return [W/2 + dot(d, this.r)*k, H/2 - dot(d, this.u)*k, z, k];
  }
  push(z, fn) { this.items.push({ z, fn }); }
  flush() { const it = this.items; it.sort((a, b) => b.z - a.z); const c = this.c; for (let i = 0; i < it.length; i++) it[i].fn(c); it.length = 0; }
  sphere(p, r, col, grad = true) {
    const q = this.proj(p); if (!q) return; const rad = r*q[3];
    this.push(q[2], c => { if (grad) { const g = c.createRadialGradient(q[0] - rad*.35, q[1] - rad*.4, rad*.1, q[0], q[1], rad); g.addColorStop(0, shade(col, 1.25)); g.addColorStop(1, shade(col, .72)); c.fillStyle = g; } else c.fillStyle = col; c.beginPath(); c.arc(q[0], q[1], rad, 0, 7); c.fill(); });
  }
  capsule(a, b, r, col) {                             // membro: cilindro com pontas redondas, com realce de luz
    const qa = this.proj(a), qb = this.proj(b); if (!qa || !qb) return; const w = r*(qa[3] + qb[3]);
    this.push((qa[2] + qb[2])/2 - .01, c => { c.lineCap = 'round'; c.strokeStyle = shade(col, .7); c.lineWidth = w; c.beginPath(); c.moveTo(qa[0], qa[1]); c.lineTo(qb[0], qb[1]); c.stroke();
      c.strokeStyle = col; c.lineWidth = w*.66; c.beginPath(); c.moveTo(qa[0] - w*.08, qa[1] - w*.1); c.lineTo(qb[0] - w*.08, qb[1] - w*.1); c.stroke(); });
  }
  limb(a, b, r0, r1, col) {                           // membro afilado (cone com pontas redondas) com gradiente de luz vinda de cima-esquerda
    const qa = this.proj(a), qb = this.proj(b); if (!qa || !qb) return; const ra = r0*qa[3], rb = r1*qb[3];
    this.push((qa[2] + qb[2])/2 - .01, c => {
      const dx = qb[0] - qa[0], dy = qb[1] - qa[1], L = Math.hypot(dx, dy) || 1, nx = -dy/L, ny = dx/L, sg = (nx*-.5 + ny*-.8) > 0 ? 1 : -1, mx = (qa[0] + qb[0])/2, my = (qa[1] + qb[1])/2, rr = (ra + rb)/2 + .5;
      const g = c.createLinearGradient(mx - nx*sg*rr, my - ny*sg*rr, mx + nx*sg*rr, my + ny*sg*rr); g.addColorStop(0, shade(col, .6)); g.addColorStop(.5, col); g.addColorStop(1, shade(col, 1.2)); c.fillStyle = g;
      c.beginPath(); c.moveTo(qa[0] + nx*ra, qa[1] + ny*ra); c.lineTo(qb[0] + nx*rb, qb[1] + ny*rb); c.lineTo(qb[0] - nx*rb, qb[1] - ny*rb); c.lineTo(qa[0] - nx*ra, qa[1] - ny*ra); c.closePath(); c.fill();
      c.beginPath(); c.arc(qa[0], qa[1], ra, 0, 7); c.fill(); c.beginPath(); c.arc(qb[0], qb[1], rb, 0, 7); c.fill(); });
  }
  ellip(p, rx, ry, up, col, z) {                      // elipsoide (cabeça, mão, bota) orientado pelo vetor "para cima"
    const q = this.proj(p), qu = this.proj(add(p, mul(up, .1))); if (!q || !qu) return; const ang = Math.atan2(qu[0] - q[0], -(qu[1] - q[1])), a = rx*q[3], b = ry*q[3];
    this.push(z ?? q[2], c => { const g = c.createRadialGradient(q[0] - a*.35, q[1] - b*.4, Math.min(a, b)*.1, q[0], q[1], Math.max(a, b)); g.addColorStop(0, shade(col, 1.2)); g.addColorStop(1, shade(col, .7)); c.fillStyle = g; c.beginPath(); c.ellipse(q[0], q[1], a, b, ang, 0, 7); c.fill(); });
  }
  quad(pts, col, z, alpha = 1) {
    const q = pts.map(p => this.proj(p)); if (q.some(v => !v)) return;
    this.push(z ?? q.reduce((s, v) => s + v[2], 0)/q.length, c => { c.globalAlpha = alpha; c.fillStyle = col; c.beginPath(); c.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) c.lineTo(q[i][0], q[i][1]); c.closePath(); c.fill(); c.globalAlpha = 1; });
  }
  tex(img, TL, TR, BL, z) {                           // textura mapeada num plano 3D (transformação afim): nomes/números "impressos" no tecido
    const a = this.proj(TL), b = this.proj(TR), d = this.proj(BL); if (!a || !b || !d) return; const iw = img.width, ih = img.height;
    this.push(z ?? a[2], c => { c.save(); c.transform((b[0] - a[0])/iw, (b[1] - a[1])/iw, (d[0] - a[0])/ih, (d[1] - a[1])/ih, a[0], a[1]); c.drawImage(img, 0, 0); c.restore(); });
  }
  ground(p, rx, rz, col, alpha, z) {                  // elipse achatada no chão (sombras)
    const q = this.proj(p), qx = this.proj([p[0] + rx, p[1], p[2]]), qz = this.proj([p[0], p[1], p[2] - rz]); if (!q || !qx || !qz) return;
    this.push(z ?? 1e3, c => { c.globalAlpha = alpha; c.fillStyle = col; c.beginPath(); c.ellipse(q[0], q[1], Math.abs(qx[0] - q[0]), Math.abs(qz[1] - q[1]), 0, 0, 7); c.fill(); c.globalAlpha = 1; });
  }
}
