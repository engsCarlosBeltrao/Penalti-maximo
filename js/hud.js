import { GS } from './gameState.js';
import { pickKicker } from './players.js';
import { KICK_TYPES, TYPE_ORDER, STYLE_NAMES, supportedTypes } from './kicks.js';
// botões do tipo de cobrança (coordenadas lógicas 960×540); também nas teclas 1, 2 e 3
export const TYPE_CHIPS = TYPE_ORDER.map((t, i) => ({ t, x: 712 + i*82, y: 470, w: 76, h: 26 }));
export const chipAt = (x, y) => TYPE_CHIPS.find(c => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h)?.t || null;
function kickInfo(c, game) {                                        // tipo escolhido e rotina do cobrador; botões só na vez do jogador, antes de mirar
  const k = game.kick; if (!k) return; const sup = supportedTypes(k.estilo);
  c.font = '600 12px system-ui'; c.textAlign = 'left'; c.fillStyle = k.estilo === 'comum' ? '#cfd8e3' : '#ffe66d'; c.fillText(`${KICK_TYPES[k.tipo].nome} · ${STYLE_NAMES[k.estilo]}${k.pedido !== k.tipo ? ' (sem ' + KICK_TYPES[k.pedido].nome.toLowerCase() + ')' : ''}`, 14, 494);
  if (!game.hum() || GS.estado !== 'AGUARDANDO_COBRANCA') return;
  TYPE_CHIPS.forEach(ch => { const on = k.pedido === ch.t, ok = sup.includes(ch.t); c.fillStyle = on ? '#ffe66d' : 'rgba(0,0,0,.72)'; c.fillRect(ch.x, ch.y, ch.w, ch.h); c.strokeStyle = on ? '#ffe66d' : 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; c.strokeRect(ch.x + .5, ch.y + .5, ch.w - 1, ch.h - 1);
    c.fillStyle = on ? '#111' : ok ? '#fff' : '#888'; c.font = '700 13px system-ui'; c.textAlign = 'center'; c.fillText(`${KICK_TYPES[ch.t].tecla} ${KICK_TYPES[ch.t].nome}`, ch.x + ch.w/2, ch.y + 18); });
}
// HUD 2D (placar, cobrador, mensagens) desenhado por cima da cena 3D
export function hud(c, game, res, b) {
  const [a, bb] = GS.equipes; if (!a) return; c.fillStyle = 'rgba(0,0,0,.78)'; c.fillRect(250,6,460,64); c.font = '700 18px system-ui'; c.textAlign = 'left'; c.fillStyle = a.c1; c.fillRect(256,12,8,52); c.fillStyle = '#fff'; c.fillText(a.nome,272,30); c.textAlign = 'right'; c.fillText(bb.nome,694,30); c.fillStyle = bb.c1; c.fillRect(696,12,8,52);
  c.textAlign = 'center'; c.font = '900 34px Impact, sans-serif'; c.fillStyle = '#ffe66d'; c.fillText(`${GS.placar[0]} - ${GS.placar[1]}`,480,38); c.font = '13px system-ui'; c.fillStyle = '#aaa'; c.fillText(`Cobrança ${GS.cobranca}`,480,62);
  const m = game.m; if (!m) return; [0,1].forEach(q => { const n = Math.max(5, m.marks[q].length); for (let i = 0; i < n; i++) { const v = m.marks[q][i]; c.fillStyle = v === 'g' ? '#38b000' : v === 'd' ? '#4cc9f0' : v === 'x' ? '#e63946' : '#555'; c.beginPath(); c.arc(q ? 700 - i*16 : 260 + i*16, 62, 5, 0, 7); c.fill(); } });
  if (game.fin) { c.font = '900 54px Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffe66d'; c.strokeStyle = '#000'; c.lineWidth = 6; const tx = `${GS.equipes[GS.vencedor].nome.toUpperCase()} VENCE!`; c.strokeText(tx, 480, 420); c.fillText(tx, 480, 420); return; }
  const kt = GS.cobrador === 0 ? a : bb, p = pickKicker(kt, GS.cobranca, game.escolha[GS.cobrador]); c.fillStyle = 'rgba(0,0,0,.75)'; c.fillRect(10,500,230,30); c.fillStyle = kt.c1; c.fillRect(10,500,6,30); c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = '700 14px system-ui'; c.fillText(`${game.two ? 'JOGADOR ' + (GS.cobrador+1) + ' · ' : ''}${p.star ? '★ ' : ''}${p.nome} — ${p.noNum ? 'nº ?' : p.num}${p.pending ? ' (elenco pendente)' : ''}`.slice(0, 34), 24, 520);
  kickInfo(c, game);
  if (game.dec && !res && !game.fin) { c.globalAlpha = .6 + .4*Math.sin(performance.now()/150); c.font = '900 26px Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ff2d55'; c.fillText('COBRANÇA DECISIVA', 480, 104); c.globalAlpha = 1; }
  if (res) { c.font = '900 64px Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = { gol:'#ffe66d', defesa:'#4cc9f0', fora:'#ccc', trave:'#ff9f1c' }[res]; c.strokeStyle = '#000'; c.lineWidth = 6; const tx = { gol:'GOL!', defesa:'DEFESA!', fora:'PARA FORA', trave:'NA TRAVE!' }[res]; c.strokeText(tx,480,420); c.fillText(tx,480,420); }
  else { c.font = '600 16px system-ui'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText('', 0, 0); if (GS.estado === 'AGUARDANDO_COBRANCA') c.fillText('Clique = chute rasteiro · segure = mais alto · solte para chutar', 560, 522); else if (GS.estado === 'DEFESA_DO_GOLEIRO') c.fillText('Defenda! ← esquerda · ↑ centro · → direita', 560, 522); }
}
