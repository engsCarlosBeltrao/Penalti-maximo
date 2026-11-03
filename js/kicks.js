// COBRANÇAS: TIPO (chapada · médio · bomba, decidido pela FORÇA da barra) × ESTILO (comum ou rotina de craque). Cada combinação é um clipe do Blender (tools/blender/cobranca.py),
// cujos tempos/contato/pose de início e fim vêm de js/kickClips.js (gerado). Aqui só se decide QUAL clipe e qual bola cada cobrança usa.
// A escolha usa o ID real do elenco (js/lineups), nunca o nome mostrado na tela.
import { KICK_CLIPS } from './kickClips.js';
import { PLAYERS } from './players.js';
import { AIM_LIM } from './aim.js';

// Bola por tipo: tf = tempo de voo até a linha do gol (s); curl = curva lateral máxima (m) do efeito da parte interna do pé.
// Velocidade inicial = distância/tf × k/(1−e^−k) (arrasto, ver ballWorld): ~15 m/s (chapada), ~20 (médio), ~27 (bomba) para o centro do gol.
// Referência: Nunome et al. 2002 — máximo de 23,4 m/s (parte interna) e 28,0 m/s (peito do pé); a chapada colocada fica bem abaixo do máximo.
export const KICK_TYPES = {
  chapada: { nome: 'Chapada', tf: .80, curl: .16 },
  medio:   { nome: 'Médio',   tf: .62, curl: 0 },
  bomba:   { nome: 'Bomba',   tf: .46, curl: 0 },
};
export const TYPE_ORDER = ['chapada', 'medio', 'bomba'];
// Rotinas próprias (ID do elenco → estilo). Pés confirmados: Neymar e Gabigol no elenco do jogo; Jorginho e Arrascaeta: destros (Transfermarkt).
export const STAR_STYLES = { 'santos-neymar-jr': 'neymar', 'santos-gabriel-barbosa': 'gabigol', 'flamengo-jorginho': 'jorginho', 'flamengo-giorgian-de-arrascaeta': 'arrascaeta' };
export const STYLE_NAMES = { comum: 'Cobrança padrão', neymar: 'Ritmo variado', gabigol: 'Hesitação e decisão', jorginho: 'Pulinho', arrascaeta: 'Técnica e compacta' };
// FORÇA = fração da barra (a mesma barra que o jogador enche segurando; js/aim.js → y): 0 no mínimo, 1 no máximo.
// Faixas: até 35% chapada · acima de 35% até 70% médio · acima de 70% bomba (fronteira fechada à esquerda: 35% exato = chapada, 70% exato = médio).
export const FORCE_BANDS = { chapada: .35, medio: .70 };
export const forceFromAim = y => Math.min(1, Math.max(0, (y - AIM_LIM.ymin)/(AIM_LIM.ymax - AIM_LIM.ymin)));
export const typeFromForce = f => (f <= FORCE_BANDS.chapada + 1e-9 ? 'chapada' : f <= FORCE_BANDS.medio + 1e-9 ? 'medio' : 'bomba');

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
// Todos os tipos de um estilo partem do MESMO ponto e da mesma pose (o tipo só é conhecido ao soltar a barra): a espera usa o médio do estilo.
export const waitSpec = playerId => kickSpec(playerId, 'medio');
// Clipes de reação do cobrador (tools/blender/reacoes.py): ENTRADA (caminhada até o ponto de partida), 5 comemorações de gol e 5 reações de cobrança perdida
// (duração em s, igual ao clipe — conferida em test_kicks.mjs). Arquivos: assets/models/anim/<nome>_<r|l>.glb.
export const ENTRY_S = 2.7;
export const GOAL_REACTIONS = { gol_bracos_abertos: 3.2, gol_punhos: 2.8, gol_salto: 3.0, gol_aponta: 3.0, gol_corrida: 3.4 };
export const MISS_REACTIONS = { perdeu_cabeca_baixa: 2.8, perdeu_maos_cintura: 3.0, perdeu_mao_rosto: 2.8, perdeu_maos_cabeca: 3.0, perdeu_olha_chao: 3.0 };
export const REACTION_NAMES = { gol_bracos_abertos: 'Braços abertos', gol_punhos: 'Punhos cerrados', gol_salto: 'Pequeno salto', gol_aponta: 'Apontando para cima', gol_corrida: 'Corrida comemorativa',
  perdeu_cabeca_baixa: 'Cabeça baixa', perdeu_maos_cintura: 'Mãos na cintura', perdeu_mao_rosto: 'Mão no rosto', perdeu_maos_cabeca: 'Mãos na cabeça', perdeu_olha_chao: 'Olhar para o chão' };
export const GOAL_S = Math.max(...Object.values(GOAL_REACTIONS)), MISS_S = Math.max(...Object.values(MISS_REACTIONS));
// SACOLA embaralhada: cada reação sai uma vez antes de qualquer uma repetir, e a primeira de uma sacola nova nunca é a última da anterior (sem repetição
// imediata). Sorteada UMA vez por cobrança, quando o resultado é confirmado (game.js), e guardada na bola: o mesmo chute nunca troca de reação.
export function reactionBag(names, rnd = Math.random) {
  let bag = [], last = null;
  return () => {
    if (!bag.length) { bag = names.slice(); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rnd()*(i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      if (bag.length > 1 && bag[0] === last) [bag[0], bag[1]] = [bag[1], bag[0]]; }
    return last = bag.shift();
  };
}
// Pose de início e fim do clipe no mundo do jogo (Blender → mundo: x = −x_b, z = y_b + 11; yaw = π + AP). Espaço do destro: o canhoto espelha (rig.js).
// wd = largura do atleta (build × altura, a escala x/z do modelo: loader.js → apply). O clipe da cobrança é escalado em torno da BOLA e deslocado para o
// ponto de toque da chuteira continuar na bola (loader.js → apply); a espera e a reação precisam usar o MESMO ponto, senão o pé desliza na transição.
const comp = (c, wd) => { const t = c.toque || [0, 0, 0], x = -(t[0] - wd*t[0]), z = -(t[2] - wd*t[2]); return [c.pe === 'l' ? -x : x, z]; };   // no espaço do destro
const at = (c, wd, p, y = 0) => { const k = comp(c, wd); return [-wd*p[0] + k[0], y, 11 + wd*p[1] + k[1]]; };
export const clipStart = (c, wd = 1) => ({ root: at(c, wd, c.inicio.S), yaw: Math.PI + c.inicio.AP*Math.PI/180 });
export const clipEnd = (c, wd = 1) => ({ root: at(c, wd, c.fim.pelve), sup: at(c, wd, c.fim.apoio, .08), kick: at(c, wd, c.fim.chute, .08) });
