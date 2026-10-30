// CABELOS, BARBAS, BIGODES, COSTELETAS E FAIXA PROCEDURAIS (geometria pura, roda no Node). O modelo-base não tem cabelo no couro cabeludo: só sobrancelhas.
// Cada peça é uma casca fina que segue a superfície REAL da cabeça (mapa radial medido nos vértices de pele), então encaixa sem flutuar nem afundar.
// Além da posição, cada vértice leva h = [cobertura, tom, u, v] (atributo _HAIR do GLB), lido pelo shader de js/three/hairMaterial.js:
//   cobertura 1 = cabelo, 0 = pele (degradê, linha do cabelo e barba por fazer misturam as duas cores); tom 0 = raiz/lateral, 1 = topo/pontas (duas cores);
//   u, v = coordenadas da textura de fios (u em volta da cabeça, v ao longo do crescimento). É isso que tira o aspecto de "capacete".
// Eixos do modelo: +Y para cima, +Z para a frente (rosto), cabeça centrada em x=0. θ=0 é a frente do rosto, cresce para o lado +X.
const TAU = Math.PI*2, clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a)*t, sstep = t => { t = clamp(t, 0, 1); return t*t*(3 - 2*t); };
const interp = (tab, x) => { if (x <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; return lerp(y0, y1, (x - x0)/(x1 - x0)); } return tab[tab.length - 1][1]; };
const absTh = th => Math.abs(((th + Math.PI) % TAU + TAU) % TAU - Math.PI);                        // 0 na frente, π na nuca
// ---- ruído suave determinístico, periódico em x (para dar a volta na cabeça sem emenda) ----
const h2 = (i, j, s) => { let h = (i*374761393 + j*668265263 + s*982451653) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0)/4294967296; };
function noise(x, y, period, seed = 1) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx*fx*(3 - 2*fx), v = fy*fy*(3 - 2*fy), P = i => ((i % period) + period) % period;
  const a = h2(P(xi), yi, seed), b = h2(P(xi + 1), yi, seed), c = h2(P(xi), yi + 1, seed), d = h2(P(xi + 1), yi + 1, seed); return lerp(lerp(a, b, u), lerp(c, d, u), v)*2 - 1; }
