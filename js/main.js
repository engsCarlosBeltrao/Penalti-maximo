// Interface: menu, seleção de times/jogadores, playlist, configurações, campeonato e telas de resultado.
import { Game, cfg } from './game.js';
import { DBG } from './scene3d.js';
import { GS } from './gameState.js';
import { Events } from './events.js';
import { Arduino } from './arduino.js';
import { TEAMS, CRESTS } from './teams.js';
import { squad } from './players.js';
import { Cup } from './tournament.js';
import { Music } from './musicPlayer.js';
import { AM } from './audioManager.js';
import { Store } from './settingsStore.js';
import { openMusicPanel } from './musicPanel.js';
import { sfx, ambient } from './audio.js';
const ui = document.getElementById('ui'), cv = document.getElementById('cv'), app = document.getElementById('app'), back = document.getElementById('back');
let sel = { a: null, b: null }, escolha = [null, null], cup = null, mode = 'solo', me = null;
// --- layout: UI lógica 960x540 escalada; canvas com resolução interna × devicePixelRatio ---
function fit() { const narrow = window.innerWidth < 820; ui.classList.toggle('flow', narrow); document.body.classList.toggle('narrow', narrow); const s = narrow ? 1 : app.clientWidth / 960, d = window.devicePixelRatio || 1; ui.style.transform = narrow ? 'none' : `scale(${s})`; const cs = app.clientWidth / 960; cv.width = Math.round(960*cs*d); cv.height = Math.round(540*cs*d); }
window.addEventListener('resize', fit); fit();
const fallback = t => `<svg viewBox="0 0 46 54"><path d="M3 3h40v26c0 13-12 20-20 23C15 49 3 42 3 29z" fill="#2a3b52" stroke="#8da2bd" stroke-width="2"/><text x="23" y="32" font-size="14" font-weight="900" text-anchor="middle" fill="#fff">${t.sigla}</text></svg>`;
// escudo: só pede o PNG se a key estiver em CRESTS (teams.js) → sem erros 404 quando o arquivo não existe
const crest = t => CRESTS.includes(t.key) ? `<img src="assets/crests/${t.key}.png" alt="${t.sigla}" title="${t.nome}" onerror="this.outerHTML=''">` : fallback(t);
const show = h => { ui.className = window.innerWidth < 820 ? 'flow' : ''; ui.innerHTML = h; back.hidden = true; };
const hide = () => { ui.className = 'off'; back.hidden = false; };
const on = (id, f) => { const e = document.getElementById(id); if (e) e.onclick = f; };
const T = i => TEAMS[i];
Store.load(); AM.init(); Game.init(cv); Music.init(); Arduino.registrarComandos({ iniciar: () => Game.restart(), pausar: () => Game.paused = !Game.paused, reiniciar: () => Game.restart() }); Arduino.iniciar();
back.onclick = () => { Game.stop(); Music.setMode('menu'); menu(); };
document.addEventListener('pointerdown', () => AM.userGesture(), { once: true });   // áudio só depois da 1ª interação (política dos navegadores)
document.addEventListener('pointerdown', () => { if (!Music.playing && !Music.msg && Music.tracks.length && !GS.equipes[0]?.jogando) Music.play(); }, { once: true });

function menu() { GS.estado = 'MENU'; Music.onChange = null; AM.onChange = null; Music.setMode('menu'); if (AM.gestured) AM.enterMenu();
  show(`<h1>PÊNALTI MÁXIMO</h1><p>${sel.a != null ? `${T(sel.a).nome} x ${sel.b != null ? T(sel.b).nome : 'sorteio'}` : 'Segure, mire no tempo certo e solte.'}</p><div class="menu">
  <button id="solo">JOGAR SOZINHO</button><button id="duo">JOGAR COM ALGUÉM</button><button id="tm" class="sec">ESCOLHER TIMES</button><button id="pj" class="sec">ESCOLHER JOGADORES</button>
  <button id="cp" class="sec">CAMPEONATO</button><button id="pl" class="sec">MÚSICAS E TORCIDAS</button><button id="cf" class="sec">CONFIGURAÇÕES</button><button id="hw" class="sec">COMO JOGAR</button></div>`);
  on('solo', () => need('solo')); on('duo', () => need('duo')); on('tm', () => pickTeam('a', 'Time do Jogador 1', () => pickTeam('b', 'Time do Jogador 2 / adversário', menu))); on('pj', pickPlayers);
  on('cp', () => need('copa')); on('pl', () => openMusicPanel({ ui, show, TEAMS, crest, back: menu })); on('cf', settings); on('hw', how); }
