// Tela "Músicas e Torcidas": abas TORCIDAS (arquivos de áudio do usuário por clube, tocados pelo jogo na partida) · REGRAS DA PARTIDA (quais eventos
// tocam, pausa, fim, repetição, volume) · LINKS DO SPOTIFY (só cadastro/abrir fora do jogo, js/spotifyPanel.js). Barra do player sempre visível.
import { Store } from './settingsStore.js';
import { Arquivos, validaArquivo, ACEITA } from './torcidaArquivos.js';
import { adiciona, renomeia, principal, tira, uidT } from './torcidas.js';
import { telaSpotify } from './spotifyPanel.js';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mb = n => n > 0 ? (n/1048576).toFixed(n < 1048576*10 ? 1 : 0) + ' MB' : '';
const EST = { tocando: 'TOCANDO', pausado: 'PAUSADO', parado: 'PARADO', carregando: 'CARREGANDO…', erro: 'ERRO' };
const REP = { todas: 'TODAS', uma: 'UMA', nao: 'NÃO' };
export function telaMusicas(ctx) {
  const { ui, show, TEAMS, voltar, Torcida, SpotifyC } = ctx; const TODOS = TEAMS; let aba = ctx.aba || 'torcidas', clube = ctx.clube || TEAMS[0].key, editando = null, removendo = null, nota = '', notaTipo = '';
  const ITENS = [{ key: 'menu', nome: 'Músicas do Menu', sigla: 'MENU', menu: true }, ...TEAMS];   // 'menu' = músicas do menu principal (no lugar de um clube)
  const imgDe = (x, cls = '') => x.menu ? `<span class="sp-mn ${cls}">♪<small>MENU</small></span>` : `<img src="assets/crests/${x.key}.png" alt="${esc(x.sigla)}">`;
  const T = k => ITENS.find(t => t.key === k), lista = () => Store.data.torcidas ||= {}, R = () => Store.data.torcidaRegras;
  const salvar = () => { if (!Store.save()) { nota = Store.warning || 'Não foi possível salvar.'; notaTipo = 'err'; } };
  const abas = () => `<div class="tabs mu-abas">${[['torcidas', 'TORCIDAS (ARQUIVOS)'], ['regras', 'REGRAS DA PARTIDA'], ['spotify', 'LINKS DO SPOTIFY'], ['diag', 'DIAGNÓSTICO']].map(([k, n]) => `<button class="sm ${aba === k ? '' : 'sec'}" data-aba="${k}">${n}</button>`).join('')}</div>`;
  const ligaAbas = () => ui.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => { aba = b.dataset.aba; editando = removendo = null; nota = ''; desenha(); });
  function barra() {
    const P = Torcida, t = P.clube && T(P.clube), r = R();
    return `<div class="mu-player" id="mu-player"><div class="mu-agora">${t ? `<img src="assets/crests/${t.key}.png" alt="">` : '<span class="mu-nota">♪</span>'}<div><em class="mu-est ${P.estado}">${EST[P.estado] || P.estado}</em><b>${P.faixa ? esc(P.faixa.nome) : 'Nenhuma música tocando'}</b><span>${t ? esc(t.nome) : P.motivo ? esc(P.motivo) : 'Na partida, o jogo toca sozinho conforme as regras.'}</span></div></div>
      <div class="mu-ctl"><button class="sm" data-p="alternar" ${P.clube || P.faixa ? '' : 'disabled'}>${P.estado === 'tocando' ? '❚❚ PAUSAR' : P.estado === 'pausado' ? '▶ CONTINUAR' : '▶ PLAY'}</button><button class="sm sec" data-p="trocar" ${P._fila.length > 1 ? '' : 'disabled'}>⏭ TROCAR</button><button class="sm sec" data-p="parar" ${P.estado === 'parado' ? 'disabled' : ''}>■ PARAR</button>
      <button class="sm sec" data-p="repetir">REPETIR: ${REP[r.repetir]}</button><label class="mu-vol">VOLUME <input type="range" id="mu-vol" min="0" max="1" step=".05" value="${r.volume}"><i>${Math.round(r.volume*100)}%</i></label></div></div>`;
  }
  function ligaBarra() {
    ui.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { const a = b.dataset.p, P = Torcida;
      if (a === 'alternar') P.alternar(); else if (a === 'trocar') P.trocar(); else if (a === 'parar') P.parar();
      else if (a === 'repetir') { const o = ['todas', 'uma', 'nao']; R().repetir = o[(o.indexOf(R().repetir) + 1) % 3]; salvar(); atualizaBarra(); } });
    const v = document.getElementById('mu-vol'); if (v) v.oninput = () => { R().volume = +v.value; Torcida.atualizaVolume(); v.nextElementSibling.textContent = Math.round(+v.value*100) + '%'; }, v && (v.onchange = salvar);
  }
  function atualizaBarra() { const el = document.getElementById('mu-player'); if (!el) return; const foco = document.activeElement?.dataset?.p; el.outerHTML = barra(); ligaBarra(); if (foco) ui.querySelector(`[data-p="${foco}"]`)?.focus(); if (aba === 'torcidas') marcaTocando(); }
  const marcaTocando = () => ui.querySelectorAll('.mu-item').forEach(r => { const on = Torcida.faixa?.id === r.dataset.id && Torcida.estado === 'tocando'; r.classList.toggle('tocando', on); const b = r.querySelector('[data-a="ouvir"]'); if (b) b.textContent = on ? '❚❚ PAUSAR' : '▶ OUVIR'; });
  Torcida.onChange = () => { if (!ui.contains(document.getElementById('mu-player'))) { Torcida.onChange = null; return; } atualizaBarra(); };
  function linha(e) {
    if (editando === e.id) return `<div class="sp-item mu-item ed" data-id="${e.id}"><button class="sm sec mu-star${e.principal ? ' on' : ''}" disabled>★</button><div class="sp-form"><input id="mu-en" value="${esc(e.nome)}" maxlength="80" aria-label="Nome da música"></div><div class="sp-bts"><button class="sm" data-a="salvar">SALVAR</button><button class="sm sec" data-a="cancelar">CANCELAR</button></div></div>`;
    return `<div class="sp-item mu-item" data-id="${e.id}"><button class="sm sec mu-star${e.principal ? ' on' : ''}" data-a="principal" title="${e.principal ? 'Música principal do clube' : 'Tornar principal'}" aria-label="Principal">★</button>
      <div class="sp-txt"><b>${esc(e.nome)}${e.principal ? ' <em class="mu-tag">PRINCIPAL</em>' : ''}</b><span>${esc(e.arquivo)}${e.tamanho ? ' · ' + mb(e.tamanho) : ''}</span></div>
      <div class="sp-bts">${removendo === e.id ? `<span class="sp-conf">Remover?</span><button class="sm" data-a="rem-sim">SIM</button><button class="sm sec" data-a="rem-nao">NÃO</button>`
        : `<button class="sm" data-a="ouvir">▶ OUVIR</button><button class="sm sec" data-a="editar">EDITAR</button><button class="sm sec" data-a="remover">REMOVER</button>`}</div></div>`;
  }
  function telaTorcidas() {
    const t = T(clube), l = lista()[clube] || [];
    return `<div class="sp-clubes">${ITENS.map(x => `<button class="sp-cl${x.key === clube ? ' on' : ''}${x.menu ? ' mn' : ''}" data-cl="${x.key}" title="${esc(x.nome)}">${imgDe(x)}${(lista()[x.key] || []).length ? `<i>${lista()[x.key].length}</i>` : ''}</button>`).join('')}</div>
      <div class="box sp-box mu-box"><div class="sp-topo">${imgDe(t, 'g')}<div><b>${esc(t.nome)}</b><span>${l.length ? `${l.length} ${l.length > 1 ? 'músicas' : 'música'} · ★ = principal (toca primeiro)` : (t.menu ? 'Nenhuma música do menu: adicione arquivos aqui (ou links na aba Links do Spotify).' : 'Nenhum arquivo: na partida usa os links do Spotify do clube, se houver.')}</span></div>
        <label class="mu-add sm">+ ADICIONAR ARQUIVOS (MP3, WAV, OGG)<input type="file" id="mu-file" accept="${ACEITA}" multiple hidden></label></div>
        <div class="sp-lista">${l.map(linha).join('')}</div></div>`;
  }
  function telaRegras() {
    const r = R(), ck = (k, n, d) => `<label class="mu-ck"><input type="checkbox" data-r="${k}" ${r[k] ? 'checked' : ''}><span><b>${n}</b>${d}</span></label>`;
    const sel = (k, n, ops) => `<label class="mu-sel"><b>${n}</b><select data-r="${k}">${ops.map(([v, d]) => `<option value="${v}" ${r[k] === v ? 'selected' : ''}>${d}</option>`).join('')}</select></label>`;
    const spOk = SpotifyC?.conectado();
    return `<div class="box mu-regras"><div class="mu-col"><h3>DE ONDE VEM A MÚSICA</h3>${sel('origem', 'Origem', [['auto', 'Automático: arquivos; se não tiver, Spotify'], ['arquivos', 'Só arquivos do computador'], ['spotify', 'Só Spotify (app do PC, Premium)']])}<p class="mu-obs">${spOk ? '✔ Spotify conectado: clubes sem arquivo tocam os links do Spotify (deixe o aplicativo Spotify aberto no PC).' : r.origem === 'arquivos' ? 'Usa os arquivos MP3/WAV/OGG de cada clube.' : '⚠ Spotify não conectado: só os arquivos tocam. Para usar o Spotify: aba Links do Spotify → CONECTAR.'}</p>${ck('menu', 'Música no menu', 'Toca as músicas do item ♪ MENU na tela inicial (para quando a partida começa).')}<h3>QUANDO TOCAR</h3>${ck('inicio', 'Início da partida', 'Toca a música do time que entra em campo para cobrar primeiro.')}${ck('vez', 'Mudança de equipe', 'Antes de qualquer comemoração, a cada vez de cobrança toca a música do time que vai cobrar.')}${ck('gol', 'Comemoração', 'Toca a música da torcida que está comemorando (gol, defesa do goleiro, pênalti perdido pelo adversário) e ela continua tocando até a OUTRA torcida comemorar.')}</div>
      <div class="mu-col"><h3>DURANTE A PARTIDA</h3>${sel('chute', 'Na cobrança', [['abaixar', 'Abaixar a música (efeitos aparecem)'], ['nada', 'Manter o volume']])}${sel('pausa', 'Pausa da partida', [['pausar', 'Pausar a música'], ['abaixar', 'Abaixar a música'], ['continuar', 'Continuar tocando']])}${sel('fim', 'Fim da partida', [['vencedor', 'Tocar a música do vencedor'], ['parar', 'Parar a música'], ['continuar', 'Continuar a que está tocando']])}${sel('repetir', 'Ao terminar a música', [['todas', 'Tocar a próxima do clube'], ['uma', 'Repetir a mesma'], ['nao', 'Parar']])}
      <p class="mu-obs">Só toca uma música por vez. Ao sair da partida ou voltar ao menu, a música para. Os efeitos e a torcida do jogo continuam iguais.</p></div></div>`;
  }
  function desenha(foco) {
    if (aba === 'spotify') { Torcida.onChange = null; return telaSpotify({ ui, show, TEAMS: TODOS, clube, voltar, Torcida, abas: abas(), onAbas: () => { ligaAbas(); }, SpotifyC, nota: ctx.nota }); }
    show(`<div class="sp mu"><h2>Músicas e Torcidas</h2>${abas()}${aba === 'torcidas' ? telaTorcidas() : aba === 'diag' ? '<div class="box mu-diag" id="mu-diag">Verificando…</div>' : telaRegras()}${barra()}<p class="note sp-nota ${notaTipo}" id="sp-nota">${esc(nota)}</p><button id="b" class="sec" data-voltar>VOLTAR</button></div>`);
    ligaAbas(); ligaBarra(); document.getElementById('b').onclick = () => { Torcida.onChange = null; if (Torcida.clube !== 'menu') Torcida.parar(); voltar(); };
    Torcida.onChange = () => { if (!ui.contains(document.getElementById('mu-player'))) { Torcida.onChange = null; return; } atualizaBarra(); };
    if (aba === 'torcidas') {
      ui.querySelectorAll('.sp-cl').forEach(b => b.onclick = () => { clube = b.dataset.cl; editando = removendo = null; nota = ''; desenha(`[data-cl="${clube}"]`); });
      ui.querySelectorAll('.mu-item [data-a]').forEach(b => b.onclick = () => acao(b.dataset.a, b.closest('.mu-item').dataset.id));
      document.getElementById('mu-file').onchange = e => adicionaArquivos([...e.target.files]); marcaTocando();
    } else ui.querySelectorAll('[data-r]').forEach(i => i.onchange = () => { R()[i.dataset.r] = i.type === 'checkbox' ? i.checked : i.value; salvar(); if (i.dataset.r === 'origem' || i.dataset.r === 'menu') { Torcida.parar(); nota = 'Regra salva.'; notaTipo = 'ok'; return desenha(); } nota = 'Regras salvas.'; notaTipo = 'ok'; document.getElementById('sp-nota').textContent = nota; document.getElementById('sp-nota').className = 'note sp-nota ok'; });
    if (aba === 'diag') diagnostico();
    const el = foco && ui.querySelector(foco); if (el) el.focus();
  }
  // DIAGNÓSTICO: tudo o que decide se a música toca (para o usuário mandar um print)
  async function diagnostico() {
    const el = () => document.getElementById('mu-diag'), r = R(), ok = v => v ? '<b class="dg-ok">✔</b>' : '<b class="dg-no">✖</b>', L = [], sp = SpotifyC;
    const arq = Store.data.torcidas || {}, lk = Store.data.spotify || {}, nArq = k => (arq[k] || []).length, nLk = k => (lk[k] || []).length;
    L.push(`<div>${ok(true)} Origem: <b>${{ auto: 'Automático', arquivos: 'Só arquivos', spotify: 'Só Spotify' }[r.origem]}</b> · Música no menu: <b>${r.menu ? 'ligada' : 'DESLIGADA'}</b> · Início ${r.inicio ? '✔' : '✖'} · Troca de time ${r.vez ? '✔' : '✖'} · Comemoração ${r.gol ? '✔' : '✖'} · Fim: ${r.fim}</div>`);
    const conectado = !!sp?.conectado(); L.push(`<div>${ok(conectado)} Spotify conectado${conectado ? '' : ' — vá em LINKS DO SPOTIFY → CONECTAR'}</div>`);
    if (conectado) { const u = await sp.quemSou(); L.push(`<div>${ok(u && u.premium !== false)} Conta: ${u ? `<b>${esc(u.nome)}</b> · ${u.premium ? 'Premium' : u.premium === false ? '<b class="dg-no">SEM PREMIUM — o Spotify não deixa o jogo controlar</b>' : 'tipo de conta não informado pelo Spotify (o ▶ TESTAR confirma)'}` : 'não respondeu: ' + esc(sp.msg)}</div>`);
      const d = await sp.api('GET', '/me/player/devices'), ds = d.ok ? d.json?.devices || [] : null;
      L.push(`<div>${ok(ds && ds.length)} Spotify aberto no PC: ${ds ? (ds.length ? ds.map(x => `<b>${esc(x.name)}</b> (${esc(x.type)}${x.is_active ? ', ativo' : ''})`).join(', ') : '<b class="dg-no">NENHUM — abra o aplicativo Spotify no PC</b>') : esc(sp.msg)}</div>`); }
    if (!el()) return;
    const item = k => { const fonte = Torcida.fonte(k), a = nArq(k), l = nLk(k); return `<span class="${(a || (l && conectado)) ? 'dg-ok' : a + l ? 'dg-av' : 'dg-0'}">${esc(T(k).sigla)} ${a ? a + ' arq' : ''}${a && l ? ' · ' : ''}${l ? l + ' link' : ''}${!a && !l ? '—' : ''}${a + l ? ` → ${fonte === 'spotify' ? 'Spotify' : 'arquivo'}` : ''}</span>`; };
    L.push(`<div>${ok(nArq('menu') || (nLk('menu') && conectado))} Menu: ${item('menu')}</div><div class="dg-cl">Clubes: ${TEAMS.map(t => item(t.key)).join(' ')}</div>`);
    L.push(`<div>Player agora: <b>${Torcida.estado}</b> ${Torcida.clube ? esc(T(Torcida.clube)?.nome || Torcida.clube) : ''} ${Torcida.faixa ? '"' + esc(Torcida.faixa.nome) + '"' : ''} ${Torcida.motivo ? '· <b class="dg-no">' + esc(Torcida.motivo) + '</b>' : ''}${sp?.msg ? ' · Spotify: ' + esc(sp.msg) : ''}</div>`);
    L.push('<div class="dg-dica">Mande um print desta tela se a música não tocar. Para testar agora: aba LINKS DO SPOTIFY → ▶ TESTAR.</div>');
    el().innerHTML = L.join('');
  }
  async function adicionaArquivos(fs) {
    const au = typeof document !== 'undefined' ? document.createElement('audio') : null, pode = m => !au || au.canPlayType(m) !== '', erros = [], ok = [];
    for (const f of fs) { const v = validaArquivo(f, pode); if (!v.ok) { erros.push(v.error); continue; } const id = uidT(), r = adiciona(lista(), clube, { id, arquivo: f.name, tamanho: f.size, tipo: v.mime });
      if (!r.ok) { erros.push(r.error); continue; } if (!(await Arquivos.guardar(id, f))) erros.push(`${f.name}: não foi possível guardar o arquivo (vale só nesta sessão).`); ok.push(r.entrada.nome); }
    salvar(); nota = [ok.length ? `Adicionada(s) ao ${T(clube).nome}: ${ok.join(', ')}` : '', ...erros].filter(Boolean).join(' · '); notaTipo = erros.length ? 'err' : 'ok'; desenha();
  }
  async function acao(a, id) {
    const e = (lista()[clube] || []).find(x => x.id === id); if (!e) return;
    if (a === 'ouvir') { if (Torcida.faixa?.id === id && Torcida.estado === 'tocando') Torcida.pausar(); else if (Torcida.faixa?.id === id && Torcida.estado === 'pausado') Torcida.continuar(); else await Torcida.tocarFaixa(clube, id); return; }
    if (a === 'principal') { principal(lista(), clube, id); salvar(); nota = `Principal do ${T(clube).nome}: ${e.nome}`; notaTipo = 'ok'; return desenha(`[data-id="${id}"] [data-a="principal"]`); }
    if (a === 'editar') { editando = id; removendo = null; return desenha('#mu-en'); }
    if (a === 'cancelar') { editando = null; return desenha(`[data-id="${id}"] [data-a="editar"]`); }
    if (a === 'salvar') { if (!renomeia(lista(), clube, id, document.getElementById('mu-en').value)) { nota = 'Digite um nome.'; notaTipo = 'err'; return desenha('#mu-en'); } editando = null; salvar(); nota = 'Nome salvo.'; notaTipo = 'ok'; return desenha(`[data-id="${id}"] [data-a="editar"]`); }
    if (a === 'remover') { removendo = id; return desenha(`[data-id="${id}"] [data-a="rem-nao"]`); }
    if (a === 'rem-nao') { removendo = null; return desenha(`[data-id="${id}"] [data-a="remover"]`); }
    if (a === 'rem-sim') { if (Torcida.faixa?.id === id) Torcida.parar(); tira(lista(), clube, id); await Arquivos.apagar(id); removendo = null; salvar(); nota = `Removida: ${e.nome}`; notaTipo = 'ok'; return desenha(); }
  }
  desenha();
}
