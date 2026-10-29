// Inspetor de GLB PURO (roda no navegador e no Node): valida o modelo contra o contrato do jogo. Usado por tools/inspect-glb.mjs e por js/three/loader.js.
import { resolveBones } from './skeletonMap.js';
export const SLOTS = { shirt: /shirt|jersey|camisa|torso|top/i, shorts: /short|calc|pant/i, socks: /sock|meia/i, skin: /skin|pele|body/i, hair: /hair|cabelo/i, boots: /boot|shoe|cleat|chuteira/i };
export const OPT_SLOTS = { gloves: /glove|luva/i, eyes: /eye|olho/i, trim: /^trim|detalhe/i, sole: /^sole|sola/i };
export function parseGLB(u8) {                          // u8: Uint8Array (Buffer do Node também serve)
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (u8.length < 20 || dv.getUint32(0, true) !== 0x46546C67) throw new Error('Não é um arquivo GLB (assinatura "glTF" ausente). Exporte como .glb (binário).');
  if (dv.getUint32(4, true) !== 2) throw new Error('Versão do glTF diferente de 2.0.'); let off = 12, json = null, bin = null;
  while (off + 8 <= u8.length) { const l = dv.getUint32(off, true), ty = dv.getUint32(off + 4, true), d = u8.subarray(off + 8, off + 8 + l); if (ty === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(d)); else if (ty === 0x004E4942) bin = d; off += 8 + l + ((4 - l % 4) % 4); }
  if (!json) throw new Error('GLB sem bloco JSON.'); return { json, bin };
}
const mmul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c*4 + r] += a[k*4 + r]*b[c*4 + k]; return o; };
const compose = n => { if (n.matrix) return n.matrix.slice(); const t = n.translation || [0, 0, 0], q = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1], [x, y, z, w] = q;
  return [(1 - 2*(y*y + z*z))*s[0], (2*(x*y + z*w))*s[0], (2*(x*z - y*w))*s[0], 0, (2*(x*y - z*w))*s[1], (1 - 2*(x*x + z*z))*s[1], (2*(y*z + x*w))*s[1], 0, (2*(x*z + y*w))*s[2], (2*(y*z - x*w))*s[2], (1 - 2*(x*x + y*y))*s[2], 0, t[0], t[1], t[2], 1]; };
