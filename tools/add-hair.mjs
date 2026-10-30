// Acrescenta ao athlete.glb (já preparado) os penteados Hair_*, barbas Beard_*, bigodes Must_*, costeletas Side_* e a faixa Acc_band, todos presos ao osso da cabeça.
// Cada peça leva o atributo _HAIR (cobertura, tom, u, v) para o shader de js/three/hairMaterial.js e usa materiais próprios (HairCap, Beard, Band),
// clonados do material Hair do modelo, para que cabelo, barba e faixa tenham cores independentes (as sobrancelhas continuam no material Hair).
// Uso: node tools/add-hair.mjs assets/models/athlete.glb [saida.glb] [--troca]   (--troca remove as peças antigas antes; sem ele, recusa se já houver)
import fs from 'node:fs';
import { readModel, readAccessor, Builder } from './gltf-io.mjs';
import { resolveBones } from '../js/three/skeletonMap.js';
import { skinMap, buildHair, buildBeard, buildMustache, buildSideburn, buildBand, HAIR, BEARD, MUSTACHE, SIDEBURN } from './hair-geometry.mjs';
const PIECE = /^(Hair|Beard|Must|Side|Acc)_/, NEW_MATS = ['HairCap', 'Beard', 'Band'];
// Remove as peças de cabelo antigas e os materiais delas, e reconstrói o buffer só com o que continua em uso (o arquivo não incha a cada troca).
export function stripHair(model) {
  const j = JSON.parse(JSON.stringify(model.json)), drop = new Set(j.nodes.map((n, i) => PIECE.test(n.name || '') ? i : -1).filter(i => i >= 0));
  const nodeMap = new Map(); j.nodes.forEach((n, i) => { if (!drop.has(i)) nodeMap.set(i, nodeMap.size); });
  const meshKeep = new Set(j.nodes.filter((n, i) => !drop.has(i) && n.mesh !== undefined).map(n => n.mesh)), meshMap = new Map(); j.meshes.forEach((m, i) => { if (meshKeep.has(i)) meshMap.set(i, meshMap.size); });
  j.nodes = j.nodes.filter((n, i) => !drop.has(i)).map(n => { const o = { ...n }; if (o.children) { o.children = o.children.filter(c => nodeMap.has(c)).map(c => nodeMap.get(c)); if (!o.children.length) delete o.children; } if (o.mesh !== undefined) o.mesh = meshMap.get(o.mesh); return o; });
  j.meshes = j.meshes.filter((m, i) => meshKeep.has(i)); (j.scenes || []).forEach(s => { s.nodes = s.nodes.filter(c => nodeMap.has(c)).map(c => nodeMap.get(c)); });
  (j.skins || []).forEach(s => { s.joints = s.joints.map(c => nodeMap.get(c)); if (s.skeleton !== undefined) s.skeleton = nodeMap.get(s.skeleton); }); (j.animations || []).forEach(a => a.channels.forEach(c => { c.target.node = nodeMap.get(c.target.node); }));
  const matDrop = new Set(j.materials.map((m, i) => NEW_MATS.includes(m.name) ? i : -1).filter(i => i >= 0)), matMap = new Map(); j.materials.forEach((m, i) => { if (!matDrop.has(i)) matMap.set(i, matMap.size); });
  j.materials = j.materials.filter((m, i) => !matDrop.has(i)); j.meshes.forEach(m => m.primitives.forEach(p => { if (p.material !== undefined) p.material = matMap.get(p.material); }));
  // compacta acessores/bufferViews em uso
  const usedAcc = new Set(); j.meshes.forEach(m => m.primitives.forEach(p => { Object.values(p.attributes).forEach(a => usedAcc.add(a)); if (p.indices !== undefined) usedAcc.add(p.indices); (p.targets || []).forEach(t => Object.values(t).forEach(a => usedAcc.add(a))); }));
  (j.skins || []).forEach(s => { if (s.inverseBindMatrices !== undefined) usedAcc.add(s.inverseBindMatrices); }); (j.animations || []).forEach(a => a.samplers.forEach(s => { usedAcc.add(s.input); usedAcc.add(s.output); }));
  const accMap = new Map(); [...usedAcc].sort((a, b) => a - b).forEach(a => accMap.set(a, accMap.size));
  const usedBV = new Set([...usedAcc].map(a => j.accessors[a].bufferView).filter(v => v !== undefined)); (j.images || []).forEach(im => { if (im.bufferView !== undefined) usedBV.add(im.bufferView); });
  const bvMap = new Map(), parts = []; let len = 0; [...usedBV].sort((a, b) => a - b).forEach(v => { const bv = j.bufferViews[v], src = model.buffers[bv.buffer || 0].subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength), pad = (4 - len % 4) % 4; if (pad) { parts.push(new Uint8Array(pad)); len += pad; } bvMap.set(v, { ...bv, buffer: 0, byteOffset: len }); parts.push(src); len += src.length; });
  j.accessors = [...accMap.keys()].map(a => { const acc = { ...j.accessors[a] }; if (acc.bufferView !== undefined) acc.bufferView = [...bvMap.keys()].indexOf(acc.bufferView); return acc; });
  j.bufferViews = [...bvMap.values()]; (j.images || []).forEach(im => { if (im.bufferView !== undefined) im.bufferView = [...bvMap.keys()].indexOf(im.bufferView); });
  const remapAcc = a => accMap.get(a); j.meshes.forEach(m => m.primitives.forEach(p => { for (const k in p.attributes) p.attributes[k] = remapAcc(p.attributes[k]); if (p.indices !== undefined) p.indices = remapAcc(p.indices); (p.targets || []).forEach(t => { for (const k in t) t[k] = remapAcc(t[k]); }); }));
  (j.skins || []).forEach(s => { if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = remapAcc(s.inverseBindMatrices); }); (j.animations || []).forEach(a => a.samplers.forEach(s => { s.input = remapAcc(s.input); s.output = remapAcc(s.output); }));
  const bin = new Uint8Array(len); let o = 0; for (const p of parts) { bin.set(p, o); o += p.length; } j.buffers = [{ byteLength: len }];
  return { json: j, buffers: [bin], dir: model.dir, removed: drop.size };
}
export function addHair(model, only = null) {
  const j0 = model.json; if ((j0.nodes || []).some(n => PIECE.test(n.name || ''))) throw new Error('O modelo já tem cabelos/barbas. Use --troca para substituir.');
  const b = new Builder(model), j = b.json, nodes = j.nodes, sk = j.skins[0], names = sk.joints.map(n => nodes[n].name), R = resolveBones(names, {}), headJ = names.indexOf(R.map.Head);
  const mats = j.materials.map(m => m.name), hairMat = mats.indexOf('Hair'), skinMat = mats.indexOf('Skin'); if (hairMat < 0 || skinMat < 0) throw new Error('Faltam os materiais Hair/Skin.');
  const skinTex = j.materials[skinMat].pbrMetallicRoughness?.baseColorTexture, matOf = {};
  for (const name of NEW_MATS) { const m = JSON.parse(JSON.stringify(j.materials[hairMat])); m.name = name; m.pbrMetallicRoughness = { ...(m.pbrMetallicRoughness || {}), baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: name === 'Band' ? .8 : .72 };
    if (name === 'Band' || !skinTex) delete m.pbrMetallicRoughness.baseColorTexture; else m.pbrMetallicRoughness.baseColorTexture = { ...skinTex };   // cabelo/barba amostram a textura da PELE: degradê e barba rala mostram a pele de verdade
    j.materials.push(m); matOf[name] = j.materials.length - 1; }
  const skinNodes = nodes.map((n, i) => [n, i]).filter(([n]) => n.mesh !== undefined && n.skin !== undefined);
  const parentOf = i => nodes.findIndex(n => (n.children || []).includes(i)), par = parentOf(skinNodes[0][1]); if (par < 0) throw new Error('Pai das malhas não encontrado.');
  const wmPos = i => { let p = [0, 0, 0]; const chain = []; for (let k = i; k >= 0 && k !== undefined; k = parentOf(k)) { chain.push(k); if (chain.length > 80) break; } chain.reverse().forEach(k => { const t = nodes[k].translation || [0, 0, 0]; p = [p[0] + t[0], p[1] + t[1], p[2] + t[2]]; }); return p; };
  const headY = wmPos(sk.joints[headJ])[1], verts = [], suv = [];
  for (const [n] of skinNodes) for (const p of j.meshes[n.mesh].primitives) if (p.material === skinMat) { const P = readAccessor(model, p.attributes.POSITION), T = p.attributes.TEXCOORD_0 !== undefined ? readAccessor(model, p.attributes.TEXCOORD_0) : null; P.forEach((q, i) => { if (q[1] > headY - .2) { verts.push(q); suv.push(T ? T[i] : [.5, .5]); } }); }
  if (!verts.length) throw new Error('Sem vértices de pele na cabeça.');
  const skinR = skinMap(verts), headTop = Math.max(...verts.map(v => v[1])), made = [];
  const uvAt = p => { let best = 0, bd = Infinity; for (let i = 0; i < verts.length; i++) { const q = verts[i], d = (q[0] - p[0])**2 + (q[1] - p[1])**2 + (q[2] - p[2])**2; if (d < bd) { bd = d; best = i; } } return suv[best]; };   // UV da pele mais próxima
  const add = (name, m, mat) => { if (!m) return; const attrs = { POSITION: b.accessor(m.V.map(v => v.p), 'VEC3', 5126, { target: 34962, minmax: true }), NORMAL: b.accessor(m.V.map(v => v.n), 'VEC3', 5126, { target: 34962 }), TEXCOORD_0: b.accessor(m.V.map(v => uvAt(v.p)), 'VEC2', 5126, { target: 34962 }),
      _HAIR: b.accessor(m.V.map(v => v.h), 'VEC4', 5126, { target: 34962 }), JOINTS_0: b.accessor(m.V.map(() => [headJ, 0, 0, 0]), 'VEC4', 5123, { target: 34962 }), WEIGHTS_0: b.accessor(m.V.map(() => [1, 0, 0, 0]), 'VEC4', 5126, { target: 34962 }) };
    j.meshes.push({ name, primitives: [{ attributes: attrs, indices: b.accessor(m.T.flatMap(t => t.map(i => [i])), 'SCALAR', 5123, { target: 34963 }), material: matOf[mat], mode: 4 }] });
    nodes.push({ name, mesh: j.meshes.length - 1, skin: 0 }); (nodes[par].children ||= []).push(nodes.length - 1); made.push([name, m.V.length, m.T.length]); };
  const want = n => !only || only.includes(n);
  for (const s of Object.keys(HAIR)) if (want('Hair_' + s)) add('Hair_' + s, buildHair(s, skinR, { yTop: headTop - .002 }), 'HairCap');
  for (const k of Object.keys(BEARD)) if (want('Beard_' + k)) add('Beard_' + k, buildBeard(k, skinR), 'Beard');
  for (const k of Object.keys(MUSTACHE)) if (want('Must_' + k)) add('Must_' + k, buildMustache(k, skinR), 'Beard');
  for (const k of Object.keys(SIDEBURN)) if (want('Side_' + k)) add('Side_' + k, buildSideburn(k, skinR), 'Beard');
  if (want('Acc_band')) add('Acc_band', buildBand(skinR), 'Band');
  return { glb: b.glb(), made, headTop, headY };
}
const entry = process.argv[1] && process.argv[1].endsWith('add-hair.mjs');
if (entry) { const args = process.argv.slice(2), troca = args.includes('--troca'), [inp, out = inp] = args.filter(a => !a.startsWith('--')); if (!inp) { console.log('Uso: node tools/add-hair.mjs athlete.glb [saida.glb] [--troca]'); process.exit(2); }
  try { let m = readModel(inp); if (troca) { m = stripHair(m); console.log(`   removidas ${m.removed} peças antigas`); } const r = addHair(m); fs.writeFileSync(out, r.glb); console.log(`✔ ${out} (${(r.glb.length/1024).toFixed(0)} KB) topo da cabeça y=${r.headTop.toFixed(3)}`);
    let tv = 0, tt = 0; r.made.forEach(([n, v, t]) => { tv += v; tt += t; console.log(`   ${n}: ${v} vértices, ${t} triângulos`); }); console.log(`   total: ${r.made.length} peças, ${tv} vértices, ${tt} triângulos (só 1 penteado + barba + bigode + costeleta aparecem por jogador)`); } catch (e) { console.log('✖', e.stack); process.exit(1); } }
