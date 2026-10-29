// CABELOS E BARBAS PROCEDURAIS (geometria pura, roda no Node). O modelo-base (Quaternius Superhero) não tem cabelo no couro cabeludo: só sobrancelhas.
// Cada penteado/barba é uma casca fina que segue a superfície REAL da cabeça (mapa radial medido nos vértices de pele), então encaixa sem flutuar nem afundar.
// Eixos do modelo: +Y para cima, +Z para a frente (rosto), cabeça centrada em x=0. θ=0 é a frente do rosto, cresce para o lado +X.
const TAU = Math.PI*2, clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a)*t, sstep = t => { t = clamp(t, 0, 1); return t*t*(3 - 2*t); };
const interp = (tab, x) => { if (x <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; return lerp(y0, y1, (x - x0)/(x1 - x0)); } return tab[tab.length - 1][1]; };
export const HAIR_STYLES = ['bald', 'buzz', 'short', 'curly', 'long', 'afro', 'bun'], BEARDS = ['none', 'stubble', 'short', 'full', 'mustache'];
// ---- mapa radial da pele: r(θ, y) = distância ao eixo da cabeça (maior vértice de pele em cada célula), preenchido nos buracos ----
export function skinMap(verts, { y0 = 1.5, y1 = 1.83, dy = .006, nth = 48 } = {}) {
  const ny = Math.round((y1 - y0)/dy) + 1, R = Array.from({ length: ny }, () => new Float32Array(nth).fill(NaN));
  for (const [x, y, z] of verts) { if (y < y0 || y > y1) continue; const th = (Math.atan2(x, z) + TAU) % TAU, r = Math.hypot(x, z), iy = Math.round((y - y0)/dy);
    for (const [ky, wy] of [[iy, 1]]) { const it = Math.round(th/TAU*nth) % nth; if (!(R[ky][it] >= r)) R[ky][it] = r; } }
  for (let pass = 0; pass < 40; pass++) { let any = false; for (let i = 0; i < ny; i++) for (let k = 0; k < nth; k++) if (Number.isNaN(R[i][k])) { const n = [R[i][(k + 1) % nth], R[i][(k + nth - 1) % nth], R[i - 1]?.[k], R[i + 1]?.[k]].filter(v => v !== undefined && !Number.isNaN(v)); if (n.length) { R[i][k] = n.reduce((a, c) => a + c, 0)/n.length; any = true; } } if (!any) break; }
  for (let i = 0; i < ny; i++) for (let k = 0; k < nth; k++) if (Number.isNaN(R[i][k])) R[i][k] = 0;
  // suaviza o ruído (média 3×3) para a casca não herdar cada vértice da orelha
  const S = R.map(r => Float32Array.from(r)); for (let i = 0; i < ny; i++) for (let k = 0; k < nth; k++) { let s = 0, c = 0; for (let a = -1; a <= 1; a++) for (let d = -1; d <= 1; d++) { const row = R[i + a]; if (!row) continue; s += row[(k + d + nth) % nth]; c++; } S[i][k] = s/c; }
  return (th, y) => { th = ((th % TAU) + TAU) % TAU; const fy = clamp((y - y0)/dy, 0, ny - 1), i0 = Math.floor(fy), i1 = Math.min(ny - 1, i0 + 1), ty = fy - i0, ft = th/TAU*nth, k0 = Math.floor(ft) % nth, k1 = (k0 + 1) % nth, tt = ft - Math.floor(ft);
    const a = lerp(S[i0][k0], S[i0][k1], tt), b = lerp(S[i1][k0], S[i1][k1], tt); return lerp(a, b, ty); };
}
// ---- malha em grade (anéis × colunas) → vértices com normais suaves e triângulos ----
function gridMesh(rows, closeTop = false, wrap = true) {                // rows[i][k] = [x,y,z]; i de baixo para cima
  const NR = rows.length, NC = rows[0].length, V = [], T = []; rows.forEach(r => r.forEach(p => V.push({ p: p.slice() })));
  const id = (i, k) => i*NC + (wrap ? (k + NC) % NC : k); const last = wrap ? NC : NC - 1;
  for (let i = 0; i < NR - 1; i++) for (let k = 0; k < last; k++) { const a = id(i, k), b = id(i, k + 1), c = id(i + 1, k + 1), d = id(i + 1, k); T.push([a, b, c], [a, c, d]); }
  return { V, T };
}
function finish(m, center) {                                            // normais por área, viradas para fora do centro
  const N = m.V.map(() => [0, 0, 0]); for (const [a, b, c] of m.T) { const A = m.V[a].p, B = m.V[b].p, C = m.V[c].p, u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]], n = [u[1]*w[2] - u[2]*w[1], u[2]*w[0] - u[0]*w[2], u[0]*w[1] - u[1]*w[0]]; for (const i of [a, b, c]) { N[i][0] += n[0]; N[i][1] += n[1]; N[i][2] += n[2]; } }
  m.V.forEach((v, i) => { let n = N[i], l = Math.hypot(...n) || 1; n = n.map(x => x/l); const d = [v.p[0] - center[0], v.p[1] - center[1], v.p[2] - center[2]]; if (n[0]*d[0] + n[1]*d[1] + n[2]*d[2] < 0) n = n.map(x => -x); v.n = n; });
  return m;
}
const merge = (...ms) => { const o = { V: [], T: [] }; for (const m of ms) { const b = o.V.length; o.V.push(...m.V); m.T.forEach(t => o.T.push(t.map(i => i + b))); } return o; };
function ico(c, r, sy = 1) {                                            // esfera simples (coque)
  const V = [], T = [], ns = 8, nl = 6; for (let i = 0; i <= nl; i++) { const ph = Math.PI*i/nl; for (let k = 0; k < ns; k++) { const th = TAU*k/ns; V.push({ p: [c[0] + r*Math.sin(ph)*Math.sin(th), c[1] + r*sy*Math.cos(ph), c[2] + r*Math.sin(ph)*Math.cos(th)] }); } }
  for (let i = 0; i < nl; i++) for (let k = 0; k < ns; k++) { const a = i*ns + k, b = i*ns + (k + 1)%ns, c2 = (i + 1)*ns + (k + 1)%ns, d = (i + 1)*ns + k; T.push([a, d, c2], [a, c2, b]); } return { V, T };
}
// ---- linha do cabelo (altura y em função de θ, simétrica) ----
const LINE = [[0, 1.752], [.7, 1.746], [1.2, 1.735], [1.55, 1.705], [1.95, 1.69], [2.4, 1.655], [Math.PI, 1.632]];
const hairline = th => { const a = Math.abs(((th + Math.PI) % TAU + TAU) % TAU - Math.PI); return interp(LINE, a); };
export function buildHair(style, skinR, { yTop = 1.815, headC = [0, 1.7, 0] } = {}) {
  if (style === 'bald') return null;
  const P = { buzz: { t: .0035, vol: .002 }, short: { t: .011, vol: .014 }, curly: { t: .012, vol: .02 }, long: { t: .011, vol: .012 }, afro: { t: .011, vol: .016 }, bun: { t: .011, vol: .014 } }[style]; if (!P) throw new Error('Penteado desconhecido: ' + style);
  const NT = 48, NS = style === 'long' ? 12 : 8, rows = [];
  const lineOf = th => { let y = hairline(th); if (style === 'long') { const a = Math.abs(((th + Math.PI) % TAU + TAU) % TAU - Math.PI), f = sstep((a - 1.45)/.9); y = lerp(y, 1.50, f); } return y; };
  for (let i = 0; i <= NS; i++) { const s = i/NS, row = [];
    for (let k = 0; k < NT; k++) { const th = TAU*k/NT, y0 = lineOf(th), ytopH = yTop + P.vol, y = lerp(y0, ytopH, s), yq = Math.max(y, 1.6), yRef = Math.min(y, yTop - .002);
      let r = skinR(th, style === 'long' && y < 1.64 ? 1.64 : yRef) + P.t + P.vol*s*s; if (style === 'long' && y < 1.64) r += (1.64 - y)*.22;
      if (style === 'curly') r += .016*Math.sin(th*11 + s*9)*Math.sin(s*4.2 + .6)*(0.5 + s) + .006;
      if (i === NS) r = 0; else { const cap = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, y - (yTop - .05))/(yTop + P.vol - (yTop - .05) + .004), 2))); r *= clamp(.35 + cap, 0, 1) ; }
      row.push([r*Math.sin(th), y, r*Math.cos(th)]); } rows.push(row); }
  let m = finish(gridMesh(rows), headC);
  if (style === 'afro') m.V.forEach(v => { const dx = v.p[0] - headC[0], dy = v.p[1] - headC[1], dz = v.p[2] - headC[2]; v.p = [headC[0] + dx*1.34, headC[1] + dy*1.2 + .012, headC[2] + dz*1.3]; });
  if (style === 'bun') m = finish(merge(m, ico([0, yTop + .018, -.05], .04, .9)), headC);
  return m;
}
export function buildBeard(kind, skinR, headC = [0, 1.7, 0]) {
  if (kind === 'none') return null;
  const cfg = { stubble: { th: 1.55, t: .0028, lo: .006 }, short: { th: 1.55, t: .008, lo: .004 }, full: { th: 1.62, t: .0135, lo: 0 }, mustache: { th: .34, t: .006, lo: 0 } }[kind]; if (!cfg) throw new Error('Barba desconhecida: ' + kind);
  const NT = kind === 'mustache' ? 9 : 25, NY = kind === 'mustache' ? 3 : 7, rows = [];
  const U = th => { const a = Math.abs(th); return kind === 'mustache' ? 1.641 : interp([[0, 1.626], [.5, 1.634], [1.0, 1.65], [1.45, 1.668], [2, 1.67]], a); };
  const Lw = th => { const a = Math.abs(th); return kind === 'mustache' ? 1.629 : interp([[0, 1.596 + cfg.lo], [.6, 1.602 + cfg.lo], [1.1, 1.624 + cfg.lo], [1.5, 1.652], [2, 1.664]], a); };
  for (let i = 0; i <= NY; i++) { const s = i/NY, row = [];
    for (let k = 0; k < NT; k++) { const q = NT === 1 ? 0 : k/(NT - 1), th = lerp(-cfg.th, cfg.th, q), y = lerp(Lw(th), U(th), s), edge = Math.min(sstep(s*5), sstep((1 - s)*5), sstep(q*8), sstep((1 - q)*8)), chin = kind === 'full' ? .012*Math.exp(-th*th/.25)*(1 - s) : 0, must = kind === 'mustache' ? Math.sin(Math.PI*clamp(s, 0, 1))*.003 : 0;
      const r = skinR(th, kind === 'mustache' ? 1.622 : clamp(y, 1.58, 1.8)) + cfg.t*(.35 + .65*edge) + chin + must; row.push([r*Math.sin(th), y, r*Math.cos(th)]); } rows.push(row); }
  return finish(gridMesh(rows, false, false), headC);
}
