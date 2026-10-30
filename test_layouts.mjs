// Testa os scripts auxiliares em varias estruturas de pasta (com e sem "tools"), incluindo o caso de um unico arquivo na raiz.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { pathToFileURL } from 'node:url'; import { spawnSync } from 'node:child_process';
let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FALHOU:', n)); };
const find = (name) => ['tools', '.', 'js/three'].map((d) => path.resolve(d, name)).find((p) => fs.existsSync(p)); const load = (name) => import(pathToFileURL(find(name)).href);
const { makeTubeGLB } = await load('make-tube-glb.mjs'), { prepare } = await load('prepare-athlete.mjs'), { readModel } = await load('gltf-io.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'layouts-'));
const raw = makeTubeGLB().glb, rawFile = path.join(tmp, 'raw.glb'); fs.writeFileSync(rawFile, raw); const athlete = prepare(readModel(rawFile)).glb;
const SCRIPTS = ['check-3d-setup.mjs', 'inspect-glb.mjs', 'gltf-io.mjs', 'prepare-athlete.mjs', 'setup-3d.mjs'], MODS = ['glbInspect.js', 'skeletonMap.js'];
const CORE = ['js/main.js', 'js/game.js', 'js/renderer.js', 'js/frame.js', 'js/rig.js', 'js/three/engine.js', 'js/three/loader.js', 'js/three/retarget.js', 'js/three/skeletonMap.js', 'js/three/glbInspect.js', 'js/three/uniform.js', 'js/three/stadium.js', 'js/three/math.js', 'js/vec.js', 'js/face.js', 'js/shirtTex.js', 'js/three/stadiumFx.js', 'js/three/hairMaterial.js'];
const put = (root, rel, data, keep) => { const p = path.join(root, rel); if (keep && fs.existsSync(p)) return; fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); };
function build(name, o) {
  const skip = o.skipCore || [];
  const root = path.join(tmp, name); fs.mkdirSync(root, { recursive: true });
  (o.scripts || SCRIPTS).forEach((s) => { const d = path.join(root, o.scriptsDir); fs.mkdirSync(d, { recursive: true }); fs.copyFileSync(find(s), path.join(d, s)); });
  (o.mods || MODS).forEach((m) => { if (o.modsDir === null) return; const d = path.join(root, o.modsDir); fs.mkdirSync(d, { recursive: true }); fs.copyFileSync(find(m), path.join(d, m)); });
  if (o.core !== false) CORE.filter((f) => !skip.includes(f)).forEach((f) => put(root, f, '// placeholder\n', true)); put(root, 'index.html', '<script type="importmap">{"imports":{"three":"./vendor/three/three.module.js"}}</script>');
  if (o.vendor !== false) { put(root, 'vendor/three/three.module.js', "const REVISION = '160';\n"); ['loaders/GLTFLoader.js', 'utils/BufferGeometryUtils.js', 'utils/SkeletonUtils.js'].forEach((f) => put(root, 'vendor/three/addons/' + f, '//\n')); }
  if (o.athlete !== false) put(root, 'assets/models/athlete.glb', athlete); return root;
}
const run = (root, cwd, args) => { const r = spawnSync('node', args, { cwd: cwd || root, encoding: 'utf8', timeout: 60000 }); if (process.env.LAYOUT_DEBUG) console.log('--- ' + path.basename(root) + ': node ' + args.join(' ') + ' (exit ' + r.status + ')\n' + (r.stdout + r.stderr).split('\n').slice(0, 14).join('\n')); return r; }, out = (r) => r.stdout + r.stderr, noModErr = (r) => !/ERR_MODULE_NOT_FOUND|Cannot find module|at .*\(file:/.test(out(r));
const LAYOUTS = [['A: scripts em tools/, modulos em js/three/', { scriptsDir: 'tools', modsDir: 'js/three' }, 'tools'], ['B: scripts na raiz, modulos em js/three/', { scriptsDir: '.', modsDir: 'js/three' }, '.'], ['C: tudo solto na raiz (sem tools e sem js/three para os scripts)', { scriptsDir: '.', modsDir: '.' }, '.']];
let i = 0;
for (const [nome, o, sd] of LAYOUTS) {
  const root = build('L' + (++i), o), S = (f) => (sd === '.' ? f : sd + '/' + f), r = run(root, root, [S('check-3d-setup.mjs')]);
  t(nome + ' -> check-3d-setup roda sem erro de modulo', noModErr(r)); t(nome + ' -> check conclui "tudo pronto" (exit 0)', r.status === 0 && out(r).includes('tudo pronto')); t(nome + ' -> check usa o inspetor COMPLETO e aprova o athlete.glb', out(r).includes('atende ao contrato') && !out(r).includes('reduzida'));
  const ins = run(root, root, [S('inspect-glb.mjs'), 'assets/models/athlete.glb']); t(nome + ' -> inspect-glb funciona', noModErr(ins) && ins.status === 0 && ins.stdout.includes('7 triangulos') === false && ins.stdout.includes('materiais'));
  fs.copyFileSync(rawFile, path.join(root, 'raw.glb')); const pr = run(root, root, [S('prepare-athlete.mjs'), 'raw.glb', 'saida.glb']); t(nome + ' -> prepare-athlete gera o atleta e o inspetor aprova', noModErr(pr) && pr.status === 0 && fs.existsSync(path.join(root, 'saida.glb')) && pr.stdout.includes('aprovou'));
}
// D: situacao do usuario — SO o check-3d-setup.mjs na raiz (sem inspect-glb.mjs)
const NOINSP = ['js/three/glbInspect.js', 'js/three/skeletonMap.js'];
let root = build('D1', { scriptsDir: '.', scripts: ['check-3d-setup.mjs'], modsDir: null, skipCore: NOINSP }); let r = run(root, root, ['check-3d-setup.mjs']);
t('D1 (so o check na raiz, sem glbInspect.js em lugar nenhum): NAO falha com ERR_MODULE_NOT_FOUND', noModErr(r)); t('D1: usa inspecao reduzida, avisa o que copiar e lista o arquivo ausente', out(r).includes('reduzida') && out(r).includes('glbInspect.js nao encontrado') && out(r).includes('FALTA js/three/glbInspect.js')); t('D1: ainda valida o athlete.glb', out(r).includes('atende ao contrato'));
root = build('D2', { scriptsDir: '.', scripts: ['check-3d-setup.mjs'], modsDir: null }); r = run(root, root, ['check-3d-setup.mjs']);
t('D2 (glbInspect.js vazio/incompleto): nao quebra, avisa "nao exporta inspect()" e usa inspecao reduzida', noModErr(r) && r.status === 0 && out(r).includes('nao exporta inspect()') && out(r).includes('atende ao contrato (inspecao reduzida)'));
// E: faltam vendor e athlete -> falha controlada com mensagens uteis (sem stack trace)
root = build('E', { scriptsDir: '.', scripts: ['check-3d-setup.mjs'], modsDir: null, vendor: false, athlete: false }); r = run(root, root, ['check-3d-setup.mjs']);
t('E: faltando vendor/athlete -> exit 1 sem stack trace', r.status === 1 && noModErr(r) && out(r).includes('FALTA vendor/three/three.module.js') && out(r).includes('FALTA assets/models/athlete.glb'));
// F: faltam arquivos do projeto -> lista exatamente quais
root = build('F', { scriptsDir: '.', scripts: ['check-3d-setup.mjs'], modsDir: null, core: false }); r = run(root, root, ['check-3d-setup.mjs']); t('F: lista os arquivos do projeto que faltam e nao altera nada', r.status === 1 && out(r).includes('FALTA js/three/engine.js') && out(r).includes('Nada foi alterado'));
// G: executado de OUTRA pasta -> acha a raiz pelo local do script
root = build('G', { scriptsDir: '.', modsDir: 'js/three' }); r = run(root, tmp, [path.join(root, 'check-3d-setup.mjs')]); t('G: roda de outra pasta e acha a raiz do projeto', r.status === 0 && out(r).includes('Pasta do projeto: ' + root));
// H: prepare-athlete sem os modulos que ele usa -> erro claro (exit 2), sem stack trace
root = build('H', { scriptsDir: '.', scripts: ['prepare-athlete.mjs'], modsDir: null }); r = run(root, root, ['prepare-athlete.mjs', 'x.glb']); t('H: prepare-athlete sem gltf-io.mjs -> mensagem clara dizendo o que copiar', r.status === 2 && out(r).includes('nao encontrei "gltf-io.mjs"') && noModErr(r));
root = build('I1', { scriptsDir: '.', scripts: ['inspect-glb.mjs'], modsDir: null, skipCore: NOINSP }); r = run(root, root, ['inspect-glb.mjs', 'x.glb']); t('I1: inspect-glb sem glbInspect.js -> mensagem clara (exit 2)', r.status === 2 && out(r).includes('nao encontrei "glbInspect.js"') && noModErr(r));
root = build('I2', { scriptsDir: '.', scripts: ['inspect-glb.mjs'], modsDir: null }); r = run(root, root, ['inspect-glb.mjs', 'x.glb']); t('I2: glbInspect.js vazio -> mensagem clara (exit 2)', r.status === 2 && out(r).includes('nao exporta inspect') && noModErr(r));
// setup-3d na raiz instala em ./vendor/three relativo ao cwd
root = path.join(tmp, 'J'); fs.mkdirSync(root); fs.copyFileSync(find('setup-3d.mjs'), path.join(root, 'setup-3d.mjs')); r = run(root, root, ['setup-3d.mjs', '--self-test']); t('J: setup-3d.mjs --self-test funciona na raiz', r.status === 0 && out(r).includes('integridade do arquivo confirmada'));
fs.rmSync(tmp, { recursive: true, force: true }); console.log(`LAYOUTS OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
