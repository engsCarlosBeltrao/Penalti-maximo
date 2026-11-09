// Testa tools/setup-3d.mjs sem internet (servidor HTTP local) e confere a integridade do codigo do projeto.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http'; import { spawn, spawnSync } from 'node:child_process';
const SETUP = ['tools', '.'].map((d) => path.resolve(d, 'setup-3d.mjs')).find((p) => fs.existsSync(p)); if (!SETUP) { console.log('setup-3d.mjs nao encontrado'); process.exit(1); }
let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FALHOU:', n)); };
const E = String.fromCharCode(38);
const DSTS = ['vendor/three/three.module.js', 'vendor/three/addons/loaders/GLTFLoader.js', 'vendor/three/addons/utils/BufferGeometryUtils.js', 'vendor/three/addons/utils/SkeletonUtils.js'];
const FAKE = { 'build/three.module.js': "const REVISION = '160';\nexport { REVISION };\n/* " + 'x'.repeat(400000) + ' */', 'examples/jsm/loaders/GLTFLoader.js': "import { Loader } from 'three';\nimport { toTrianglesDrawMode } from '../utils/BufferGeometryUtils.js';\nclass GLTFLoader extends Loader {}\n/* " + 'y'.repeat(30000) + ' */\nexport { GLTFLoader };', 'examples/jsm/utils/BufferGeometryUtils.js': 'function toTrianglesDrawMode() {}\nexport { toTrianglesDrawMode };\n/* ' + 'z'.repeat(200) + ' */', 'examples/jsm/utils/SkeletonUtils.js': 'function clone(s) { return s; }\nexport { clone };\n/* ' + 'w'.repeat(200) + ' */' };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-')); let n = 0; const newRoot = () => { const r = path.join(tmp, 'r' + (++n)); fs.mkdirSync(r); return r; };
const runSync = (a) => spawnSync('node', [SETUP, ...a], { encoding: 'utf8', timeout: 60000 });
const runAsync = (a) => new Promise((res) => { let out = ''; const c = spawn('node', [SETUP, ...a]); c.stdout.on('data', (d) => { out += d; }); c.on('close', (code) => res({ status: code, stdout: out })); setTimeout(() => { c.kill(); res({ status: -1, stdout: out }); }, 30000); });
const serve = (handler) => new Promise((res) => { const s = http.createServer(handler); s.listen(0, () => res({ s, base: 'http://localhost:' + s.address().port + '/' })); });
// 1) integridade do codigo do projeto
const files = []; const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { if (e.name === 'node_modules' || e.name === 'vendor' || e.name.startsWith('.')) return; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.js') || p.endsWith('.mjs')) files.push(p); });
['tools', 'js'].forEach((d) => { if (fs.existsSync(d)) walk(d); }); ['test.mjs', 'test_music.mjs', 'test_rig.mjs', 'test_frame.mjs', 'test_retarget.mjs', 'test_glb.mjs', 'test_prepare.mjs', 'test_setup.mjs'].forEach((f) => { if (fs.existsSync(f)) files.push(f); });
const noSyntax = files.filter((f) => spawnSync('node', ['--check', f], { encoding: 'utf8' }).status !== 0); t('node --check passa em TODOS os arquivos .js/.mjs (' + files.length + ')', noSyntax.length === 0); if (noSyntax.length) console.log('  com erro de sintaxe:', noSyntax);
const markers = [[']' + '(http', 'link Markdown'], [E + 'amp;', 'entidade HTML'], [E + 'lt;', 'entidade HTML'], [E + 'gt;', 'entidade HTML'], [String.fromCharCode(0x200b), 'caractere invisivel'], [String.fromCharCode(0xfeff), 'BOM']];
const artefatos = []; files.filter((f) => !f.endsWith('test_setup.mjs')).forEach((f) => {
  let s = fs.readFileSync(f, 'utf8');
  s = s.split('\n').filter((l) => !l.startsWith('const esc = ')).join('\n');   // unica excecao legitima: a funcao esc() que escapa texto do usuario para HTML (paineis musicPanel, spotifyPanel, torcidaPanel)
  markers.forEach(([m, d]) => { if (s.includes(m)) artefatos.push(f + ': ' + d); }); }); t('nenhum link Markdown/entidade HTML/caractere invisivel no codigo (exceto as funcoes esc() dos paineis)', artefatos.length === 0); if (artefatos.length) console.log(' ', artefatos);
t('setup-3d.mjs --self-test passa', runSync(['--self-test']).status === 0);
// 2) copia local (--from)
let root = newRoot(); const pkg = path.join(tmp, 'package'); Object.entries(FAKE).forEach(([k, v]) => { fs.mkdirSync(path.dirname(path.join(pkg, k)), { recursive: true }); fs.writeFileSync(path.join(pkg, k), v); });
let r = runSync(['--from', pkg, '--root', root]); t('--from: grava os 4 arquivos e confirma r160', r.status === 0 && DSTS.every((d) => fs.existsSync(path.join(root, d))) && r.stdout.includes('Three.js r160 instalado'));
// 3) download HTTP real (servidor local): grava os 4 arquivos, byte a byte, nos caminhos definidos
let sv = await serve((q, s) => { const k = q.url.replace('/', ''); if (FAKE[k] !== undefined) s.end(FAKE[k]); else { s.statusCode = 404; s.end('nao existe'); } });
root = newRoot(); r = await runAsync(['--base', sv.base, '--root', root]);
t('HTTP: baixa e grava os 4 arquivos nos caminhos definidos', r.status === 0 && DSTS.every((d) => fs.existsSync(path.join(root, d))));
t('HTTP: conteudo gravado identico ao servido (byte a byte)', DSTS.every((d, i) => fs.readFileSync(path.join(root, d), 'utf8') === Object.values(FAKE)[i]));
t('HTTP: imprime tamanho, sha256 e revisao', r.stdout.includes('sha256') && r.stdout.includes('Three.js r160 instalado')); sv.s.close();
// 4) falhas: mensagens claras
sv = await serve((q, s) => { s.setHeader('content-type', 'text/html'); s.end('<!DOCTYPE html><html><body>Login da rede</body></html>'); }); root = newRoot(); r = await runAsync(['--base', sv.base, '--root', root]);
t('resposta HTML (proxy/portal): erro explica que veio uma pagina HTML', r.status === 1 && r.stdout.includes('pagina HTML') && r.stdout.includes('Alternativa sem este script')); t('resposta HTML: nada e gravado', !fs.existsSync(path.join(root, DSTS[0]))); sv.s.close();
sv = await serve((q, s) => { s.statusCode = 404; s.end('x'); }); root = newRoot(); r = await runAsync(['--base', sv.base, '--root', root]); t('HTTP 404: erro diz que o arquivo nao existe na versao', r.status === 1 && r.stdout.includes('HTTP 404') && r.stdout.includes('nao existe na versao')); sv.s.close();
sv = await serve((q, s) => { const k = q.url.replace('/', ''); s.end(k === 'build/three.module.js' ? "const REVISION = '160'; /* truncado */" : (FAKE[k] ?? 'x')); }); root = newRoot(); r = await runAsync(['--base', sv.base, '--root', root]); t('arquivo truncado: erro diz que e pequeno demais', r.status === 1 && r.stdout.includes('pequeno demais')); sv.s.close();
sv = await serve((q, s) => { const k = q.url.replace('/', ''); s.end(k === 'examples/jsm/utils/SkeletonUtils.js' ? 'nada util aqui ' + 'a'.repeat(300) : (FAKE[k] ?? 'x')); }); root = newRoot(); r = await runAsync(['--base', sv.base, '--root', root]); t('conteudo inesperado: erro diz o que faltou', r.status === 1 && r.stdout.includes('conteudo inesperado') && r.stdout.includes('function clone')); sv.s.close();
root = newRoot(); r = await runAsync(['--base', 'http://localhost:1/', '--root', root]); t('sem conexao: erro claro (recusada/rede) e dica de alternativa', r.status === 1 && /conexao recusada|nao foi possivel|interrompida|fetch failed/.test(r.stdout) && r.stdout.includes('npm pack'));
r = runSync(['--from', path.join(tmp, 'naoexiste'), '--root', newRoot()]); t('pasta --from inexistente: erro claro', r.status === 1 && r.stdout.includes('nao existe'));
fs.rmSync(tmp, { recursive: true, force: true }); console.log('SETUP OK ' + ok + ' | FALHAS ' + bad); process.exit(bad ? 1 : 0);