function need(m) { mode = m; const go = () => m === 'duo' && sel.b == null ? pickTeam('b', 'Time do Jogador 2', go) : launch(); sel.a == null ? pickTeam('a', m === 'duo' ? 'Time do Jogador 1' : 'Escolha seu time', go) : go(); }
function pickTeam(slot, title, next) { GS.estado = 'SELECAO_EQUIPE';
  show(`<h2>${title}</h2><div class="grid">${TEAMS.map(t => `<div class="card" data-i="${t.id}">${crest(t)}<br>${t.nome}</div>`).join('')}</div><button id="b" class="sec">VOLTAR</button>`);
  ui.querySelectorAll('.card').forEach(c => c.onclick = () => { sel[slot] = +c.dataset.i; if (slot === 'a') escolha[0] = null; else escolha[1] = null; next(); }); on('b', menu); }
function pickPlayers() { if (sel.a == null) return pickTeam('a', 'Primeiro escolha o time do Jogador 1', pickPlayers);
  const slots = sel.b == null ? [0] : [0, 1], one = s => { const t = T(s ? sel.b : sel.a), sq = squad(t);
    show(`<h2>Cobrador — ${t.nome} (${sq.filter(p => !p.pending).length} confirmados)</h2><div class="box"><div class="pl"><button data-p="" class="sec">★ AUTOMÁTICO</button>${sq.map(p => `<button data-p="${p.id}" ${p.isStar ? '' : 'class="sec"'}>${p.isStar ? '★ ' : ''}${p.pending ? 'Pendente' : (p.nickname || p.name)} · ${p.jerseyNumber ?? '?'} · ${p.rating}</button>`).join('')}</div><p style="font-size:12px;margin-top:8px">Elencos verificados: só atletas com fonte e data em js/players.js. "Pendente" = elenco não verificado; "?" = camisa não confirmada. Dados e fontes em js/lineups/clubs/.</p></div><button id="b" class="sec">VOLTAR</button>`);
    ui.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { escolha[s] = b.dataset.p || null; s < slots.length - 1 ? one(s + 1) : menu(); }); on('b', menu); }; one(0); }
function launch() { if (mode === 'copa') { cup = new Cup(sel.a); return cupScreen(); } const b = mode === 'duo' ? sel.b : (sel.b ?? T(sel.a).id === 0 ? 1 : 0); versus(sel.a, mode === 'duo' || sel.b != null ? sel.b : [...TEAMS.keys()].filter(i => i !== sel.a)[Math.floor(Math.random() * 19)]); }
function versus(a, b) { me = a; show(`<h2>${mode === 'copa' ? cup.stageName() : mode === 'duo' ? 'Dois jogadores' : 'Amistoso'}</h2><div style="display:flex;gap:30px;align-items:center">${crest(T(a))}<h1>VS</h1>${crest(T(b))}</div><h3>${T(a).nome} x ${T(b).nome}</h3><button id="go">INICIAR DISPUTA</button><button id="b" class="sec">VOLTAR</button>`);
  on('b', menu); on('go', () => { hide(); Music.setMode('game'); Game.start(T(a), T(b), (win, [x, y], marks) => end(win, x, y, a, b, marks), mode === 'duo', escolha); }); }
