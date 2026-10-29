// Leitura e escrita mínimas de glTF/GLB (sem dependências) para as ferramentas de preparação de modelos.
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
const { parseGLB } = await need('glbInspect.js', 'ler arquivos GLB', ['parseGLB']);
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }, SZ = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }, MAXV = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535, 5125: 4294967295 };
export function readModel(file) {                                      // .glb ou .gltf (com .bin/imagens externos ou data URIs)
  const raw = new Uint8Array(fs.readFileSync(file)), dir = path.dirname(file);
  if (/\.glb$/i.test(file)) { const { json, bin } = parseGLB(raw); return { json, buffers: [bin || new Uint8Array(0)], dir }; }
  const json = JSON.parse(new TextDecoder().decode(raw)), buffers = (json.buffers || []).map(b => { if (!b.uri) throw new Error('buffer sem uri em .gltf'); if (b.uri.startsWith('data:')) return new Uint8Array(Buffer.from(b.uri.split(',')[1], 'base64')); return new Uint8Array(fs.readFileSync(path.join(dir, decodeURIComponent(b.uri)))); });
  return { json, buffers, dir };
}
export function readAccessor(m, i) {                                   // → array de arrays de números (normalizado quando "normalized")
  const a = m.json.accessors[i], n = NC[a.type], sz = SZ[a.componentType], out = new Array(a.count); if (a.sparse) throw new Error('Acessor esparso (sparse) não suportado: exporte sem "sparse accessors".');
  if (a.bufferView === undefined) { for (let k = 0; k < a.count; k++) out[k] = new Array(n).fill(0); return out; }
  const bv = m.json.bufferViews[a.bufferView], buf = m.buffers[bv.buffer], dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), base = (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || n*sz;
  const get = { 5120: (o) => dv.getInt8(o), 5121: (o) => dv.getUint8(o), 5122: (o) => dv.getInt16(o, true), 5123: (o) => dv.getUint16(o, true), 5125: (o) => dv.getUint32(o, true), 5126: (o) => dv.getFloat32(o, true) }[a.componentType];
  for (let k = 0; k < a.count; k++) { const row = new Array(n); for (let c = 0; c < n; c++) { let v = get(base + k*stride + c*sz); if (a.normalized && a.componentType !== 5126) v = Math.max(v/MAXV[a.componentType], -1); row[c] = v; } out[k] = row; }
  return out;
}
// Montador de GLB: copia os buffers originais (para manter animações e dados não tocados) e acrescenta dados novos
export class Builder {
  constructor(m) { this.json = JSON.parse(JSON.stringify(m.json)); this.parts = []; this.len = 0; const offs = m.buffers.map(b => this.add(b)); (this.json.bufferViews || []).forEach(bv => { bv.byteOffset = (bv.byteOffset || 0) + offs[bv.buffer]; bv.buffer = 0; }); this.json.buffers = [{ byteLength: 0 }]; this.json.bufferViews ||= []; this.json.accessors ||= []; }
  add(u8) { const pad = (4 - this.len % 4) % 4; if (pad) { this.parts.push(new Uint8Array(pad)); this.len += pad; } const off = this.len; this.parts.push(u8); this.len += u8.length; return off; }
  accessor(values, type, comp, { target, normalized, minmax } = {}) {  // values: array de arrays
    const n = NC[type], N = values.length, T = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[comp], arr = new T(N*n); values.forEach((v, k) => v.forEach((x, c) => { arr[k*n + c] = x; }));
    const off = this.add(new Uint8Array(arr.buffer)); this.json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: arr.byteLength, ...(target ? { target } : {}) });
    const acc = { bufferView: this.json.bufferViews.length - 1, componentType: comp, count: N, type, ...(normalized ? { normalized: true } : {}) };
    if (minmax) { acc.min = [...Array(n).keys()].map(c => Math.min(...values.map(v => v[c]))); acc.max = [...Array(n).keys()].map(c => Math.max(...values.map(v => v[c]))); } this.json.accessors.push(acc); return this.json.accessors.length - 1;
  }
  glb() {
    this.json.buffers[0].byteLength = this.len + (4 - this.len % 4) % 4; let js = Buffer.from(JSON.stringify(this.json)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
    const bin = Buffer.concat([...this.parts.map(p => Buffer.from(p)), Buffer.alloc((4 - this.len % 4) % 4)]), h = Buffer.alloc(12), c1 = Buffer.alloc(8), c2 = Buffer.alloc(8);
    h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(0x4E4F534A, 4); c2.writeUInt32LE(bin.length, 0); c2.writeUInt32LE(0x004E4942, 4); return Buffer.concat([h, c1, js, c2, bin]);
  }
}