function pngSize(b) { if (b.length < 24) return null; const d = new DataView(b.buffer, b.byteOffset, b.byteLength); return d.getUint32(0) === 0x89504E47 ? [d.getUint32(16), d.getUint32(20)] : null; }
export function inspect(u8, opts = {}) {
  const E = [], W = [], info = {}, { json, bin } = parseGLB(u8), nodes = json.nodes || [], world = new Array(nodes.length), parent = {};
  nodes.forEach((n, i) => (n.children || []).forEach(c => { parent[c] = i; }));
  const wm = i => world[i] ??= (parent[i] !== undefined ? mmul(wm(parent[i]), compose(nodes[i])) : compose(nodes[i])), wp = i => { const m = wm(i); return [m[12], m[13], m[14]]; };
  const ext = [...(json.extensionsRequired || []), ...(json.extensionsUsed || [])]; info.extensions = [...new Set(ext)];
  if (ext.includes('KHR_draco_mesh_compression') || ext.includes('EXT_meshopt_compression') || ext.includes('KHR_texture_basisu')) E.push('Usa compressão (Draco/Meshopt/Basis), que o jogo NÃO carrega por padrão. Exporte sem compressão.');
  // esqueleto
  const skins = json.skins || []; info.skins = skins.length; if (skins.length < 1) E.push('Nenhum esqueleto (skin) no arquivo: o modelo precisa ser skinned (com pesos nos ossos).');
  const sk = skins[0]; let names = []; if (sk) { names = sk.joints.map(j => nodes[j].name || `node${j}`); info.joints = names.length; if (skins.length > 1) W.push(`${skins.length} esqueletos no arquivo; o jogo usa o primeiro.`); }
  const R = resolveBones(names, opts.skeletonMap || {}); info.bones = R.map; if (sk && !R.ok) E.push(`Ossos obrigatórios não encontrados: ${R.requiredMissing.join(', ')}. Renomeie no export ou crie assets/models/skeleton-map.json.`); if (R.missing.length && R.ok) W.push(`Ossos opcionais ausentes: ${R.missing.join(', ')}.`);
  if (sk && R.ok) { const idx = n => sk.joints.find(j => (nodes[j].name || `node${j}`) === R.map[n]), P = n => R.map[n] ? wp(idx(n)) : null;
    const hips = P('Hips'), head = P('Head'), foot = P('LeftFoot'), toe = P('LeftToeBase'), lu = P('LeftUpLeg'), ru = P('RightUpLeg'), la = P('LeftArm'), lf = P('LeftForeArm');
    if (lu && ru && lu[0] <= ru[0]) E.push('Lados trocados: o osso Left* deve ficar em +X (esquerda do personagem). Verifique o eixo/escala negativa no export.');
    if (toe && foot && toe[2] - foot[2] < .02) E.push('O modelo parece olhar para -Z (dedos do pé não estão à frente do tornozelo em +Z). O glTF espera +Z como frente: gire 180° em Y.');
    else if (!toe && foot) W.push('Sem osso ToeBase: não foi possível confirmar que o modelo olha para +Z.');
    if (head) { info.heightApprox = +(head[1] + .12).toFixed(2); if (head[1] < 1.3 || head[1] > 2.1) W.push(`Altura estimada ${info.heightApprox} m (esperado 1,6–2,0 m em metros). Verifique a escala/unidade do export.`); }
    if (hips && (hips[1] < .75 || hips[1] > 1.15)) W.push(`Quadril a ${hips[1].toFixed(2)} m (esperado 0,85–1,05 m).`);
    if (la && lf) { const d = [lf[0] - la[0], lf[1] - la[1]], a = Math.atan2(-d[1], Math.abs(d[0]))*180/Math.PI; info.armRestAngle = +a.toFixed(0); if (a < -5 || a > 50) W.push(`Braços em repouso a ${a.toFixed(0)}° da horizontal; use T-pose (0°) ou A-pose (~45°).`); }
    const unit = nodes.some(n => n.scale && n.scale.some(v => Math.abs(v - 1) > 1e-3)); if (unit) W.push('Há nós com escala diferente de 1 (comum em exports do Blender/Mixamo). O jogo compensa, mas prefira "Apply Scale" antes de exportar.'); }
  // malhas, materiais, UV
  const meshes = json.meshes || [], mats = json.materials || []; let tris = 0, skinnedPrims = 0, prims = 0; const matUse = {};
  meshes.forEach(m => m.primitives.forEach(p => { prims++; const pos = json.accessors[p.attributes.POSITION], idx = p.indices !== undefined ? json.accessors[p.indices] : null; tris += Math.floor((idx ? idx.count : pos.count)/3); if (p.attributes.JOINTS_0 !== undefined && p.attributes.WEIGHTS_0 !== undefined) skinnedPrims++; (matUse[p.material ?? -1] ??= []).push(!!p.attributes.TEXCOORD_0); }));
  info.meshes = meshes.map(m => m.name || '(sem nome)'); info.triangles = tris; info.primitives = prims; if (!meshes.length) E.push('Nenhuma malha no arquivo.'); else if (skinnedPrims < prims) W.push(`${prims - skinnedPrims} de ${prims} primitivas SEM pesos de osso (JOINTS_0/WEIGHTS_0): elas não acompanharão o esqueleto.`);
  if (tris > 30000) W.push(`${tris} triângulos por personagem (recomendado ≤ 25.000; há até 6 personagens na cena).`);
  const slotInfo = {}; Object.entries({ ...SLOTS, ...OPT_SLOTS }).forEach(([slot, re]) => { const i = mats.findIndex(m => re.test(m.name || '')); slotInfo[slot] = i >= 0 ? mats[i].name : null; if (i < 0 && SLOTS[slot]) E.push(`Material "${slot}" ausente: nomeie um material com ${SLOTS[slot].source} (cada peça do uniforme precisa de um material próprio para receber cor/estampa).`); else if (i >= 0 && slot === 'shirt' && !(matUse[i] || []).every(Boolean)) E.push('O material da camisa precisa de UV (TEXCOORD_0): nome, número e escudo são aplicados por textura.'); });
  info.materialSlots = slotInfo; info.materials = mats.map(m => m.name || '(sem nome)');
  const imgs = json.images || []; info.textures = imgs.map(im => { let size = null; if (im.bufferView !== undefined && bin) { const bv = json.bufferViews[im.bufferView]; size = pngSize(bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)); } return { name: im.name || im.uri || `imagem${imgs.indexOf(im)}`, mime: im.mimeType, size }; });
  info.textures.forEach(t => { if (t.size && (t.size[0] > 4096 || t.size[1] > 4096)) W.push(`Textura ${t.name} ${t.size.join('×')}: use ≤ 2048×2048.`); });
  const hairMeshes = (json.nodes || []).filter(n => n.mesh !== undefined && /^hair/i.test(n.name || '')).map(n => n.name); if (hairMeshes.length > 1) info.hairStyles = hairMeshes; else W.push('Um só cabelo no modelo: todos os atletas terão o mesmo penteado (só a cor muda). Para variar, inclua malhas separadas Hair_short, Hair_long, Hair_afro… (opcional).');
  const anims = (json.animations || []).map(a => { let dur = 0; a.samplers.forEach(s => { const acc = json.accessors[s.input]; if (acc.max) dur = Math.max(dur, acc.max[0]); }); return { name: a.name || '(sem nome)', duration: +dur.toFixed(2) }; }); info.animations = anims;
  if (!anims.some(a => /idle/i.test(a.name))) W.push('Sem animação "Idle" (opcional): o jogo anima o repouso por conta própria.');
  return { ok: E.length === 0, errors: E, warnings: W, info };
}
