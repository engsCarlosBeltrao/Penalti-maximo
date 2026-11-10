// Interface: menu, seleção de times/jogadores, playlist, configurações, campeonato e telas de resultado.
import { Game, cfg } from './game.js';
import { DBG } from './debug.js';
import { GS } from './gameState.js';
import { Events } from './events.js';
import { Arduino } from './arduino.js';
import { TEAMS, CRESTS, CREST_INFO } from './teams.js';
import { squad } from './players.js';
import { Cup } from './tournament.js';
import { Music } from './musicPlayer.js';
import { Store } from './settingsStore.js';
import { telaMusicas } from './torcidaPanel.js';   // Músicas e Torcidas: arquivos das torcidas (tocados pelo jogo) + links do Spotify (o antigo painel do YouTube, js/musicPanel.js, não é mais usado)
import { criaPlayer } from './torcidas.js';
import { criaControle } from './spotifyControle.js';   // Spotify pela API oficial (Premium + login do usuário): o jogo manda o app do PC tocar/pausar
import { sfx, ambient } from './audio.js';
import { telaArcade } from './hardware/painel.js';
import { Renderer } from './renderer.js';
import { loadKitPack, packMeta } from './three/kitPack.js';
import { vitorias, somaVitoria } from './vitorias.js';
const ui = document.getElementById('ui'), cv = document.getElementById('cv'), app = document.getElementById('app'), back = document.getElementById('back');
let sel = { a: null, b: null }, uni = [null, null], escolha = [null, null], cup = null, mode = 'solo', me = null;
// --- layout: UI lógica 960x540 escalada; canvas com resolução interna × devicePixelRatio ---
function fit() { const narrow = window.innerWidth < 820; ui.classList.toggle('flow', narrow); document.body.classList.toggle('narrow', narrow); const s = narrow ? 1 : app.clientWidth / 960, d = window.devicePixelRatio || 1; ui.style.transform = narrow ? 'none' : `scale(${s})`; const cs = app.clientWidth / 960; cv.width = Math.round(960*cs*d); cv.height = Math.round(540*cs*d); }
window.addEventListener('resize', fit); fit();
const fallback = t => `<svg viewBox="0 0 46 54"><path d="M3 3h40v26c0 13-12 20-20 23C15 49 3 42 3 29z" fill="#2a3b52" stroke="#8da2bd" stroke-width="2"/><text x="23" y="32" font-size="14" font-weight="900" text-anchor="middle" fill="#fff">${t.sigla}</text></svg>`;
// escudo: só pede o PNG se a key estiver em CRESTS (teams.js) → sem erros 404 quando o arquivo não existe
const crest = t => CRESTS.includes(t.key) ? `<img src="assets/crests/${t.key}.png" alt="${t.sigla}" title="${t.nome}" onerror="this.outerHTML=''">` : fallback(t);
const MOLDURA = `<div class="tl-logo" aria-hidden="true"><b>PÊNALTI</b> <b>MÁXIMO</b></div><div class="tl-teclas" aria-hidden="true"><span><kbd class="seta">▲</kbd><kbd class="seta">▼</kbd><kbd class="seta">◀</kbd><kbd class="seta">▶</kbd> Navegar / ajustar</span><span><kbd>ENTER</kbd> Selecionar</span><span><kbd>ESC</kbd> Voltar</span><span><kbd>M</kbd> Som</span></div>`;   // logo e legenda das telas internas (no estilo da tela inicial)
const show = h => { const fl = window.innerWidth < 820; ui.className = fl ? 'flow tela' : 'tela'; ui.navTela = null; ui.innerHTML = h + (fl ? '' : MOLDURA); back.hidden = true; vitrine(); };
const hide = () => { ui.className = 'off'; back.hidden = false; };
const on = (id, f) => { const e = document.getElementById(id); if (e) e.onclick = f; };
const T = i => TEAMS[i];
Store.load(); Store.carregaDisco();   /* junta as músicas salvas em arquivo (dados/musicas-salvas.json) com as do navegador */ Game.init(cv); Music.init();
// MÚSICAS DAS TORCIDAS: um único player do jogo, ligado aos eventos da partida (js/torcidas.js); para ao sair da partida / voltar ao menu
const SpotifyC = criaControle();
const Torcida = criaPlayer({ spotify: SpotifyC, store: () => Store.data, Audio: typeof Audio !== 'undefined' ? Audio : null, url: b => URL.createObjectURL(b), livre: u => URL.revokeObjectURL(u), pausaOutras: () => { if (Music.playing) Music.pause(); } });
Torcida.liga(Events, GS);
// o navegador só libera som depois do 1º clique/tecla: nessa hora começa a música do menu (arquivos); pelo Spotify não precisa esperar
const liberaSom = () => { if (GS.estado === 'MENU' && Torcida.estado !== 'tocando') Torcida.tocarMenu(); };
document.addEventListener('pointerdown', liberaSom, { once: true }); document.addEventListener('keydown', liberaSom, { once: true });
// AVISO NA TELA (partida): só qual música começou a tocar. Problemas (clube sem música, Spotify fechado, sem Premium...) não aparecem para o
// jogador durante a partida — ficam em Músicas e Torcidas → Diagnóstico.
const aviso = document.createElement('div'); aviso.id = 'tocando'; aviso.hidden = true; app.appendChild(aviso); let avisoT = null, ultimoAviso = '';
Torcida.ouvir(P => { if (!Game.m) return; const t = TEAMS.find(x => x.key === P.clube || x.key === P.semMusica);
  const msg = P.estado === 'tocando' && P.faixa ? `♪ ${P.faixa.nome}${t ? ' — ' + t.nome : ''}${P._fonte === 'spotify' ? ' (Spotify)' : ''}` : '';
  if (!msg || msg === ultimoAviso) return; ultimoAviso = msg; aviso.textContent = msg; aviso.className = P.estado === 'erro' ? 'erro' : ''; aviso.hidden = false; clearTimeout(avisoT); avisoT = setTimeout(() => { aviso.hidden = true; ultimoAviso = ''; }, P.estado === 'erro' ? 7000 : 3500); });   // o gerenciador do YouTube (js/audioManager.js) não é mais iniciado: nada de música externa tocando no jogo ou na partida
