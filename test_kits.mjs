// Testa o pack de camisas convertido: cobertura dos 20 clubes, arquivos existentes, cores válidas, imagens 1024x768 e a lógica de pack/cores (sem DOM).
import fs from 'fs'; import { TEAMS } from './js/teams.js'; import { uniformColors } from './js/three/uniform.js'; import { loadKitPack, packMeta, kitPackReady, packVariants } from './js/three/kitPack.js';
let ok = 0, bad = 0; const t = (c, m) => { if (c) ok++; else { bad++; console.log('FALHOU:', m); } };
const meta = JSON.parse(fs.readFileSync('assets/kits/kits.json', 'utf8')), hex = /^#[0-9a-f]{6}$/i, ids = new Set();
for (const tm of TEAMS) { const m = meta[tm.key]; t(!!m, 'clube sem uniformes: ' + tm.key); if (!m) continue; t(!!m.home, tm.key + ' sem titular');
  for (const [v, k] of Object.entries(m)) { t(fs.existsSync(k.file), 'arquivo ausente ' + k.file); for (const c of ['main', 'sleeve', 'shorts', 'socks', 'trim']) t(hex.test(k[c]), `${tm.key}/${v}.${c} inválida`); if (v === 'home') { t(!ids.has(k.packId), 'ID repetido ' + k.packId); ids.add(k.packId); }
    const b = fs.readFileSync(k.file); t(b[0] === 0xff && b[1] === 0xd8, k.file + ' não é JPEG'); } }
const bb = fs.readFileSync(meta.flamengo.home.file); let w = 0, h = 0; for (let i = 2; i < bb.length - 9;) { if (bb[i] !== 0xff) { i++; continue; } const m = bb[i + 1]; if (m >= 0xc0 && m <= 0xc3) { h = bb.readUInt16BE(i + 5); w = bb.readUInt16BE(i + 7); break; } i += 2 + bb.readUInt16BE(i + 2); } t(w === 1024 && h === 768, `tamanho ${w}x${h}`);
// sem fetch do pack no Node: packMeta ainda não existe; depois de injetar, resolve variante e cai no titular
globalThis.fetch = async () => ({ ok: true, json: async () => meta }); await loadKitPack(); t(kitPackReady(), 'pack não carregou'); t(packMeta('flamengo', 'away').packId === meta.flamengo.away.packId, 'variante away'); t(packMeta('flamengo', 'xyz').file === meta.flamengo.home.file, 'fallback titular'); t(packMeta('inexistente') === null, 'clube inexistente'); t(packVariants('flamengo').length === 3, 'variantes');
const face = { skin: '#c68642', hairC: '#111', boot: '#222' }, kit = { c1: '#f00', c2: '#000', sh: '#123456' }, p = packMeta('flamengo');
t(uniformColors(kit, {}, face, p).shorts === p.shorts && uniformColors(kit, {}, face, p).socks === p.socks && uniformColors(kit, {}, face, p).trim === p.trim, 'cores do pack'); t(uniformColors(kit, {}, face).shorts === '#123456', 'sem pack mantém o procedural');
console.log(`KITS OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
