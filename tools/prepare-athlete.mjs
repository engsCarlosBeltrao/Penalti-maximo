#!/usr/bin/env node
// PREPARA um humanoide rigado qualquer (ex.: CC0 da Quaternius/KayKit/100 Avatars) para virar atleta do Pênalti Máximo:
//  • separa a malha em materiais Shirt/Shorts/Socks/Skin/Hair/Boots/Gloves usando os PESOS DOS OSSOS (osso dominante de cada triângulo) e a posição ao longo do osso;
//  • gera a UV da camisa por projeção cilíndrica (formato "wrap": u dá a volta no tronco, frente em 0,25, costas em 0,75);
//  • descarta texturas e cores originais (cor/estampa passam a vir do jogo); mantém esqueleto e animações originais.
// Uso: node prepare-athlete.mjs <entrada.glb|.gltf> [saida.glb] [--map skeleton-map.json] [--skin pele.png] [--eyes olhos.png] [--hair cabelo.png]   (funciona em qualquer pasta)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// Localiza modulos auxiliares em varias pastas possiveis (nao presume pasta "tools" nem "js/three").
const HERE_DIR = path.dirname(fileURLToPath(import.meta.url));
function locate(name) {
  const bases = [HERE_DIR, path.join(HERE_DIR, 'js', 'three'), path.join(HERE_DIR, 'three'), path.join(HERE_DIR, 'tools'), path.join(HERE_DIR, '..', 'js', 'three'), path.join(HERE_DIR, '..', 'tools'), path.join(HERE_DIR, '..'), process.cwd(), path.join(process.cwd(), 'js', 'three'), path.join(process.cwd(), 'tools')];
  for (const b of bases) { const p = path.join(b, name); if (fs.existsSync(p)) return p; }
  return null;
}
async function need(name, para, exportsEsperados = []) {
  const p = locate(name);
  if (!p) { console.log('ERRO  nao encontrei "' + name + '" (necessario para ' + para + ').\n      Procurei na pasta deste script, em js/three, em tools e na pasta atual.\n      Copie "' + name + '" do projeto para a pasta deste script (ou para js/three/) e rode de novo.'); process.exit(2); }
  let mod; try { mod = await import(pathToFileURL(p).href); } catch (e) { console.log('ERRO  "' + p + '" existe mas nao carregou: ' + String(e.message || e).split('\n')[0] + '\n      Substitua-o pela copia original do projeto.'); process.exit(2); }
  const faltam = exportsEsperados.filter((n) => !(n in mod));
  if (faltam.length) { console.log('ERRO  "' + p + '" existe mas nao exporta ' + faltam.join(', ') + ' (arquivo vazio ou incompleto?).\n      Substitua-o pela copia original do projeto.'); process.exit(2); }
  return mod;
}
const { readModel, readAccessor, Builder } = await need('gltf-io.mjs', 'ler/escrever glTF', ['readModel', 'readAccessor', 'Builder']);
const { resolveBones, CANON } = await need('skeletonMap.js', 'reconhecer os ossos', ['resolveBones', 'CANON']);
const { inspect } = await need('glbInspect.js', 'validar o resultado', ['inspect']);
const mm = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c*4 + r] += a[k*4 + r]*b[c*4 + k]; return o; };
const compose = n => { if (n.matrix) return n.matrix.slice(); const t = n.translation || [0, 0, 0], [x, y, z, w] = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1];
  return [(1 - 2*(y*y + z*z))*s[0], 2*(x*y + z*w)*s[0], 2*(x*z - y*w)*s[0], 0, 2*(x*y - z*w)*s[1], (1 - 2*(x*x + z*z))*s[1], 2*(y*z + x*w)*s[1], 0, 2*(x*z + y*w)*s[2], 2*(y*z - x*w)*s[2], (1 - 2*(x*x + y*y))*s[2], 0, t[0], t[1], t[2], 1]; };