// ---- PAUSA (botões PAUSA/DESPAUSA do arcade, tecla P ou Esc): congela a partida; SAIR exige confirmação ----
const pz = document.createElement('div'); pz.id = 'pausa'; pz.hidden = true; app.appendChild(pz);
const pausa = {
  aberta: () => !pz.hidden,
  abrir() { if (!Game.pausar()) return; pz.hidden = false; pausa.tela(); },
  tela(conf = false) { pz.innerHTML = conf ? `<h1>SAIR DA PARTIDA?</h1><p>O resultado desta partida será perdido.</p><button id="pz-sim">SIM, SAIR</button><button id="pz-nao" class="sec" data-voltar>NÃO, VOLTAR</button>`
      : `<h1>JOGO PAUSADO</h1><p>${GS.equipes[0]?.nome || ''} ${GS.placar[0]} x ${GS.placar[1]} ${GS.equipes[1]?.nome || ''}</p><button id="pz-cont">CONTINUAR</button><button id="pz-sair" class="sec">SAIR DA PARTIDA</button>`;
    on('pz-cont', () => pausa.fechar()); on('pz-sair', () => pausa.tela(true)); on('pz-nao', () => pausa.tela(false));
    on('pz-sim', () => { pausa.fechar(false); Game.stop(); Music.setMode('menu'); menu(); }); },
  fechar(retomar = true) { pz.hidden = true; pz.innerHTML = ''; if (retomar) Game.retomar(); },
  voltar() { if (pz.querySelector('#pz-nao')) pausa.tela(false); else pausa.fechar(); }   // VOLTAR na pausa: sai da confirmação ou volta ao jogo
};
window.addEventListener('keydown', e => { if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && Game.m && !Game.fin && ui.className === 'off') { e.preventDefault(); pausa.aberta() ? pausa.fechar() : pausa.abrir(); } });
Arduino.iniciar({ game: Game, pausa, raizes: () => [pz, ui], emMenu: () => ui.className !== 'off' });
back.onclick = () => { if (pausa.aberta()) pausa.fechar(false); Game.stop(); Music.setMode('menu'); menu(); };
document.addEventListener('pointerdown', () => { if (!Music.playing && !Music.msg && Music.tracks.length && !GS.equipes[0]?.jogando) Music.play(); }, { once: true });