const fbm = (th, y, f, seed) => { const p = Math.round(f); return .65*noise(th/TAU*p, y*f*6, p, seed) + .35*noise(th/TAU*p*2, y*f*12, p*2, seed + 7); };
// ---- mapa radial da pele: r(θ, y) = distância ao eixo da cabeça (maior vértice de pele em cada célula), preenchido nos buracos ----
export function skinMap(verts, { y0 = 1.45, y1 = 1.83, dy = .006, nth = 48 } = {}) {
  const ny = Math.round((y1 - y0)/dy) + 1, R = Array.from({ length: ny }, () => new Float32Array(nth).fill(NaN));
  for (const [x, y, z] of verts) { if (y < y0 || y > y1) continue; const th = (Math.atan2(x, z) + TAU) % TAU, r = Math.hypot(x, z), iy = Math.round((y - y0)/dy), it = Math.round(th/TAU*nth) % nth; if (!(R[iy][it] >= r)) R[iy][it] = r; }
  for (let pass = 0; pass < 40; pass++) { let any = false; for (let i = 0; i < ny; i++) for (let k = 0; k < nth; k++) if (Number.isNaN(R[i][k])) { const n = [R[i][(k + 1) % nth], R[i][(k + nth - 1) % nth], R[i - 1]?.[k], R[i + 1]?.[k]].filter(v => v !== undefined && !Number.isNaN(v)); if (n.length) { R[i][k] = n.reduce((a, c) => a + c, 0)/n.length; any = true; } } if (!any) break; }
  for (let i = 0; i < ny; i++) for (let k = 0; k < nth; k++) if (Number.isNaN(R[i][k])) R[i][k] = 0;
  // suaviza o ruído (média 3×3) para a casca não herdar cada vértice da orelha
  const S = R.map(r => Float32Array.from(r)); for (let i = 0; i < ny; i++) for (let k = 0; k < nth; k++) { let s = 0, c = 0; for (let a = -1; a <= 1; a++) for (let d = -1; d <= 1; d++) { const row = R[i + a]; if (!row) continue; s += row[(k + d + nth) % nth]; c++; } S[i][k] = s/c; }
  return (th, y) => { th = ((th % TAU) + TAU) % TAU; const fy = clamp((y - y0)/dy, 0, ny - 1), i0 = Math.floor(fy), i1 = Math.min(ny - 1, i0 + 1), ty = fy - i0, ft = th/TAU*nth, k0 = Math.floor(ft) % nth, k1 = (k0 + 1) % nth, tt = ft - Math.floor(ft);
    const a = lerp(S[i0][k0], S[i0][k1], tt), b = lerp(S[i1][k0], S[i1][k1], tt); return lerp(a, b, ty); };
}
// ---- malha em grade (anéis × colunas) → vértices com normais suaves e triângulos ----
function gridMesh(rows, H, wrap = true) {                             // rows[i][k] = [x,y,z]; H[i][k] = [cobertura, tom, u, v]
  const NR = rows.length, NC = rows[0].length, V = [], T = []; rows.forEach((r, i) => r.forEach((p, k) => V.push({ p: p.slice(), h: H[i][k] })));
  const id = (i, k) => i*NC + (wrap ? (k + NC) % NC : k), last = wrap ? NC : NC - 1;
  for (let i = 0; i < NR - 1; i++) for (let k = 0; k < last; k++) { const a = id(i, k), b = id(i, k + 1), c = id(i + 1, k + 1), d = id(i + 1, k); T.push([a, b, c], [a, c, d]); }
  return { V, T };
}
function finish(m, center) {                                            // normais por área, viradas para fora do centro
  const N = m.V.map(() => [0, 0, 0]); for (const [a, b, c] of m.T) { const A = m.V[a].p, B = m.V[b].p, C = m.V[c].p, u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]], n = [u[1]*w[2] - u[2]*w[1], u[2]*w[0] - u[0]*w[2], u[0]*w[1] - u[1]*w[0]]; for (const i of [a, b, c]) { N[i][0] += n[0]; N[i][1] += n[1]; N[i][2] += n[2]; } }
  m.V.forEach((v, i) => { let n = N[i], l = Math.hypot(...n) || 1; n = n.map(x => x/l); const d = [v.p[0] - center[0], v.p[1] - center[1], v.p[2] - center[2]]; if (n[0]*d[0] + n[1]*d[1] + n[2]*d[2] < 0) n = n.map(x => -x); v.n = n; v.h ||= [1, .5, 0, 0]; });
  return m;
}
const merge = (...ms) => { const o = { V: [], T: [] }; for (const m of ms) { if (!m) continue; const b = o.V.length; o.V.push(...m.V); m.T.forEach(t => o.T.push(t.map(i => i + b))); } return o; };
function blob(c, r, sy, rough, seed) {                                  // esfera irregular (coque, ponta de dread)
  const V = [], T = [], ns = 12, nl = 8; for (let i = 0; i <= nl; i++) { const ph = Math.PI*i/nl; for (let k = 0; k < ns; k++) { const th = TAU*k/ns, rr = r*(1 + rough*noise(k*.9, i*.9, 999, seed)); V.push({ p: [c[0] + rr*Math.sin(ph)*Math.sin(th), c[1] + rr*sy*Math.cos(ph), c[2] + rr*Math.sin(ph)*Math.cos(th)], h: [1, .4 + .6*(1 - i/nl), k/ns*3, i/nl*3] }); } }
  for (let i = 0; i < nl; i++) for (let k = 0; k < ns; k++) { const a = i*ns + k, b = i*ns + (k + 1)%ns, c2 = (i + 1)*ns + (k + 1)%ns, d = (i + 1)*ns + k; T.push([a, d, c2], [a, c2, b]); } return finish({ V, T }, c);
}
function tube(path, rad, seed) {                                        // tubo (dread) ao longo de uma polilinha, afinando na ponta
  const ns = 6, V = [], T = [], L = path.length; for (let i = 0; i < L; i++) { const p = path[i], q = path[Math.min(L - 1, i + 1)], o = path[Math.max(0, i - 1)], t = [q[0] - o[0], q[1] - o[1], q[2] - o[2]], tl = Math.hypot(...t) || 1, tt = t.map(x => x/tl);
    let a = Math.abs(tt[1]) < .9 ? [0, 1, 0] : [1, 0, 0]; const b1 = [tt[1]*a[2] - tt[2]*a[1], tt[2]*a[0] - tt[0]*a[2], tt[0]*a[1] - tt[1]*a[0]], bl = Math.hypot(...b1); const B1 = b1.map(x => x/bl), B2 = [tt[1]*B1[2] - tt[2]*B1[1], tt[2]*B1[0] - tt[0]*B1[2], tt[0]*B1[1] - tt[1]*B1[0]];
    const r = rad*(1 - .35*i/(L - 1))*(1 + .15*noise(i*.8, seed, 999, seed)); for (let k = 0; k < ns; k++) { const an = TAU*k/ns; V.push({ p: [p[0] + r*(Math.cos(an)*B1[0] + Math.sin(an)*B2[0]), p[1] + r*(Math.cos(an)*B1[1] + Math.sin(an)*B2[1]), p[2] + r*(Math.cos(an)*B1[2] + Math.sin(an)*B2[2])], h: [1, .3 + .7*i/(L - 1), k/ns*2, i*.9] }); } }
  for (let i = 0; i < L - 1; i++) for (let k = 0; k < ns; k++) { const a = i*ns + k, b = i*ns + (k + 1)%ns, c = (i + 1)*ns + (k + 1)%ns, d = (i + 1)*ns + k; T.push([a, b, c], [a, c, d]); }
  const m = { V, T }, N = m.V.map(() => [0, 0, 0]); m.V.forEach((v, idx) => { const p = path[Math.floor(idx/ns)]; const d = [v.p[0] - p[0], v.p[1] - p[1], v.p[2] - p[2]], l = Math.hypot(...d) || 1; v.n = d.map(x => x/l); }); return m;
}
// ---- linha do cabelo (altura y em função de θ, simétrica) ----
const LINE = [[0, 1.760], [.4, 1.761], [.72, 1.756], [1.0, 1.744], [1.28, 1.726], [1.55, 1.705], [1.95, 1.69], [2.4, 1.655], [Math.PI, 1.632]];   // entradas leves nas têmporas (não é uma linha reta de cuia)
const hairline = th => interp(LINE, absTh(th));
// ---- CATÁLOGO DE PENTEADOS ----
// fade: altura do degradê nas laterais/nuca (0 = sem degradê); side: espessura da casca nas laterais; top: espessura no alto; vol: volume extra na coroa;
// quiff: topete (volume na frente do alto); fringe: franja (desce sobre a testa); recede: entradas; len: comprimento abaixo da linha (laterais/nuca);
// curl/spike/wave/twist/coil: relevo; rows: tranças nagô; locs: dreads pendurados; bun: coque; afro: escala do black power. tex: escala da textura [u, v]. base: penteado do renderizador 2D.
const FADE = { none: 0, low: .02, mid: .042, high: .07 };
export const HAIR = {
  raspado_entradas: { fade: FADE.mid, side: .0012, top: .0022, vol: 0, recede: .016, tex: [70, 70], base: 'buzz' },
  rente:            { fade: FADE.low, side: .0014, top: .0028, vol: 0, tex: [70, 70], base: 'buzz' },
  social_risca:     { fade: FADE.low, side: .0035, top: .009, vol: .006, quiff: .006, part: .55, tex: [44, 9], base: 'short' },
  degrade_medio:    { fade: FADE.mid, side: .002, top: .008, vol: .006, tex: [44, 9], base: 'short' },
  degrade_alto:     { fade: FADE.high, side: .0015, top: .009, vol: .007, tex: [44, 9], base: 'short' },
  crop_franja:      { fade: FADE.mid, side: .002, top: .010, vol: .008, fringe: .016, spike: .004, tex: [52, 14], base: 'short' },
  topete_degrade:   { fade: FADE.mid, side: .002, top: .010, vol: .008, quiff: .024, tex: [44, 9], base: 'short' },
  topete:           { fade: 0, side: .005, top: .011, vol: .009, quiff: .022, tex: [44, 9], base: 'short' },
  penteado_tras:    { fade: FADE.low, side: .004, top: .010, vol: .008, quiff: .008, tex: [48, 6], base: 'short' },
  espetado:         { fade: 0, side: .004, top: .011, vol: .009, spike: .013, tex: [52, 14], base: 'short' },
  crespo_curto:     { fade: 0, side: .005, top: .009, vol: .006, coil: .0022, tex: [90, 90], base: 'buzz' },
  crespo_degrade:   { fade: FADE.mid, side: .002, top: .010, vol: .008, coil: .0025, tex: [90, 90], base: 'short' },
  cacheado_degrade: { fade: FADE.mid, side: .002, top: .015, vol: .016, curl: .011, tex: [60, 40], base: 'curly' },
  cacheado_medio:   { fade: 0, side: .008, top: .017, vol: .018, curl: .015, fringe: .008, len: .012, tex: [60, 40], base: 'curly' },
  ondulado_medio:   { fade: 0, side: .006, top: .012, vol: .012, wave: .006, len: .01, tex: [40, 8], base: 'short' },
  franja_media:     { fade: 0, side: .006, top: .011, vol: .010, fringe: .03, len: .012, tex: [44, 7], base: 'short' },
  liso_desfiado:    { fade: 0, side: .010, top: .013, vol: .012, fringe: .024, len: .065, shag: .014, tex: [44, 6], base: 'long' },
  longo_ombros:     { fade: 0, side: .011, top: .011, vol: .011, len: .17, shag: .008, tex: [44, 5], base: 'long' },
  black_power:      { fade: 0, side: .010, top: .010, vol: .014, afro: [1.62, 1.42, 1.55], coil: .004, tex: [90, 90], base: 'afro' },
  trancas_nago:     { fade: 0, side: .0025, top: .0035, vol: 0, rows: 10, tex: [80, 14], base: 'buzz' },
  dreads_degrade:   { fade: FADE.high, side: .0015, top: .010, vol: .007, twist: .006, locs: 11, tex: [70, 40], base: 'short' },
  twists:           { fade: FADE.mid, side: .002, top: .012, vol: .011, twist: .007, tex: [70, 40], base: 'curly' },
  coque_alto:       { fade: FADE.high, side: .0015, top: .006, vol: .003, bun: .034, tex: [48, 6], base: 'bun' },
};
export const HAIR_STYLES = ['careca', ...Object.keys(HAIR)];
export function buildHair(style, skinR, { yTop = 1.815, headC = [0, 1.7, 0] } = {}) {
  if (style === 'careca' || style === 'bald') return null;
  const P = HAIR[style]; if (!P) throw new Error('Penteado desconhecido: ' + style);
  const NT = 72, NS = P.len > .05 ? 22 : 16, rows = [], H = [], seed = [...style].reduce((s, c) => s + c.charCodeAt(0), 0);
  const capY = yTop - .055, scalp = (th, y) => skinR(th, clamp(y, P.len ? 1.64 : 1.45, yTop - .002))*Math.pow(Math.max(0, 1 - Math.pow(Math.max(0, y - capY)/(yTop - capY), 2.6)), 1/2.6);   // domo cheio (superelipse) para não afundar no crânio   // perfil do crânio (domo no alto)
  const lineOf = th => { const a = absTh(th); let y = hairline(th) + .0025*noise(th/TAU*23, .5, 23, seed);              // linha irregular, não reta
    if (P.recede) y += P.recede*Math.exp(-((a - .62)**2)/.035);                                                          // entradas
    if (P.fringe) y -= P.fringe*Math.exp(-a*a/.45)*(1 + .25*noise(th/TAU*31, 3.3, 31, seed));                            // franja sobre a testa, com pontas
    if (P.len) { const f = sstep((a - 1.2)/.8); y -= P.len*f; if (P.shag) y -= P.shag*f*(.5 + .5*noise(th/TAU*29, 1.7, 29, seed)); }   // comprimento nas laterais/nuca
    return y; };
  for (let i = 0; i <= NS; i++) { const s = i/NS, row = [], hrow = [];
    for (let k = 0; k < NT; k++) { const th = TAU*k/NT, a = absTh(th), y0 = lineOf(th), y = lerp(y0, yTop, Math.pow(s, P.len > .05 ? 1.25 : 1)), base = hairline(th);
      const front = 1 - sstep((a - .7)/.6), crown = sstep((s - .2)/.5);
      const fadeW = P.fade ? sstep((y - base + .004)/P.fade) : 1, sideW = lerp(fadeW, 1, front);                         // degradê só nas laterais e nuca
      let t = lerp(lerp(.0026, Math.max(P.side, .0026), sideW), Math.max(P.top, .0042), crown) + P.vol*s*s;
      if (P.quiff) t += P.quiff*Math.exp(-a*a/.3)*Math.sin(Math.PI*clamp((s - .05)/.75, 0, 1));
      if (P.part) t -= .003*Math.exp(-((th - P.part)**2)/.004)*crown;                                                    // risca
      if (P.fringe && y < base) t = Math.max(t, .006); else t = lerp(.0026, t, sstep((y - y0)/.02 + .05));                // a franja tem espessura até a ponta; o resto afina na linha do cabelo (sem degrau)
      const nz = fbm(th, y, 14, seed);
      if (P.curl) t += P.curl*(.35 + .9*fbm(th, y, 11, seed + 3) + .45*fbm(th, y, 23, seed + 4))*sstep(sideW*1.4 - .2)*(.35 + .65*crown);
      if (P.coil) t += P.coil*fbm(th, y, 34, seed + 5)*sideW;
      if (P.spike) t += P.spike*Math.pow(Math.max(0, fbm(th, y, 16, seed + 9)), 1.4)*crown;
      if (P.wave) t += P.wave*Math.sin(th*7 + y*140 + nz)*crown;
      if (P.twist) t += P.twist*Math.pow(Math.abs(Math.sin(th*13)*Math.sin(y*520 + th*3)), .6)*crown*sideW;
      t += .0012*fbm(th, y, 40, seed + 11)*crown;                                                                        // contorno levemente irregular em todos
      let ridge = 1; if (P.rows) { ridge = Math.pow(Math.abs(Math.cos(P.rows*th/2)), .7); t += .0045*ridge; }
      // a casca cresce ao longo da NORMAL do crânio (no topo ela sobe, não só abre para os lados: é isso que evita o formato de capacete)
      const e = .002, S0 = scalp(th, y), dS = (scalp(th, Math.min(y + e, yTop)) - scalp(th, y - e))/(Math.min(y + e, yTop) - y + e), nl = Math.hypot(1, dS), nr = 1/nl, ny = -dS/nl;
      let r = S0 + t*nr, yy = y + t*ny;
      if (P.len && y < 1.64) r += (1.64 - y)*.24*sstep((a - 1.1)/.6) + (1.64 - y)*.12;                                    // o cabelo comprido cai por fora do pescoço
      if (i === NS) { r = 0; yy = yTop + t; }
      const edge = P.fringe && y < base ? 1 : sstep((y - y0)/.01 + .2);                                                 // linha do cabelo macia
      let w = Math.min(edge, .1 + .9*sideW); if (P.rows) w *= .45 + .55*ridge;
      const tone = P.fringe && y < base + .01 ? .9 : clamp(.15 + .85*crown*(P.fade ? sideW : 1) + .12*nz, 0, 1);   // franja = pontas
      row.push([r*Math.sin(th), yy, r*Math.cos(th)]); hrow.push([+w.toFixed(3), +tone.toFixed(3), +(th/TAU*P.tex[0]).toFixed(3), +((y - base)*P.tex[1]*10).toFixed(3)]); }
    rows.push(row); H.push(hrow); }
  let m = finish(gridMesh(rows, H), headC);
  if (P.afro) { const [sx, sy, sz] = P.afro; m.V.forEach(v => { const fr = v.p[2] > 0 ? sstep(v.p[2]/.09) : 0, k = sstep((v.p[1] - 1.66)/.06)*(1 - .8*fr*sstep((1.79 - v.p[1])/.03));   /* a frente (testa) cresce menos: não descola da linha do cabelo */ v.p = [headC[0] + (v.p[0] - headC[0])*lerp(1, sx, k), headC[1] + (v.p[1] - headC[1])*lerp(1, sy, k) + .012*k, headC[2] + (v.p[2] - headC[2])*lerp(1, sz, k)]; }); m = finish({ V: m.V.map(v => ({ p: v.p, h: v.h })), T: m.T }, headC); }
  if (P.bun) m = finish(merge(m, blob([0, yTop + .016, -.046], P.bun, .9, .12, seed)), headC);
  if (P.locs) { const L = []; for (let j = 0; j < P.locs; j++) { const th = Math.PI + (j/(P.locs - 1) - .5)*2.0, y0 = 1.76 - .02*Math.abs(j/(P.locs - 1) - .5), r0 = skinR(th, y0) + .006, path = [];
      for (let q = 0; q <= 7; q++) { const f = q/7, y = y0 - f*(.14 + .02*Math.sin(j*2.1)), rr = (y > 1.64 ? skinR(th, Math.min(y, 1.8)) : skinR(th, 1.64) + (1.64 - y)*.35) + .008 + .03*f*f; path.push([rr*Math.sin(th), y, rr*Math.cos(th)]); }
      L.push(tube(path, .0085, seed + j)); } m = merge(m, ...L); }
  return m;
}
// ---- BARBAS (área entre o lábio/maçã do rosto e o queixo) ----
// th: meia-largura em θ; t: espessura; lo: recuo da borda de baixo; cov: cobertura (por fazer < 1 mistura pele e pelo); chin: volume no queixo; len: barba longa; band: só a faixa do queixo; goatee: só o centro.
export const BEARD = {
  por_fazer:   { th: 1.38, t: .0012, lo: .003, cov: .5 },
  cavanhaque:  { th: .5, t: .006, lo: 0, cov: 1, chin: .004 },
  queixo:      { th: 1.38, t: .005, lo: 0, cov: 1, band: .02 },
  cheia_curta: { th: 1.4, t: .0055, lo: .001, cov: 1, chin: .003 },
  cheia_media: { th: 1.41, t: .009, lo: 0, cov: 1, chin: .008 },
  densa:       { th: 1.42, t: .014, lo: 0, cov: 1, chin: .013 },
  longa:       { th: 1.42, t: .015, lo: 0, cov: 1, chin: .016, len: .045 },
};
export const BEARDS = ['nenhuma', ...Object.keys(BEARD)];
export function buildBeard(kind, skinR, headC = [0, 1.7, 0]) {
  if (kind === 'nenhuma' || kind === 'none') return null;
  const P = BEARD[kind]; if (!P) throw new Error('Barba desconhecida: ' + kind);
  const NT = 31, NY = P.len ? 11 : 8, rows = [], H = [], seed = kind.length*17;
  const U = th => interp([[0, 1.626], [.45, 1.636], [.8, 1.655], [1.1, 1.674], [1.42, 1.698], [2, 1.70]], Math.abs(th)) + .002*noise(th*4, 2, 999, seed);   // borda de cima (bochecha)
  const Lw = th => { const a = Math.abs(th); let y = interp([[0, 1.596 + P.lo], [.6, 1.602 + P.lo], [1.1, 1.624 + P.lo], [1.5, 1.652], [2, 1.664]], a); if (P.len) y -= P.len*Math.exp(-a*a/.35); return y; };
  for (let i = 0; i <= NY; i++) { const s = i/NY, row = [], hrow = [];
    for (let k = 0; k < NT; k++) { const q = k/(NT - 1), th = lerp(-P.th, P.th, q), lo = Lw(th), hi = P.band ? Math.min(U(th), lo + P.band + .01*sstep((Math.abs(th) - 1)/.5)) : U(th), y = lerp(lo, hi, s);
      const edge = Math.min(sstep(s*5), sstep(q*(P.th < 1 ? 4 : 7)), sstep((1 - q)*(P.th < 1 ? 4 : 7))), top = sstep((1 - s)*3.2);
      const below = Math.max(0, 1.596 - y), chin = (P.chin || 0)*Math.exp(-th*th/.25)*(1 - s);
      const r = skinR(th, clamp(y, 1.58, 1.8)) + P.t*(.3 + .7*Math.min(edge, top)) + chin + below*(.7 + .3*Math.cos(th));
      const w = P.cov*Math.min(1, top*1.15)*(P.goatee || P.th < 1 ? .15 + .85*edge : .75 + .25*edge);
      row.push([r*Math.sin(th), y, r*Math.cos(th)]); hrow.push([+w.toFixed(3), .5, +(q*24).toFixed(3), +(s*18).toFixed(3)]); }
    rows.push(row); H.push(hrow); }
  return finish(gridMesh(rows, H, false), headC);
}
// ---- BIGODES (entre o nariz e o lábio de cima) ----
export const MUSTACHE = { bigode_fino: { t: .0022, h: .006, w: .3 }, bigode: { t: .0045, h: .0095, w: .36 }, bigode_marcado: { t: .0075, h: .012, w: .42 } };
export function buildMustache(kind, skinR, headC = [0, 1.7, 0]) {
  const P = MUSTACHE[kind]; if (!P) throw new Error('Bigode desconhecido: ' + kind);
  const NT = 15, NY = 4, rows = [], H = [];
  for (let i = 0; i <= NY; i++) { const s = i/NY, row = [], hrow = []; for (let k = 0; k < NT; k++) { const q = k/(NT - 1), th = lerp(-P.w, P.w, q), droop = .006*Math.pow(Math.abs(th)/P.w, 2), y = 1.6305 - droop + s*P.h*(1 - .35*Math.abs(th)/P.w);
      const edge = Math.min(sstep(s*4), sstep((1 - s)*4), sstep(q*5), sstep((1 - q)*5)); row.push(((r) => [r*Math.sin(th), y, r*Math.cos(th)])(skinR(th, 1.622) + P.t*(.35 + .65*edge) + .002)); hrow.push([Math.min(1, .5 + edge), .5, q*10, s*6]); }
    rows.push(row); H.push(hrow); }
  return finish(gridMesh(rows, H, false), headC);
}
// ---- COSTELETAS (faixa à frente da orelha; "raspada"/"coberta" = sem malha, "ligada" = longa até a barba) ----
export const SIDEBURN = { costeleta_curta: { y0: 1.683 }, costeleta_longa: { y0: 1.662 } };
export function buildSideburn(kind, skinR, headC = [0, 1.7, 0]) {
  const P = SIDEBURN[kind]; if (!P) throw new Error('Costeleta desconhecida: ' + kind);
  const side = sg => { const rows = [], H = []; for (let i = 0; i <= 6; i++) { const s = i/6, row = [], hrow = []; for (let k = 0; k < 5; k++) { const q = k/4, th = sg*lerp(1.27, 1.43, q), y = lerp(P.y0, hairline(th) + .004, s), edge = Math.min(sstep(q*4), sstep((1 - q)*4));
      const r = skinR(th, y) + .0016 + .0012*edge; row.push([r*Math.sin(th), y, r*Math.cos(th)]); hrow.push([.75*sstep(s*3.5)*sstep((1 - s)*2.5 + .15)*(.35 + .65*edge), .2, q*3, s*12]);   /* some nas duas pontas: emenda no cabelo e na barba */ } rows.push(row); H.push(hrow); } return finish(gridMesh(rows, H, false), headC); };
  return merge(side(1), side(-1));
}
// ---- FAIXA DE CABEÇA (acessório: Cássio, Lyanco, Krovinović, Memphis) ----
export function buildBand(skinR, headC = [0, 1.7, 0]) {
  const NT = 64, rows = [], H = []; for (let i = 0; i <= 3; i++) { const s = i/3, row = [], hrow = []; for (let k = 0; k < NT; k++) { const th = TAU*k/NT, a = absTh(th), y = lerp(1.747, 1.712, sstep((a - 1)/1.6)) - .0005*Math.cos(th) + s*.022, r = skinR(th, Math.min(y, 1.79)) + .0175 + .002*Math.sin(Math.PI*s);
      row.push([r*Math.sin(th), y, r*Math.cos(th)]); hrow.push([1, .5, 0, 0]); } rows.push(row); H.push(hrow); }
  return finish(gridMesh(rows, H), headC);
}
