// Testa o gerador e o inspetor de GLB: um modelo correto passa e cada defeito conhecido é detectado.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
// localiza um modulo auxiliar sem presumir a pasta "tools" (nem js/three)
const load = async (name) => { for (const d of ['tools', '.', 'js/three', 'js']) { const p = path.resolve(d, name); if (fs.existsSync(p)) return import(pathToFileURL(p).href); } throw new Error('nao encontrei ' + name); };
const { makeGLB } = await load('make-test-glb.mjs');
const { inspect, parseGLB } = await load('glbInspect.js');
let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FALHOU:', n)); };
let r = inspect(new Uint8Array(makeGLB())); t('modelo correto é aprovado', r.ok && r.info.joints === 22 && r.info.animations[0].name === 'Idle');
r = inspect(new Uint8Array(makeGLB({ arms: 'A' }))); t('A-pose é aceita', r.ok && r.info.armRestAngle > 30);
r = inspect(new Uint8Array(makeGLB({ prefix: 'mixamorig:' }))); t('ossos com prefixo Mixamo são reconhecidos', r.ok);
r = inspect(new Uint8Array(makeGLB({ facing: '-z' }))); t('modelo virado para -Z é recusado', !r.ok && r.errors.some(e => /-Z/.test(e)));
r = inspect(new Uint8Array(makeGLB({ swapLR: true }))); t('esquerda/direita trocadas é recusado', !r.ok && r.errors.some(e => /Lados trocados/.test(e)));
r = inspect(new Uint8Array(makeGLB({ dropMaterials: ['Shorts'] }))); t('material do calção ausente é recusado', !r.ok && r.errors.some(e => /shorts/.test(e)));
r = inspect(new Uint8Array(makeGLB({ dropMaterials: ['Shirt'] }))); t('material da camisa ausente é recusado', !r.ok && r.errors.some(e => /shirt/.test(e)));
r = inspect(new Uint8Array(makeGLB({ dropMaterials: ['Gloves'] }))); t('luvas são opcionais', r.ok);
r = inspect(new Uint8Array(makeGLB({ dropBones: ['LeftLeg'] }))); t('osso obrigatório ausente é recusado', !r.ok && r.errors.some(e => /LeftLeg/.test(e)));
r = inspect(new Uint8Array(makeGLB({ dropBones: ['Spine1', 'Spine2', 'LeftToeBase', 'RightToeBase', 'LeftShoulder', 'RightShoulder'] }))); t('ossos opcionais ausentes passam com aviso', r.ok && r.warnings.some(w => /opcionais/.test(w)));
r = inspect(new Uint8Array(makeGLB({ extensionsRequired: ['KHR_draco_mesh_compression'] }))); t('Draco é recusado (sem decodificador)', !r.ok && r.errors.some(e => /Draco/.test(e)));
let threw = false; try { parseGLB(new Uint8Array(Buffer.from('isto não é um glb'))); } catch { threw = true; } t('arquivo que não é GLB gera erro claro', threw);
r = inspect(makeGLB(), { skeletonMap: {} }); t('relatório lista materiais e ossos', Object.keys(r.info.bones).length === 22 && r.info.materialSlots.shirt === 'Shirt');
// ---- clipe do chute feito no Blender (tools/blender/chute.py) aplicado ao athlete.glb pelos nomes dos ossos ----
if (fs.existsSync('assets/models/anim/chute.glb')) {
  const { readModel, readAccessor } = await load('gltf-io.mjs'), O = readModel('assets/models/athlete.glb').json, C = readModel('assets/models/anim/chute.glb'), cj = C.json, A = cj.animations || [];
  t('chute.glb: um clipe "Chute"', A.length === 1 && A[0].name === 'Chute');
  const skel = new Set(O.skins[0].joints.map(i => O.nodes[i].name)), tgt = [...new Set(A[0].channels.map(c => cj.nodes[c.target.node].name))];
  t('chute.glb: todos os ossos animados existem no esqueleto do athlete.glb (65)', tgt.length === 65 && tgt.every(n => skel.has(n)));
  t('chute.glb: só esqueleto + animação (nenhuma malha, material ou pele)', !(cj.meshes || []).length && !(cj.materials || []).length && !(cj.skins || []).length);
  const rot = j => Object.fromEntries(j.nodes.map(n => [n.name, n.rotation || [0, 0, 0, 1]])), ro = rot(O), rc = rot(cj);
  t('chute.glb: esqueleto de repouso igual ao do athlete.glb (< 0,1°)', tgt.every(n => Math.acos(Math.min(1, Math.abs(ro[n].reduce((s, v, i) => s + v*rc[n][i], 0))))*360/Math.PI < .1));
  const ex = cj.nodes.find(n => n.name === 'Armature').extras || {}, dur = Math.max(...A[0].samplers.map(s => readAccessor(C, s.input).flat().pop()));
  t('chute.glb: 60 fps, contato no quadro 78 (1,3 s de aproximação) e clipe cobre a recuperação (contato + 1 s)', ex.chute_fps === 60 && Math.abs(ex.chute_contato_s - 78/60) < 1e-6 && ex.chute_inicio_tc === -1.3 && ex.chute_fim_tc === 1 && dur >= ex.chute_contato_s + 1 - 1e-3);
}
console.log(`GLB OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