// TELA INICIAL: estádio 3D em tela cheia com o cobrador principal do time de costas no lado direito (vitrine: js/frame.js), menu em coluna
// na esquerda. Cada opção chama a MESMA função de antes; a navegação (setas/Enter/Esc e os botões do arcade) é o Navegador do Arduino.
const OPCOES = [
  ['solo', 'JOGAR SOZINHO', 'Você cobra e defende contra a CPU, 5 cobranças por time.'],
  ['duo', 'JOGAR COM ALGUÉM', 'Dois jogadores no mesmo computador alternam as cobranças.'],
  ['cp', 'CAMPEONATO', 'Fase de grupos e mata-mata até a final.'],
  ['tm', 'ESCOLHER TIMES', 'Time do Jogador 1 e do adversário (ou do Jogador 2).'],
  ['pj', 'ESCOLHER JOGADORES', 'Escolha quem cobra pelo seu time.'],
  ['pl', 'MÚSICAS E TORCIDAS', 'Músicas das torcidas (seus arquivos MP3/WAV/OGG) tocadas na partida, e links do Spotify.'],
  ['cf', 'CONFIGURAÇÕES', 'Velocidade da mira, dificuldade do goleiro e volumes.'],
  ['hw', 'COMO JOGAR', 'Controles de cobrança e de defesa, regras da disputa.'],
  ['ar', 'ARCADE / ARDUINO', 'Conecte o painel de botões e o LCD do arcade.']];
const ACOES = { solo: () => need('solo'), duo: () => need('duo'), cp: () => need('copa'), tm: () => selecao({ lados: 2, fim: 'menu' }), pj: () => pickPlayers(),
  pl: () => telaMusicas({ ui, show, TEAMS, clube: sel.a != null ? T(sel.a).key : null, voltar: menu, Torcida, SpotifyC }), cf: () => settings(), hw: () => how(), ar: () => telaArcade({ show, on, voltar: menu, Arduino }) };
let vitrineTime = null, ultimaOpcao = 'solo';
function vitrine() {                                                     // jogador do time escolhido (ou do 1º time) na frente da torcida desse time
  const t = T(sel.a ?? 0); if (vitrineTime !== t.id && Renderer.setTeams) { vitrineTime = t.id; Renderer.setTeams(t, T(sel.b ?? (t.id === 0 ? 1 : 0))); }
  Game.vitrine = { time: t, escolha: escolha[0], t: Game.vitrine?.t ?? 0 }; }
const ardTexto = () => Arduino.conectado ? ['ok', 'ARDUINO CONECTADO'] : Arduino.estado === 'conectando' ? ['warn', 'ARDUINO CONECTANDO'] : ['off', 'ARDUINO DESCONECTADO'];
function menu() { GS.estado = 'MENU'; Music.onChange = null; Torcida.onChange = null; Torcida.tocarMenu(); Music.setMode('menu'); vitrine();
  const ta = sel.a != null ? T(sel.a) : null, tb = sel.b != null ? T(sel.b) : null, [ac, at] = ardTexto();
  show(`<div class="mm"><div class="mm-luz"></div><div class="mm-sombra"></div>
  <div class="mm-logo"><span class="mm-bola"></span><div><b>PÊNALTI</b><b>MÁXIMO</b></div></div>
  <nav class="mm-lista">${OPCOES.map(([id, nome, d], i) => `<button id="${id}" class="mi${i < 3 ? ' mi-p' : ''}" data-d="${d}"><i></i><span>${nome}</span></button>${i === 2 ? '<hr class="mm-sep">' : ''}`).join('')}</nav>
  <div class="mm-info"><div class="mm-tag">${ta ? 'PARTIDA' : 'BEM-VINDO'}</div><h3>${ta ? `${ta.nome} <em>x</em> ${tb ? tb.nome : 'sorteio'}` : 'Segure, espere a seta e solte.'}</h3><p id="mm-d"></p></div>
  <div class="mm-topo">${ta ? `<span class="mm-time">${crest(ta)}${ta.nome}</span>` : ''}<span class="mm-ard ${ac}"><i></i>${at}</span></div>
  <div class="mm-teclas"><span><kbd class="seta">▲</kbd><kbd class="seta">▼</kbd> Navegar</span><span><kbd>ENTER</kbd> Selecionar</span><span><kbd>ESC</kbd> Voltar</span><span><kbd>M</kbd> Som</span></div></div>`);
  ui.classList.remove('tela'); ui.classList.add('home'); ui.querySelectorAll('.tl-logo,.tl-teclas').forEach(e => e.remove()); const d = document.getElementById('mm-d');
  const destaca = b => { d.textContent = b.dataset.d; d.classList.remove('in'); void d.offsetWidth; d.classList.add('in'); ultimaOpcao = b.id; };
  const obs = new MutationObserver(ms => ms.forEach(m => m.target.classList.contains('nav-foco') && destaca(m.target)));   // destaque vem do Navegador (teclado, mouse ou arcade)
  ui.querySelectorAll('.mi').forEach(b => { obs.observe(b, { attributes: true, attributeFilter: ['class'] }); b.onmouseenter = () => Arduino.nav ? Arduino.nav.marca(b) : destaca(b);
    b.onclick = () => { b.classList.add('pick'); ui.classList.add('saindo'); setTimeout(() => ACOES[b.id](), 140); }; });   // feedback rápido e a mesma ação de antes
  const ini = document.getElementById(ultimaOpcao) || document.getElementById('solo'); destaca(ini); Arduino.nav?.marca(ini); }
