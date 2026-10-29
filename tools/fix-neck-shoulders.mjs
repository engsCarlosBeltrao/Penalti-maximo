#!/usr/bin/env node
// CONSERTO DO PESCOÇO E DOS OMBROS no athlete.glb JÁ PREPARADO (o original bruto não existe mais, então não dá para rodar o prepare-athlete de novo).
// Mexe SÓ nos vértices da malha do corpo com material Skin, Shirt e Trim (posição, normal e, opcionalmente, pesos da base do pescoço).
// Todo o resto (rosto, olhos, cabelos, barbas, texturas, materiais, esqueleto, UVs da camisa, extras.shirtUV) sai byte a byte igual: o script confere isso no fim.
// O mesmo campo de deformação (função só da posição) é aplicado à pele e às roupas, então a camisa acompanha o corpo sem abrir buracos.
// Uso: node tools/fix-neck-shoulders.mjs [entrada.glb] [saida.glb]   (padrão: assets/models/athlete.original.glb → assets/models/athlete.fixed.glb; nunca sobrescreve a entrada)
// O athlete.glb do jogo JÁ é o resultado deste script (copiado de athlete.fixed.glb). Para refazer com outros parâmetros: rode no original e copie a saída para athlete.glb.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readModel, readAccessor } from './gltf-io.mjs';
import { resolveBones } from '../js/three/skeletonMap.js';
// Parâmetros (metros/graus; alturas relativas aos ossos Neck e Head). FIX_JSON='{"ombro":{"graus":22}}' para experimentar sem editar o arquivo.
export const FIX = {
  neck: { de: -.02, cheio: .025, ate: .04, fim: -.012, fimNuca: .03, rIn: .09, rOut: .15, sx: .72, sz: .92 },   // afina o pescoço entre Neck-2cm e Head-1,2cm na FRENTE (as barbas começam acima disso); na lateral/nuca a transição vai até Head+3cm (sem dobra sob a mandíbula)
  ombro: { x0: .12, y0: .034, graus: 26, piso: -.06, rampa: .05, fade: .09 },                        // trapézio: linha que desce de (x0, Neck+y0) com essa inclinação; comprime acima do piso (Arm+piso); some além do ombro. x0 fica fora da gola (meia-largura ~.128): dentro dela a faixa preta esticava e virava uma "cunha" nas costas
  folga: .006,                                                                                         // folga mínima camisa/gola → pele
  afunda: { x0: .12, x1: .28, yMin: -.11, yMax: .035, folga: .012, raio: .03 },                     // pele ESCONDIDA sob a camisa no ombro (entre a gola e a barra da manga, de Neck-11cm a Neck+3,5cm): fica ≥ 12 mm abaixo do plano da roupa (malha esparsa: a face passava rente à pele e furava nas poses). Descer até a axila piorou: ali a superfície é côncava
  copiaPesos: true,                                                                                    // roupa que se moveu usa os pesos da pele logo abaixo: com o braço levantado, pesos um pouco diferentes faziam a pele furar a camisa no ombro
  pesos: { f: .5, de: -.03, ate: .05, r: .11 }                                                         // tira metade da influência das clavículas na base do pescoço (passa para neck_01); f: 0 desliga
};
if (process.env.FIX_JSON) { const o = JSON.parse(process.env.FIX_JSON); for (const k of Object.keys(o)) FIX[k] = typeof o[k] === 'object' ? { ...FIX[k], ...o[k] } : o[k]; }
const sm = t => { t = Math.min(1, Math.max(0, t)); return t*t*(3 - 2*t); }, MATS = ['Skin', 'Shirt', 'Trim'];
const sha = u8 => crypto.createHash('sha256').update(u8).digest('hex');
function grid(P, cs = .02) { const g = new Map(), k = (x, y, z) => x + ',' + y + ',' + z; P.forEach((p, i) => { const c = k(Math.floor(p[0]/cs), Math.floor(p[1]/cs), Math.floor(p[2]/cs)); let a = g.get(c); if (!a) g.set(c, a = []); a.push(i); });
  return p => { const cx = Math.floor(p[0]/cs), cy = Math.floor(p[1]/cs), cz = Math.floor(p[2]/cs); let m = Infinity; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (const i of g.get(k(cx + dx, cy + dy, cz + dz)) || []) { const s = P[i], d = Math.hypot(s[0] - p[0], s[1] - p[1], s[2] - p[2]); if (d < m) m = d; } return m; }; }