function resumo(marks) { const s = m => m.map(v => `<span style="color:${v === 'g' ? '#38b000' : v === 'd' ? '#4cc9f0' : '#e63946'}">${v === 'g' ? '● gol' : v === 'd' ? '● defesa' : '● fora/trave'}</span>`).join(' '); return `<div class="box" style="font-size:12px">${[0, 1].map(i => `<b>${GS.equipes[i].nome}:</b> ${s(marks[i])}`).join('<br>')}</div>`; }
function end(win, x, y, a, b, marks) { Music.setMode('menu');
  if (mode === 'copa') { cup.playerResult(x, y); return cupScreen(win, x, y, a, b); }
  const msg = mode === 'duo' ? `${T(win ? a : b).nome} venceu!` : win ? 'VITÓRIA!' : 'DERROTA';
  show(`<h1>${msg}</h1><h2>${T(a).nome} ${x} x ${y} ${T(b).nome}</h2>${resumo(marks)}<button id="r">REVANCHE</button><button id="m" class="sec">VOLTAR AO MENU</button>`);
  on('r', () => { hide(); Music.setMode('game'); Game.restart(); }); on('m', menu); }
function cupScreen(win, x, y, a, b) {
  if (cup.champion !== null) { GS.estado = 'CAMPEONATO_FINALIZADO'; const t = T(cup.champion); show(`<h1>${cup.champion === sel.a ? 'CAMPEÃO!' : 'CAMPEONATO ENCERRADO'}</h1>${crest(t)}<h2>${t.nome}</h2><div class="box" style="font-size:12px">${cup.hist.slice(-8).join('<br>')}</div><button id="m">MENU</button>`); on('m', menu); cup = null; return; }
  const nx = cup.alive ? cup.nextForMe() : null, res = win == null ? '' : `<p>Último jogo: ${T(a).nome} ${x} x ${y} ${T(b).nome} — ${win ? 'vitória' : 'derrota'}</p>`;
  const tbl = cup.groups.map((g, i) => `<table><tr><th>Grupo ${'ABCD'[i]}</th><th>P</th><th>V</th><th>D</th><th>SG</th></tr>${cup.rank(g).map(id => { const r = cup.tab[id]; return `<tr${id === sel.a ? ' style="color:#ffe66d"' : ''}><td>${cup.name(id)}</td><td>${r.pts}</td><td>${r.w}</td><td>${r.l}</td><td>${r.gf - r.ga}</td></tr>`; }).join('')}</table>`).join('');
  show(`<h2>${cup.stageName()}</h2>${res}<div class="box" style="display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:11px">${tbl}</div>${nx ? `<button id="n">PRÓXIMO: vs ${cup.name(nx[1])}</button>` : ''}<button id="m" class="sec">SAIR</button>`);
  if (nx) on('n', () => { mode = 'copa'; versus(nx[0], nx[1]); }); on('m', menu); }