// teclado nos menus (mesmo Navegador dos botões do arcade): setas, Enter, Esc/Backspace = voltar
window.addEventListener('keydown', e => { if (ui.className.includes('off') || pausa.aberta()) return;
  if (ui.navTela) { const c = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', Enter: 'OK', Escape: 'BACK', Backspace: 'BACK' }[e.key]; if (c) { e.preventDefault(); ui.navTela(c); } return; }   // seleção de times: as teclas são da própria tela
  if (!Arduino.nav) return;
  if (e.key === 'Escape' && /^(INPUT|TEXTAREA)$/.test(e.target?.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox') { e.target.blur(); return; }   // Esc num campo de texto: só sai do campo const t = e.target, campo = t && (t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
  const dir = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' }[e.key];
  if (dir && !campo) { e.preventDefault(); Arduino.nav.mover(dir); } else if (e.key === 'Enter' && !campo && t?.tagName !== 'BUTTON') { e.preventDefault(); Arduino.nav.confirmar(); } else if (e.key === 'Escape' || (e.key === 'Backspace' && !campo)) { if (Arduino.nav.voltar()) e.preventDefault(); } });
function need(m) { mode = m; selecao({ lados: m === 'copa' ? 1 : 2, fim: m === 'copa' ? 'copa' : 'jogar' }); }
function pickTeam(slot, title, next) { GS.estado = 'SELECAO_EQUIPE';
  show(`<h2>${title}</h2><div class="grid">${TEAMS.map(t => `<div class="card" data-i="${t.id}">${crest(t)}<br>${t.nome}</div>`).join('')}</div><button id="b" class="sec">VOLTAR</button>`);
  ui.querySelectorAll('.card').forEach(c => c.onclick = () => { sel[slot] = +c.dataset.i; if (slot === 'a') escolha[0] = null; else escolha[1] = null; next(); }); on('b', menu); }
function pickPlayers() { if (sel.a == null) return pickTeam('a', 'Primeiro escolha o time do Jogador 1', pickPlayers);
  const slots = sel.b == null ? [0] : [0, 1], one = s => { const t = T(s ? sel.b : sel.a), sq = squad(t);
    show(`<h2>Cobrador — ${t.nome} (${sq.filter(p => !p.pending).length} confirmados)</h2><div class="box"><div class="pl"><button data-p="" class="sec">★ AUTOMÁTICO</button>${sq.map(p => `<button data-p="${p.id}" ${p.isStar ? '' : 'class="sec"'}>${p.isStar ? '★ ' : ''}${p.pending ? 'Pendente' : (p.nickname || p.name)} · ${p.jerseyNumber ?? '?'} · ${p.rating}</button>`).join('')}</div><p style="font-size:12px;margin-top:8px">Elencos verificados: só atletas com fonte e data em js/players.js. "Pendente" = elenco não verificado; "?" = camisa não confirmada. Dados e fontes em js/lineups/clubs/.</p></div><button id="b" class="sec">VOLTAR</button>`);
    ui.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { escolha[s] = b.dataset.p || null; s < slots.length - 1 ? one(s + 1) : menu(); }); on('b', menu); }; one(0); }
function launch() { if (mode === 'copa') { cup = new Cup(sel.a); return cupScreen(); } const b = mode === 'duo' ? sel.b : (sel.b ?? T(sel.a).id === 0 ? 1 : 0); versus(sel.a, mode === 'duo' || sel.b != null ? sel.b : [...TEAMS.keys()].filter(i => i !== sel.a)[Math.floor(Math.random() * 19)]); }
// time com o uniforme confirmado na seleção (t.uni: home | away | third; js/frame.js → uniDe). No campeonato o adversário usa o padrão.
const comUni = (i, lado) => { const u = lado === 0 ? (i === sel.a ? uni[0] : null) : (mode !== 'copa' && i === sel.b ? uni[1] : null); return u ? { ...T(i), uni: u } : T(i); };
// ===== SELEÇÃO DE TIMES E UNIFORMES: Jogador 1 escolhe clube (◀ ▶) → Enter → uniforme (◀ ▶) → Enter (confirmado e travado) → Jogador 2 faz o mesmo →
// confronto com os dois escudos e uniformes → Enter inicia. Esc volta uma etapa. O fundo 3D mostra os dois cobradores com os uniformes (js/frame.js → duelo).
const UNIS = [['home', '1º UNIFORME', 'CASA'], ['away', '2º UNIFORME', 'FORA'], ['third', '3º UNIFORME', 'ALTERNATIVO']];
const escudoImg = t => `<img src="assets/crests/${t.key}.png" alt="${t.nome}" class="${CREST_INFO[t.key] === 'pack' ? 'pq' : ''}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'sx-sigla',textContent:'${t.sigla}'}))">`;
const PRELOAD = new Map(); const preCarrega = () => TEAMS.forEach(t => { if (!PRELOAD.has(t.key)) { const im = new Image(); im.src = `assets/crests/${t.key}.png`; PRELOAD.set(t.key, im); } });   // cache: os 20 escudos carregados uma vez só
function dadosTime(t) { const sq = squad(t).filter(p => !p.pending), r = sq.map(p => p.rating), best = sq.slice().sort((a, b) => b.rating - a.rating)[0];
  return { n: sq.length, media: r.length ? Math.round(r.reduce((a, b) => a + b, 0)/r.length) : null, top: r.length ? Math.max(...r) : null, craque: best ? (best.nickname || best.name) : '—', vit: vitorias(t.key) }; }
function selecao({ lados, fim }) {
  GS.estado = 'SELECAO_EQUIPE'; preCarrega(); loadKitPack().then(() => desenha());
  const solo = mode === 'solo' && fim === 'jogar', i0 = sel.a ?? 0, L = [{ i: i0, uni: uni[0] || 'home', etapa: 'clube' }];
  if (lados === 2) L.push({ i: sel.b ?? (i0 === 0 ? 1 : 0), uni: uni[1] || 'away', etapa: 'clube' });
  let vez = 0, pronto = false, aviso = '';
  const nomeJog = k => k === 0 ? 'JOGADOR 1' : solo ? 'ADVERSÁRIO (CPU)' : fim === 'menu' ? 'JOGADOR 2 / ADVERSÁRIO' : 'JOGADOR 2';
  show(`<div class="sx${lados === 1 ? ' um' : ''}"><div class="sx-topo"><div class="sx-tit">SELECIONAR TIMES</div><div class="sx-vez" id="sx-vez"></div></div>
    ${L.map((_, k) => `<div class="sx-lado sx-${k ? 'b' : 'a'}" id="sx-${k}"><div class="sx-jog">${nomeJog(k)}</div><div class="sx-nome"></div>
      <div class="sx-esc"><button class="sx-seta" data-k="${k}" data-d="-1" aria-label="anterior">◀</button><div class="sx-escudo"></div><button class="sx-seta" data-k="${k}" data-d="1" aria-label="próximo">▶</button></div>
      <div class="sx-uni"><button class="sx-seta" data-k="${k}" data-d="-1" aria-label="uniforme anterior">◀</button><div><span class="sx-un"></span><span class="sx-ut"></span></div><button class="sx-seta" data-k="${k}" data-d="1" aria-label="próximo uniforme">▶</button></div><div class="sx-pecas"></div><div class="sx-ok">✔ CONFIRMADO</div></div>`).join('')}
    <div class="sx-centro"><div class="sx-vs">VS</div><div class="sx-attr" id="sx-attr"></div></div>
    <div class="sx-acao"><p class="sx-aviso" id="sx-aviso"></p><button id="sx-go"></button></div><div class="sx-teclas" id="sx-teclas"></div></div>`);
  ui.classList.add('selecao');
  const $ = id => document.getElementById(id), barra = v => v == null ? '' : `<i style="width:${Math.max(4, Math.min(100, (v - 60)*2.5))}%"></i>`;
  function desenha() {
    if (!ui.contains($('sx-0'))) return;
    L.forEach((l, k) => { const t = T(l.i), el = $('sx-' + k), u = UNIS.find(x => x[0] === l.uni), m = packMeta(t.key, l.uni), ativo = !pronto && vez === k;
      el.className = `sx-lado sx-${k ? 'b' : 'a'}${ativo ? ' ativo et-' + l.etapa : ''}${l.etapa === 'ok' ? ' conf' : ''}${!ativo && l.etapa !== 'ok' ? ' espera' : ''}`;
      el.querySelector('.sx-nome').textContent = t.nome;
      const esc = el.querySelector('.sx-escudo'); if (esc.dataset.key !== t.key) { esc.dataset.key = t.key; esc.innerHTML = escudoImg(t); esc.classList.remove('troca'); void esc.offsetWidth; esc.classList.add('troca'); }
      el.querySelector('.sx-un').textContent = u[1]; el.querySelector('.sx-ut').textContent = u[2];
      el.querySelector('.sx-pecas').innerHTML = m ? [['Camisa', m.main], ['Calção', m.shorts], ['Meião', m.socks]].map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('') : '';
      el.querySelectorAll('.sx-esc .sx-seta').forEach(b => b.disabled = !(ativo && l.etapa === 'clube')); el.querySelectorAll('.sx-uni .sx-seta').forEach(b => b.disabled = !(ativo && l.etapa === 'uniforme')); });
    const l = L[vez], quem = nomeJog(vez);
    $('sx-vez').innerHTML = pronto ? '<b>CONFRONTO DEFINIDO</b>' : `<b>VEZ DO ${quem}</b> — ${l.etapa === 'clube' ? (solo && vez === 1 ? 'ESCOLHA O ADVERSÁRIO' : 'ESCOLHA SEU TIME') : 'ESCOLHA O UNIFORME'}`;
    const d = L.map(x => dadosTime(T(x.i)));
    $('sx-attr').innerHTML = lados === 1 ? '<div class="sx-a1">CAMPEONATO</div><p>Fase de grupos e mata-mata. Os adversários são sorteados.</p>'
      : [['VITÓRIAS', 'vit'], ['MÉDIA DO ELENCO', 'media'], ['MELHOR NOTA', 'top'], ['COBRADORES', 'n']].map(([n, k]) => `<div class="sx-at"><span>${d[0][k] ?? '—'}</span><em>${n}</em><span>${d[1][k] ?? '—'}</span>${k === 'n' || k === 'vit' ? '' : `<div class="sx-br e">${barra(d[0][k])}</div><div class="sx-br d">${barra(d[1][k])}</div>`}</div>`).join('')
        + `<div class="sx-craque"><span>★ ${d[0].craque}</span><em>CRAQUE</em><span>★ ${d[1].craque}</span></div>`;
    const go = $('sx-go'); go.textContent = pronto ? (fim === 'menu' ? 'SALVAR E VOLTAR' : fim === 'copa' ? 'COMEÇAR CAMPEONATO' : 'INICIAR PARTIDA') : l.etapa === 'clube' ? 'CONFIRMAR CLUBE' : 'CONFIRMAR UNIFORME';
    go.classList.toggle('pronto', pronto); $('sx-aviso').textContent = aviso; ui.querySelector('.sx').classList.toggle('pronto', pronto);
    $('sx-teclas').innerHTML = (pronto ? `<span><kbd>ENTER</kbd> ${go.textContent}</span>` : `<span><kbd class="seta">◀</kbd><kbd class="seta">▶</kbd> Mudar <b>${l.etapa === 'clube' ? 'CLUBE' : 'UNIFORME'}</b></span><span><kbd>ENTER</kbd> ${l.etapa === 'clube' ? 'Confirmar clube' : 'Confirmar uniforme'}</span>`) + '<span><kbd>ESC</kbd> Voltar etapa</span>';
    Game.vitrine = { ...(Game.vitrine || {}), time: T(L[0].i), duelo: L.map(x => ({ time: T(x.i), uni: x.uni, escolha: x.i === sel.a ? escolha[0] : x.i === sel.b ? escolha[1] : null, tConf: x.tConf })) };
  }
  function muda(k, d) { const l = L[k]; if (pronto || k !== vez || l.etapa === 'ok') return false; aviso = '';
    if (l.etapa === 'clube') { l.i = (l.i + d + TEAMS.length) % TEAMS.length; l.uni = k === 1 && L[0].i === l.i && L[0].uni === 'home' ? 'away' : 'home'; }   // clube novo começa no titular (no reserva, se for o mesmo clube e uniforme do J1)
    else { const j = UNIS.findIndex(x => x[0] === l.uni); l.uni = UNIS[(j + d + 3) % 3][0]; }
    sfx('click'); desenha(); return true; }
  function confirma() { aviso = '';
    if (pronto) return iniciar();
    const l = L[vez];
    if (l.etapa === 'clube') l.etapa = 'uniforme';
    else { if (vez === 1 && L[0].i === l.i && L[0].uni === l.uni) { aviso = 'Mesmo clube e mesmo uniforme do Jogador 1: escolha outro uniforme.'; desenha(); return true; }
      l.etapa = 'ok'; l.tConf = Game.vitrine?.t ?? 0; if (vez < L.length - 1) vez++; else pronto = true; }
    sfx('click'); desenha(); return true; }
  function volta() { aviso = '';
    if (pronto) { pronto = false; L[vez].etapa = 'uniforme'; L[vez].tConf = null; }
    else if (L[vez].etapa === 'uniforme') L[vez].etapa = 'clube';
    else if (vez > 0) { vez--; L[vez].etapa = 'uniforme'; L[vez].tConf = null; }
    else { menu(); return true; }
    desenha(); return true; }
  let saindo = false;
  function iniciar() { if (saindo) return true; saindo = true; const [a, b] = L; if (sel.a !== a.i) escolha[0] = null; sel.a = a.i; uni[0] = a.uni;
    if (b) { if (sel.b !== b.i) escolha[1] = null; sel.b = b.i; uni[1] = b.uni; }
    ui.querySelector('.sx').classList.add('saindo');
    setTimeout(() => { if (fim === 'menu') return menu(); if (fim === 'copa') { cup = new Cup(sel.a); return cupScreen(); }
      hide(); Music.setMode('game'); Game.finalCampeonato = false; Game.start(comUni(sel.a, 0), comUni(sel.b, 1), (win, [x, y], marks) => end(win, x, y, sel.a, sel.b, marks), mode === 'duo', escolha); }, 420); return true; }
  ui.navTela = c => c === 'LEFT' ? muda(vez, -1) : c === 'RIGHT' ? muda(vez, 1) : c === 'OK' ? confirma() : c === 'BACK' ? volta() : true;
  ui.querySelectorAll('.sx-seta').forEach(b => b.onclick = () => muda(+b.dataset.k, +b.dataset.d)); $('sx-go').onclick = () => confirma();
  desenha();
}
function versus(a, b) { me = a; show(`<h2>${mode === 'copa' ? cup.stageName() : mode === 'duo' ? 'Dois jogadores' : 'Amistoso'}</h2><div style="display:flex;gap:30px;align-items:center">${crest(T(a))}<h1>VS</h1>${crest(T(b))}</div><h3>${T(a).nome} x ${T(b).nome}</h3><button id="go">INICIAR DISPUTA</button><button id="b" class="sec">VOLTAR</button>`);
  on('b', menu); on('go', () => { hide(); Music.setMode('game'); Game.finalCampeonato = mode === 'copa' && cup.stageName() === 'Final'; Game.start(comUni(a, 0), comUni(b, 1), (win, [x, y], marks) => end(win, x, y, a, b, marks), mode === 'duo', escolha); }); }
function resumo(marks) { const s = m => m.map(v => `<span style="color:${v === 'g' ? '#38b000' : v === 'd' ? '#4cc9f0' : '#e63946'}">${v === 'g' ? '● gol' : v === 'd' ? '● defesa' : '● fora/trave'}</span>`).join(' '); return `<div class="box" style="font-size:12px">${[0, 1].map(i => `<b>${GS.equipes[i].nome}:</b> ${s(marks[i])}`).join('<br>')}</div>`; }
function end(win, x, y, a, b, marks) { Music.setMode('menu');
  const venc = win ? a : mode === 'duo' ? b : null; if (venc != null) somaVitoria(T(venc).key);   // vitória de um jogador humano com o clube (contra a CPU, só quando o jogador vence)
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
function how() { show(`<h2>Como jogar</h2><div class="box" style="max-width:700px"><b>Cobrando:</b> quando o cobrador fica pronto, aparece a <b>seta</b> no gramado, saindo da bola e <b>oscilando</b> de um lado para o outro. <b>Segure</b> (clique, ESPAÇO ou botão ARCADE) para encher a seta da base até a ponta enquanto a ponta sobe — mais tempo = mais força e chute mais alto. A seta continua oscilando: <b>solte</b> quando ela apontar para onde você quer, e a bola vai nessa direção. Tecla <b>M</b> silencia.<br><b>Defendendo (modo sozinho):</b> setas ← ↑ → logo após o chute adversário.<br><b>Jogar com alguém:</b> dois jogadores no mesmo computador alternam as cobranças com o mouse; os goleiros são da IA.<br><b>Regras:</b> 5 cobranças por time, alternadas; a disputa termina antes se um time não puder mais alcançar o outro; empate vai para morte súbita.<br><b>☰ MENU</b> (canto superior esquerdo) volta ao menu durante a partida.</div><button id="b">VOLTAR</button>`); on('b', menu); }
function settings() { show(`<h2>Configurações</h2><div class="box"><label>Mira horizontal<input id="hs" type="range" min=".4" max="2" step=".1" value="${cfg.hs}"></label><label>Mira vertical<input id="vs" type="range" min=".2" max="1.4" step=".1" value="${cfg.vs}"></label>
<label>Goleiro<select id="df">${['easy', 'normal', 'hard'].map(d => `<option value="${d}" ${cfg.diff === d ? 'selected' : ''}>${{ easy: 'Fácil', normal: 'Normal', hard: 'Difícil' }[d]}</option>`).join('')}</select></label>
<label>Efeitos sonoros<input id="sn" type="checkbox" ${cfg.sound ? 'checked' : ''}></label><label>Volume dos efeitos<input id="vl" type="range" min="0" max="1" step=".1" value="${cfg.vol}"></label><label>Volume da torcida<input id="vc" type="range" min="0" max="1" step=".1" value="${cfg.volCrowd}"></label><label>Volume da música<input id="vm" type="range" min="0" max="1" step=".05" value="${Music.vol}"></label></div><button id="rc" class="sec">REINICIAR CAMPEONATO</button><button id="b">VOLTAR</button>`);
  const bind = (id, k, f) => document.getElementById(id).oninput = e => cfg[k] = f(e.target);
  bind('hs', 'hs', e => +e.value); bind('vs', 'vs', e => +e.value); bind('df', 'diff', e => e.value); bind('sn', 'sound', e => e.checked); bind('vl', 'vol', e => +e.value); bind('vc', 'volCrowd', e => +e.value); document.getElementById('vm').oninput = e => Music.setVol(+e.target.value); on('rc', () => { cup = null; alert('Campeonato reiniciado.'); }); on('b', menu); }
document.addEventListener('click', e => { if (e.target.closest('button,.card')) sfx('click'); });
window.addEventListener('keydown', e => { if (e.key === 'm' || e.key === 'M') { cfg.sound = !cfg.sound; ambient(cfg.sound && !!Game.m && !Game.fin); } });   // M = silenciar/ativar
// Motor do jogo: Three.js + GLB (js/three/engine.js). Se não abrir (sem WebGL, sem servidor, arquivo faltando), mostra o motivo e a opção de tentar de novo.
function engineError(err) {
  const m = String(err && err.message || err), why = /dynamically imported|resolve module|Failed to fetch/.test(m) ? 'Three.js ou o modelo não foram encontrados (abra o jogo por um servidor local; rode: node tools/check-3d-setup.mjs).' : /WebGL/i.test(m) ? 'Este navegador/computador não liberou o WebGL.' : m.split('\n')[0].slice(0, 160);
  const d = document.createElement('div'); d.id = 'engine-error'; d.innerHTML = `<div class="box"><h2>Não foi possível abrir o jogo em 3D</h2><p>${why}</p><button id="ee-retry">TENTAR DE NOVO</button></div>`;
  Object.assign(d.style, { position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,10,20,.88)', zIndex: 50, textAlign: 'center' }); app.appendChild(d);
  d.querySelector('#ee-retry').onclick = () => location.reload();
}
import('./three/engine.js').then(m => m.start({ cv })).then(() => { console.info('Motor 3D (Three.js/GLB) ativo.'); if (!Game.m) vitrine(); }).catch(err => { console.error('Motor 3D indisponível:', err); engineError(err); });
menu();
window.JOGO = { GS, Events, Game, DBG, Arduino, pausa, Torcida, SpotifyC };
// volta do login do Spotify (?code=...): conclui a conexão e reabre Músicas e Torcidas na aba do Spotify
SpotifyC.retornoLogin().then(r => { if (r === null) return; telaMusicas({ ui, show, TEAMS, voltar: menu, Torcida, SpotifyC, aba: 'spotify', nota: r ? 'Spotify conectado.' : SpotifyC.msg }); }).catch(() => {});   // depuração/integração: JOGO.GS.placar, JOGO.Events.on('gol', ...)