const tp = (m, p) => [m[0]*p[0] + m[4]*p[1] + m[8]*p[2] + m[12], m[1]*p[0] + m[5]*p[1] + m[9]*p[2] + m[13], m[2]*p[0] + m[6]*p[1] + m[10]*p[2] + m[14]];
export const SLOT_LIST = ['Shirt', 'Shorts', 'Socks', 'Skin', 'Hair', 'Boots', 'Gloves', 'Eyes', 'Trim', 'Sole'];   // Trim = detalhes na cor secundária (gola, punhos, cano da meia); Sole = sola, travas e cadarço
const TEXTURED = new Set(['Skin', 'Gloves', 'Eyes', 'Hair']);   // estes mantêm a UV original (o rosto do modelo é pintado na textura da pele)
// regra de material por osso e posição ao longo do osso (t = 0 na articulação, 1 na seguinte)
export function slotFor(canon, c, B) {
  // O CORPO so tem 2 materiais: Skin e Gloves (mao). Camisa, calcao, meia e chuteira NAO sao mais pedacos do corpo: sao malhas novas (buildGarments).
  const along = (a, b) => { const A = B[a], Z = B[b]; if (!A || !Z) return .5; const d = [Z[0] - A[0], Z[1] - A[1], Z[2] - A[2]], L = d[0]*d[0] + d[1]*d[1] + d[2]*d[2] || 1; return ((c[0] - A[0])*d[0] + (c[1] - A[1])*d[1] + (c[2] - A[2])*d[2])/L; };
  const side = /^(Left|Right)/.exec(canon)?.[1] || (c[0] >= 0 ? 'Left' : 'Right'), base = canon.replace(/^(Left|Right)/, '');
  if (base === 'Head') return c[1] > B.Head[1] + .06 ? 'Hair' : 'Skin';
  if (base === 'Hand' || ((base === 'ForeArm' || base === 'Arm') && along(side + 'ForeArm', side + 'Hand') > .97)) return 'Gloves';
  return 'Skin';
}
// ===================== ROUPAS DE VERDADE =====================
// Metodo (cascas de roupa sobre o corpo, como em ferramentas de alfaiataria 3D simplificadas):
//  1. recorta a malha do corpo com um CAMPO escalar por peça (f >= 0 fica): cortes retos, sem serrilhado, com vértices novos nas arestas cortadas;
//  2. afasta a casca do corpo ao longo da normal (folga + abertura na barra);
//  3. fecha cada borda aberta com uma BAINHA (faixa de espessura), para o tecido não parecer papel;
//  4. separa gola/punho/cano da meia por OUTRO corte reto (material Trim); chuteira ganha sola, travas e cadarço (geometria própria).
const v3 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot: (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2], nrm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; } };
const kl = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerpV = (a, b, t) => { const m = (x, y) => x.map((q, i) => q + (y[i] - q)*t), near = t < .5 ? a : b; return { p: m(a.p, b.p), n: v3.nrm(m(a.n, b.n)), uv: m(a.uv, b.uv), j: near.j.slice(), w: near.w.slice() }; };
export function clipMesh(V, T, fn) {                        // mantém f(vértice) >= 0; devolve vértices/triângulos novos e as arestas do corte
  const F = V.map(v => fn(v.p)), out = [], map = new Map(), cache = new Map(), outT = [], cuts = [];
  const cp = v => ({ p: v.p.slice(), n: v.n.slice(), uv: v.uv.slice(), j: v.j.slice(), w: v.w.slice() });   // cópia: cada peça deforma os SEUS vértices (antes eram compartilhados e o afastamento se somava)
  const keep = i => { let k = map.get(i); if (k === undefined) { k = out.length; out.push(cp(V[i])); map.set(i, k); } return k; };
  const cut = (i, j) => { const a = Math.min(i, j), b = Math.max(i, j), key = a + '_' + b; let k = cache.get(key); if (k === undefined) { k = out.length; out.push(lerpV(V[a], V[b], F[a]/(F[a] - F[b]))); cache.set(key, k); } return k; };
  for (const tri of T) { const poly = [], cutIdx = [];
    for (let e = 0; e < 3; e++) { const i = tri[e], j = tri[(e + 1) % 3]; if (F[i] >= 0) poly.push(keep(i)); if ((F[i] >= 0) !== (F[j] >= 0)) { const k = cut(i, j); poly.push(k); cutIdx.push(k); } }
    for (let k = 1; k + 1 < poly.length; k++) outT.push([poly[0], poly[k], poly[k + 1]]);
    if (cutIdx.length === 2) cuts.push(cutIdx); }
  return { V: out, T: outT, cuts };
}
function hemLip(V, T, cuts, thick) {                        // bainha: faixa entre a borda externa e a mesma borda recuada (espessura do tecido)
  for (const [a, b] of cuts) { const base = V.length, mk = v => ({ p: v.p.map((x, i) => x - v.n[i]*thick), n: v.n.slice(), uv: v.uv.slice(), j: v.j.slice(), w: v.w.slice() }); V.push(mk(V[a]), mk(V[b])); T.push([a, b, base + 1], [a, base + 1, base]); }
}
// d(p) = folga ao longo da normal; dh(p) = abertura extra SÓ para os lados (horizontal), para a barra não descer em regiões de normal voltada para baixo (virilha)
function displace(V, d, dh = () => 0, fy = () => 1) { V.forEach(v => { const k = d(v.p), h = dh(v.p), hl = Math.hypot(v.n[0], v.n[2]) || 1; v.p = [v.p[0] + v.n[0]*k + v.n[0]/hl*h, v.p[1] + v.n[1]*k*fy(v.p), v.p[2] + v.n[2]*k + v.n[2]/hl*h]; }); }   // fy: atenua o deslocamento vertical perto da barra (barra reta)
// Caimento de tecido: suaviza a casca (Taubin λ|μ, sem encolher) para tirar o "músculo" do corpo da camisa, mantém as bordas fixas e garante folga mínima sobre a pele.
export function relax(V, T, q0, { iters = 24, lam = .5, mu = -.53, minOff = .012, pin = new Set(), wt = () => 1 } = {}) {
  const adj = V.map(() => new Set()); for (const [a, b, c] of T) { adj[a].add(b); adj[a].add(c); adj[b].add(a); adj[b].add(c); adj[c].add(a); adj[c].add(b); }
  const step = k => { const P = V.map(v => v.p); const N = P.map((p, i) => { if (pin.has(i) || !adj[i].size) return p; let x = 0, y = 0, z = 0; for (const j of adj[i]) { x += P[j][0]; y += P[j][1]; z += P[j][2]; } const m = adj[i].size, f = k*wt(p); return [p[0] + f*(x/m - p[0]), p[1] + f*(y/m - p[1]), p[2] + f*(z/m - p[2])]; }); V.forEach((v, i) => { v.p = N[i]; }); };
  for (let it = 0; it < iters; it++) { step(lam); step(mu); }
  V.forEach((v, i) => { const q = q0[i], s = (v.p[0] - q[0])*v.n[0] + (v.p[1] - q[1])*v.n[1] + (v.p[2] - q[2])*v.n[2]; if (s < minOff) { const d = minOff - s; v.p = [v.p[0] + v.n[0]*d, v.p[1] + v.n[1]*d, v.p[2] + v.n[2]*d]; } });
}
function fixSeam(V, T) {                                    // triângulo que atravessa a costura (u 0↔1): duplica os vértices baixos com u+1 (textura em RepeatWrapping)
  for (const t of T) { const us = t.map(i => V[i].uv[0]); if (Math.max(...us) - Math.min(...us) > .5) for (let e = 0; e < 3; e++) if (V[t[e]].uv[0] < .5) { const o = V[t[e]]; V.push({ ...o, uv: [o.uv[0] + 1, o.uv[1]] }); t[e] = V.length - 1; } }
}
function box(c, [sx, sy, sz], j) {
  const V = [], T = [], F = [[[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]], [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]], [[0, 1, 0], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]], [[0, -1, 0], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]]], [[0, 0, 1], [[1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, -1, 1]]], [[0, 0, -1], [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]]]];
  for (const [n, qs] of F) { const b = V.length; qs.forEach(q => V.push({ p: [c[0] + q[0]*sx/2, c[1] + q[1]*sy/2, c[2] + q[2]*sz/2], n: n.slice(), uv: [0, 0], j: [j, 0, 0, 0], w: [1, 0, 0, 0] })); T.push([b, b + 1, b + 2], [b, b + 2, b + 3]); }
  return { V, T };
}
function stud(c, r0, r1, h, j, seg = 6) {                   // trava cônica (de cima para baixo)
  const V = [], T = [], mk = (p, n) => ({ p, n, uv: [0, 0], j: [j, 0, 0, 0], w: [1, 0, 0, 0] });
  for (let i = 0; i < seg; i++) { const a0 = i/seg*Math.PI*2, a1 = (i + 1)/seg*Math.PI*2, am = (a0 + a1)/2, n = [Math.cos(am), 0, Math.sin(am)], b = V.length;
    V.push(mk([c[0] + Math.cos(a0)*r0, c[1], c[2] + Math.sin(a0)*r0], n), mk([c[0] + Math.cos(a1)*r0, c[1], c[2] + Math.sin(a1)*r0], n), mk([c[0] + Math.cos(a1)*r1, c[1] - h, c[2] + Math.sin(a1)*r1], n), mk([c[0] + Math.cos(a0)*r1, c[1] - h, c[2] + Math.sin(a0)*r1], n)); T.push([b, b + 1, b + 2], [b, b + 2, b + 3]); }
  const b = V.length; V.push(mk([c[0], c[1] - h, c[2]], [0, -1, 0])); for (let i = 0; i < seg; i++) { const a0 = i/seg*Math.PI*2, a1 = (i + 1)/seg*Math.PI*2, k = V.length; V.push(mk([c[0] + Math.cos(a0)*r1, c[1] - h, c[2] + Math.sin(a0)*r1], [0, -1, 0]), mk([c[0] + Math.cos(a1)*r1, c[1] - h, c[2] + Math.sin(a1)*r1], [0, -1, 0])); T.push([b, k, k + 1]); }
  return { V, T };
}
// normais suavizadas (média espacial dos vizinhos com normal parecida): afastar a roupa por normais "cruas" faz a casca se dobrar/atravessar em dobras côncavas (virilha, axila)
export function smoothNormals(V, r = .04) {
  const grid = new Map(), cs = r, ck = (a, b, c) => a + ',' + b + ',' + c; V.forEach((v, i) => { const k = ck(Math.floor(v.p[0]/cs), Math.floor(v.p[1]/cs), Math.floor(v.p[2]/cs)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i); });
  return V.map(v => { const cx = Math.floor(v.p[0]/cs), cy = Math.floor(v.p[1]/cs), cz = Math.floor(v.p[2]/cs); let nx = 0, ny = 0, nz = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (const j of grid.get(ck(cx + dx, cy + dy, cz + dz)) || []) { const u = V[j], d = Math.hypot(u.p[0] - v.p[0], u.p[1] - v.p[1], u.p[2] - v.p[2]); if (d < r && v3.dot(u.n, v.n) > .3) { const w = 1 - d/r; nx += u.n[0]*w; ny += u.n[1]*w; nz += u.n[2]*w; } }
    const l = Math.hypot(nx, ny, nz); return l > 1e-6 ? { ...v, n: [nx/l, ny/l, nz/l] } : v; });
}
export const FIT = { shirt: .016, shirtHem: .014, sleeveFlare: .002, shorts: .02, shortsFlare: .012, socks: .006, boots: .012, sole: .018, sleeve: .42, tube: false, yoke: true, relax: 0, shirtMin: .009, ease: .005, shoulderEase: .004, torsoMin: .86, body: { waist: .16, depth: .12, trap: .025 } };   // folgas (m) e comprimento da manga (fração do braço)

