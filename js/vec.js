// VETORES 3D ([x, y, z]) e cor: funções puras usadas pelo motor 3D, pelo rig, pela física da bola e pelas ferramentas.
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, s) => [a[0]*s, a[1]*s, a[2]*s];
export const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2], cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
export const len = a => Math.hypot(a[0], a[1], a[2]), norm = a => { const l = len(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; }, lerp = (a, b, t) => [a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t, a[2] + (b[2]-a[2])*t];
const cache = new Map();
export function shade(hex, f) {                       // clareia (f>1) ou escurece (f<1) uma cor #rrggbb
  const key = hex + f; let v = cache.get(key); if (v) return v; const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16)*f | 0), g = Math.min(255, (n >> 8 & 255)*f | 0), b = Math.min(255, (n & 255)*f | 0); v = `rgb(${r},${g},${b})`; cache.set(key, v); return v;
}
