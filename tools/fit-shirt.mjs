#!/usr/bin/env node
// CAIMENTO DA CAMISA: o preparo antigo achatou as costas da camisa num plano (z constante da omoplata até a barra) e alargou o tronco para "cair reto",
// o que dava ~9 cm de vão sobre a lombar e 3–4 cm sobrando de cada lado (aspecto de caixa/mochila). Aqui o TRONCO da camisa (abaixo das omoplatas)
// é aproximado da pele: raio-alvo = raio da pele naquela altura/ângulo (suavizado na vertical, para o tecido "atravessar" a curva da lombar em vez de grudar)
// + folga que cresce para a barra. Só encolhe (nunca estufa); mangas, ombro/gola, UVs, pesos e o resto do modelo ficam iguais.
// Uso: node tools/fit-shirt.mjs [entrada.glb] [saida.glb]   (padrão: assets/models/athlete.glb → assets/models/athlete.fit.glb; nunca sobrescreve a entrada)
import fs from 'node:fs';
import path from 'node:path';
import { readModel, readAccessor } from './gltf-io.mjs';
export const FIT = { yTop: 1.38, yFull: 1.30, yHem: .93, easeTop: .02, easeHem: .03, easeBack: .014, smooth: .07, minGap: .012 };   // metros; easeBack: folga extra atrás (o tecido não cola na lombar). Com 6 mm a pele furava a camisa na pose
const sm = t => { t = Math.min(1, Math.max(0, t)); return t*t*(3 - 2*t); }, NA = 72;
export function fitShirt(m) {
  const j = m.json; if ((j.asset.extras || {}).shirtFit) throw new Error('Este modelo já passou pelo fit-shirt.');
  const body = j.meshes.find(me => ['Skin', 'Shirt'].every(s => me.primitives.some(p => (j.materials[p.material] || {}).name === s))), mat = p => (j.materials[p.material] || {}).name;
  const skinV = body.primitives.filter(p => mat(p) === 'Skin').flatMap(p => { const P = readAccessor(m, p.attributes.POSITION), J = readAccessor(m, p.attributes.JOINTS_0), W = readAccessor(m, p.attributes.WEIGHTS_0); return P.map((q, i) => ({ p: q, j: J[i], w: W[i] })); })
    .filter(v => v.p[1] > .8 && v.p[1] < 1.42 && Math.abs(v.p[0]) < .3), skin = skinV.map(v => v.p);
  // eixo do tronco (z do meio da pele na linha central) e raio máximo da pele por (altura de 1 cm, ângulo de 5°); acima de 1,32 os braços em T entram na conta, então só o tronco central
  const Y0 = .80, NY = 62, zc = new Array(NY).fill(null), R = Array.from({ length: NY }, () => new Array(NA).fill(0)), yi = y => Math.round((y - Y0)*100), ai = (x, z, c) => ((Math.round(Math.atan2(x, z - c)/(2*Math.PI)*NA) % NA) + NA) % NA;
  for (let k = 0; k < NY; k++) { const s = skin.filter(p => Math.abs(p[0]) < .04 && Math.abs(yi(p[1]) - k) <= 1); if (s.length) zc[k] = (Math.max(...s.map(p => p[2])) + Math.min(...s.map(p => p[2])))/2; }
  for (let k = 0; k < NY; k++) if (zc[k] === null) zc[k] = zc[k - 1] ?? zc.find(v => v !== null);
  for (const p of skin) { if (p[1] > 1.32 && Math.abs(p[0]) > .2) continue; for (let k = yi(p[1]) - 2; k <= yi(p[1]) + 2; k++) { if (k < 0 || k >= NY) continue; const a = ai(p[0], p[2], zc[k]), r = Math.hypot(p[0], p[2] - zc[k]); if (r > R[k][a]) R[k][a] = r; } }   // ±2 cm: a malha é esparsa (faixas de 1 cm ficavam sem vértice em alguns ângulos)
  for (let k = 0; k < NY; k++) for (let a = 0; a < NA; a++) if (!R[k][a]) { let best = 0; for (let d = 1; d < NA/2 && !best; d++) best = Math.max(R[k][(a + d) % NA], R[k][(a - d + NA) % NA]); R[k][a] = best; }   // ângulos sem vértice: vizinho
  const SW = Math.round(FIT.smooth*100), RS = R.map((row, k) => row.map((_, a) => { let s = 0, n = 0; for (let d = -SW; d <= SW; d++) { const kk = k + d; if (kk < 0 || kk >= NY) continue; const w = 1 - Math.abs(d)/(SW + 1); s += R[kk][a]*w; n += w; } return s/n; }));
  const target = p => { const k = Math.min(NY - 1, Math.max(0, yi(p[1]))), a = ai(p[0], p[2], zc[k]), back = sm((zc[k] - p[2])/.06), t = sm((FIT.yFull - p[1])/(FIT.yFull - FIT.yHem));
    return { k, r: Math.max(R[k][a], RS[k][a]) + FIT.easeTop + (FIT.easeHem - FIT.easeTop)*t + FIT.easeBack*back }; };
  const F = p => { const w = sm((FIT.yTop - p[1])/(FIT.yTop - FIT.yFull)); if (w <= 0 || p[1] < Y0) return p; const { k, r: rt } = target(p), dx = p[0], dz = p[2] - zc[k], r = Math.hypot(dx, dz); if (r < 1e-6 || r <= rt) return p;
    const rn = r + (rt - r)*w; return [dx*rn/r, p[1], zc[k] + dz*rn/r]; };
  const normal = (p, n) => { const h = 1e-4, J = [0, 1, 2].map(c => { const a = p.slice(), b = p.slice(); a[c] += h; b[c] -= h; const fa = F(a), fb = F(b); return [0, 1, 2].map(r => (fa[r] - fb[r])/(2*h)); });
    const M = [[J[0][0], J[1][0], J[2][0]], [J[0][1], J[1][1], J[2][1]], [J[0][2], J[1][2], J[2][2]]], cof = (r, c) => { const rs = [0, 1, 2].filter(i => i !== r), cs = [0, 1, 2].filter(i => i !== c); return M[rs[0]][cs[0]]*M[rs[1]][cs[1]] - M[rs[0]][cs[1]]*M[rs[1]][cs[0]]; };
    const v = [0, 1, 2].map(r => [0, 1, 2].reduce((s, c) => s + ((r + c) % 2 ? -1 : 1)*cof(r, c)*n[c], 0)), l = Math.hypot(...v) || 1; return v.map(x => x/l); };
  const out = new Uint8Array(m.buffers[0]), dv = new DataView(out.buffer, out.byteOffset, out.byteLength), J2 = JSON.parse(JSON.stringify(j)), st = { movidos: 0, maxEncolheu: 0 };
  const put = (ai_, rows) => { const a = J2.accessors[ai_], bv = J2.bufferViews[a.bufferView], base = (bv.byteOffset || 0) + (a.byteOffset || 0), n = rows[0].length, sz = a.componentType === 5126 ? 4 : 2; if (bv.byteStride) throw new Error('bufferView intercalado não suportado.');
    rows.forEach((r, k) => r.forEach((v, c) => { const o = base + (k*n + c)*sz; if (sz === 4) dv.setFloat32(o, v, true); else dv.setUint16(o, v, true); })); };
  for (const p of body.primitives.filter(q => mat(q) === 'Shirt')) { const P = readAccessor(m, p.attributes.POSITION), N = readAccessor(m, p.attributes.NORMAL), T = readAccessor(m, p.attributes.TEXCOORD_0), JJ = readAccessor(m, p.attributes.JOINTS_0), WW = readAccessor(m, p.attributes.WEIGHTS_0);
    const P2 = P.map((q, i) => T[i][1] >= .73 ? q : F(q)), N2 = P.map((q, i) => T[i][1] >= .73 ? N[i] : normal(q, N[i]));   // v ≥ .73: mangas e faixa do ombro (mapa da manga) ficam como estão
    P2.forEach((q, i) => { const d = Math.hypot(q[0] - P[i][0], q[2] - P[i][2]); if (d < 1e-6) return;   // garantia: o vértice movido fica a ≥ minGap da pele (empurra para fora no raio do tronco)
      let near = Infinity, ni = -1; skin.forEach((s, si) => { if (Math.abs(s[1] - q[1]) > .03) return; const e = Math.hypot(s[0] - q[0], s[1] - q[1], s[2] - q[2]); if (e < near) { near = e; ni = si; } });
      if (ni >= 0) { JJ[i] = skinV[ni].j.slice(); WW[i] = skinV[ni].w.slice(); }   // tecido ajustado deforma junto com a pele logo abaixo (pesos de osso iguais): sem isso a pele furava na pose
      if (near < FIT.minGap) { const k = Math.min(NY - 1, Math.max(0, yi(q[1]))), dx = q[0], dz = q[2] - zc[k], r = Math.hypot(dx, dz) || 1, rn = r + FIT.minGap - near; P2[i] = [dx*rn/r, q[1], zc[k] + dz*rn/r]; st.empurrados = (st.empurrados || 0) + 1; }
      st.movidos++; st.maxEncolheu = Math.max(st.maxEncolheu, +d.toFixed(4)); });
    { // normais dos vértices movidos refeitas pela malha nova (área dos triângulos, somadas por posição para não marcar as costuras); o jacobiano de F pegava a "quina" do min() e gerava manchas escuras
      const I = readAccessor(m, p.indices).map(r => r[0]), acc = new Map(), key = q => q.map(v => Math.round(v*1e4)).join(',');
      for (let t = 0; t < I.length; t += 3) { const [a, b, c] = [P2[I[t]], P2[I[t + 1]], P2[I[t + 2]]], u = [0, 1, 2].map(k => b[k] - a[k]), w = [0, 1, 2].map(k => c[k] - a[k]), n = [u[1]*w[2] - u[2]*w[1], u[2]*w[0] - u[0]*w[2], u[0]*w[1] - u[1]*w[0]];
        for (const vi of [I[t], I[t + 1], I[t + 2]]) { const k = key(P2[vi]), s = acc.get(k) || [0, 0, 0]; acc.set(k, s.map((v, i) => v + n[i])); } }
      P2.forEach((q, i) => { if (Math.hypot(q[0] - P[i][0], q[2] - P[i][2]) < 1e-6) return; const s = acc.get(key(q)), l = s && Math.hypot(...s); if (l > 1e-12) { const nn = s.map(v => v/l); N2[i] = nn[0]*N[i][0] + nn[1]*N[i][1] + nn[2]*N[i][2] < 0 ? nn.map(v => -v) : nn; } }); }   // mantém o lado da normal original (bainha/avesso)
    // UV: o mapa do tronco é uma projeção plana (u − centro ∝ x; frente centro .25, costas .75). Vértice que ficou mais perto do eixo leva o u junto,
    // senão a estampa encolhe com a camisa (número, patrocinador e escudo espremidos na cintura)
    const T2 = T.map((uv, i) => { const x0 = P[i][0], x1 = P2[i][0]; if (uv[1] >= .73 || Math.abs(x0) < 1e-4 || Math.abs(x1 - x0) < 1e-6) return uv; const c = uv[0] >= 1 ? 1.25 : uv[0] >= .5 ? .75 : .25; return [c + (uv[0] - c)*x1/x0, uv[1]]; });
    put(p.attributes.TEXCOORD_0, T2);
    put(p.attributes.POSITION, P2); put(p.attributes.NORMAL, N2); put(p.attributes.JOINTS_0, JJ); put(p.attributes.WEIGHTS_0, WW); const acc = J2.accessors[p.attributes.POSITION]; acc.min = [0, 1, 2].map(c => Math.min(...P2.map(q => q[c]))); acc.max = [0, 1, 2].map(c => Math.max(...P2.map(q => q[c]))); }
  J2.asset.extras = { ...(J2.asset.extras || {}), shirtFit: { v: 1, ...FIT } };
  const js = new TextEncoder().encode(JSON.stringify(J2)), jl = Math.ceil(js.length/4)*4, total = 28 + jl + out.length, g = new Uint8Array(total), gv = new DataView(g.buffer);
  gv.setUint32(0, 0x46546C67, true); gv.setUint32(4, 2, true); gv.setUint32(8, total, true); gv.setUint32(12, jl, true); gv.setUint32(16, 0x4E4F534A, true); g.fill(0x20, 20, 20 + jl); g.set(js, 20);
  gv.setUint32(20 + jl, out.length, true); gv.setUint32(24 + jl, 0x004E4942, true); g.set(out, 28 + jl);
  return { glb: g, st };
}
const entry = process.argv[1] && process.argv[1].endsWith('fit-shirt.mjs');
if (entry) {
  const [inp = 'assets/models/athlete.glb', outp = 'assets/models/athlete.fit.glb'] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  try { if (path.resolve(inp) === path.resolve(outp)) throw new Error('A saída não pode ser o próprio arquivo de entrada.'); const r = fitShirt(readModel(inp)); fs.writeFileSync(outp, r.glb); console.log(`✔ ${outp} gerado`, r.st); }
  catch (e) { console.log('✖', e.message); process.exit(1); }
}
