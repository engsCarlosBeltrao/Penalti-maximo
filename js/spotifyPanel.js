// Tela "Músicas e Torcidas" (Spotify): cada clube tem a própria lista de links (faixas e playlists). Adicionar, editar, remover, reordenar e ABRIR
// fora do jogo — no aplicativo Spotify do Windows (URI oficial) ou no navegador. Nada toca dentro do jogo nem durante a partida. Salvo em settingsStore.
import { Store } from './settingsStore.js';
import { redirectUri, clientIdOk } from './spotifyControle.js';
import { TIPOS, parseSpotify, adicionar, editar, remover, mover, buscaMeta, abrirNoApp, abrirNoNavegador, urlDe } from './spotify.js';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function telaSpotify({ ui, show, TEAMS, clube: c0, voltar, abas = '', onAbas = null, SpotifyC = null, nota: nota0 = '', Torcida = null }) {   // abas/onAbas: dentro da tela Músicas e Torcidas (js/torcidaPanel.js)
  let clube = c0 || TEAMS[0].key, editando = null, removendo = null, nota = nota0 || '', notaTipo = nota0 ? (/conectado/.test(nota0) ? 'ok' : 'err') : '', ocupado = false, verConta = !SpotifyC?.conectado(), testando = false;
  const ITENS = [{ key: 'menu', nome: 'Músicas do Menu', sigla: 'MENU', menu: true }, ...TEAMS];   // 'menu' = músicas do menu principal (no lugar de um clube)
  const imgDe = (x, cls = '') => x.menu ? `<span class="sp-mn ${cls}">♪<small>MENU</small></span>` : `<img src="assets/crests/${x.key}.png" alt="${esc(x.sigla)}">`;
  const lista = () => Store.data.spotify ||= {}, T = k => ITENS.find(t => t.key === k);
  const salvar = () => { if (!Store.save()) { nota = Store.warning || 'Não foi possível salvar.'; notaTipo = 'err'; } };
  const avisa = (m, tipo = '') => { nota = m; notaTipo = tipo; };
  function conta() {
    if (!SpotifyC) return '<p class="sp-sub">Links do Spotify por clube · abrem no <b>aplicativo Spotify do Windows</b> (ou no navegador).</p>';
    const on = SpotifyC.conectado(), u = SpotifyC.usuario;
    if (on && !verConta) return `<div class="sp-conta on"><span class="sp-dot"></span><b>SPOTIFY CONECTADO</b><span>${u ? esc(u.nome) + (u.premium === false ? ' · <em>conta sem Premium: o Spotify não deixa o jogo controlar</em>' : '') : 'O jogo toca e pausa as músicas no app do PC (Regras da partida → Fonte: Spotify).'}</span>${Torcida ? `<button class="sm" id="sp-teste">${testando && Torcida.estado === 'tocando' ? '■ PARAR TESTE' : '▶ TESTAR'}</button>` : ''}<button class="sm sec" id="sp-cfg">CONTA</button></div>`;
    return `<div class="sp-conta"><div class="sp-passos"><b>CONECTAR O SPOTIFY</b> (para o jogo tocar e pausar a música no app do PC · precisa de <b>Premium</b>)<ol><li>Entre em <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">developer.spotify.com/dashboard</a> → <b>Create app</b> (Web API).</li><li>Em <b>Redirect URI</b> coloque exatamente: <code id="sp-ru">${esc(redirectUri())}</code> <button class="sm sec" id="sp-copia">COPIAR</button></li><li>Copie o <b>Client ID</b> do app, cole abaixo e clique em CONECTAR (o login é na página do Spotify).</li></ol></div>
      <div class="sp-cid"><input id="sp-cidv" value="${esc(SpotifyC.clientId())}" placeholder="Client ID (32 caracteres)" maxlength="40" aria-label="Client ID do Spotify"><button class="sm" id="sp-con">CONECTAR</button>${on ? '<button class="sm sec" id="sp-des">DESCONECTAR</button><button class="sm sec" id="sp-fecha">FECHAR</button>' : ''}</div></div>`;
  }
  function ligaConta() {
    if (!SpotifyC) return; const $ = id => document.getElementById(id);
    if ($('sp-cfg')) $('sp-cfg').onclick = () => { verConta = true; desenha('#sp-cidv'); };
    if ($('sp-teste')) $('sp-teste').onclick = async () => { if (testando && Torcida.estado === 'tocando') { testando = false; Torcida.parar(); avisa('Teste parado.', 'ok'); return desenha('#sp-teste'); }   // toca AGORA o 1º link do item selecionado, pelo mesmo caminho da partida
      const l = lista()[clube] || []; if (!l.length) { avisa(`Cadastre um link em ${T(clube).nome} para testar.`, 'err'); return desenha('#sp-link'); }
      avisa('Mandando o Spotify tocar…'); desenha(); const ok = await Torcida.tocarFaixa(clube, l[0].id); testando = ok; avisa(ok ? `Tocando no Spotify: ${l[0].nome}. Ouviu? Então está tudo certo.` : 'Não tocou: ' + (Torcida.motivo || SpotifyC.msg), ok ? 'ok' : 'err'); desenha('#sp-teste'); };
    if ($('sp-fecha')) $('sp-fecha').onclick = () => { verConta = false; desenha(); };
    if ($('sp-copia')) $('sp-copia').onclick = () => { navigator.clipboard?.writeText(redirectUri()).then(() => { avisa('Endereço copiado.', 'ok'); desenha(); }, () => { avisa('Copie o endereço manualmente.', 'err'); desenha(); }); };
    if ($('sp-des')) $('sp-des').onclick = () => { SpotifyC.desconectar(); avisa('Spotify desconectado.', 'ok'); desenha(); };
    if ($('sp-con')) $('sp-con').onclick = async () => { const id = $('sp-cidv').value.trim(); if (!clientIdOk(id)) { avisa('Client ID inválido: são 32 letras/números (aparece na página do seu app no Spotify).', 'err'); return desenha('#sp-cidv'); }
      SpotifyC.salvaClientId(id); avisa('Abrindo o login do Spotify…'); desenha(); await SpotifyC.conectar(); };
    if (SpotifyC.conectado() && !SpotifyC.usuario && !SpotifyC._buscando) { SpotifyC._buscando = true; SpotifyC.quemSou().then(() => { SpotifyC._buscando = false; if (ui.contains(document.querySelector('.sp-conta'))) desenha(); }); }
  }
  function linha(e, i, n) {
    if (editando === e.id) return `<div class="sp-item ed" data-id="${e.id}"><div class="sp-capa">${e.capa ? `<img src="${esc(e.capa)}" alt="">` : '♪'}</div>
      <div class="sp-form"><input id="sp-en" value="${esc(e.nome)}" maxlength="80" aria-label="Nome da música" placeholder="Nome"><input id="sp-el" value="${esc(urlDe(e))}" aria-label="Link do Spotify" placeholder="https://open.spotify.com/track/..."></div>
      <div class="sp-bts"><button class="sm" data-a="salvar">SALVAR</button><button class="sm sec" data-a="cancelar">CANCELAR</button></div></div>`;
    return `<div class="sp-item" data-id="${e.id}"><div class="sp-capa">${e.capa ? `<img src="${esc(e.capa)}" alt="" onerror="this.remove()">` : '♪'}</div>
      <div class="sp-txt"><b>${esc(e.nome)}</b><span><em>${TIPOS[e.tipo]}</em>${e.autor ? ' · ' + esc(e.autor) : ''}</span><a class="sp-link" href="${esc(urlDe(e))}" target="_blank" rel="noopener" tabindex="-1">${esc(urlDe(e).replace('https://', ''))}</a></div>
      <div class="sp-bts">${removendo === e.id ? `<span class="sp-conf">Remover?</span><button class="sm" data-a="rem-sim">SIM</button><button class="sm sec" data-a="rem-nao">NÃO</button>`
        : `<button class="sm sp-abre" data-a="app">▶ ABRIR NO SPOTIFY</button><button class="sm sec" data-a="web">NAVEGADOR</button><button class="sm sec" data-a="editar">EDITAR</button><button class="sm sec sp-ico" data-a="cima" ${i ? '' : 'disabled'} aria-label="Subir">▲</button><button class="sm sec sp-ico" data-a="baixo" ${i < n - 1 ? '' : 'disabled'} aria-label="Descer">▼</button><button class="sm sec" data-a="remover">REMOVER</button>`}</div></div>`;
  }
  function desenha(foco) {
    const t = T(clube), l = lista()[clube] || [];
    show(`<div class="sp"><h2>Músicas e Torcidas</h2>${abas}${conta()}
      <div class="sp-clubes">${ITENS.map(x => `<button class="sp-cl${x.key === clube ? ' on' : ''}${x.menu ? ' mn' : ''}" data-cl="${x.key}" title="${esc(x.nome)}">${imgDe(x)}${(lista()[x.key] || []).length ? `<i>${lista()[x.key].length}</i>` : ''}</button>`).join('')}</div>
      <div class="box sp-box"><div class="sp-topo">${imgDe(t, 'g')}<div><b>${esc(t.nome)}</b><span>${l.length ? `${l.length} ${l.length > 1 ? 'músicas cadastradas' : 'música cadastrada'}` : 'Nenhuma música cadastrada para este clube.'}</span></div></div>
        <div class="sp-lista">${l.map((e, i) => linha(e, i, l.length)).join('')}</div>
        <div class="sp-add"><input id="sp-link" placeholder="Cole o link do Spotify (faixa ou playlist): https://open.spotify.com/track/..." aria-label="Link do Spotify"><input id="sp-nome" placeholder="Nome (opcional)" maxlength="80" aria-label="Nome da música"><button id="sp-add" class="sm"${ocupado ? ' disabled' : ''}>+ ADICIONAR MÚSICA</button></div></div>
      <p class="note sp-nota ${notaTipo}" id="sp-nota">${esc(nota)}</p><button id="b" class="sec" data-voltar>VOLTAR</button></div>`);
    ui.querySelectorAll('.sp-cl').forEach(b => b.onclick = () => { clube = b.dataset.cl; editando = removendo = null; avisa(''); desenha(`[data-cl="${clube}"]`); });
    ui.querySelectorAll('.sp-item [data-a]').forEach(b => b.onclick = () => acao(b.dataset.a, b.closest('.sp-item').dataset.id));
    document.getElementById('sp-add').onclick = add; document.getElementById('sp-link').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); add(); } };
    document.getElementById('b').onclick = voltar; onAbas?.(); ligaConta();
    const el = foco && ui.querySelector(foco); if (el) el.focus();
  }
  async function add() {
    const link = document.getElementById('sp-link').value, nome = document.getElementById('sp-nome').value.trim(), p = parseSpotify(link);
    if (!p.ok) { avisa(p.error, 'err'); return desenha('#sp-link'); }
    ocupado = true; avisa('Buscando nome e capa no Spotify…'); desenha();
    const meta = await buscaMeta(link); ocupado = false;
    const r = adicionar(lista(), clube, link, nome, meta || {});
    if (!r.ok) { avisa(r.error, 'err'); return desenha('#sp-link'); }
    salvar(); if (notaTipo !== 'err') avisa(meta ? `Adicionada: ${r.entrada.nome}` : `Adicionada: ${r.entrada.nome} (sem capa: o Spotify não respondeu; o nome pode ser editado).`, 'ok'); desenha('#sp-link');
  }
  async function acao(a, id) {
    const l = lista()[clube] || [], e = l.find(x => x.id === id); if (!e) return;
    if (a === 'app') { avisa('Abrindo no aplicativo Spotify… (o navegador pode pedir confirmação)'); desenha(`[data-id="${id}"] [data-a="app"]`);
      const abriu = await abrirNoApp(e); avisa(abriu ? `Aberto no Spotify: ${e.nome}` : 'O aplicativo Spotify não respondeu. Ele está instalado? Use NAVEGADOR para abrir no site.', abriu ? 'ok' : 'err'); return desenha(`[data-id="${id}"] [data-a="${abriu ? 'app' : 'web'}"]`); }
    if (a === 'web') { abrirNoNavegador(e); avisa(`Aberto no navegador: ${e.nome}`, 'ok'); return desenha(`[data-id="${id}"] [data-a="web"]`); }
    if (a === 'editar') { editando = id; removendo = null; avisa(''); return desenha('#sp-en'); }
    if (a === 'cancelar') { editando = null; avisa(''); return desenha(`[data-id="${id}"] [data-a="editar"]`); }
    if (a === 'salvar') { const link = document.getElementById('sp-el').value, nome = document.getElementById('sp-en').value, p = parseSpotify(link);
      if (!p.ok) { avisa(p.error, 'err'); return desenha('#sp-el'); }
      const meta = p.url !== urlDe(e) ? await buscaMeta(link) : null, r = editar(lista(), clube, id, { link, nome, meta });
      if (!r.ok) { avisa(r.error, 'err'); return desenha('#sp-el'); } editando = null; salvar(); avisa(`Salvo: ${r.entrada.nome}`, 'ok'); return desenha(`[data-id="${id}"] [data-a="editar"]`); }
    if (a === 'remover') { removendo = id; return desenha(`[data-id="${id}"] [data-a="rem-nao"]`); }
    if (a === 'rem-nao') { removendo = null; return desenha(`[data-id="${id}"] [data-a="remover"]`); }
    if (a === 'rem-sim') { remover(lista(), clube, id); removendo = null; salvar(); avisa(`Removida: ${e.nome}`, 'ok'); return desenha('#sp-link'); }
    if (a === 'cima' || a === 'baixo') { mover(lista(), clube, id, a === 'cima' ? -1 : 1); salvar(); return desenha(`[data-id="${id}"] [data-a="${a}"]`); }
  }
  desenha();
}