if (process.env.FIT_JSON) Object.assign(FIT, JSON.parse(process.env.FIT_JSON));   // experimentos: FIT_JSON='{"ease":.005}'
// Corpo mais atlético (menos "quadrado"): afina cintura e peito (V do tronco), reduz a profundidade e abaixa um pouco o trapézio.
// Só mexe em vértices ligados à coluna/quadril (pesos dos ossos), então braços, pernas, cabeça e o esqueleto/animações ficam intactos.
export function reshapeBody(pos, jo, we, canonOfJoint, B) {
  const F = FIT.body; if (!F) return; const hip = B.Hips[1], sp = B.Spine2 || B.Spine1 || B.Spine, CORE = new Set(['Hips', 'Spine', 'Spine1', 'Spine2']), memo = new Map();
  const isCore = ji => { let r = memo.get(ji); if (r === undefined) { r = CORE.has(canonOfJoint(ji)); memo.set(ji, r); } return r; };
  const sm = x => { x = Math.min(1, Math.max(0, x)); return x*x*(3 - 2*x); };
  for (let k = 0; k < pos.length; k++) { let wt = 0; jo[k].forEach((ji, c) => { if (isCore(ji)) wt += we[k][c]; }); if (wt < .01) continue;
    const p = pos[k], t = (p[1] - hip)/Math.max(.01, sp[1] - hip);
    if (t < -.12 || t > 1.6) continue;
    const up = sm((t + .12)/.4), down = 1 - sm((t - 1.0)/.5), wz = wt*up*down;                         // 0 no quadril, pleno no tronco, some nos ombros
    const g = t < .35 ? 1 : 1 - .65*sm((t - .35)/.65), sx = 1 - (F.waist*g)*wz, sz = 1 - F.depth*wz;   // cintura mais fina, peito ~metade do corte
    p[0] = sp[0] + (p[0] - sp[0])*sx; p[2] = sp[2] + (p[2] - sp[2])*sz;
    if (t > 1.0 && t < 1.6) p[1] -= F.trap*wt*sm((t - 1.0)/.25)*(1 - sm((t - 1.3)/.3))*Math.min(1, Math.max(0, 1 - Math.abs(p[0] - sp[0])/.22)); }   // trapézio um pouco mais baixo perto do pescoço
}
export function buildGarments(V0raw, T0, B, J) {
  const V0 = smoothNormals(V0raw);
  // J = { LeftFoot: índice do osso, RightFoot: ... } para prender travas/cadarço ao pé
  const hip = B.Hips[1], head = B.Head[1], sp = B.Spine2 || B.Spine1 || B.Spine, SIDE = Math.sign((B.LeftArm || [1])[0]) || 1;
  const kneeY = (B.LeftLeg || B.RightLeg)[1], ankleY = (B.LeftFoot || B.RightFoot)[1], minY = Math.min(...V0.map(v => v.p[1]));
  const hemY = hip - .02, waistTop = hemY + .035, shortsEnd = kneeY + .12*(hip - kneeY), sockTop = kneeY - .025, bootTop = ankleY + .075, soleTop = minY + .026;
  const armOf = p => { const s = p[0]*SIDE >= 0 ? 'Left' : 'Right', A = B[s + 'Arm'], Z = B[s + 'ForeArm']; return A && Z ? { A, Z, d: v3.sub(Z, A) } : null; };
  const armT = p => { const a = armOf(p); if (!a) return { t: -1, L: 1 }; const L2 = v3.dot(a.d, a.d); return { t: v3.dot(v3.sub(p, a.A), a.d)/L2, L: Math.sqrt(L2), a }; };
  const sleeveF = p => { const { t, L } = armT(p); return (FIT.sleeve - t)*L; };
  const neckF = p => { const r = Math.hypot(p[0] - sp[0], p[2] - sp[2]), yb = head - .085 - .035*kl((p[2] - sp[2])/.1, -.3, 1), rad = Math.max(0, .07 + 3.5*(p[1] - yb)); return r - rad; };   // gola redonda (mais baixa na frente)
  const shirtF = p => Math.min(p[1] - hemY, sleeveF(p), neckF(p)), shirtTrimF = p => Math.max(p[1] > sp[1] ? .022 - neckF(p) : -1, .02 - sleeveF(p));
  const shortsF = p => Math.min(p[1] - shortsEnd, waistTop - p[1]), socksF = p => Math.min(p[1] - ankleY, sockTop - p[1]), sockTrimF = p => p[1] - (sockTop - .035);
  const bootsF = p => Math.min(bootTop - p[1], p[1] - soleTop), soleF = p => soleTop - p[1];
  // UV da camisa: torso = cilindro (frente u=.25, costas u=.75); manga = ângulo ao redor do braço (listras correm ao longo do braço)
  let topY = sp[1] + .12; const botY = hip - .1;   // topY é recalculado depois do recorte: topo real da camisa (ombros/colarinho)
  const torsoUV = p => { const th = Math.atan2(p[0] - sp[0], p[2] - sp[2]); let u = th/(2*Math.PI) + .25; u -= Math.floor(u); return [u, kl((topY - p[1])/(topY - botY))*.72]; };   // v 0..0.72 = corpo
  const sleeveUV = p => { const { t, L, a } = armT(p); if (!a) return [.5, .86]; const ax = v3.nrm(a.d), loc = v3.sub(p, a.A), al = v3.dot(loc, ax), rad = [loc[0] - ax[0]*al, loc[1] - ax[1]*al, loc[2] - ax[2]*al], e2 = [-ax[2], 0, ax[0]];
    const th = Math.atan2(v3.dot(rad, e2), rad[1]), left = p[0]*SIDE >= 0, sg = left ? 1 : -1; return [(left ? .238 : .738) + sg*th/(2*Math.PI)*.28, .772 + .208*kl(al/(L*FIT.sleeve))]; };   // faixa v .74..0.98: uma por braço (esq. u≈.25, dir. u≈.75); frente do braço = u crescente nos dois
  const out = [];
  const peça = (slot, V, T) => { if (T.length) out.push({ slot, V, T }); };
  // punho da manga = mesmo tecido da manga (nas camisas de referência a manga termina sem punho contrastante)
  // --- camisa: tronco e mangas separados por um corte reto no ombro, cada parte com o seu mapeamento de textura ---
  { const c = clipMesh(V0, T0, shirtF);
    topY = Math.min(Math.max(...c.V.map(v => v.p[1])), head - .08); UVINFO = { top: +topY.toFixed(4), bot: +botY.toFixed(4) }; if (process.env.UVDBG) console.log("UVDBG topY", topY, "botY", botY, "oldTop", sp[1] + .12);
    const q0 = c.V.map(v => v.p.slice());
    displace(c.V, p => FIT.ease + FIT.shoulderEase*kl((sp[1] + .05 - p[1])/.08) + FIT.sleeveFlare*kl((.2 - sleeveF(p))/.2), p => FIT.shirtHem*kl((hemY + .35 - p[1])/.35) ** 2, p => kl((p[1] - hemY)/.1));
    // manga em tubo circular (DESLIGADO: o raio máximo do músculo em torno do eixo do osso deixava a manga ~1,6x mais larga que o braço — a manga agora acompanha a superfície real do braço pelo deslocamento acima)
    if (FIT.tube) { const info = c.V.map((v, i) => { const a = armT(q0[i]).a, t = armT(q0[i]).t, L = armT(q0[i]).L; if (!a || t*L < 0) return null; const ax = v3.nrm(a.d), loc = v3.sub(q0[i], a.A), al = v3.dot(loc, ax), rv = [loc[0] - ax[0]*al, loc[1] - ax[1]*al, loc[2] - ax[2]*al]; return { a, ax, al, rv, r0: Math.hypot(...rv), t: t*L }; }), bins = {}, key = x => Math.round(x/.02);
      info.forEach(f => { if (f) bins[key(f.al)] = Math.max(bins[key(f.al)] || 0, f.r0); });
      const sm = k => { let t = 0, n = 0; for (let d = -2; d <= 2; d++) if (bins[k + d] !== undefined) { t += bins[k + d]; n++; } return n ? t/n : 0; };
      c.V.forEach((v, i) => { const f = info[i]; if (!f || f.r0 < 1e-6) return; const dsp = v3.sub(v.p, f.a.A), al2 = v3.dot(dsp, f.ax), rv2 = [dsp[0] - f.ax[0]*al2, dsp[1] - f.ax[1]*al2, dsp[2] - f.ax[2]*al2], rd = Math.hypot(...rv2); if (rd < 1e-6) return;
        const k = kl(f.t/.1), rt = Math.max(sm(key(f.al)) + .004 + FIT.sleeveFlare*kl(f.t/.3), f.r0 + .006), rn = rd + (rt - rd)*k; v.p = [f.a.A[0] + f.ax[0]*al2 + rv2[0]/rd*rn, f.a.A[1] + f.ax[1]*al2 + rv2[1]/rd*rn, f.a.A[2] + f.ax[2]*al2 + rv2[2]/rd*rn]; }); }
    relax(c.V, c.T, q0, { iters: FIT.relax, pin: new Set(c.cuts.flat()), wt: p => Math.abs(p[0] - sp[0]) < .2 && p[1] < sp[1] - .02 ? kl((sp[1] - .02 - p[1])/.06) : 0, minOff: FIT.shirtMin });   // tecido caindo, não colado no músculo
    hemLip(c.V, c.T, c.cuts, .01);
    const armPos = p => armT(p).t*armT(p).L;
    const torso0 = clipMesh(c.V, c.T, p => -armPos(p)), sleeve = clipMesh(c.V, c.T, armPos);
    // tronco: projeção PLANA na frente e nas costas (como no molde original do kit): o painel cobre de costura lateral a costura lateral, sem coluna esticada nas laterais
    const chestV = torso0.V.filter(v => v.p[1] > hemY + .1 && v.p[1] < sp[1] - .08), XS = Math.max(...chestV.map(v => Math.abs(v.p[0] - sp[0]))), ZMID = (Math.min(...chestV.map(v => v.p[2])) + Math.max(...chestV.map(v => v.p[2])))/2;
    const fpart = clipMesh(torso0.V, torso0.T, p => p[2] - ZMID), bpart = clipMesh(torso0.V, torso0.T, p => ZMID - p[2]), cl1 = x => Math.max(-1, Math.min(1, x));
    const torso = { V: fpart.V.concat(bpart.V), T: fpart.T.concat(bpart.T.map(t => t.map(i => i + fpart.V.length))) };
    sleeve.V.forEach(v => { v.uv = sleeveUV(v.p); });
    // tronco reto como na camisa real: o tecido não afunila na cintura — raio mínimo = 90% do raio do peito, no mesmo ângulo (só para fora; UV já calculado)
    { const NB = 36, ang = v => Math.floor(((Math.atan2(v.p[0] - sp[0], v.p[2] - sp[2]) + Math.PI)/(2*Math.PI))*NB) % NB, chest = Array(NB).fill(0);
      torso.V.forEach(v => { if (v.p[1] > sp[1] - .1 && v.p[1] < sp[1] + .02 && Math.abs(v.p[0] - sp[0]) < .3) chest[ang(v)] = Math.max(chest[ang(v)], Math.hypot(v.p[0] - sp[0], v.p[2] - sp[2])); });
      torso.V.forEach(v => { const r = Math.hypot(v.p[0] - sp[0], v.p[2] - sp[2]), rc = chest[ang(v)]; if (rc && v.p[1] < sp[1] - .02 && r < rc*FIT.torsoMin) { const k = kl((sp[1] - .02 - v.p[1])/.1), rn = r + (rc*FIT.torsoMin - r)*k; v.p[0] = sp[0] + (v.p[0] - sp[0])*rn/r; v.p[2] = sp[2] + (v.p[2] - sp[2])*rn/r; } }); }
    // costas retas: o tecido não acompanha o "bumbum" — achata o fundo da camisa no plano das omoplatas (só região do tronco, abaixo do peito)
    { const up = torso.V.filter(v => v.p[1] > sp[1] - .04 && v.p[1] < sp[1] + .1 && Math.abs(v.p[0] - sp[0]) < .18), zb = Math.min(...up.map(v => v.p[2])) - .004; const hw = Math.max(...torso.V.filter(v => v.p[1] < sp[1] && v.p[1] > hemY).map(v => Math.abs(v.p[0] - sp[0])));
      torso.V.forEach(v => { if (v.p[2] < sp[2] - .02) { const k = kl((sp[1] + .05 - v.p[1])/.12)*kl((hw*.85 - Math.abs(v.p[0] - sp[0]))/(hw*.3)); v.p[2] += (zb - v.p[2])*k; ; } }); }
    // UV só DEPOIS de endireitar/achatar o tronco: assim as listras seguem a posição final do tecido (antes ficavam presas à posição antiga e entortavam na cintura)
    const XSU = Math.max(XS, ...torso0.V.filter(v => v.p[1] > sp[1] - .08).map(v => Math.abs(v.p[0] - sp[0]))), XSy = p => XS + (XSU*1.1 - XS)*kl((p[1] - (sp[1] - .1))/.12);   // acima da axila o molde acompanha o tronco que alarga (sem travar na borda = sem borrão nas laterais)
    fpart.V.forEach(v => { v.uv = [.25 + cl1((v.p[0] - sp[0])/XSy(v.p))*.235, torsoUV(v.p)[1]]; }); bpart.V.forEach(v => { v.uv = [.75 - cl1((v.p[0] - sp[0])/XSy(v.p))*.235, torsoUV(v.p)[1]]; });
    const nk = p => p[1] > sp[1] ? .022 - neckF(p) : -1, cf = p => .02 - sleeveF(p);
    const tm = clipMesh(torso.V, torso.T, p => -nk(p)), tt = clipMesh(torso.V, torso.T, nk), sm = clipMesh(sleeve.V, sleeve.T, p => -cf(p)), st = clipMesh(sleeve.V, sleeve.T, cf);
    fixSeam(tm.V, tm.T);
    // ombro: faixa no topo da camisa (da gola até a manga) usa o mapa da MANGA, então as 3 listras do ombro continuam do braço até a gola, como na camisa real
    const ZC = -.035, yokeF = p => Math.min(p[1] - (topY - .06 - .5*Math.max(0, Math.abs(p[0] - sp[0]) - .1)), Math.abs(p[0] - sp[0]) - .05), yk = clipMesh(tm.V, tm.T, yokeF), tr0 = clipMesh(tm.V, tm.T, p => -yokeF(p));
    const ykF = clipMesh(yk.V, yk.T, p => p[2] - ZMID), ykB = clipMesh(yk.V, yk.T, p => ZMID - p[2]);   // só a METADE DA FRENTE usa o mapa da manga; nas costas a faixa mantém o mapa do tronco (evita recortes nas listras das costas)
    ykF.V.forEach(v => { const left = v.p[0]*SIDE >= 0, sg = left ? 1 : -1; v.uv = [(left ? .238 : .738) + sg*(v.p[2] - ZC)*1.2, .78]; });   // listras correm da manga para a gola (u pela profundidade, v fixo no início da faixa)
    if (FIT.yoke) { peça('Shirt', tr0.V, tr0.T); peça('Shirt', ykF.V, ykF.T); peça('Shirt', ykB.V, ykB.T); } else peça('Shirt', tm.V, tm.T); peça('Shirt', sm.V, sm.T); peça('Trim', tt.V, tt.T); peça('Shirt', st.V, st.T); }
  // --- calção (solto, abre na barra) ---
  { const c = clipMesh(V0, T0, shortsF); displace(c.V, p => .008 + (FIT.shorts - .008)*kl((hemY + .03 - p[1])/.1), p => FIT.shortsFlare*kl((hip - .12 - p[1])/Math.max(.05, hip - .12 - shortsEnd)), p => p[1] > waistTop - .05 ? 0 : kl((p[1] - shortsEnd)/.08)); hemLip(c.V, c.T, c.cuts, .012); peça('Shorts', c.V, c.T); }
  // --- meias (justas) com punho na cor secundária ---
  { const c = clipMesh(V0, T0, socksF); displace(c.V, () => FIT.socks); hemLip(c.V, c.T, c.cuts, .004);
    const m = clipMesh(c.V, c.T, p => -sockTrimF(p)), tr = clipMesh(c.V, c.T, sockTrimF); peça('Socks', m.V, m.T); peça('Trim', tr.V, tr.T); }
  // --- chuteira: cano, sola, travas, cadarço ---
  { const c = clipMesh(V0, T0, bootsF); displace(c.V, () => FIT.boots); hemLip(c.V, c.T, c.cuts, .006); peça('Boots', c.V, c.T);
    const so = clipMesh(V0, T0, soleF); displace(so.V, () => FIT.sole); hemLip(so.V, so.T, so.cuts, .008); peça('Sole', so.V, so.T);
    const sd = { V: [], T: [] }, add = g => { const b = sd.V.length; sd.V.push(...g.V); g.T.forEach(t => sd.T.push(t.map(i => i + b))); };
    for (const side of ['Left', 'Right']) { const jf = J[side + 'Foot']; if (jf === undefined) continue; const fv = V0.filter(v => v.p[1] < bootTop && v.p[0]*SIDE*(side === 'Left' ? 1 : -1) > 0 && v.p[1] < .2);
      if (!fv.length) continue; const xc = fv.reduce((s2, v) => s2 + v.p[0], 0)/fv.length, zs = fv.map(v => v.p[2]), z0 = Math.min(...zs), z1 = Math.max(...zs), yb = minY - FIT.sole + .002;
      for (const z of [z0 + .03, z0 + .055]) for (const dx of [-.022, .022]) add(stud([xc + dx, yb, z], .009, .006, .014, jf));                 // 4 travas no calcanhar
      for (const z of [z1 - .1, z1 - .07, z1 - .04]) for (const dx of [-.028, .028]) add(stud([xc + dx, yb, z], .009, .006, .014, jf));         // 6 travas na frente
      for (let k = 0; k < 4; k++) { const z = z0 + (z1 - z0)*(.5 + k*.1), top = Math.max(...fv.filter(v => Math.abs(v.p[2] - z) < .02).map(v => v.p[1]), minY + .05); add(box([xc, top + FIT.boots + .002, z], [.055, .006, .01], jf)); }   // cadarço
    } peça('Sole', sd.V, sd.T); }
  return out;
}
let UVINFO = null;   // mapa vertical do corpo (topo/base da camisa em metros): gravado no GLB para o uniform.js usar o mesmo valor
export function prepare(model, override = {}, tex = {}) {
  if ((model.json.materials || []).some(m => /^shirt$/i.test(m.name || ''))) throw new Error('Este modelo já foi preparado (tem o material Shirt). Rode o prepare-athlete no modelo ORIGINAL, não no resultado.');   // tex: { skin, eyes, hair } = Buffers PNG opcionais (mantêm o rosto pintado)
  const j = model.json, nodes = j.nodes || [], parent = {}; nodes.forEach((n, i) => (n.children || []).forEach(c => { parent[c] = i; })); const world = [], wm = i => world[i] ??= parent[i] !== undefined ? mm(wm(parent[i]), compose(nodes[i])) : compose(nodes[i]);
  const skin = (j.skins || [])[0]; if (!skin) throw new Error('O arquivo não tem esqueleto (skin).'); const names = skin.joints.map(n => nodes[n].name || `node${n}`), R = resolveBones(names, override);
  if (!R.ok) { const e = new Error(`Ossos obrigatórios não reconhecidos: ${R.requiredMissing.join(', ')}.\nNomes de ossos no arquivo:\n  ${names.join(', ')}\nCrie um skeleton-map.json { "Hips": "nome", … } e use --map.`); e.names = names; throw e; }
  const B = {}, canonOfNode = new Map(); CANON.forEach(c => { if (!R.map[c]) return; const ni = skin.joints[names.indexOf(R.map[c])], m = wm(ni); B[c] = [m[12], m[13], m[14]]; canonOfNode.set(ni, c); });
  const canonOfJoint = jIdx => { let n = skin.joints[jIdx]; while (n !== undefined && !canonOfNode.has(n)) n = parent[n]; return n === undefined ? null : canonOfNode.get(n); };   // osso extra → ancestral canônico
  const top = B.Spine2 || B.Spine1 || B.Spine, waist = B.Hips, stats = {}, b = new Builder(model), matIdx = Object.fromEntries(SLOT_LIST.map((s, i) => [s, i]));
  nodes.forEach((n, ni) => { if (n.mesh === undefined || n.skin === undefined) return; const M = wm(ni), mesh = b.json.meshes[n.mesh], newPrims = [];
    mesh.primitives.forEach(p => { if ((p.mode ?? 4) !== 4) throw new Error('Só triângulos são suportados (mode 4).'); const A = p.attributes, pos = readAccessor(model, A.POSITION), jo = readAccessor(model, A.JOINTS_0), we = readAccessor(model, A.WEIGHTS_0), nor = A.NORMAL !== undefined ? readAccessor(model, A.NORMAL) : null;
      const matName = String((model.json.materials || [])[p.material]?.name || ''), UV0 = A.TEXCOORD_0 !== undefined ? readAccessor(model, A.TEXCOORD_0) : null, hasHairMat = (model.json.materials || []).some(m => /hair/i.test(m.name || ''));
      if (!/eye|hair/i.test(matName)) reshapeBody(pos, jo, we, canonOfJoint, B);
      const idx = p.indices !== undefined ? readAccessor(model, p.indices).map(r => r[0]) : pos.map((_, k) => k), groups = {}; SLOT_LIST.forEach(s => { groups[s] = []; });
      for (let t = 0; t + 2 < idx.length; t += 3) { const v = [idx[t], idx[t + 1], idx[t + 2]], wsum = {}; v.forEach(k => jo[k].forEach((ji, c) => { wsum[ji] = (wsum[ji] || 0) + we[k][c]; }));
        const best = Object.entries(wsum).sort((x, y) => y[1] - x[1])[0], canon = best ? canonOfJoint(+best[0]) : null, cen = tp(M, [0, 1, 2].map(c => (pos[v[0]][c] + pos[v[1]][c] + pos[v[2]][c])/3));
        let slot = canon ? slotFor(canon, cen, B) : 'Skin'; if (/eye/i.test(matName)) slot = 'Eyes'; else if (/hair/i.test(matName)) slot = 'Hair'; else if (slot === 'Hair' && hasHairMat) slot = 'Skin'; groups[slot].push(v); }
      SLOT_LIST.forEach(slot => { const tris = groups[slot]; if (!tris.length) return; const remap = new Map(), vs = []; tris.forEach(tr => tr.forEach(k => { if (!remap.has(k)) { remap.set(k, vs.length); vs.push(k); } }));
        const P = vs.map(k => pos[k]), uv = vs.map(k => { if (TEXTURED.has(slot)) return UV0 ? UV0[k].slice(0, 2) : [0, 0]; if (slot !== 'Shirt') return [0, 0]; const w = tp(M, pos[k]), th = Math.atan2(w[0] - waist[0], w[2] - waist[2]); let u = th/(2*Math.PI) + .25; u -= Math.floor(u); const v = Math.min(1, Math.max(0, (top[1] + .12 - w[1])/(top[1] + .12 - (waist[1] - .05)))); return [u, v]; });
        const attrs = { POSITION: b.accessor(P, 'VEC3', 5126, { target: 34962, minmax: true }), TEXCOORD_0: b.accessor(uv, 'VEC2', 5126, { target: 34962 }), JOINTS_0: b.accessor(vs.map(k => jo[k]), 'VEC4', 5123, { target: 34962 }), WEIGHTS_0: b.accessor(vs.map(k => { const s = we[k].reduce((x, y) => x + y, 0) || 1; return we[k].map(x => x/s); }), 'VEC4', 5126, { target: 34962 }) };
        if (nor) attrs.NORMAL = b.accessor(vs.map(k => nor[k]), 'VEC3', 5126, { target: 34962 });
        newPrims.push({ attributes: attrs, indices: b.accessor(tris.flatMap(tr => tr.map(k => [remap.get(k)])), 'SCALAR', vs.length > 65535 ? 5125 : 5123, { target: 34963 }), material: matIdx[slot], mode: 4 }); stats[slot] = (stats[slot] || 0) + tris.length; });
      if (!/eye|hair/i.test(matName)) {                                    // corpo: cria as roupas como malhas novas por cima
        const nw = r => { const t = r.reduce((x, y) => x + y, 0) || 1; return r.map(x => x/t); }, V0 = pos.map((q, k) => ({ p: q.slice(0, 3), n: nor ? nor[k].slice(0, 3) : [0, 0, 0], uv: [0, 0], j: jo[k].slice(), w: nw(we[k]) })), T0 = []; for (let t = 0; t + 2 < idx.length; t += 3) T0.push([idx[t], idx[t + 1], idx[t + 2]]);
        const J = {}; ['Left', 'Right'].forEach(sd => { const nm = R.map[sd + 'Foot']; if (nm) J[sd + 'Foot'] = names.indexOf(nm); });
        const merged = {}; for (const g of buildGarments(V0, T0, B, J)) { const m = merged[g.slot] ||= { slot: g.slot, V: [], T: [] }, off = m.V.length; m.V.push(...g.V); g.T.forEach(t => m.T.push(t.map(i => i + off))); }   // um primitivo por material
        for (const g of Object.values(merged)) { const used = new Map(), vv = [], tt = g.T.map(t => t.map(i => { if (!used.has(i)) { used.set(i, vv.length); vv.push(g.V[i]); } return used.get(i); }));
          const at = { POSITION: b.accessor(vv.map(v => v.p), 'VEC3', 5126, { target: 34962, minmax: true }), NORMAL: b.accessor(vv.map(v => v.n), 'VEC3', 5126, { target: 34962 }), TEXCOORD_0: b.accessor(vv.map(v => v.uv), 'VEC2', 5126, { target: 34962 }), JOINTS_0: b.accessor(vv.map(v => v.j), 'VEC4', 5123, { target: 34962 }), WEIGHTS_0: b.accessor(vv.map(v => v.w), 'VEC4', 5126, { target: 34962 }) };
          newPrims.push({ attributes: at, indices: b.accessor(tt.flatMap(t => t.map(i => [i])), 'SCALAR', vv.length > 65535 ? 5125 : 5123, { target: 34963 }), material: matIdx[g.slot], mode: 4 }); stats[g.slot] = (stats[g.slot] || 0) + tt.length; } } });
    mesh.primitives = newPrims; });
  b.json.materials = SLOT_LIST.map(s => ({ name: s, ...(['Shirt', 'Shorts', 'Socks', 'Trim', 'Boots', 'Sole'].includes(s) ? { doubleSided: true } : {}), pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: s === 'Eyes' ? .35 : s === 'Sole' ? .6 : .85 } })); delete b.json.textures; delete b.json.images; delete b.json.samplers;
  const withTex = { Skin: tex.skin, Gloves: tex.skin, Eyes: tex.eyes, Hair: tex.hair }, srcOf = new Map();   // embute cada PNG uma vez (Skin e Gloves dividem a mesma imagem)
  for (const [slot, buf] of Object.entries(withTex)) { if (!buf) continue; let si = srcOf.get(buf); if (si === undefined) { const off = b.add(new Uint8Array(buf)); b.json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: buf.length }); (b.json.images ||= []).push({ bufferView: b.json.bufferViews.length - 1, mimeType: 'image/png' }); si = b.json.images.length - 1; srcOf.set(buf, si); }
    (b.json.textures ||= []).push({ source: si }); b.json.materials[matIdx[slot]].pbrMetallicRoughness.baseColorTexture = { index: b.json.textures.length - 1 }; if (slot === 'Hair') b.json.materials[matIdx[slot]].doubleSided = true; }   // cor/estampa vêm do jogo
  if (UVINFO) b.json.asset = { ...(b.json.asset || { version: '2.0' }), extras: { ...((b.json.asset || {}).extras || {}), shirtUV: { ...UVINFO, v: 2 } } };   // lido por loader.js → uniform.js
  return { glb: b.glb(), stats, bones: R.map };
}
const entry = process.argv[1] && process.argv[1].endsWith('prepare-athlete.mjs');
if (entry) {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--')), mi = process.argv.indexOf('--map'), override = mi > 0 ? JSON.parse(fs.readFileSync(process.argv[mi + 1], 'utf8')) : {}, inp = args[0], out = args[1] || 'assets/models/athlete.glb';
  if (!inp) { console.log('Uso: node ' + path.relative(process.cwd(), fileURLToPath(import.meta.url)) + ' <entrada.glb|.gltf> [saida.glb] [--map skeleton-map.json]'); process.exit(2); }
  try { const tf = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? fs.readFileSync(process.argv[i + 1]) : undefined; }, r = prepare(readModel(inp), override, { skin: tf('skin'), eyes: tf('eyes'), hair: tf('hair') }); fs.mkdirSync(out.replace(/[^/\\]+$/, '') || '.', { recursive: true }); fs.writeFileSync(out, r.glb);
    console.log(`✔ ${out} gerado (${(r.glb.length/1024).toFixed(0)} KB). Triângulos por material:`, r.stats); const rep = inspect(new Uint8Array(r.glb), { skeletonMap: override });
    console.log(rep.ok ? '✔ O inspetor aprovou o modelo.' : '✖ O inspetor ainda aponta problemas:'); rep.errors.forEach(e => console.log('   ERRO ', e)); rep.warnings.forEach(w => console.log('   aviso', w)); process.exit(rep.ok ? 0 : 1); }
  catch (e) { console.log('✖', e.message); process.exit(1); }
}
