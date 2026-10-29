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
console.log(`GLB OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
