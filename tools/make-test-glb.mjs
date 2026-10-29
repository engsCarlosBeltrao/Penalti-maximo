#!/usr/bin/env node
// Gera um GLB MÍNIMO e válido (esqueleto de 22 ossos, 7 materiais nomeados, UV, pesos, animação "Idle") para testar o carregador e o inspetor.
// Não é um jogador de verdade: é um "esqueleto de teste" (um triângulo por peça). Uso: node tools/make-test-glb.mjs [saida.glb]
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
const { syntheticModel } = await need('retarget.js', 'montar o esqueleto de teste', ['syntheticModel']);
const { CANON, PARENT } = await need('skeletonMap.js', 'nomes dos ossos', ['CANON', 'PARENT']);
export function makeGLB(o = {}) {
  const M = syntheticModel({ arms: o.arms || 'T' }), sx = o.swapLR ? -1 : 1, fz = o.facing === '-z' ? -1 : 1, nodes = [], bones = CANON.filter(b => b in M.bones && !(o.dropBones || []).includes(b)), id = {};
  nodes.push({ name: 'Armature', children: [] }); bones.forEach(b => { id[b] = nodes.length; nodes.push({ name: (o.prefix || '') + b, children: [] }); });
  bones.forEach(b => { const p = PARENT[b]; let pp = p; while (pp && !(pp in id)) pp = PARENT[pp]; const w = M.bones[b].pos, pw = pp ? M.bones[pp].pos : [0, 0, 0]; nodes[id[b]].translation = [(w[0] - pw[0])*sx, w[1] - pw[1], (w[2] - pw[2])*fz]; (pp ? nodes[id[pp]] : nodes[0]).children.push(id[b]); });
  const SL = [['Shirt', 'Spine1'], ['Shorts', 'Hips'], ['Socks', 'LeftLeg'], ['Skin', 'Head'], ['Hair', 'Head'], ['Boots', 'LeftFoot'], ['Gloves', 'LeftHand']].filter(([m]) => !(o.dropMaterials || []).includes(m));
  const parts = [], bv = [], acc = []; let off = 0; const push = (buf, target) => { const pad = (4 - buf.length % 4) % 4, b = Buffer.concat([buf, Buffer.alloc(pad)]); bv.push({ buffer: 0, byteOffset: off, byteLength: buf.length, ...(target ? { target } : {}) }); parts.push(b); off += b.length; return bv.length - 1; };
  const f32 = a => Buffer.from(new Float32Array(a).buffer), prims = [];
  SL.forEach(([mat, bone], mi) => { const bn = bone in id ? bone : 'Hips', p = M.bones[bn].pos, v = [[-.05, 0, 0], [.05, 0, 0], [0, .1, 0]].map(d => [(p[0] + d[0])*sx, p[1] + d[1], (p[2] + d[2])*fz]), j = bones.indexOf(bn);
    const pos = f32(v.flat()), mn = [0, 1, 2].map(k => Math.min(...v.map(q => q[k]))), mx = [0, 1, 2].map(k => Math.max(...v.map(q => q[k])));
    acc.push({ bufferView: push(pos, 34962), componentType: 5126, count: 3, type: 'VEC3', min: mn, max: mx }); const A = acc.length - 1;
    acc.push({ bufferView: push(f32([0, 0, 1, 0, .5, 1]), 34962), componentType: 5126, count: 2 + 1, type: 'VEC2' });
    acc.push({ bufferView: push(Buffer.from(new Uint8Array([j, 0, 0, 0, j, 0, 0, 0, j, 0, 0, 0])), 34962), componentType: 5121, count: 3, type: 'VEC4' });
    acc.push({ bufferView: push(f32([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), 34962), componentType: 5126, count: 3, type: 'VEC4' });
    acc.push({ bufferView: push(Buffer.from(new Uint16Array([0, 1, 2]).buffer), 34963), componentType: 5123, count: 3, type: 'SCALAR' });
    prims.push({ attributes: { POSITION: A, TEXCOORD_0: A + 1, JOINTS_0: A + 2, WEIGHTS_0: A + 3 }, indices: A + 4, material: mi }); });
  const ibm = []; bones.forEach(b => { const p = M.bones[b].pos; ibm.push(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -p[0]*sx, -p[1], -p[2]*fz, 1); });
  acc.push({ bufferView: push(f32(ibm)), componentType: 5126, count: bones.length, type: 'MAT4' }); const IBM = acc.length - 1;
  acc.push({ bufferView: push(f32([0, 1, 2])), componentType: 5126, count: 3, type: 'SCALAR', min: [0], max: [2] }); acc.push({ bufferView: push(f32([0, 0, 0, 1, .02, 0, 0, .9998, 0, 0, 0, 1])), componentType: 5126, count: 3, type: 'VEC4' });
  const json = { asset: { version: '2.0', generator: 'penalti-maximo make-test-glb' }, scene: 0, scenes: [{ nodes: [0, nodes.length] }], nodes: [...nodes, { name: 'TestMesh', mesh: 0, skin: 0 }],
    skins: [{ joints: bones.map(b => id[b]), inverseBindMatrices: IBM, skeleton: id.Hips }], meshes: [{ name: 'Body', primitives: prims }], materials: SL.map(([m]) => ({ name: m, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: .85 } })),
    animations: [{ name: 'Idle', samplers: [{ input: acc.length - 2, output: acc.length - 1, interpolation: 'LINEAR' }], channels: [{ sampler: 0, target: { node: id.Spine, path: 'rotation' } }] }], accessors: acc, bufferViews: bv, buffers: [{ byteLength: off }] };
  if (o.extensionsRequired) { json.extensionsUsed = json.extensionsRequired = o.extensionsRequired; }
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]); const bin = Buffer.concat(parts), h = Buffer.alloc(12), c1 = Buffer.alloc(8), c2 = Buffer.alloc(8);
  h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(0x4E4F534A, 4); c2.writeUInt32LE(bin.length, 0); c2.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([h, c1, js, c2, bin]);
}
if (process.argv[1] && process.argv[1].endsWith('make-test-glb.mjs')) { const out = process.argv[2] || 'assets/models/_test/minimal-humanoid.glb'; fs.mkdirSync(out.replace(/[^/\\]+$/, '') || '.', { recursive: true }); fs.writeFileSync(out, makeGLB()); console.log('GLB de teste gerado:', out, `(${fs.statSync(out).size} bytes)`); }
