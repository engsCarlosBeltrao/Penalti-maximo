// O HUMOR DA TORCIDA desta partida: uma única máquina de estados (js/torcidaEstado.js) ligada aos eventos do jogo, compartilhada pela torcida 3D
// (js/three/torcedores.js) e pelo som da torcida (js/torcidaSom.js). Game.update() avança o relógio (parado na pausa).
import { Events } from './events.js';
import { criaTorcidaEstado } from './torcidaEstado.js';
export const Humor = criaTorcidaEstado(Events);