export function fixModel(m) {
  const j = m.json, bin = m.buffers[0], sk = j.skins[0], jn = sk.joints.map(i => j.nodes[i].name), R = resolveBones(jn), ibm = readAccessor(m, sk.inverseBindMatrices);
  if ((j.asset.extras || {}).fixNeck) throw new Error('Este modelo já passou pelo fix-neck-shoulders. Rode no athlete.original.glb.');
  const neckName = R.map.Neck || jn.find(x => /^neck/i.test(x)), ji = n => jn.indexOf(n), bone = n => { const a = ibm[ji(n)], t = [a[12], a[13], a[14]]; return [-(a[0]*t[0] + a[1]*t[1] + a[2]*t[2]), -(a[4]*t[0] + a[5]*t[1] + a[6]*t[2]), -(a[8]*t[0] + a[9]*t[1] + a[10]*t[2])]; };
  const nY = bone(neckName)[1], hY = bone(R.map.Head)[1], arm = bone(R.map.LeftArm), sx = Math.abs(arm[0]), spY = bone(R.map.Spine2 || R.map.Spine1 || R.map.Spine)[1], mat = i => (j.materials[i] || {}).name || '';
  const body = j.meshes.find(me => ['Skin', 'Shirt'].every(s => me.primitives.some(p => mat(p.material) === s))); if (!body) throw new Error('Malha do corpo (Skin + Shirt) não encontrada.');
  const prims = body.primitives.filter(p => MATS.includes(mat(p.material))).map(p => ({ p, mat: mat(p.material), P: readAccessor(m, p.attributes.POSITION), N: readAccessor(m, p.attributes.NORMAL), J: readAccessor(m, p.attributes.JOINTS_0), W: readAccessor(m, p.attributes.WEIGHTS_0) }));
  const skin0 = prims.filter(q => q.mat === 'Skin').flatMap(q => q.P);
  // eixo do pescoço = linha entre os ossos Neck e Head (o meio da pele não serve: a parte de baixo do queixo puxa o centro para a frente e a nuca era esmagada, criando um vinco)
  const nZ = bone(neckName)[2], hZ = bone(R.map.Head)[2], zAt = y => nZ + (hZ - nZ)*Math.min(1, Math.max(0, (y - nY)/(hY - nY)));
  // topo = maior y numa janela de ±2 cm em x (a malha é pouco densa: faixas estreitas quase não têm vértices e davam um topo falso, mais baixo)
  const yF = arm[1] + FIX.ombro.piso, BIN = .005, top = []; for (let x = 0; x < sx + .15; x += BIN) { const s = skin0.filter(p => Math.abs(Math.abs(p[0]) - x) < .02 && Math.abs(p[2]) < .12 && p[1] > yF && p[1] < nY + .055); top.push(s.length ? Math.max(...s.map(p => p[1])) : null); }   // acima de Neck+5,5cm já é a lateral do pescoço, não o ombro
  const topS = top.map((v, i) => { const w = [top[i - 1], v, top[i + 1]].filter(x => x !== null && x !== undefined); return w.length ? w.reduce((a, b) => a + b, 0)/w.length : null; }), topAt = ax => topS[Math.min(topS.length - 1, Math.floor(ax/BIN))];
  const tg = Math.tan(FIX.ombro.graus*Math.PI/180), yL = nY + FIX.ombro.y0;
  // CAMPO DE DEFORMAÇÃO F(p): (1) afina o pescoço em torno do eixo; (2) comprime verticalmente a coluna do ombro para o topo seguir a linha inclinada do trapézio
  const F = p => { let [x, y, z] = p; const N = FIX.neck, frente = sm((z - zAt(y) + .03)/.05), yFim = hY + N.fimNuca + (N.fim - N.fimNuca)*frente, wy = sm((y - (nY + N.de))/(N.cheio - N.de)) * (1 - sm((y - (nY + N.ate))/(yFim - (nY + N.ate))));
    if (wy > 0) { const c = zAt(y), r = Math.hypot(x, z - c), w = wy*(1 - sm((r - N.rIn)/(N.rOut - N.rIn))); x *= 1 - w*(1 - N.sx); z = c + (z - c)*(1 - w*(1 - N.sz)); }
    const ax = Math.abs(p[0]), O = FIX.ombro, t0 = topAt(ax); if (p[1] > yF && t0 && t0 > yF + .01) { const wx = sm((ax - O.x0)/O.rampa)*(1 - sm((ax - (sx + .01))/O.fade)), tgt = Math.min(t0, yL - tg*(ax - O.x0)), k = (tgt - yF)/(t0 - yF), ky = 1 - wx*(1 - Math.min(1, k)); y = yF + (p[1] - yF)*ky; }
    return [x, y, z]; };
  // normal nova = (J⁻ᵀ)·n, com o jacobiano de F por diferenças centrais (igual para vértices duplicados na costura: sem emendas de luz)
  const normal = (p, n) => { const h = 1e-4, J = [0, 1, 2].map(c => { const a = p.slice(), b = p.slice(); a[c] += h; b[c] -= h; const fa = F(a), fb = F(b); return [0, 1, 2].map(r => (fa[r] - fb[r])/(2*h)); });   // J[c] = ∂F/∂p_c (coluna c)
    const M = [[J[0][0], J[1][0], J[2][0]], [J[0][1], J[1][1], J[2][1]], [J[0][2], J[1][2], J[2][2]]], cof = (r, c) => { const rs = [0, 1, 2].filter(i => i !== r), cs = [0, 1, 2].filter(i => i !== c); return M[rs[0]][cs[0]]*M[rs[1]][cs[1]] - M[rs[0]][cs[1]]*M[rs[1]][cs[0]]; };
    const C = [0, 1, 2].map(r => [0, 1, 2].map(c => ((r + c) % 2 ? -1 : 1)*cof(r, c))), v = [0, 1, 2].map(r => C[r][0]*n[0] + C[r][1]*n[1] + C[r][2]*n[2]), l = Math.hypot(...v) || 1; return v.map(x => x/l); };   // cofatores ∝ J⁻ᵀ·det
  const st = { movidos: 0, desloc: 0, folga: 0, pesos: 0 };
  // pele: aplica F. Roupa: copia o deslocamento da PELE logo abaixo (média 1/d² dos vértices de pele a até 3 cm), para a gola abraçar o pescoço afinado em vez de ficar folgada
  const skinQ = prims.filter(q => q.mat === 'Skin'); skinQ.forEach(q => { q.P2 = q.P.map(F); });
  const sP = skinQ.flatMap(q => q.P), sD = skinQ.flatMap(q => q.P2.map((o, i) => o.map((v, c) => v - q.P[i][c]))), GS = .03, sg = new Map(), gk = (a, b, c) => a + ',' + b + ',' + c;
  sP.forEach((p, i) => { const k = gk(...p.map(c => Math.floor(c/GS))); (sg.get(k) || sg.set(k, []).get(k)).push(i); });
  const transfer = p => { const c = p.map(x => Math.floor(x/GS)); let W = 0; const D = [0, 0, 0]; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (const i of sg.get(gk(c[0] + dx, c[1] + dy, c[2] + dz)) || []) { const d = Math.hypot(sP[i][0] - p[0], sP[i][1] - p[1], sP[i][2] - p[2]); if (d > GS) continue; const w = 1/(d*d + 1e-6); W += w; for (let k = 0; k < 3; k++) D[k] += w*sD[i][k]; }
    if (!W) return F(p); return p.map((v, k) => v + D[k]/W); };
  prims.filter(q => q.mat !== 'Skin').forEach(q => { q.P2 = q.P.map(transfer); });
  { const A = FIX.afunda, cl = prims.filter(q => q.mat !== 'Skin').flatMap(q => q.P2.map((p, i) => ({ p, n: q.N[i] }))), cg = new Map(); cl.forEach((v, i) => { const k = gk(...v.p.map(c => Math.floor(c/GS))); (cg.get(k) || cg.set(k, []).get(k)).push(i); });
    skinQ.forEach(q => q.P2 = q.P2.map((s, i) => { const ax = Math.abs(q.P[i][0]); if (ax < A.x0 || ax > A.x1 || q.P[i][1] > nY + A.yMax || q.P[i][1] < nY + A.yMin) return s; const c = s.map(x => Math.floor(x/GS)); let b = null, bd = A.raio;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (const k of cg.get(gk(c[0] + dx, c[1] + dy, c[2] + dz)) || []) { const v = cl[k], d = Math.hypot(v.p[0] - s[0], v.p[1] - s[1], v.p[2] - s[2]); if (d < bd) { bd = d; b = v; } }
      if (!b) return s; const dp = (s[0] - b.p[0])*b.n[0] + (s[1] - b.p[1])*b.n[1] + (s[2] - b.p[2])*b.n[2]; if (dp <= -A.folga) return s; st.afundados = (st.afundados || 0) + 1; return s.map((v, k) => v - b.n[k]*(dp + A.folga)); })); }   // dp: distância com sinal até o plano da roupa (> 0 = pele por fora)
  if (FIX.copiaPesos) { const sJ = skinQ.flatMap(q => q.J), sW = skinQ.flatMap(q => q.W);   // vértice de pele mais próximo (posição original); só para roupa que o conserto deslocou
    prims.filter(q => q.mat !== 'Skin').forEach(q => q.P.forEach((p, i) => { if (Math.hypot(...q.P2[i].map((v, k) => v - p[k])) < 1e-5) return; const c = p.map(x => Math.floor(x/GS)); let best = -1, bd = Infinity;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (const k of sg.get(gk(c[0] + dx, c[1] + dy, c[2] + dz)) || []) { const d = Math.hypot(sP[k][0] - p[0], sP[k][1] - p[1], sP[k][2] - p[2]); if (d < bd) { bd = d; best = k; } }
      if (best >= 0) { q.J[i] = sJ[best].slice(); q.W[i] = sW[best].slice(); st.pesosCopiados = (st.pesosCopiados || 0) + 1; } })); }
  prims.forEach(q => { q.P2.forEach((o, i) => { const p = q.P[i], d = Math.hypot(o[0] - p[0], o[1] - p[1], o[2] - p[2]); if (d > 1e-6) { st.movidos++; st.desloc = Math.max(st.desloc, d); } }); q.N2 = q.P.map((p, i) => normal(p, q.N[i])); });
  // folga mínima: camisa/gola acima do peito que ficou colada na pele é empurrada para fora pela normal (5 passadas: empurrar pela normal nem sempre afasta do vértice mais próximo de primeira)
  const near = grid(prims.filter(q => q.mat === 'Skin').flatMap(q => q.P2));
  // o empurrão vale para a VIZINHANÇA (raio 1,2 cm, queda suave): a bainha da gola é uma faixa fina e, empurrando só a borda de dentro, ela passava da de fora (triângulos invertidos)
  const roupa = prims.filter(q => q.mat !== 'Skin'), RP = .012;
  for (let it = 0; it < 5; it++) { const push = []; roupa.forEach(q => q.P2.forEach((p, i) => { if (p[1] < spY + .1) return; const d = near(p); if (d < FIX.folga) { push.push({ p, v: q.N2[i].map(c => c*(FIX.folga - d)) }); if (!it) st.folga++; } })); if (!push.length) break;
    const g = new Map(), key = p => p.map(c => Math.floor(c/RP)).join(','); push.forEach(e => { const k = key(e.p); (g.get(k) || g.set(k, []).get(k)).push(e); });
    roupa.forEach(q => q.P2 = q.P2.map(p => { const c = p.map(x => Math.floor(x/RP)); let best = null, bm = 0;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (const e of g.get([c[0] + dx, c[1] + dy, c[2] + dz].join(',')) || []) { const d = Math.hypot(e.p[0] - p[0], e.p[1] - p[1], e.p[2] - p[2]); if (d >= RP) continue; const w = sm(1 - d/RP), mg = Math.hypot(...e.v)*w; if (mg > bm) { bm = mg; best = e.v.map(x => x*w); } }
      return best ? p.map((v, k) => v + best[k]) : p; })); }
  // pesos: na base do pescoço, parte da influência das clavículas passa para o osso do pescoço (o ombro que desce não estica mais o pescoço)
  const cla = new Set(['LeftShoulder', 'RightShoulder'].map(c => ji(R.map[c]))), nk = ji(neckName), Pw = FIX.pesos;
  if (Pw.f > 0) prims.forEach(q => q.P.forEach((p, i) => { const c = zAt(p[1]), t = sm((p[1] - (nY + Pw.de))/.02)*(1 - sm((p[1] - (nY + Pw.ate))/.02))*(1 - sm((Math.hypot(p[0], p[2] - c) - Pw.r)/.04)); if (t <= 0) return;
    const Jv = q.J[i], Wv = q.W[i]; let mov = 0; Jv.forEach((jx, s) => { if (cla.has(jx) && Wv[s] > 0) { const d = Wv[s]*Pw.f*t; Wv[s] -= d; mov += d; } }); if (mov < 1e-6) return;
    let s = Jv.findIndex((jx, k) => jx === nk && Wv[k] > 0); if (s < 0) s = Wv.findIndex(w => w === 0); if (s < 0) s = Wv.indexOf(Math.min(...Wv));   // slot do pescoço; senão um slot vazio; senão o de menor peso
    if (Jv[s] !== nk) { mov += Wv[s]; Wv[s] = 0; } Jv[s] = nk; Wv[s] += mov; const sum = Wv.reduce((a, b) => a + b, 0); for (let k = 0; k < 4; k++) Wv[k] /= sum; st.pesos++; }));
  // grava: sobrescreve os floats/ints nos MESMOS bufferViews (mesmo tamanho); só o JSON muda (min/max das posições e extras.fixNeck)
  const out = new Uint8Array(bin), dv = new DataView(out.buffer, out.byteOffset, out.byteLength), J2 = JSON.parse(JSON.stringify(j)), mexidos = new Set();
  const put = (ai, rows) => { const a = J2.accessors[ai], bv = J2.bufferViews[a.bufferView], base = (bv.byteOffset || 0) + (a.byteOffset || 0), n = rows[0].length, sz = a.componentType === 5126 ? 4 : 2; if (bv.byteStride) throw new Error('bufferView intercalado (byteStride) não suportado.'); mexidos.add(a.bufferView);
    rows.forEach((r, k) => r.forEach((v, c) => { const o = base + (k*n + c)*sz; if (sz === 4) dv.setFloat32(o, v, true); else dv.setUint16(o, v, true); })); };
  prims.forEach(q => { const A = q.p.attributes; put(A.POSITION, q.P2); put(A.NORMAL, q.N2); if (Pw.f > 0 || FIX.copiaPesos) { put(A.JOINTS_0, q.J); put(A.WEIGHTS_0, q.W); }
    const acc = J2.accessors[A.POSITION]; acc.min = [0, 1, 2].map(c => Math.min(...q.P2.map(p => p[c]))); acc.max = [0, 1, 2].map(c => Math.max(...q.P2.map(p => p[c]))); });
  J2.asset.extras = { ...(J2.asset.extras || {}), fixNeck: { v: 1, ...JSON.parse(JSON.stringify(FIX)) } };   // marca (impede rodar duas vezes) e registra os parâmetros usados; shirtUV fica igual (as UVs não mudam)
  // auto-checagem: todo bufferView que não foi mexido tem de sair idêntico
  const iguais = J2.bufferViews.every((bv, i) => mexidos.has(i) || sha(bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)) === sha(out.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)));
  if (!iguais) throw new Error('Auto-checagem falhou: um bufferView fora do corpo mudou.');
  const js = new TextEncoder().encode(JSON.stringify(J2)), jl = Math.ceil(js.length/4)*4, total = 12 + 8 + jl + 8 + out.length, g = new Uint8Array(total), gv = new DataView(g.buffer);
  gv.setUint32(0, 0x46546C67, true); gv.setUint32(4, 2, true); gv.setUint32(8, total, true); gv.setUint32(12, jl, true); gv.setUint32(16, 0x4E4F534A, true); g.fill(0x20, 20, 20 + jl); g.set(js, 20);
  gv.setUint32(20 + jl, out.length, true); gv.setUint32(24 + jl, 0x004E4942, true); g.set(out, 28 + jl);
  return { glb: g, st: { ...st, bufferViewsMexidos: mexidos.size, bufferViewsIguais: J2.bufferViews.length - mexidos.size } };
}
const entry = process.argv[1] && process.argv[1].endsWith('fix-neck-shoulders.mjs');
if (entry) {
  const [inp = 'assets/models/athlete.original.glb', outp = 'assets/models/athlete.fixed.glb'] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  try { if (path.resolve(inp) === path.resolve(outp)) throw new Error('A saída não pode ser o próprio arquivo de entrada.'); if (/athlete\.(glb|original\.glb)$/i.test(path.basename(outp))) throw new Error(`Recusado: não sobrescrevo ${path.basename(outp)}. Use outro nome de saída.`);
    const r = fixModel(readModel(inp)); fs.writeFileSync(outp, r.glb); console.log(`✔ ${outp} gerado (${(r.glb.length/1024).toFixed(0)} KB) a partir de ${inp}`, r.st); }
  catch (e) { console.log('✖', e.message); process.exit(1); }
}
