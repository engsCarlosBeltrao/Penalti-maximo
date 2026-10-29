// Humanoide SINTÉTICO feito de tubos (para testar tools/prepare-athlete.mjs): esqueleto de 22 ossos + ossos extras (dedo), uma malha com UM material.
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
export function makeTubeGLB(o = {}) {
  const M = syntheticModel({ arms: o.arms || 'T' }), nodes = [{ name: 'Armature', children: [] }], id = {}, wpos = {}, pre = o.prefix || '';
  const addBone = (name, wp, parentName) => { id[name] = nodes.length; wpos[name] = wp; const pw = parentName ? wpos[parentName] : [0, 0, 0]; nodes.push({ name: pre + name, translation: [wp[0] - pw[0], wp[1] - pw[1], wp[2] - pw[2]], children: [] }); (parentName ? nodes[id[parentName]] : nodes[0]).children.push(id[name]); };
  CANON.forEach(c => addBone(c, M.bones[c].pos, PARENT[c] && PARENT[c] in id ? PARENT[c] : (c === 'Hips' ? null : 'Hips')));
  addBone('LeftHandIndex1', [M.bones.LeftHand.pos[0] + .06, M.bones.LeftHand.pos[1], 0.02], 'LeftHand'); addBone('LeftForeArmTwist', [(M.bones.LeftForeArm.pos[0] + M.bones.LeftHand.pos[0])/2, M.bones.LeftHand.pos[1], 0], 'LeftForeArm');
  const names = Object.keys(id), jointOf = n => names.indexOf(n), V = [], N = [], J = [], Wt = [], I = [], seg = (a, bpos, r, bone, rings = 5, sides = 8) => { const A = wpos[a] || a, base = V.length, d = [bpos[0] - A[0], bpos[1] - A[1], bpos[2] - A[2]], L = Math.hypot(...d) || 1, u = d.map(x => x/L), t0 = Math.abs(u[1]) < .9 ? [0, 1, 0] : [1, 0, 0], s1 = [u[1]*t0[2] - u[2]*t0[1], u[2]*t0[0] - u[0]*t0[2], u[0]*t0[1] - u[1]*t0[0]], l1 = Math.hypot(...s1), e1 = s1.map(x => x/l1), e2 = [u[1]*e1[2] - u[2]*e1[1], u[2]*e1[0] - u[0]*e1[2], u[0]*e1[1] - u[1]*e1[0]];
    for (let i = 0; i < rings; i++) for (let k = 0; k < sides; k++) { const th = 2*Math.PI*k/sides, c = Math.cos(th), s = Math.sin(th), p = [0, 1, 2].map(q => A[q] + d[q]*i/(rings - 1) + r*(c*e1[q] + s*e2[q])); V.push(p); N.push([0, 1, 2].map(q => c*e1[q] + s*e2[q])); J.push([jointOf(bone), 0, 0, 0]); Wt.push([1, 0, 0, 0]); }
    for (let i = 0; i < rings - 1; i++) for (let k = 0; k < sides; k++) { const a0 = base + i*sides + k, a1 = base + i*sides + (k + 1)%sides, b0 = a0 + sides, b1 = a1 + sides; I.push(a0, a1, b0, a1, b1, b0); } };
  const P = c => M.bones[c].pos, up = (p, y) => [p[0], p[1] + y, p[2]];
  seg('Hips', [0, .8, 0], .16, 'Hips'); seg('Hips', P('Spine'), .15, 'Hips'); seg('Spine', P('Spine1'), .15, 'Spine'); seg('Spine1', P('Spine2'), .17, 'Spine1'); seg('Spine2', P('Neck'), .17, 'Spine2'); seg('Neck', P('Head'), .05, 'Neck'); seg('Head', up(P('Head'), .2), .1, 'Head', 7);
  ['Left', 'Right'].forEach(s => { seg(s + 'Shoulder', P(s + 'Arm'), .05, s + 'Shoulder'); seg(s + 'Arm', P(s + 'ForeArm'), .05, s + 'Arm', 7); seg(s + 'ForeArm', P(s + 'Hand'), .04, s + 'ForeArm'); seg(s + 'Hand', [P(s + 'Hand')[0] + (s === 'Left' ? .1 : -.1), P(s + 'Hand')[1], 0], .04, s + 'Hand');
    seg(s + 'UpLeg', P(s + 'Leg'), .09, s + 'UpLeg', 9); seg(s + 'Leg', P(s + 'Foot'), .06, s + 'Leg', 9); seg(s + 'Foot', P(s + 'ToeBase'), .05, s + 'Foot'); seg(s + 'ToeBase', [P(s + 'ToeBase')[0], .02, .25], .04, s + 'ToeBase'); });
  seg('LeftHandIndex1', [wpos.LeftHandIndex1[0] + .08, wpos.LeftHandIndex1[1], .02], .015, 'LeftHandIndex1', 3, 6);
  const parts = [], bv = [], acc = []; let off = 0; const push = (b, t) => { const pad = (4 - b.length % 4) % 4, bb = Buffer.concat([b, Buffer.alloc(pad)]); bv.push({ buffer: 0, byteOffset: off, byteLength: b.length, ...(t ? { target: t } : {}) }); parts.push(bb); off += bb.length; return bv.length - 1; }, f32 = a => Buffer.from(new Float32Array(a).buffer);
  const mm = k => [0, 1, 2].map(c => Math.min(...V.map(v => v[c]))), mx = k => [0, 1, 2].map(c => Math.max(...V.map(v => v[c])));
  acc.push({ bufferView: push(f32(V.flat()), 34962), componentType: 5126, count: V.length, type: 'VEC3', min: mm(), max: mx() }, { bufferView: push(f32(N.flat()), 34962), componentType: 5126, count: V.length, type: 'VEC3' }, { bufferView: push(Buffer.from(new Uint8Array(J.flat())), 34962), componentType: 5121, count: V.length, type: 'VEC4' }, { bufferView: push(f32(Wt.flat()), 34962), componentType: 5126, count: V.length, type: 'VEC4' }, { bufferView: push(Buffer.from(new Uint16Array(I).buffer), 34963), componentType: 5123, count: I.length, type: 'SCALAR' });
  const ibm = []; names.forEach(n => { const p = wpos[n]; ibm.push(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -p[0], -p[1], -p[2], 1); }); acc.push({ bufferView: push(f32(ibm)), componentType: 5126, count: names.length, type: 'MAT4' }, { bufferView: push(f32([0, 1, 2])), componentType: 5126, count: 3, type: 'SCALAR', min: [0], max: [2] }, { bufferView: push(f32([0, 0, 0, 1, .02, 0, 0, .9998, 0, 0, 0, 1])), componentType: 5126, count: 3, type: 'VEC4' });
  const json = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0, nodes.length] }], nodes: [...nodes, { name: 'Body', mesh: 0, skin: 0 }], skins: [{ joints: names.map(n => id[n]), inverseBindMatrices: 5, skeleton: id.Hips }],
    meshes: [{ name: 'Body', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, JOINTS_0: 2, WEIGHTS_0: 3 }, indices: 4, material: 0 }] }], materials: [{ name: 'Body', pbrMetallicRoughness: { baseColorFactor: [.8, .6, .5, 1] } }],
    animations: [{ name: 'Idle', samplers: [{ input: 6, output: 7 }], channels: [{ sampler: 0, target: { node: id.Spine, path: 'rotation' } }] }], accessors: acc, bufferViews: bv, buffers: [{ byteLength: off }] };
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]); const bin = Buffer.concat(parts), h = Buffer.alloc(12), c1 = Buffer.alloc(8), c2 = Buffer.alloc(8);
  h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(0x4E4F534A, 4); c2.writeUInt32LE(bin.length, 0); c2.writeUInt32LE(0x004E4942, 4);
  return { glb: Buffer.concat([h, c1, js, c2, bin]), triangles: I.length/3 };
}
if (process.argv[1] && process.argv[1].endsWith('make-tube-glb.mjs')) { const out = process.argv[2] || 'assets/models/_test/tube-humanoid.glb'; fs.mkdirSync(out.replace(/[^/\\]+$/, '') || '.', { recursive: true }); const r = makeTubeGLB(); fs.writeFileSync(out, r.glb); console.log('GLB sintético gerado:', out, `(${r.triangles} triângulos)`); }
