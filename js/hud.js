import { GS } from './gameState.js';
import { pickKicker } from './players.js';
import { KICK_TYPES, STYLE_NAMES } from './kicks.js';
function kickInfo(c, game, b) {                                      // rotina do cobrador (craques) e, depois de soltar a barra, o tipo escolhido pela força
  const k = game.kick; if (!k) return; const tx = b && b.tipo ? `${KICK_TYPES[b.tipo].nome} · força ${Math.round((b.forca ?? 0)*100)}%${k.estilo !== 'comum' ? ' · ' + STYLE_NAMES[k.estilo] : ''}` : k.estilo !== 'comum' ? STYLE_NAMES[k.estilo] : '';
  if (!tx) return; c.font = '600 12px system-ui'; c.textAlign = 'left'; c.fillStyle = k.estilo === 'comum' ? '#cfd8e3' : '#ffe66d'; c.fillText(tx, 14, 494);
}
// HUD 2D (placar, cobrador, mensagens) desenhado por cima da cena 3D
export function hud(c, game, res, b) {
  const [a, bb] = GS.equipes; if (!a) return; c.fillStyle = 'rgba(0,0,0,.78)'; c.fillRect(250,6,460,64); c.font = '700 18px system-ui'; c.textAlign = 'left'; c.fillStyle = a.c1; c.fillRect(256,12,8,52); c.fillStyle = '#fff'; c.fillText(a.nome,272,30); c.textAlign = 'right'; c.fillText(bb.nome,694,30); c.fillStyle = bb.c1; c.fillRect(696,12,8,52);
  c.textAlign = 'center'; c.font = '900 34px Impact, sans-serif'; c.fillStyle = '#ffe66d'; c.fillText(`${GS.placar[0]} - ${GS.placar[1]}`,480,38); c.font = '13px system-ui'; c.fillStyle = '#aaa'; c.fillText(`Cobrança ${GS.cobranca}`,480,62);
  const m = game.m; if (!m) return; [0,1].forEach(q => { const n = Math.max(5, m.marks[q].length); for (let i = 0; i < n; i++) { const v = m.marks[q][i]; c.fillStyle = v === 'g' ? '#38b000' : v === 'd' ? '#4cc9f0' : v === 'x' ? '#e63946' : '#555'; c.beginPath(); c.arc(q ? 700 - i*16 : 260 + i*16, 62, 5, 0, 7); c.fill(); } });
  if (game.fin) { c.font = '900 54px Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffe66d'; c.strokeStyle = '#000'; c.lineWidth = 6; const tx = `${GS.equipes[GS.vencedor].nome.toUpperCase()} VENCE!`; c.strokeText(tx, 480, 420); c.fillText(tx, 480, 420); return; }
  const kt = GS.cobrador === 0 ? a : bb, p = pickKicker(kt, GS.cobranca, game.escolha[GS.cobrador]); c.fillStyle = 'rgba(0,0,0,.75)'; c.fillRect(10,500,230,30); c.fillStyle = kt.c1; c.fillRect(10,500,6,30); c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = '700 14px system-ui'; c.fillText(`${game.two ? 'JOGADOR ' + (GS.cobrador+1) + ' · ' : ''}${p.star ? '★ ' : ''}${p.nome} — ${p.noNum ? 'nº ?' : p.num}${p.pending ? ' (elenco pendente)' : ''}`.slice(0, 34), 24, 520);
  kickInfo(c, game, b);
  if (game.dec && !res && !game.fin) { c.globalAlpha = .6 + .4*Math.sin(performance.now()/150); c.font = '900 26px Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ff2d55'; c.fillText('COBRANÇA DECISIVA', 480, 104); c.globalAlpha = 1; }
  if (res) { c.font = '900 64px Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = { gol:'#ffe66d', defesa:'#4cc9f0', fora:'#ccc', trave:'#ff9f1c' }[res]; c.strokeStyle = '#000'; c.lineWidth = 6; const tx = { gol:'GOL!', defesa:'DEFESA!', fora:'PARA FORA', trave:'NA TRAVE!' }[res]; c.strokeText(tx,480,420); c.fillText(tx,480,420); }
  else { c.font = '600 16px system-ui'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText('', 0, 0); if (GS.estado === 'AGUARDANDO_COBRANCA') c.fillText('Segure para encher a força · solte para chutar (fraca: chapada · média: médio · forte: bomba)', 560, 522); else if (GS.estado === 'DEFESA_DO_GOLEIRO') c.fillText('Defenda! ← esquerda · ↑ centro · → direita', 560, 522); }
}
