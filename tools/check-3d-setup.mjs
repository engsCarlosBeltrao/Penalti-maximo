#!/usr/bin/env node
// Verifica se o motor Three.js/GLB tem tudo o que precisa. NAO depende de uma pasta "tools" nem de outros scripts:
// funciona onde estiver (raiz do projeto, tools/, etc.), acha a raiz do projeto sozinho e, se faltar algum modulo opcional, avisa e segue.
// Uso: node check-3d-setup.mjs   (ou node tools/check-3d-setup.mjs, conforme onde voce colocou o arquivo)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const has = (p) => fs.existsSync(p);
function findRoot() {                                           // a raiz e a pasta que tem index.html ou vendor/
  const cands = [process.cwd(), HERE, path.join(HERE, '..'), path.join(process.cwd(), '..')];
  for (const c of cands) if (has(path.join(c, 'index.html')) || has(path.join(c, 'vendor'))) return path.resolve(c);
  return path.resolve(process.cwd());
}
const ROOT = findRoot();
const R = (...p) => path.join(ROOT, ...p);
function locate(name) {                                         // procura um modulo auxiliar em varios lugares possiveis
  const bases = [HERE, path.join(HERE, 'js', 'three'), path.join(HERE, 'three'), path.join(HERE, 'tools'), path.join(HERE, '..', 'js', 'three'), path.join(HERE, '..'), R('js', 'three'), R('tools'), R(''), process.cwd(), path.join(process.cwd(), 'js', 'three')];
  for (const b of bases) { const p = path.join(b, name); if (has(p)) return p; }
  return null;
}
const rel = (p) => path.relative(process.cwd(), p) || '.';
let falhas = 0, avisos = 0;
const ok = (m) => console.log('  OK    ' + m);
const bad = (m) => { falhas++; console.log('  FALTA ' + m); };
const aviso = (m) => { avisos++; console.log('  aviso ' + m); };
const info = (m) => console.log('  .     ' + m);
const title = (m) => console.log('\n' + m);

console.log('Pasta do projeto: ' + ROOT);
console.log('Este script esta em: ' + rel(HERE) + '  (pasta tools nao e necessaria)');

// 1) arquivos do jogo e do motor Three.js (so verifica; nunca altera)
title('1) Arquivos do projeto referenciados pelo motor Three.js');
const CORE = [
  ['index.html', 'pagina do jogo (precisa do importmap)'], ['js/main.js', 'jogo'], ['js/game.js', 'jogo'], ['js/renderer.js', 'selecao do motor'], ['js/frame.js', 'descricao de cada quadro'], ['js/rig.js', 'poses'], ['js/scene3d.js', 'motor atual (nao e alterado)'],
  ['js/three/engine.js', 'motor Three.js'], ['js/three/loader.js', 'carregador de GLB'], ['js/three/retarget.js', 'poses -> ossos'], ['js/three/skeletonMap.js', 'nomes dos ossos'], ['js/three/glbInspect.js', 'inspetor de GLB'], ['js/three/uniform.js', 'uniformes'], ['js/three/stadium.js', 'estadio Three.js'], ['js/three/math.js', 'matematica do retargeting'],
];
let faltamCore = [];
for (const [f, d] of CORE) { if (has(R(f))) ok(f); else { faltamCore.push(f); bad(f + '  (' + d + ')'); } }
if (faltamCore.length) info('Copie os arquivos que faltam do projeto original, mantendo as pastas (js/, js/three/). Nada foi alterado.');
const htmlPath = R('index.html');
if (has(htmlPath)) { const h = fs.readFileSync(htmlPath, 'utf8'); if (h.includes('importmap') && h.includes('vendor/three/three.module.js')) ok('index.html tem o importmap apontando para vendor/three/'); else bad('index.html sem o importmap de vendor/three/ (o motor Three.js nao consegue importar "three")'); }

// 2) Three.js
title('2) Three.js em vendor/three/');
const VENDOR = [['vendor/three/three.module.js', 'Three.js (build/three.module.js)'], ['vendor/three/addons/loaders/GLTFLoader.js', 'GLTFLoader'], ['vendor/three/addons/utils/BufferGeometryUtils.js', 'BufferGeometryUtils'], ['vendor/three/addons/utils/SkeletonUtils.js', 'SkeletonUtils']];
for (const [f, d] of VENDOR) { if (has(R(f))) ok(f); else bad(f + '  <-  ' + d + '  (rode: node ' + rel(path.join(HERE, 'setup-3d.mjs')) + ')'); }
if (has(R(VENDOR[0][0]))) {
  const src = fs.readFileSync(R(VENDOR[0][0]), 'utf8'), marca = "const REVISION = '", i = src.indexOf(marca), j = i < 0 ? -1 : src.indexOf("'", i + marca.length), rev = j < 0 ? null : Number(src.slice(i + marca.length, j));
  if (rev === null || Number.isNaN(rev)) aviso('nao consegui ler a revisao do Three.js');
  else if (rev >= 160 && rev <= 169) ok('Three.js r' + rev + ' (compativel: arquivo unico)');
  else if (rev >= 170) { if (has(R('vendor/three/three.core.js'))) ok('Three.js r' + rev + ' com three.core.js'); else bad('Three.js r' + rev + ' exige tambem vendor/three/three.core.js (recomendado: r160)'); }
  else bad('Three.js r' + rev + ' e antigo demais (minimo r150; recomendado r160)');
}

