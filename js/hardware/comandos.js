// O QUE CADA BOTÃO FAZ, conforme o momento do jogo. Passa SEMPRE pelos mesmos caminhos do teclado/mouse:
//  - chute: Game.down() ao apertar (começa a encher a MESMA barra de força) e Game.up() ao soltar (chuta com a força daquele instante);
//  - goleiro do jogador: Game.keeperChoose() com as setas (como ← ↑ →);
//  - menus: o navegador clica no item em foco; pausa: o menu de pausa do jogo.
// Bloqueios: um aperto do arcade gera no máximo UMA cobrança; comandos fora de hora são ignorados (e contados).
import { GS } from '../gameState.js';
const LADO = { LEFT: .15, RIGHT: .85, UP: .5, DOWN: .5 };
export function criarComandos({ game, nav, pausa, emMenu }) {
  const st = { segurando: false, carregando: false, chutes: 0, ignorados: 0, ultimo: null };
  const ign = (m) => { st.ignorados++; st.ultimo = 'ignorado: ' + m; return false; };
  const partida = () => !!(game.m && !game.fin) && !emMenu();
  // o aperto do arcade só vale se a cobrança já aceita (cobrador no ponto) — exatamente como o clique do mouse. Aperto antes da hora não "fica
  // guardado": senão a força sairia do tempo desde a liberação, e não do tempo real que o botão ficou apertado.
  function tentaCarregar() {
    if (!st.segurando || st.carregando || !partida() || pausa.aberta() || GS.estado !== 'AGUARDANDO_COBRANCA') return false;
    game.down(null); if (GS.estado === 'MIRANDO') { st.carregando = true; return true; } st.cedo = true; return false;
  }
  function comando(cmd) {
    const [b, ev] = cmd.split('_'), dir = b in LADO ? b : null; st.ultimo = cmd;
    if (cmd === 'ARCADE_DOWN') { if (st.segurando) return ign('arcade já apertado'); st.segurando = true; st.cedo = false;
      if (!partida() || pausa.aberta()) return (emMenu() || pausa.aberta()) ? nav.confirmar() : ign('arcade fora da cobrança'); return tentaCarregar() || ign('cedo: o cobrador ainda não está pronto'); }
    if (cmd === 'ARCADE_UP') { const ia = st.carregando; st.segurando = false; st.carregando = false;
      if (ia && GS.estado === 'MIRANDO' && partida()) { game.up(); st.chutes++; return true; } return ign('soltou sem carregar'); }
    if (pausa.aberta()) { if (dir) return nav.mover(dir); if (b === 'ADVANCE') return nav.confirmar(); if (b === 'BACK') { pausa.voltar(); return true; } return false; }
    if (partida()) {
      if (b === 'ADVANCE' || b === 'BACK') { if (st.carregando) return ign('pausa durante a carga'); pausa.abrir(); return true; }   // VOLTAR também só abre a pausa: sair exige confirmar
      if (dir) { if (ev === 'REPEAT') return ign('repetição na partida'); if (GS.estado === 'DEFESA_DO_GOLEIRO' && !game.hum()) return game.keeperChoose(LADO[dir]) !== false; return ign('seta fora da defesa'); }
      return ign(cmd);
    }
    if (emMenu()) { if (dir) return nav.mover(dir); if (b === 'ADVANCE') return nav.confirmar(); if (b === 'BACK') return nav.voltar(); }
    return ign(cmd);
  }
  // chamado em todo passo: se a carga sumiu (saída, cancelamento), zera
  function tick() { if (st.carregando && GS.estado !== 'MIRANDO') st.carregando = false; }
  // queda da ligação com o arcade apertado: cancela a carga (sem chute fantasma)
  function soltarTudo() { if (st.carregando && GS.estado === 'MIRANDO') game.cancel(); st.segurando = false; st.carregando = false; }
  return { comando, tick, soltarTudo, st };
}
