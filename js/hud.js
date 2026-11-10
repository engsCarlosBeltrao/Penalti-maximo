import { GS } from './gameState.js';
import { pickKicker } from './players.js';
import { footOf } from './kicks.js';
import { desenhaPlacar } from './placar.js';
// HUD 2D (placar, cobrador, mensagens) desenhado por cima da cena 3D
export function hud(c, game, res, b) {
  const [a, bb] = GS.equipes; if (!a) return;
  desenhaPlacar(c, game);                                            // placar de transmissão (js/placar.js)
  const m = game.m; if (!m) return;
  if (game.fin) {                                                     // festa do título: faixa embaixo (o grupo comemorando fica livre no meio da tela)
    const u = Math.min(1, Math.max(0, (game.fin.t - 1)/.5)); if (u <= 0) return; const tx = `${GS.equipes[GS.vencedor].nome.toUpperCase()} É ${game.finalCampeonato ? 'CAMPEÃO' : 'VENCEDOR'}!`;
    c.save(); c.globalAlpha = u; c.font = '900 30px Impact, sans-serif'; c.textAlign = 'center'; const w = c.measureText(tx).width + 60, y0 = 488 + 14*(1 - u);
    c.fillStyle = 'rgba(8,10,16,.82)'; c.fillRect(480 - w/2, y0, w, 40); c.fillStyle = '#ffd75e'; c.fillRect(480 - w/2, y0 + 38, w, 2); c.fillStyle = '#ffffff'; c.fillText(tx, 480, y0 + 31);
    if (game.fin.t > 1.5) { c.font = '600 11px system-ui'; c.fillStyle = 'rgba(255,255,255,.65)'; c.fillText('aperte para continuar', 480, y0 - 6); } c.restore(); return; }
  const kt = GS.cobrador === 0 ? a : bb, p = pickKicker(kt, GS.cobranca, game.escolha[GS.cobrador]); // etiqueta do cobrador (canto inferior esquerdo, inclinada): pé preferido (PD/PE), nome e número
  { const tx = `${game.two ? 'J' + (GS.cobrador + 1) + ' · ' : ''}${p.star ? '★ ' : ''}${p.nome}${p.noNum ? '' : ' ' + p.num}`.slice(0, 30); c.font = '700 14px system-ui'; const w = c.measureText(tx).width + 70;
    c.fillStyle = 'rgba(8,12,18,.82)'; c.beginPath(); c.moveTo(18, 496); c.lineTo(18 + w, 496); c.lineTo(10 + w, 524); c.lineTo(10, 524); c.closePath(); c.fill();
    c.fillStyle = kt.c1; c.beginPath(); c.arc(28, 510, 5, 0, 7); c.fill(); c.fillStyle = '#cfd8e3'; c.textAlign = 'left'; c.font = '700 12px system-ui'; c.fillText(footOf(p.id) === 'l' ? 'PE' : 'PD', 38, 515);
    c.fillStyle = '#fff'; c.font = '700 14px system-ui'; c.fillText(tx, 62, 515); }
  if (game.dec && !res && !game.fin) { c.globalAlpha = .6 + .4*Math.sin(performance.now()/150); c.font = '900 26px Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ff2d55'; c.fillText('COBRANÇA DECISIVA', 480, 104); c.globalAlpha = 1; }
  if (res) { c.font = '900 64px Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = { gol:'#ffe66d', defesa:'#4cc9f0', fora:'#ccc', trave:'#ff9f1c' }[res]; c.strokeStyle = '#000'; c.lineWidth = 6; const tx = { gol:'GOL!', defesa:'DEFESA!', fora:'PARA FORA', trave:'NA TRAVE!' }[res]; c.strokeText(tx,480,420); c.fillText(tx,480,420); }
  else { c.font = '600 16px system-ui'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText('', 0, 0); if (game.miraVisivel?.()) { c.font = '700 12px system-ui'; [['SEGURE', 'FORÇA E ALTURA'], ['SOLTE', 'CHUTA']].forEach(([k, v], i) => { c.fillStyle = 'rgba(8,12,18,.6)'; c.fillRect(760, 84 + i*22, 190, 19); c.textAlign = 'left'; c.fillStyle = '#9fb0c4'; c.fillText(k, 767, 98 + i*22); c.textAlign = 'right'; c.fillStyle = '#fff'; c.fillText(v, 944, 98 + i*22); }); } }   // (sem textos de canto escolhido/travado e sem tipo/força do chute na tela: o jogador não precisa dessas informações)
}
