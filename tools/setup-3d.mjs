#!/usr/bin/env node
// Instala o Three.js (padrao r160) em vendor/three/. Roda no SEU computador (precisa de internet e Node 18+).
//   node setup-3d.mjs                        baixa de unpkg e, se falhar, de jsdelivr
//   node setup-3d.mjs --from package         copia de uma pasta "package" ja extraida (npm pack three@0.160.0, depois tar -xf three-0.160.0.tgz)
//   node setup-3d.mjs --self-test            confere a integridade deste proprio arquivo (URLs validas, sem links Markdown)
//   opcoes: --version 0.160.0   --root <pasta do projeto>   --base <url>   --no-size-check
// Este arquivo NAO usa expressoes regulares nem enderecos literais: as URLs sao montadas por partes e validadas com new URL().
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const has = (name) => args.includes(name);

const VERSION = opt('--version') || '0.160.0';
const ROOT = path.resolve(opt('--root') || '.');
const FROM = opt('--from');
const TIMEOUT_MS = 30000;
const selfRel = path.relative(process.cwd(), path.resolve(process.argv[1] || 'setup-3d.mjs'));
const sibling = (f) => path.relative(process.cwd(), path.join(path.dirname(path.resolve(process.argv[1] || '.')), f));

// ---- enderecos: montados por partes (nada de links literais) e validados ----
const PROTO = 'https';
const SEP = '://';
const HOSTS = [
  { nome: 'unpkg', host: ['unpkg', 'com'].join('.'), prefix: '' },
  { nome: 'jsdelivr', host: ['cdn', 'jsdelivr', 'net'].join('.'), prefix: 'npm/' },
];
function buildBase(h) { return new URL(PROTO + SEP + h.host + '/' + h.prefix + 'three@' + VERSION + '/').href; }
function ensureSlash(u) { const s = new URL(u).href; return s.endsWith('/') ? s : s + '/'; }
const BASES = opt('--base') ? [{ nome: 'personalizado', base: ensureSlash(opt('--base')) }] : HOSTS.map((h) => ({ nome: h.nome, base: buildBase(h) }));

// ---- arquivos: origem no pacote, destino no projeto, trechos obrigatorios (texto simples) ----
const FILES = [
  { src: 'build/three.module.js', dst: 'vendor/three/three.module.js', must: ['REVISION', 'export {'], min: 200000 },
  { src: 'examples/jsm/loaders/GLTFLoader.js', dst: 'vendor/three/addons/loaders/GLTFLoader.js', must: ['class GLTFLoader', "from 'three'", 'BufferGeometryUtils.js'], min: 20000 },
  { src: 'examples/jsm/utils/BufferGeometryUtils.js', dst: 'vendor/three/addons/utils/BufferGeometryUtils.js', must: ['toTrianglesDrawMode'], min: 100 },
  { src: 'examples/jsm/utils/SkeletonUtils.js', dst: 'vendor/three/addons/utils/SkeletonUtils.js', must: ['function clone'], min: 100 },
];

const ok = (m) => console.log('OK   ' + m);
const warn = (m) => console.log('AVISO ' + m);
const bad = (m) => console.log('ERRO ' + m);
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);

// ---- mensagens de erro claras ----
function explain(err, url) {
  const code = (err && err.cause && err.cause.code) || (err && err.code) || '';
  if (err && err.name === 'AbortError') return 'tempo esgotado (' + TIMEOUT_MS / 1000 + ' s) ao acessar ' + url + '. Conexao lenta ou bloqueada.';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'nao foi possivel resolver o nome do servidor (' + new URL(url).host + '). Sem internet, DNS ou proxy bloqueando.';
  if (code === 'ECONNREFUSED') return 'conexao recusada por ' + new URL(url).host + '.';
  if (code === 'ECONNRESET' || code === 'UND_ERR_SOCKET') return 'a conexao foi interrompida (rede instavel ou firewall).';
  if (code === 'CERT_HAS_EXPIRED' || String(code).startsWith('UNABLE_TO') || String(code).includes('CERT')) return 'erro de certificado HTTPS (' + code + '): relogio do computador errado ou rede corporativa interceptando HTTPS.';
  return (err && err.message ? err.message : String(err)) + (code ? ' (' + code + ')' : '');
}

async function fetchText(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal, redirect: 'follow' });
    if (res.status === 404) throw new Error('HTTP 404: este arquivo nao existe na versao ' + VERSION + ' (' + url + ')');
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ao baixar ' + url);
    return await res.text();
  } finally { clearTimeout(timer); }
}

function validate(f, text) {
  const head = text.slice(0, 200).trimStart().toLowerCase();
  if (head.startsWith('<!doctype') || head.startsWith('<html')) throw new Error('recebi uma pagina HTML em vez do arquivo (proxy, portal de login da rede ou bloqueio).');
  if (!has('--no-size-check') && text.length < f.min) throw new Error('arquivo pequeno demais (' + text.length + ' bytes; esperado pelo menos ' + f.min + '): download truncado ou versao errada.');
  const falta = f.must.filter((s) => !text.includes(s));
  if (falta.length) throw new Error('conteudo inesperado: nao encontrei ' + falta.map((s) => '"' + s + '"').join(', ') + '.');
}

