// PLACAR DA DISPUTA (estilo transmissão esportiva) — desenhado pelo HUD 2D (js/hud.js) por cima da cena, no espaço lógico 960×540 (o HUD escala
// para qualquer resolução). Só LÊ o estado da partida (GS.equipes, GS.placar, GS.cobranca, GS.cobrador, game.m.marks, game.fin, GS.vencedor);
// não muda nada da lógica. As animações nascem de comparar o estado com o do quadro anterior (gol, defesa/erro, nova rodada, fim, nova partida).
//  [escudo NOME ▌]  [ 2 │ 1 ]  [▐ NOME escudo]      ← painéis dos times + caixa do resultado
//   ● ✓ ✕ ○ ○          COBRANÇA 3 DE 5          ○ ○ ● ✓ ✕   ← cobranças de cada time (a da vez pulsa) + faixa da rodada
import { GS } from './gameState.js';
import { CRESTS } from './teams.js';
const FONTE = (peso, px) => `${peso} ${px}px Bahnschrift, "Arial Narrow", "Segoe UI", sans-serif`;
const lum = h => { const n = parseInt(String(h || '#888').slice(1), 16); return (.3*(n >> 16) + .59*(n >> 8 & 255) + .11*(n & 255))/255; };
const corTime = t => (lum(t.c1) < .14 && t.c2 ? (lum(t.c2) > .9 ? '#d9dde3' : t.c2) : lum(t.c1) > .93 ? '#e8ebf0' : t.c1);   // a cor que aparece no fundo escuro
const ease = u => { u = Math.max(0, Math.min(1, u)); return 1 - Math.pow(1 - u, 3); };
const L = { cx: 480, y: 10, h: 48, caixa: 132, painel: 236, sub: 18 };       // medidas (px lógicos)
const escudos = new Map();
function escudo(t) {
  if (!CRESTS.includes(t.key) || typeof Image === 'undefined') return null; let i = escudos.get(t.key);
  if (!i) { i = new Image(); i.onerror = () => { i.falhou = true; }; i.src = `assets/crests/${t.key}.png`; escudos.set(t.key, i); }
  return i.complete && i.naturalWidth && !i.falhou ? i : null;
}
// texto que cabe na largura: diminui a fonte até caber; se não couber nem pequeno, usa a sigla
function cabe(c, tx, larg, px, min, peso = 700, alt) {
  for (let s = px; s >= min; s--) { c.font = FONTE(peso, s); if (c.measureText(tx).width <= larg) return { tx, s }; }
  return alt ? cabe(c, alt, larg, px, min, peso) : { tx, s: min };
}
// estado das animações (comparado a cada quadro)
const A = { partida: null, t0: 0, placar: [0, 0], rolo: [null, null], marcas: [0, 0], pop: [null, null], tremor: 0, faixa: '', faixaAnt: '', tFaixa: 0, fim: null };
function acompanha(game, now) {
  if (game.m !== A.partida) { A.partida = game.m; A.t0 = now; A.placar = [...GS.placar]; A.marcas = game.m ? game.m.marks.map(x => x.length) : [0, 0]; A.rolo = [null, null]; A.pop = [null, null]; A.fim = null; A.faixa = ''; }
  [0, 1].forEach(q => {
    if (GS.placar[q] !== A.placar[q]) { A.rolo[q] = { de: A.placar[q], para: GS.placar[q], t0: now }; A.placar[q] = GS.placar[q]; }
    const mk = game.m?.marks[q] || []; if (mk.length > A.marcas[q]) { const v = mk[mk.length - 1]; A.pop[q] = { i: mk.length - 1, v, t0: now }; if (v !== 'g') A.tremor = now; } A.marcas[q] = mk.length;
  });
  if (game.fin && !A.fim) A.fim = now;
}
function faixaTexto(game) {
  const [a, b] = GS.equipes, n = GS.cobranca;
  if (game.fin) return `FIM DE JOGO · ${(GS.vencedor === 0 ? a : b).nome.toUpperCase()} VENCE ${Math.max(...GS.placar)} A ${Math.min(...GS.placar)}`;
  return n <= 5 ? `DISPUTA DE PÊNALTIS · COBRANÇA ${n} DE 5` : `MORTE SÚBITA · ${n}ª COBRANÇA`;
}
// um indicador de cobrança: g = gol (verde, ✓) · d/x = perdeu (defesa, fora ou trave: vermelho, ✕) · vazio = ainda não batida · atual = pulsa
function indicador(c, x, y, r, v, atual, cor, now, pop) {
  if (v === 'd') v = 'x';                                                    // defesa do goleiro = cobrança perdida: vermelho com ×
  const k = pop ? 1 + .7*(1 - ease((now - pop.t0)/.35)) : 1, R = r*k;
  c.save(); c.translate(x, y);
  if (!v) { c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.arc(0, 0, R - .8, 0, 7); c.stroke();
    if (atual) { const p = .5 + .5*Math.sin(now*6); c.strokeStyle = cor; c.lineWidth = 2.2; c.globalAlpha = .55 + .45*p; c.beginPath(); c.arc(0, 0, R + 1.5 + 1.5*p, 0, 7); c.stroke();
      c.globalAlpha = 1; c.fillStyle = cor; c.beginPath(); c.arc(0, 0, R*.38, 0, 7); c.fill(); }
    c.restore(); return; }
  const fundo = v === 'g' ? '#27c46b' : v === 'd' ? '#2f8cff' : '#ef3b4b'; const gr = c.createLinearGradient(0, -R, 0, R); gr.addColorStop(0, fundo); gr.addColorStop(1, v === 'g' ? '#169a4f' : v === 'd' ? '#1b62c4' : '#b81f2f');
  c.fillStyle = gr; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.stroke();
  c.strokeStyle = '#fff'; c.lineWidth = 1.9; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  if (v === 'g') { c.moveTo(-R*.42, R*.02); c.lineTo(-R*.1, R*.34); c.lineTo(R*.45, -R*.32); }
  else if (v === 'd') { c.moveTo(0, -R*.5); c.lineTo(R*.42, -R*.3); c.lineTo(R*.36, R*.12); c.quadraticCurveTo(R*.2, R*.42, 0, R*.55); c.quadraticCurveTo(-R*.2, R*.42, -R*.36, R*.12); c.lineTo(-R*.42, -R*.3); c.closePath(); }   // escudinho: defendido
  else { c.moveTo(-R*.36, -R*.36); c.lineTo(R*.36, R*.36); c.moveTo(R*.36, -R*.36); c.lineTo(-R*.36, R*.36); }
  c.stroke(); c.restore();
}
// painel de um time (q = 0 à esquerda, 1 à direita)
function painel(c, t, q, x, w, y, h, now, game, estado) {
  const dir = q ? 1 : -1, cor = corTime(t), interno = q ? x : x + w, externo = q ? x + w : x;
  const { cobrando, vencedor, perdedor } = estado;
  c.save(); if (perdedor) c.globalAlpha *= .55;
  // fundo: vidro escuro com a cor do time entrando pela borda de fora
  const gr = c.createLinearGradient(externo, 0, interno, 0); gr.addColorStop(0, `rgba(${hex(cor)},.42)`); gr.addColorStop(.38, 'rgba(14,18,27,.9)'); gr.addColorStop(1, 'rgba(10,13,20,.94)');
  c.fillStyle = gr; c.fillRect(x, y, w, h);
  const brilho = c.createLinearGradient(0, y, 0, y + h); brilho.addColorStop(0, 'rgba(255,255,255,.10)'); brilho.addColorStop(.5, 'rgba(255,255,255,0)'); c.fillStyle = brilho; c.fillRect(x, y, w, h);
  // filete na cor do time encostado na caixa do resultado + linha de baixo
  c.fillStyle = cor; c.fillRect(q ? x : x + w - 4, y, 4, h); c.fillRect(x, y + h - 2.5, w, 2.5);
  if (cobrando && !game.fin) { const u = (now*.6) % 1, lx = q ? x + w*u : x + w*(1 - u), lg = c.createLinearGradient(lx - 50, 0, lx + 50, 0);   // luz correndo na linha de quem está cobrando
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.5, 'rgba(255,255,255,.95)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = lg; c.fillRect(x, y + h - 2.5, w, 2.5); }
  // escudo (proporção preservada) ou selo com a sigla
  const es = escudo(t), tam = h - 10, ex = q ? x + w - tam - 8 : x + 8, ey = y + 5;
  if (es) { const r = es.naturalWidth/es.naturalHeight, ew = r >= 1 ? tam : tam*r, eh = r >= 1 ? tam/r : tam; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 6; c.drawImage(es, ex + (tam - ew)/2, ey + (tam - eh)/2, ew, eh); c.shadowBlur = 0; }
  else { c.fillStyle = cor; c.beginPath(); c.arc(ex + tam/2, ey + tam/2, tam/2, 0, 7); c.fill(); c.fillStyle = lum(cor) > .55 ? '#111' : '#fff'; c.font = FONTE(800, 12); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t.sigla || '', ex + tam/2, ey + tam/2 + 1); }
  // nome (cabe sempre: diminui a fonte; se precisar, usa a sigla)
  const livre = w - tam - 30, nx = q ? x + 14 : x + w - 14, fit = cabe(c, String(t.nome).toUpperCase(), livre, 21, 13, 700, t.sigla);
  c.font = FONTE(700, fit.s); c.textAlign = q ? 'left' : 'right'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(fit.tx, nx, y + h/2 + 1);
  // brilho do gol (a cor do time acende o painel e se apaga)
  const gl = estado.gol != null ? 1 - (now - estado.gol)/1.1 : 0; if (gl > 0) { c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(${hex(cor)},${(.45*gl).toFixed(3)})`; c.fillRect(x, y, w, h); c.globalCompositeOperation = 'source-over'; }
  // fim: o vencedor pulsa de leve e ganha a etiqueta
  if (vencedor) { const p = .5 + .5*Math.sin(now*3); c.strokeStyle = `rgba(255,215,94,${(.5 + .4*p).toFixed(2)})`; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, h - 2);
    c.font = FONTE(800, 10); const tw = c.measureText('CAMPEÃO').width + 12, bx = q ? x + 10 : x + w - 10 - tw; c.fillStyle = '#ffd75e'; c.fillRect(bx, y - 7, tw, 13); c.fillStyle = '#16120a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('CAMPEÃO', bx + tw/2, y + .5); }
  c.restore();
}
const hex = h => { const s = String(h); if (s.startsWith('rgb')) return s.replace(/[^\d,]/g, ''); const n = parseInt(s.slice(1), 16); return `${n >> 16},${n >> 8 & 255},${n & 255}`; };
// número do placar com "rolo" (o antigo sobe e sai, o novo entra de baixo)
function numero(c, v, x, y, cor, rolo, now) {
  c.font = FONTE(700, 38); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = cor;
  if (rolo) { const u = ease((now - rolo.t0)/.45); if (u < 1) { c.save(); c.beginPath(); c.rect(x - 30, y - 22, 60, 44); c.clip(); c.globalAlpha = 1 - u; c.fillText(String(rolo.de), x, y - 26*u); c.globalAlpha = u; c.fillText(String(rolo.para), x, y + 26*(1 - u)); c.restore(); return; } }
  c.fillText(String(v), x, y);
}
export function desenhaPlacar(c, game) {
  const [a, b] = GS.equipes; if (!a || !b) return; const now = performance.now()/1000; acompanha(game, now);
  const ent = game.m ? ease((now - A.t0)/.5) : 1, sh = A.tremor && now - A.tremor < .35 ? Math.sin((now - A.tremor)*70)*3*(1 - (now - A.tremor)/.35) : 0;
  const y = L.y - 18*(1 - ent), cx = L.cx + sh, cw = L.caixa, h = L.h, pw = L.painel;
  c.save(); c.globalAlpha = ent;
  // caixa do resultado
  const fim = !!game.fin, v = GS.vencedor, lider = GS.placar[0] === GS.placar[1] ? -1 : GS.placar[0] > GS.placar[1] ? 0 : 1;
  const gb = c.createLinearGradient(0, y, 0, y + h); gb.addColorStop(0, 'rgba(26,31,43,.97)'); gb.addColorStop(1, 'rgba(9,11,17,.97)'); c.fillStyle = gb; c.fillRect(cx - cw/2, y - 3, cw, h + 6);
  c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(cx - cw/2, y - 3, cw, 1); c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(cx - .5, y + 9, 1, h - 18);
  [0, 1].forEach(q => numero(c, GS.placar[q], cx + (q ? 1 : -1)*cw/4, y + h/2 + 1, lider === q ? '#ffd75e' : '#ffffff', A.rolo[q], now));
  // painéis
  const gols = [0, 1].map(q => A.rolo[q] && A.rolo[q].para > A.rolo[q].de && now - A.rolo[q].t0 < 1.1 ? A.rolo[q].t0 : null);
  [[a, 0, cx - cw/2 - pw], [b, 1, cx + cw/2]].forEach(([t, q, x]) => painel(c, t, q, x, pw, y, h, now, game, { cobrando: GS.cobrador === q && !!game.m, vencedor: fim && v === q, perdedor: fim && v !== q, gol: gols[q] }));
  // faixa da rodada (troca de texto com fade)
  const tx = faixaTexto(game); if (tx !== A.faixa) { A.faixaAnt = A.faixa; A.faixa = tx; A.tFaixa = now; }
  const fy = y + h + 3, fw = Math.max(cw + 120, 300); c.fillStyle = 'rgba(8,10,16,.88)'; c.fillRect(cx - fw/2, fy, fw, L.sub);
  c.fillStyle = fim ? '#ffd75e' : 'rgba(255,255,255,.18)'; c.fillRect(cx - fw/2, fy + L.sub - 1, fw, 1);
  const u = ease((now - A.tFaixa)/.3); c.textAlign = 'center'; c.textBaseline = 'middle';
  const fitF = cabe(c, tx, fw - 16, 11.5, 8, 600);
  if (u < 1 && A.faixaAnt) { c.globalAlpha = ent*(1 - u); c.font = FONTE(600, cabe(c, A.faixaAnt, fw - 16, 11.5, 8, 600).s); c.fillStyle = '#c9d2de'; c.fillText(A.faixaAnt, cx, fy + L.sub/2 + 1 - 6*u); }
  c.globalAlpha = ent*u; c.font = FONTE(600, fitF.s); c.fillStyle = fim ? '#ffd75e' : '#dfe6ef'; c.fillText(tx, cx, fy + L.sub/2 + 1 + 6*(1 - u)); c.globalAlpha = ent;
  // cobranças de cada time, embaixo do painel (perto da caixa do resultado)
  const m = game.m; if (m) [0, 1].forEach(q => {
    const mk = m.marks[q], atual = !fim && GS.cobrador === q && !(game.ball && game.ball.res) ? mk.length : -1, n = Math.max(5, mk.length, atual + 1);
    const r = 6.5, ini = fw/2 + 8, disp = cw/2 + pw - ini - 6, passo = Math.min(18, (disp - 2*r)/Math.max(1, n - 1)), larg = (n - 1)*passo + 2*r + 10, y0 = fy + L.sub/2, cor = corTime(q ? b : a);
    c.fillStyle = 'rgba(8,10,16,.72)'; c.fillRect(q ? cx + ini - 5 : cx - ini - larg + 5, fy, larg, L.sub);                   // fundo das bolinhas (legível sobre o gramado)
    for (let i = 0; i < n; i++) { const xi = q ? cx + ini + r + i*passo : cx - ini - r - (n - 1 - i)*passo;
      indicador(c, xi, y0, r, mk[i], i === atual, cor, now, A.pop[q] && A.pop[q].i === i && now - A.pop[q].t0 < .35 ? A.pop[q] : null); }
  });
  c.restore();
}
