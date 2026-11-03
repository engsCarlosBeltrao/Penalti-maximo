// Junta os JSONs gerados por tools/blender/cobranca.py em js/kickClips.js (dados que o jogo lê de forma síncrona: tempos, contato, início e fim de cada clipe).
// Uso: node tools/build-kick-clips.mjs [assets/models/anim]
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2] || 'assets/models/anim', out = {};
for (const f of fs.readdirSync(dir).filter(f => /^cobranca_.+\.json$/.test(f)).sort()) {
  const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), r = m.relatorio;
  out[m.id] = { estilo: m.estilo, tipo: m.tipo, pe: m.pe, arquivo: m.arquivo, t0: m.t0, t1: m.t1, contato: m.contato_s, toque: m.toque, plantio: m.plantio, pouso: m.pouso, inicio: m.inicio, fim: m.fim,
    velPe: m.vel_pe_contato_m_s, folgaContatoMm: (r.contato_canhoto || r.contato).chuteira_bola_mm, derivaApoioMm: r.max_deriva_apoio_mm };
}
const src = `// GERADO por tools/build-kick-clips.mjs a partir de ${dir}/cobranca_*.json (tools/blender/cobranca.py). Não editar à mão.\n// Coordenadas do clipe (Blender): bola em (0,0); gol em -Y; esquerda do jogador = +X. inicio/fim no espaço do DESTRO (pe 'l' = espelho).\nexport const KICK_CLIPS = ${JSON.stringify(out, null, 1)};\n`;
fs.writeFileSync('js/kickClips.js', src); console.log('js/kickClips.js:', Object.keys(out).length, 'clipes');