async function obtain(f) {
  if (FROM) {
    const p = path.join(FROM, f.src);
    if (!fs.existsSync(p)) throw new Error('nao existe ' + p + ' (a pasta --from deve ser a pasta "package" extraida do npm pack)');
    return { text: fs.readFileSync(p, 'utf8'), origem: p };
  }
  const motivos = [];
  for (const b of BASES) {
    const url = new URL(f.src, b.base).href;
    try { const text = await fetchText(url); validate(f, text); return { text, origem: b.nome }; }
    catch (e) { motivos.push(b.nome + ': ' + explain(e, url)); }
  }
  throw new Error(motivos.join(' | '));
}

function revisionOf(text) {
  const marca = "const REVISION = '";
  const i = text.indexOf(marca);
  if (i < 0) return null;
  const j = text.indexOf("'", i + marca.length);
  return j < 0 ? null : text.slice(i + marca.length, j);
}

// ---- auto-teste de integridade deste arquivo ----
function selfTest() {
  let falhas = 0;
  const check = (nome, cond) => { if (cond) ok(nome); else { falhas++; bad(nome); } };
  for (const h of HOSTS) { let valido = true; try { const u = new URL(buildBase(h)); valido = u.protocol === 'https:' && u.href.includes('three@' + VERSION); } catch { valido = false; } check('URL valida: ' + buildBase(h), valido); }
  const src = fs.readFileSync(new URL(import.meta.url), 'utf8');
  // os padroes proibidos sao montados por partes, para o proprio arquivo nao conte-los
  const E = String.fromCharCode(38);                       // o caractere e-comercial
  const proibidos = [[']' + '(http', 'link Markdown'], [E + 'amp;', 'entidade HTML'], [E + 'lt;', 'entidade HTML'], [E + 'gt;', 'entidade HTML'], [E + 'quot;', 'entidade HTML'], [String.fromCharCode(0x200b), 'caractere invisivel'], [String.fromCharCode(0xfeff), 'caractere invisivel']];
  for (const [t, d] of proibidos) check('sem ' + d + ' (' + (t.length === 1 ? 'U+' + t.charCodeAt(0).toString(16) : t) + ')', !src.includes(t));
  const marca = '.replace(' + '/';
  const semRegex = !src.split('\n').some((l) => { const s = l.trim(); return !s.startsWith('//') && s.includes(marca); });
  check('sem expressoes regulares em replace()', semRegex);
  if (falhas) { bad(falhas + ' problema(s) de integridade.'); process.exit(1); }
  ok('integridade do arquivo confirmada');
}

async function main() {
  if (has('--self-test')) { selfTest(); return; }
  console.log('Destino: ' + ROOT);
  console.log(FROM ? 'Origem: pasta local ' + FROM : 'Origem: ' + BASES.map((b) => b.nome + ' (' + b.base + ')').join(' -> '));
  let falhas = 0;
  for (const f of FILES) {
    try {
      const { text, origem } = await obtain(f);
      validate(f, text);
      const dst = path.join(ROOT, f.dst);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      const tmp = dst + '.tmp';
      fs.writeFileSync(tmp, text);
      fs.renameSync(tmp, dst);
      const lido = fs.readFileSync(dst, 'utf8');           // confere o que foi realmente gravado
      if (lido !== text) throw new Error('o arquivo gravado difere do baixado (disco cheio ou sem permissao?)');
      ok(f.dst + '  (' + (Buffer.byteLength(text) / 1024).toFixed(0) + ' KB, sha256 ' + sha(text) + ', de ' + origem + ')');
    } catch (e) { falhas++; bad(f.dst + ' <- ' + e.message); }
  }
  const tm = path.join(ROOT, FILES[0].dst);
  if (fs.existsSync(tm)) {
    const rev = revisionOf(fs.readFileSync(tm, 'utf8')), want = VERSION.split('.')[1];
    if (rev === want) ok('Three.js r' + rev + ' instalado');
    else if (rev) { falhas++; bad('revisao instalada r' + rev + ' diferente da esperada r' + want); }
    else warn('nao consegui ler a revisao do Three.js');
  }
  if (falhas) {
    console.log('\n' + falhas + ' problema(s). Alternativa sem este script:');
    console.log('  npm pack three@' + VERSION);
    console.log('  tar -xf three-' + VERSION + '.tgz');
    console.log('  node ' + selfRel + ' --from package');
    process.exit(1);
  }
  console.log('\nPronto. Proximo passo: node ' + sibling('check-3d-setup.mjs') + '   (depois abra three-smoke.html pelo Live Server).');
}
main().catch((e) => { bad(e && e.message ? e.message : String(e)); process.exit(1); });