function how() { show(`<h2>Como jogar</h2><div class="box" style="max-width:700px"><b>Cobrando:</b> a linha amarela oscila sozinha. <b>Clique e solte</b> = chute rasteiro na posição da linha; <b>segure</b> o botão = o marcador de altura sobe enquanto a linha continua se movendo; solte para chutar (espere o cobrador chegar à bola). Tecla <b>M</b> silencia.<br><b>Defendendo (modo sozinho):</b> setas ← ↑ → logo após o chute adversário.<br><b>Jogar com alguém:</b> dois jogadores no mesmo computador alternam as cobranças com o mouse; os goleiros são da IA.<br><b>Regras:</b> 5 cobranças por time, alternadas; a disputa termina antes se um time não puder mais alcançar o outro; empate vai para morte súbita.<br><b>☰ MENU</b> (canto superior esquerdo) volta ao menu durante a partida.</div><button id="b">VOLTAR</button>`); on('b', menu); }
function settings() { show(`<h2>Configurações</h2><div class="box"><label>Mira horizontal<input id="hs" type="range" min=".4" max="2" step=".1" value="${cfg.hs}"></label><label>Mira vertical<input id="vs" type="range" min=".2" max="1.4" step=".1" value="${cfg.vs}"></label>
<label>Goleiro<select id="df">${['easy', 'normal', 'hard'].map(d => `<option value="${d}" ${cfg.diff === d ? 'selected' : ''}>${{ easy: 'Fácil', normal: 'Normal', hard: 'Difícil' }[d]}</option>`).join('')}</select></label>
<label>Efeitos sonoros<input id="sn" type="checkbox" ${cfg.sound ? 'checked' : ''}></label><label>Volume dos efeitos<input id="vl" type="range" min="0" max="1" step=".1" value="${cfg.vol}"></label><label>Volume da torcida<input id="vc" type="range" min="0" max="1" step=".1" value="${cfg.volCrowd}"></label><label>Volume da música<input id="vm" type="range" min="0" max="1" step=".05" value="${Music.vol}"></label></div><button id="rc" class="sec">REINICIAR CAMPEONATO</button><button id="b">VOLTAR</button>`);
  const bind = (id, k, f) => document.getElementById(id).oninput = e => cfg[k] = f(e.target);
  bind('hs', 'hs', e => +e.value); bind('vs', 'vs', e => +e.value); bind('df', 'diff', e => e.value); bind('sn', 'sound', e => e.checked); bind('vl', 'vol', e => +e.value); bind('vc', 'volCrowd', e => +e.value); document.getElementById('vm').oninput = e => Music.setVol(+e.target.value); on('rc', () => { cup = null; alert('Campeonato reiniciado.'); }); on('b', menu); }
document.addEventListener('click', e => { if (e.target.closest('button,.card')) sfx('click'); });
window.addEventListener('keydown', e => { if (e.key === 'm' || e.key === 'M') { cfg.sound = !cfg.sound; ambient(cfg.sound && !!Game.m && !Game.fin); } });   // M = silenciar/ativar
// Motor 3D (Three.js + GLB) é o motor do jogo. O procedural (scene3d.js) só é usado com ?engine=2d (ou no jogar.html, que define window.ENGINE = '2d').
// Se o 3D falhar, o jogo NÃO troca de motor em silêncio: mostra o motivo e deixa o jogador escolher tentar de novo ou abrir o motor antigo.
function engineError(err) {
  const m = String(err && err.message || err), why = /dynamically imported|resolve module|Failed to fetch/.test(m) ? 'Three.js ou o modelo não foram encontrados (abra o jogo por um servidor local; rode: node tools/check-3d-setup.mjs).' : /WebGL/i.test(m) ? 'Este navegador/computador não liberou o WebGL.' : m.split('\n')[0].slice(0, 160);
  const d = document.createElement('div'); d.id = 'engine-error'; d.innerHTML = `<div class="box"><h2>Não foi possível abrir o jogo em 3D</h2><p>${why}</p><button id="ee-retry">TENTAR DE NOVO</button><button id="ee-2d" class="sec">USAR O MOTOR ANTIGO (2D)</button></div>`;
  Object.assign(d.style, { position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,10,20,.88)', zIndex: 50, textAlign: 'center' }); app.appendChild(d);
  d.querySelector('#ee-retry').onclick = () => location.reload(); d.querySelector('#ee-2d').onclick = () => { const u = new URL(location.href); u.searchParams.set('engine', '2d'); location.href = u.href; };
}
if ((new URLSearchParams(location.search).get('engine') || window.ENGINE) !== '2d') {
  import('./three/engine.js').then(m => m.start({ cv })).then(() => console.info('Motor 3D (Three.js/GLB) ativo.')).catch(err => { console.error('Motor 3D indisponível:', err); engineError(err); });
}
menu();
window.JOGO = { GS, Events, Game, DBG };   // depuração/integração: JOGO.GS.placar, JOGO.Events.on('gol', ...)
