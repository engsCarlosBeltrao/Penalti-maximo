// COBRANÇAS: TIPO (chapada · médio · bomba) × ESTILO (comum ou rotina de craque). Cada combinação é um clipe do Blender (tools/blender/cobranca.py),
// cujos tempos/contato/pose de início e fim vêm de js/kickClips.js (gerado). Aqui só se decide QUAL clipe e qual bola cada cobrança usa.
// A escolha usa o ID real do elenco (js/lineups), nunca o nome mostrado na tela.
import { KICK_CLIPS } from './kickClips.js';
import { PLAYERS } from './players.js';

// Bola por tipo: tf = tempo de voo até a linha do gol (s); curl = curva lateral máxima (m) do efeito da parte interna do pé.
// Velocidade inicial = distância/tf × k/(1−e^−k) (arrasto, ver ballWorld): ~15 m/s (chapada), ~20 (médio), ~27 (bomba) para o centro do gol.
// Referência: Nunome et al. 2002 — máximo de 23,4 m/s (parte interna) e 28,0 m/s (peito do pé); a chapada colocada fica bem abaixo do máximo.
export const KICK_TYPES = {
  chapada: { nome: 'Chapada', tf: .80, curl: .16, tecla: '1' },
  medio:   { nome: 'Médio',   tf: .62, curl: 0,   tecla: '2' },
  bomba:   { nome: 'Bomba',   tf: .46, curl: 0,   tecla: '3' },
};
export const TYPE_ORDER = ['chapada', 'medio', 'bomba'];
// Rotinas próprias (ID do elenco → estilo). Pés confirmados: Neymar e Gabigol no elenco do jogo; Jorginho e Arrascaeta: destros (Transfermarkt).
export const STAR_STYLES = { 'santos-neymar-jr': 'neymar', 'santos-gabriel-barbosa': 'gabigol', 'flamengo-jorginho': 'jorginho', 'flamengo-giorgian-de-arrascaeta': 'arrascaeta' };
export const STYLE_NAMES = { comum: 'Cobrança padrão', neymar: 'Ritmo variado', gabigol: 'Hesitação e decisão', jorginho: 'Pulinho', arrascaeta: 'Técnica e compacta' };
// Preferência da CPU por estilo (soma 1); um tipo que o estilo não tem cai no médio daquele estilo.
const CPU_PREF = { comum: { chapada: .3, medio: .5, bomba: .2 }, neymar: { chapada: .65, medio: .35 }, gabigol: { chapada: .55, medio: .45 }, jorginho: { chapada: .6, medio: .4 }, arrascaeta: { chapada: .5, medio: .5 } };

export const styleOf = id => STAR_STYLES[id] || 'comum';
export const footOf = id => (PLAYERS.find(p => p.id === id)?.preferredFoot === 'left' ? 'l' : 'r');
export const supportedTypes = estilo => TYPE_ORDER.filter(t => KICK_CLIPS[`${estilo}_${t}`]);
// Especificação completa de uma cobrança: clipe, tempos, bola. tipoPedido pode não existir no estilo (ex.: bomba de Neymar) → médio do mesmo estilo.
export function kickSpec(playerId, tipoPedido = 'medio') {
  let estilo = styleOf(playerId); if (!supportedTypes(estilo).length) estilo = 'comum';
  const tipos = supportedTypes(estilo), tipo = tipos.includes(tipoPedido) ? tipoPedido : tipos.includes('medio') ? 'medio' : tipos[0];
  const id = `${estilo}_${tipo}`, c = KICK_CLIPS[id], T = KICK_TYPES[tipo];
  return { id, estilo, tipo, pedido: tipoPedido, pe: c.pe, clip: c, t0: c.t0, t1: c.t1, tf: T.tf, curl: T.curl * (c.pe === 'l' ? -1 : 1) };
}
export function cpuType(playerId, rnd = Math.random) {
  const pref = CPU_PREF[styleOf(playerId)] || CPU_PREF.comum; let r = rnd();
  for (const [t, w] of Object.entries(pref)) { if ((r -= w) <= 0) return t; } return 'medio';
}
// Pose de início e fim do clipe no mundo do jogo (Blender → mundo: x = −x_b, z = y_b + 11; yaw = π + AP). Espaço do destro: o canhoto espelha (rig.js).
export const clipStart = c => ({ root: [-c.inicio.S[0], 0, c.inicio.S[1] + 11], yaw: Math.PI + c.inicio.AP*Math.PI/180 });
export const clipEnd = c => ({ root: [-c.fim.pelve[0], 0, c.fim.pelve[1] + 11], sup: [-c.fim.apoio[0], .08, c.fim.apoio[1] + 11], kick: [-c.fim.chute[0], .08, c.fim.chute[1] + 11] });
