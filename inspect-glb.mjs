#!/usr/bin/env node
// Inspetor de GLB (linha de comando). Funciona em qualquer pasta. Uso: node inspect-glb.mjs assets/models/athlete.glb [--json]
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
const { inspect, parseGLB } = await need('glbInspect.js', 'inspecionar o modelo', ['inspect', 'parseGLB']);
export { inspect, parseGLB };
const entry = process.argv[1] && process.argv[1].endsWith('inspect-glb.mjs');
if (entry) {
  const f = process.argv[2]; if (!f) { console.log('Uso: node ' + path.relative(process.cwd(), fileURLToPath(import.meta.url)) + ' arquivo.glb [--json]'); process.exit(2); }
  let rep; try { rep = inspect(new Uint8Array(fs.readFileSync(f))); } catch (e) { console.log(`✖ ${f}: ${e.message}`); process.exit(1); }
  if (process.argv.includes('--json')) console.log(JSON.stringify(rep, null, 1)); else {
    console.log(`${rep.ok ? '✔' : '✖'} ${f}  (${(fs.statSync(f).size/1024).toFixed(0)} KB · ${rep.info.triangles} triângulos · ${rep.info.joints ?? 0} ossos · altura ≈ ${rep.info.heightApprox ?? '?'} m)`);
    console.log('  materiais:', Object.entries(rep.info.materialSlots).map(([k, v]) => `${k}=${v ?? '—'}`).join('  ')); console.log('  animações:', rep.info.animations.map(a => `${a.name} (${a.duration}s)`).join(', ') || 'nenhuma');
    rep.errors.forEach(e => console.log('  ERRO   ', e)); rep.warnings.forEach(w => console.log('  aviso  ', w)); }
  process.exit(rep.ok ? 0 : 1);
}
