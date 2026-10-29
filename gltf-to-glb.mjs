// Converte .gltf + .bin em .glb (sem texturas externas: o jogo pinta os materiais). Uso: node gltf-to-glb.mjs entrada.gltf saida.glb
import fs from 'node:fs'; import path from 'node:path';
const [inp, out] = process.argv.slice(2);
if (!inp || !out) { console.log('Uso: node gltf-to-glb.mjs entrada.gltf saida.glb'); process.exit(2); }
const j = JSON.parse(fs.readFileSync(inp, 'utf8'));
const bufs = j.buffers.map(b => fs.readFileSync(path.join(path.dirname(inp), decodeURIComponent(b.uri))));
if (bufs.length !== 1) { console.log('ERRO: esperava 1 buffer, achei ' + bufs.length); process.exit(1); }
delete j.images; delete j.textures; delete j.samplers;
for (const m of j.materials || []) {
  const p = m.pbrMetallicRoughness; if (p) { delete p.baseColorTexture; delete p.metallicRoughnessTexture; }
  delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture;
}
let bin = bufs[0]; while (bin.length % 4) bin = Buffer.concat([bin, Buffer.alloc(1)]);
j.buffers = [{ byteLength: bin.length }];
let js = Buffer.from(JSON.stringify(j)); while (js.length % 4) js = Buffer.concat([js, Buffer.from(' ')]);
const h = Buffer.alloc(12); h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(0x4E4F534A, 4);
const c2 = Buffer.alloc(8); c2.writeUInt32LE(bin.length, 0); c2.writeUInt32LE(0x004E4942, 4);
fs.writeFileSync(out, Buffer.concat([h, c1, js, c2, bin]));
console.log('OK ' + out + ' (' + fs.statSync(out).size + ' bytes)');
