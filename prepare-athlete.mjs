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
export const SLOT_LIST = ['Shirt', 'Shorts', 'Socks', 'Skin', 'Hair', 'Boots', 'Gloves', 'Eyes'];
const TEXTURED = new Set(['Skin', 'Gloves', 'Eyes', 'Hair']);   // estes mantêm a UV original (o rosto do modelo é pintado na textura da pele)
// regra de material por osso e posição ao longo do osso (t = 0 na articulação, 1 na seguinte)
export function slotFor(canon, c, B) {
  // Cortes RETOS por altura/eixo do membro (nao por osso dominante do triangulo, que alterna entre ossos vizinhos e serrilha a barra).
  const along = (a, b) => { const A = B[a], Z = B[b]; if (!A || !Z) return .5; const d = [Z[0] - A[0], Z[1] - A[1], Z[2] - A[2]], L = d[0]*d[0] + d[1]*d[1] + d[2]*d[2] || 1; return ((c[0] - A[0])*d[0] + (c[1] - A[1])*d[1] + (c[2] - A[2])*d[2])/L; };
  const side = /^(Left|Right)/.exec(canon)?.[1] || (c[0] >= 0 ? 'Left' : 'Right'), base = canon.replace(/^(Left|Right)/, ''), y = c[1];
  const pick = n => B[side + n] || B[(side === 'Left' ? 'Right' : 'Left') + n], hipY = B.Hips[1], kneeY = pick('Leg')?.[1] ?? hipY - .45, ankleY = pick('Foot')?.[1] ?? .08;
  const hemY = hipY - .07, shortsEnd = kneeY + .38*(hipY - kneeY), sockTop = kneeY - .04;
  switch (base) {
    case 'Neck': return 'Skin';
    case 'Head': return c[1] > B.Head[1] + .06 ? 'Hair' : 'Skin';
    case 'Shoulder': return 'Shirt';
    case 'Arm': case 'ForeArm': case 'Hand': {
      if (base === 'Hand' || along(side + 'ForeArm', side + 'Hand') > .97) return 'Gloves';
      return along(side + 'Arm', side + 'ForeArm') < .45 ? 'Shirt' : 'Skin'; }
    case 'Foot': case 'ToeBase': return 'Boots';
    default: // Hips, Spine*, UpLeg, Leg e extras: so a altura decide
      if (y > hemY && (base === 'Hips' || base.startsWith('Spine') || base === 'UpLeg')) return 'Shirt';
      if (y > shortsEnd) return 'Shorts';
      if (y > sockTop) return 'Skin';
      if (y > ankleY + .02) return 'Socks';
      return 'Boots';
  }
}
export function prepare(model, override = {}, tex = {}) {   // tex: { skin, eyes, hair } = Buffers PNG opcionais (mantêm o rosto pintado)
  const j = model.json, nodes = j.nodes || [], parent = {}; nodes.forEach((n, i) => (n.children || []).forEach(c => { parent[c] = i; })); const world = [], wm = i => world[i] ??= parent[i] !== undefined ? mm(wm(parent[i]), compose(nodes[i])) : compose(nodes[i]);
  const skin = (j.skins || [])[0]; if (!skin) throw new Error('O arquivo não tem esqueleto (skin).'); const names = skin.joints.map(n => nodes[n].name || `node${n}`), R = resolveBones(names, override);
  if (!R.ok) { const e = new Error(`Ossos obrigatórios não reconhecidos: ${R.requiredMissing.join(', ')}.\nNomes de ossos no arquivo:\n  ${names.join(', ')}\nCrie um skeleton-map.json { "Hips": "nome", … } e use --map.`); e.names = names; throw e; }
  const B = {}, canonOfNode = new Map(); CANON.forEach(c => { if (!R.map[c]) return; const ni = skin.joints[names.indexOf(R.map[c])], m = wm(ni); B[c] = [m[12], m[13], m[14]]; canonOfNode.set(ni, c); });
  const canonOfJoint = jIdx => { let n = skin.joints[jIdx]; while (n !== undefined && !canonOfNode.has(n)) n = parent[n]; return n === undefined ? null : canonOfNode.get(n); };   // osso extra → ancestral canônico
  const top = B.Spine2 || B.Spine1 || B.Spine, waist = B.Hips, stats = {}, b = new Builder(model), matIdx = Object.fromEntries(SLOT_LIST.map((s, i) => [s, i]));
  nodes.forEach((n, ni) => { if (n.mesh === undefined || n.skin === undefined) return; const M = wm(ni), mesh = b.json.meshes[n.mesh], newPrims = [];
    mesh.primitives.forEach(p => { if ((p.mode ?? 4) !== 4) throw new Error('Só triângulos são suportados (mode 4).'); const A = p.attributes, pos = readAccessor(model, A.POSITION), jo = readAccessor(model, A.JOINTS_0), we = readAccessor(model, A.WEIGHTS_0), nor = A.NORMAL !== undefined ? readAccessor(model, A.NORMAL) : null;
      const matName = String((model.json.materials || [])[p.material]?.name || ''), UV0 = A.TEXCOORD_0 !== undefined ? readAccessor(model, A.TEXCOORD_0) : null, hasHairMat = (model.json.materials || []).some(m => /hair/i.test(m.name || ''));
      const idx = p.indices !== undefined ? readAccessor(model, p.indices).map(r => r[0]) : pos.map((_, k) => k), groups = {}; SLOT_LIST.forEach(s => { groups[s] = []; });
      for (let t = 0; t + 2 < idx.length; t += 3) { const v = [idx[t], idx[t + 1], idx[t + 2]], wsum = {}; v.forEach(k => jo[k].forEach((ji, c) => { wsum[ji] = (wsum[ji] || 0) + we[k][c]; }));
        const best = Object.entries(wsum).sort((x, y) => y[1] - x[1])[0], canon = best ? canonOfJoint(+best[0]) : null, cen = tp(M, [0, 1, 2].map(c => (pos[v[0]][c] + pos[v[1]][c] + pos[v[2]][c])/3));
        let slot = canon ? slotFor(canon, cen, B) : 'Skin'; if (/eye/i.test(matName)) slot = 'Eyes'; else if (/hair/i.test(matName)) slot = 'Hair'; else if (slot === 'Hair' && hasHairMat) slot = 'Skin'; groups[slot].push(v); }
      SLOT_LIST.forEach(slot => { const tris = groups[slot]; if (!tris.length) return; const remap = new Map(), vs = []; tris.forEach(tr => tr.forEach(k => { if (!remap.has(k)) { remap.set(k, vs.length); vs.push(k); } }));
        const P = vs.map(k => pos[k]), uv = vs.map(k => { if (TEXTURED.has(slot)) return UV0 ? UV0[k].slice(0, 2) : [0, 0]; if (slot !== 'Shirt') return [0, 0]; const w = tp(M, pos[k]), th = Math.atan2(w[0] - waist[0], w[2] - waist[2]); let u = th/(2*Math.PI) + .25; u -= Math.floor(u); const v = Math.min(1, Math.max(0, (top[1] + .12 - w[1])/(top[1] + .12 - (waist[1] - .05)))); return [u, v]; });
        const attrs = { POSITION: b.accessor(P, 'VEC3', 5126, { target: 34962, minmax: true }), TEXCOORD_0: b.accessor(uv, 'VEC2', 5126, { target: 34962 }), JOINTS_0: b.accessor(vs.map(k => jo[k]), 'VEC4', 5123, { target: 34962 }), WEIGHTS_0: b.accessor(vs.map(k => { const s = we[k].reduce((x, y) => x + y, 0) || 1; return we[k].map(x => x/s); }), 'VEC4', 5126, { target: 34962 }) };
        if (nor) attrs.NORMAL = b.accessor(vs.map(k => nor[k]), 'VEC3', 5126, { target: 34962 });
        newPrims.push({ attributes: attrs, indices: b.accessor(tris.flatMap(tr => tr.map(k => [remap.get(k)])), 'SCALAR', vs.length > 65535 ? 5125 : 5123, { target: 34963 }), material: matIdx[slot], mode: 4 }); stats[slot] = (stats[slot] || 0) + tris.length; }); });
    mesh.primitives = newPrims; });
  b.json.materials = SLOT_LIST.map(s => ({ name: s, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: s === 'Eyes' ? .35 : .85 } })); delete b.json.textures; delete b.json.images; delete b.json.samplers;
  const withTex = { Skin: tex.skin, Gloves: tex.skin, Eyes: tex.eyes, Hair: tex.hair }, srcOf = new Map();   // embute cada PNG uma vez (Skin e Gloves dividem a mesma imagem)
  for (const [slot, buf] of Object.entries(withTex)) { if (!buf) continue; let si = srcOf.get(buf); if (si === undefined) { const off = b.add(new Uint8Array(buf)); b.json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: buf.length }); (b.json.images ||= []).push({ bufferView: b.json.bufferViews.length - 1, mimeType: 'image/png' }); si = b.json.images.length - 1; srcOf.set(buf, si); }
    (b.json.textures ||= []).push({ source: si }); b.json.materials[matIdx[slot]].pbrMetallicRoughness.baseColorTexture = { index: b.json.textures.length - 1 }; if (slot === 'Hair') b.json.materials[matIdx[slot]].doubleSided = true; }   // cor/estampa vêm do jogo
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
