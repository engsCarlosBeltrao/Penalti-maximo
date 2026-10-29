#!/usr/bin/env node
// MEDIDOR (somente leitura) do pescoço, da transição pescoço-ombro e do caimento da camisa no athlete.glb. Não grava nada.
// Uso: node tools/measure-athlete.mjs [modelo.glb] [outro.glb] [--json]   (com 2 arquivos: compara ANTES × DEPOIS lado a lado)
// Alturas são relativas aos ossos (Neck, Head, Arm), então a régua vale para qualquer humanoide preparado pelo prepare-athlete.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { readModel, readAccessor } from './gltf-io.mjs';
import { resolveBones } from '../js/three/skeletonMap.js';
const ALVO = { neckHW: .07, slopeMin: 15, slopeMax: 25, gapMin: .005, beardGap: .006 };   // critérios de aceite do conserto (metros / graus)
const sha = u8 => crypto.createHash('sha256').update(u8).digest('hex').slice(0, 12);
const q = (a, f) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f*s.length))]; };
// grade espacial para "vértice de pele mais próximo" (2 cm por célula)
function grid(P, cs = .02) { const g = new Map(), k = (x, y, z) => x + ',' + y + ',' + z; P.forEach((p, i) => { const c = k(Math.floor(p[0]/cs), Math.floor(p[1]/cs), Math.floor(p[2]/cs)); let a = g.get(c); if (!a) g.set(c, a = []); a.push(i); });
  return p => { const cx = Math.floor(p[0]/cs), cy = Math.floor(p[1]/cs), cz = Math.floor(p[2]/cs); let m = Infinity, best = -1;
    for (let r = 1; r <= 3 && best < 0; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (const i of g.get(k(cx + dx, cy + dy, cz + dz)) || []) { const s = P[i], d = Math.hypot(s[0] - p[0], s[1] - p[1], s[2] - p[2]); if (d < m) { m = d; best = i; } }
    return { d: m, i: best }; }; }
export function measure(file) {
  const m = readModel(file), j = m.json, sk = (j.skins || [])[0]; if (!sk) throw new Error(`${file}: sem esqueleto (skin).`);
  const jn = sk.joints.map(i => j.nodes[i].name), R = resolveBones(jn), ibm = readAccessor(m, sk.inverseBindMatrices);
  if (!R.map.Neck) { const n = jn.find(x => /^neck/i.test(x)); if (n) { R.map.Neck = n; R.neckFora = n; } }   // ex.: "neck_01" não é reconhecido pelo skeletonMap.js (o jogo não anima esse osso); aqui só serve de régua
  const bone = c => { const a = ibm[jn.indexOf(R.map[c])]; if (!a) return null; const t = [a[12], a[13], a[14]]; return [-(a[0]*t[0] + a[1]*t[1] + a[2]*t[2]), -(a[4]*t[0] + a[5]*t[1] + a[6]*t[2]), -(a[8]*t[0] + a[9]*t[1] + a[10]*t[2])]; };   // posição de bind = -Rᵀ·t da matriz inversa
  const B = Object.fromEntries(['Hips', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm'].map(c => [c, bone(c)])), mat = i => (j.materials[i] || {}).name || '';
  // malha do corpo = a que tem Skin e Shirt; as outras (rosto, olhos, cabelos, barbas) são "acessórios" que o conserto NÃO pode alterar
  const bodyMesh = j.meshes.find(me => ['Skin', 'Shirt'].every(s => me.primitives.some(p => mat(p.material) === s))); if (!bodyMesh) throw new Error(`${file}: não achei a malha do corpo (materiais Skin + Shirt).`);
  const V = {}; bodyMesh.primitives.forEach(p => { const s = mat(p.material), P = readAccessor(m, p.attributes.POSITION), J = readAccessor(m, p.attributes.JOINTS_0), W = readAccessor(m, p.attributes.WEIGHTS_0); (V[s] ||= []).push(...P.map((pos, k) => ({ p: pos, j: J[k], w: W[k] }))); });
  const skin = (V.Skin || []).map(v => v.p), cloth = [...(V.Shirt || []), ...(V.Trim || [])], near = grid(skin), nY = B.Neck[1], hY = B.Head[1], arm = B.LeftArm, sx = Math.abs(arm[0]);
  // 1) pescoço: meia-largura (|x|) e profundidade (z na linha do meio) da pele, em fatias de 2 cm entre a base do pescoço e o queixo
  const fatias = []; for (let y = nY - .04; y <= hY + .03; y += .02) { const s = skin.filter(p => p[1] >= y && p[1] < y + .02 && Math.abs(p[0]) < .13), c = s.filter(p => Math.abs(p[0]) < .015);
    fatias.push({ y: +y.toFixed(3), hw: s.length ? +Math.max(...s.map(p => Math.abs(p[0]))).toFixed(3) : null, prof: c.length ? +(Math.max(...c.map(p => p[2])) - Math.min(...c.map(p => p[2]))).toFixed(3) : null }); }
  const at = y => fatias.find(f => y >= f.y && y < f.y + .02) || {};
  // 2) linha do ombro: topo da pele e da camisa por faixa de x (|z| < 12 cm), do pescoço até além da articulação do braço
  const topo = (P, x0, x1) => { const s = P.filter(p => Math.abs(p[0]) >= x0 && Math.abs(p[0]) < x1 && Math.abs(p[2]) < .12 && p[1] > nY - .15); return s.length ? Math.max(...s.map(p => p[1])) : NaN; };
  const ombro = []; for (let x = 0; x < sx + .075; x += .025) ombro.push({ x: +x.toFixed(3), pele: +topo(skin, x, x + .025).toFixed(3), camisa: +topo(cloth.map(v => v.p), x, x + .025).toFixed(3) });
  // inclinação (graus) do topo do ombro até a articulação do braço. Camisa: de x=.10 (a gola já ficou para trás). Pele: de x=.125 (antes disso o topo ainda é a lateral do pescoço)
  const incl = (P, xa) => +(Math.atan2(topo(P, xa - .0125, xa + .0125) - topo(P, sx - .0125, sx + .0125), sx - xa)*180/Math.PI).toFixed(1), inclC = incl(cloth.map(v => v.p), .1), inclP = incl(skin, .125);
  // 3) folga da camisa/gola sobre a pele (da altura do peito para cima)
  const alto = cloth.filter(v => v.p[1] > B.Spine2[1] + .1), gaps = alto.map(v => near(v.p).d), justos = gaps.filter(d => d < .003).length;
  // 4) pesos na base do pescoço: quanto as clavículas puxam (estica o pescoço quando o ombro desce)
  const cla = new Set(['LeftShoulder', 'RightShoulder'].map(c => jn.indexOf(R.map[c]))), base = (V.Skin || []).filter(v => v.p[1] > nY - .02 && v.p[1] < nY + .04 && Math.abs(v.p[0]) < .09);
  const pesoCla = base.length ? base.reduce((s, v) => s + v.j.reduce((t, ji, c) => t + (cla.has(ji) ? v.w[c] : 0), 0), 0)/base.length : NaN;
  // 5) acessórios presos à cabeça (barbas/cabelos): distância à pele — se o pescoço/queixo mudar, a barba não pode descolar
  const acess = j.meshes.filter(me => me !== bodyMesh).map(me => { const P = me.primitives.flatMap(p => readAccessor(m, p.attributes.POSITION)), d = P.map(p => near(p).d);
    return { nome: me.name, yMin: +Math.min(...P.map(p => p[1])).toFixed(3), distMed: +q(d, .5).toFixed(4), hash: sha(new Float32Array(P.flat())) }; });
  // 6) integridade: contagens e impressões digitais do que o conserto deve manter igual
  const img = (j.images || []).map(im => { const bv = j.bufferViews[im.bufferView], b = m.buffers[bv.buffer]; return sha(b.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)); });
  const integ = { neckNoJogo: R.neckFora ? `NÃO reconhecido (${R.neckFora})` : R.map.Neck, nos: j.nodes.length, malhas: j.meshes.length, materiais: j.materials.map(x => x.name).join(','), imagens: img.join(','), ossos: jn.length, ibm: sha(new Float32Array(ibm.flat())), shirtUV: JSON.stringify((j.asset.extras || {}).shirtUV || null),
    uvCamisa: sha(new Float32Array(bodyMesh.primitives.filter(p => /^(Shirt|Trim)$/.test(mat(p.material))).flatMap(p => readAccessor(m, p.attributes.TEXCOORD_0).flat()))) };
  return { arquivo: file, ossos: Object.fromEntries(Object.entries(B).map(([k, v]) => [k, v && v.map(x => +x.toFixed(3))])), fatias, ombro, acess, integ,
    resumo: { neckHW: at(nY + .045).hw, neckProf: at(nY + .045).prof, chinHW: at(hY).hw, inclOmbroCamisa: inclC, inclOmbroPele: inclP, folgaMin: +Math.min(...gaps).toFixed(4), folgaP10: +q(gaps, .1).toFixed(4), folgaMed: +q(gaps, .5).toFixed(4), justos, pontosCamisa: gaps.length, pesoClaviculaBase: +pesoCla.toFixed(2) } };
}
const fmt = v => v === null || v === undefined || Number.isNaN(v) ? '—' : String(v);
const veredito = r => [['pescoço (Neck+4,5cm) meia-largura', r.neckHW <= ALVO.neckHW, `≤ ${ALVO.neckHW}`], ['inclinação do ombro (camisa)', r.inclOmbroCamisa >= ALVO.slopeMin && r.inclOmbroCamisa <= ALVO.slopeMax, `${ALVO.slopeMin}–${ALVO.slopeMax}°`], ['folga mínima camisa→pele', r.folgaMin >= ALVO.gapMin, `≥ ${ALVO.gapMin}`]];
function report(A, Bm) {
  const col = (a, b) => Bm ? `${fmt(a).padStart(9)}  →  ${fmt(b).padEnd(9)}` : fmt(a);
  console.log(`\nMEDIDOR DO ATLETA  ${A.arquivo}${Bm ? '  →  ' + Bm.arquivo : ''}\nOssos (bind): ` + Object.entries(A.ossos).map(([k, v]) => `${k} ${v ? v.join(' ') : '—'}`).join(' · '));
  console.log('\n— Resumo —'); Object.keys(A.resumo).forEach(k => console.log(`  ${k.padEnd(18)} ${col(A.resumo[k], Bm && Bm.resumo[k])}`));
  console.log('\n— Pescoço: fatias de pele (y · meia-largura · profundidade no meio) —'); A.fatias.forEach((f, i) => { const g = Bm && Bm.fatias[i]; console.log(`  y ${f.y.toFixed(2)}  hw ${col(f.hw, g && g.hw)}  prof ${col(f.prof, g && g.prof)}`); });
  console.log('\n— Linha do ombro: topo (y) por faixa de x —'); A.ombro.forEach((o, i) => { const g = Bm && Bm.ombro[i]; console.log(`  x ${o.x.toFixed(3)}  pele ${col(o.pele, g && g.pele)}  camisa ${col(o.camisa, g && g.camisa)}`); });
  console.log('\n— Acessórios (y mínimo · distância mediana à pele · impressão digital) —'); A.acess.forEach(a => { const g = Bm && Bm.acess.find(x => x.nome === a.nome); console.log(`  ${a.nome.padEnd(16)} yMin ${col(a.yMin, g && g.yMin)}  dist ${col(a.distMed, g && g.distMed)}  ${g ? (g.hash === a.hash ? 'igual' : 'MUDOU') : a.hash}`); });
  console.log('\n— Integridade —'); Object.keys(A.integ).forEach(k => { const a = A.integ[k], b = Bm && Bm.integ[k]; console.log(`  ${k.padEnd(10)} ${Bm ? (a === b ? 'igual' : `MUDOU  ${a}  →  ${b}`) : a}`); });
  console.log('\n— Critérios de aceite —'); veredito((Bm || A).resumo).forEach(([n, ok, alvo]) => console.log(`  ${ok ? '✔' : '✖'} ${n} (alvo ${alvo})`));
}
const entry = process.argv[1] && process.argv[1].endsWith('measure-athlete.mjs');
if (entry) {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--')), files = args.length ? args : ['assets/models/athlete.glb'];
  try { files.forEach(f => { if (!fs.existsSync(f)) throw new Error(`arquivo não encontrado: ${f}`); }); const r = files.slice(0, 2).map(measure);
    if (process.argv.includes('--json')) console.log(JSON.stringify(r.length > 1 ? r : r[0], null, 1)); else report(r[0], r[1]); }
  catch (e) { console.log('✖', e.message); process.exit(1); }
}