// 3) modelos
title('3) Modelos GLB em assets/models/');
let inspect = null;
const insp = locate('glbInspect.js');
if (insp) { try { const mod = await import(pathToFileURL(insp).href); if (typeof mod.inspect === 'function') inspect = mod.inspect; else aviso('glbInspect.js encontrado em ' + rel(insp) + ' mas nao exporta inspect() (vazio ou incompleto?); usando inspecao reduzida. Substitua-o pela copia original do projeto.'); } catch (e) { aviso('glbInspect.js encontrado mas nao carregou (' + (e.message || e).split('\n')[0] + '); usando inspecao reduzida'); } }
else aviso('glbInspect.js nao encontrado: sera feita so uma inspecao REDUZIDA dos modelos (copie glbInspect.js e skeletonMap.js do projeto para a pasta deste script, ou para js/three/).');
function reduced(buf) {                                          // inspecao basica sem dependencias
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.length < 20 || dv.getUint32(0, true) !== 0x46546C67) throw new Error('nao e um arquivo GLB valido');
  let off = 12, json = null; while (off + 8 <= buf.length) { const l = dv.getUint32(off, true), ty = dv.getUint32(off + 4, true); if (ty === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(buf.subarray(off + 8, off + 8 + l))); off += 8 + l + ((4 - l % 4) % 4); }
  if (!json) throw new Error('GLB sem bloco JSON');
  const errors = [], warnings = [], skins = json.skins || [], mats = (json.materials || []).map((m) => (m.name || '').toLowerCase());
  if (!skins.length) errors.push('sem esqueleto (skin)');
  const slots = [['shirt', ['shirt', 'jersey', 'camisa']], ['shorts', ['short', 'calc']], ['socks', ['sock', 'meia']], ['skin', ['skin', 'pele']], ['hair', ['hair', 'cabelo']], ['boots', ['boot', 'shoe', 'cleat', 'chuteira']]];
  for (const [s, keys] of slots) if (!mats.some((m) => keys.some((k) => m.includes(k)))) errors.push('material "' + s + '" ausente');
  const ext = (json.extensionsUsed || []).concat(json.extensionsRequired || []); if (ext.includes('KHR_draco_mesh_compression') || ext.includes('EXT_meshopt_compression')) errors.push('usa compressao Draco/Meshopt (nao suportada)');
  let tris = 0; (json.meshes || []).forEach((m) => m.primitives.forEach((p) => { const a = json.accessors[p.indices !== undefined ? p.indices : p.attributes.POSITION]; tris += Math.floor(a.count / 3); }));
  return { ok: errors.length === 0, errors, warnings, info: { triangles: tris, joints: skins[0] ? skins[0].joints.length : 0 } };
}
for (const [f, obrig] of [['assets/models/athlete.glb', true], ['assets/models/goalkeeper.glb', false]]) {
  if (!has(R(f))) { if (obrig) bad(f + '  (obrigatorio; gere com: node ' + rel(path.join(HERE, 'prepare-athlete.mjs')) + ' <modelo.glb> ' + f + ')'); else info(f + ' ausente (opcional: o goleiro usara athlete.glb)'); continue; }
  try {
    const buf = new Uint8Array(fs.readFileSync(R(f))), rep = inspect ? inspect(buf) : reduced(buf);
    if (rep.ok) ok(f + ': atende ao contrato' + (inspect ? '' : ' (inspecao reduzida)') + '  [' + rep.info.triangles + ' triangulos, ' + rep.info.joints + ' ossos]'); else bad(f + ': NAO atende ao contrato');
    rep.errors.forEach((e) => console.log('          erro  ' + e)); rep.warnings.forEach((w) => console.log('          aviso ' + w));
  } catch (e) { bad(f + ': ' + e.message); }
}
for (const f of ['assets/models/uniform-layout.json', 'assets/models/skeleton-map.json']) info(f + (has(R(f)) ? ' presente' : ' ausente (opcional)'));

// 4) resumo
title(falhas ? 'Resultado: ' + falhas + ' item(ns) a corrigir' + (avisos ? ' e ' + avisos + ' aviso(s)' : '') + '. Corrija e rode de novo.' : 'Resultado: tudo pronto' + (avisos ? ' (' + avisos + ' aviso(s))' : '') + '. Abra three-smoke.html (diagnostico visual) pelo Live Server e depois index.html?engine=three.');
process.exit(falhas ? 1 : 0);
