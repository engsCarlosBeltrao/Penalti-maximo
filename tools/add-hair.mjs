// Acrescenta ao athlete.glb (já preparado) os penteados Hair_* e as barbas Beard_* como malhas presas ao osso da cabeça.
// Uso: node tools/add-hair.mjs assets/models/athlete.glb [saida.glb]      (idempotente: recusa se já houver Hair_*/Beard_*)
import fs from 'node:fs';
import { readModel, readAccessor, Builder } from './gltf-io.mjs';
import { resolveBones } from '../js/three/skeletonMap.js';
import { skinMap, buildHair, buildBeard, HAIR_STYLES, BEARDS } from './hair-geometry.mjs';
export function addHair(model, only = null) {
  const j0 = model.json; if ((j0.nodes || []).some(n => /^(Hair|Beard)_/.test(n.name || ''))) throw new Error('O modelo já tem Hair_*/Beard_*. Rode no athlete.glb sem cabelos.');
  const b = new Builder(model), j = b.json, nodes = j.nodes, sk = j.skins[0], names = sk.joints.map(n => nodes[n].name), R = resolveBones(names, {}), headJ = names.indexOf(R.map.Head);
  const mats = j.materials.map(m => m.name), hairMat = mats.indexOf('Hair'), skinMat = mats.indexOf('Skin'); if (hairMat < 0 || skinMat < 0) throw new Error('Faltam os materiais Hair/Skin.');
  const skinNodes = nodes.map((n, i) => [n, i]).filter(([n]) => n.mesh !== undefined && n.skin !== undefined);
  const parentOf = i => nodes.findIndex(n => (n.children || []).includes(i)), par = parentOf(skinNodes[0][1]); if (par < 0) throw new Error('Pai das malhas não encontrado.');
  const world = []; const headBone = nodes[sk.joints[headJ]]; const wmPos = i => { let p = [0, 0, 0]; const chain = []; for (let k = i; k >= 0 && k !== undefined; k = parentOf(k)) { chain.push(k); if (chain.length > 80) break; } chain.reverse().forEach(k => { const t = nodes[k].translation || [0, 0, 0]; p = [p[0] + t[0], p[1] + t[1], p[2] + t[2]]; }); return p; };
  const headY = wmPos(sk.joints[headJ])[1], verts = [], uvs = [];
  for (const [n] of skinNodes) for (const p of j.meshes[n.mesh].primitives) { if (p.material === skinMat) readAccessor(model, p.attributes.POSITION).forEach(q => { if (q[1] > headY - .12) verts.push(q); }); if (p.material === hairMat && p.attributes.TEXCOORD_0 !== undefined) uvs.push(...readAccessor(model, p.attributes.TEXCOORD_0)); }
  if (!verts.length) throw new Error('Sem vértices de pele na cabeça.');
  const uv = uvs.length ? [0, 1].map(c => uvs.reduce((s, q) => s + q[c], 0)/uvs.length) : [.5, .5], skinR = skinMap(verts), headTop = Math.max(...verts.map(v => v[1])), made = [];
  const add = (name, m) => { if (!m) return; const attrs = { POSITION: b.accessor(m.V.map(v => v.p), 'VEC3', 5126, { target: 34962, minmax: true }), NORMAL: b.accessor(m.V.map(v => v.n), 'VEC3', 5126, { target: 34962 }), TEXCOORD_0: b.accessor(m.V.map(() => uv), 'VEC2', 5126, { target: 34962 }),
      JOINTS_0: b.accessor(m.V.map(() => [headJ, 0, 0, 0]), 'VEC4', 5123, { target: 34962 }), WEIGHTS_0: b.accessor(m.V.map(() => [1, 0, 0, 0]), 'VEC4', 5126, { target: 34962 }) };
    j.meshes.push({ name, primitives: [{ attributes: attrs, indices: b.accessor(m.T.flatMap(t => t.map(i => [i])), 'SCALAR', 5123, { target: 34963 }), material: hairMat, mode: 4 }] });
    nodes.push({ name, mesh: j.meshes.length - 1, skin: 0 }); (nodes[par].children ||= []).push(nodes.length - 1); made.push([name, m.V.length, m.T.length]); };
  for (const s of HAIR_STYLES) if (!only || only.includes('Hair_' + s)) add('Hair_' + s, buildHair(s, skinR, { yTop: headTop - .002 }));
  for (const k of BEARDS) if (!only || only.includes('Beard_' + k)) add('Beard_' + k, buildBeard(k, skinR));
  return { glb: b.glb(), made, headTop, headY };
}
const entry = process.argv[1] && process.argv[1].endsWith('add-hair.mjs');
if (entry) { const [inp, out = inp] = process.argv.slice(2); if (!inp) { console.log('Uso: node tools/add-hair.mjs athlete.glb [saida.glb]'); process.exit(2); }
  try { const r = addHair(readModel(inp)); fs.writeFileSync(out, r.glb); console.log(`✔ ${out} (${(r.glb.length/1024).toFixed(0)} KB) topo da cabeça y=${r.headTop.toFixed(3)}`); r.made.forEach(([n, v, t]) => console.log(`   ${n}: ${v} vértices, ${t} triângulos`)); } catch (e) { console.log('✖', e.message); process.exit(1); } }
