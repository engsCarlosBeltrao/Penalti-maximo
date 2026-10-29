// Painel "Músicas e Torcidas": 4 abas (Playlist do Menu · Cantos das Torcidas · Canto do Campeão · Volume e Reprodução). Tudo salvo no localStorage.
import { Store, uid } from './settingsStore.js';
import { AM } from './audioManager.js';
import { parseYouTube, watchUrl } from './ytUtil.js';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stTxt = id => { const s = AM.status[id]; return s ? (s.ok ? '✔ funcionando' : '✖ ' + s.msg) : 'não testada'; };
const stCls = id => { const s = AM.status[id]; return s ? (s.ok ? 'ok' : 'err') : ''; };
export function openMusicPanel(ctx, tab = 'menu') {
  const { ui, show, TEAMS, crest, back } = ctx; let note = '';
  const save = () => { Store.save(); if (Store.warning) note = Store.warning; };
  const mk = (url, name, cat) => { const r = parseYouTube(url); if (!r.ok) { note = r.error; return null; } note = ''; return { id: uid(), name: (name || '').trim() || 'Música ' + r.id, vid: r.id, start: r.start, vol: 80, enabled: true, cat }; };
  const row = (e, label, attrs) => `<div class="trow">${label}<input class="nm" data-f="name" ${attrs} value="${esc(e.name)}" aria-label="Nome"><span class="st ${stCls(e.id)}" data-sid="${e.id}">${esc(stTxt(e.id))}</span>
    <label class="chk"><input type="checkbox" data-f="en" ${attrs} ${e.enabled ? 'checked' : ''}>ativa</label><input type="range" data-f="vol" ${attrs} min="0" max="100" value="${e.vol}" aria-label="Volume">
    <button class="sm" data-a="test" ${attrs}>${AM.cur?.entry === e ? '■ Parar' : '▶ Testar'}</button><button class="sm sec" data-a="sub" ${attrs}>Substituir</button><button class="sm sec" data-a="del" ${attrs}>Excluir</button><a class="lnk" href="${watchUrl(e.vid)}" target="_blank" rel="noopener">Abrir no YouTube</a></div>`;
  const body = () => {
    const D = Store.data;
    if (tab === 'menu') return `<div class="ctl"><button class="sm" data-a="prev">◀◀</button><button class="sm" data-a="tog">${AM.cur?.kind === 'menu' && AM.playing ? '⏸ Pausar' : '▶ Tocar'}</button><button class="sm" data-a="next">▶▶</button>
        <button class="sm ${D.menu.shuffle ? '' : 'sec'}" data-a="shuf">Aleatório</button><button class="sm ${D.menu.repeat === 'off' ? 'sec' : ''}" data-a="rep">Repetir: ${{ off: 'não', one: 'música', all: 'playlist' }[D.menu.repeat]}</button></div>
      ${D.menu.tracks.length ? D.menu.tracks.map((t, i) => row(t, `<span class="n">${i + 1}</span>`, `data-i="${i}"`).replace('<a class="lnk"', `<button class="sm sec" data-a="up" data-i="${i}">▲</button><button class="sm sec" data-a="dn" data-i="${i}">▼</button><a class="lnk"`)).join('') : '<p>Nenhuma música ainda. Cole um link abaixo.</p>'}
      <div class="trow add"><input id="addName" placeholder="Nome da música" maxlength="60"><input id="addUrl" class="url" placeholder="Cole o link do YouTube" inputmode="url"><select id="addCat"><option value="menu">Menu</option><option value="outra">Outra</option></select><button class="sm" data-a="add">Adicionar</button></div>`;
    if (tab === 'cantos') return `<p class="hint">Um canto por equipe, tocado quando a equipe vai cobrar (momento em "Volume e Reprodução"). Sem canto = áudio padrão.</p>` + TEAMS.map(t => { const e = D.chants[t.key];
      return `<div class="trow"><span class="cr">${crest(t)}</span><b class="tn">${esc(t.nome)}</b><input class="nm" data-team="${t.key}" data-f="cname" placeholder="Nome do canto" maxlength="60" value="${esc(e?.name || '')}"><input class="url" data-team="${t.key}" data-f="curl" placeholder="Link do YouTube" inputmode="url" value="${e ? esc(watchUrl(e.vid)) : ''}">
        <button class="sm" data-a="csave" data-team="${t.key}">Salvar</button>${e ? `<span class="st ${stCls(e.id)}" data-sid="${e.id}">${esc(stTxt(e.id))}</span><label class="chk"><input type="checkbox" data-f="cen" data-team="${t.key}" ${e.enabled ? 'checked' : ''}>ativo</label><input type="range" data-f="cvol" data-team="${t.key}" min="0" max="100" value="${e.vol}"><button class="sm" data-a="ctest" data-team="${t.key}">${AM.cur?.entry === e ? '■ Parar' : '▶ Testar'}</button><button class="sm sec" data-a="cdel" data-team="${t.key}">Remover</button><a class="lnk" href="${watchUrl(e.vid)}" target="_blank" rel="noopener">YouTube</a>` : ''}</div>`; }).join('');
    if (tab === 'camp') { const c = D.champion, one = (k, lab) => { const e = c[k]; return `<div class="trow"><b class="tn">${lab}</b><input class="nm" data-f="kname" data-k="${k}" placeholder="Nome" maxlength="60" value="${esc(e?.name || '')}"><input class="url" data-f="kurl" data-k="${k}" placeholder="Link do YouTube" inputmode="url" value="${e ? esc(watchUrl(e.vid)) : ''}"><button class="sm" data-a="ksave" data-k="${k}">Salvar</button>${e ? `<span class="st ${stCls(e.id)}" data-sid="${e.id}">${esc(stTxt(e.id))}</span><button class="sm" data-a="ktest" data-k="${k}">${AM.cur?.entry === e ? '■ Parar' : '▶ Testar'}</button><button class="sm sec" data-a="kdel" data-k="${k}">Remover</button>` : ''}</div>`; };
      return `<p class="hint">Tocada só quando a disputa termina com vencedor definido (nunca a cada gol).</p><div class="opts">${[['team', 'Canto da própria equipe campeã'], ['exclusive', 'Link exclusivo de comemoração'], ['default', 'Música padrão de vitória'], ['off', 'Sem música de campeão']].map(([k, n]) => `<label class="chk"><input type="radio" name="cm" value="${k}" ${c.mode === k ? 'checked' : ''}> ${n}</label>`).join('')}</div>${one('exclusive', 'Exclusiva')}${one('defaultSong', 'Padrão de vitória')}`; }
    return `<div class="trow"><label class="wide">Volume geral das músicas <input type="range" id="master" min="0" max="100" value="${D.play.master}"></label></div>
      <div class="trow"><label class="wide">Quando o canto da equipe começa <select id="start">${[['apresentacao', 'Na apresentação (início da partida)'], ['preparacao', 'Na preparação do cobrador'], ['cobranca', 'No momento do chute'], ['gol', 'Depois de um gol']].map(([k, n]) => `<option value="${k}" ${D.play.chantStart === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
      <div class="trow"><label class="chk"><input type="checkbox" id="duck" ${D.play.duckOnKick ? 'checked' : ''}> Abaixar a música durante o chute</label></div>
      <div class="trow"><label class="chk"><input type="checkbox" id="keep" ${D.play.keepMenuInMatch ? 'checked' : ''}> Manter a playlist do menu na partida quando a equipe não tiver canto</label></div>
      <div class="trow"><button class="sm sec" data-a="stopall">■ Parar tudo</button><button class="sm sec" data-a="reset">Restaurar padrões</button><button class="sm sec" data-a="clear">Limpar configurações</button></div>
      <p class="hint">Som no celular/navegador: o áudio só começa depois do seu primeiro toque ou clique. O YouTube pode bloquear vídeos incorporados; o player aparece no canto da tela enquanto toca.</p>`;
  };
  const render = () => {
    const tabs = [['menu', 'Playlist do Menu'], ['cantos', 'Cantos das Torcidas'], ['camp', 'Canto do Campeão'], ['vol', 'Volume e Reprodução']];
    show(`<h2>Músicas e Torcidas</h2><div class="tabs">${tabs.map(([k, n]) => `<button class="sm ${tab === k ? '' : 'sec'}" data-tab="${k}">${n}</button>`).join('')}</div><div class="box pbox">${body()}</div><p id="note" class="note">${esc(note || AM.msg)}</p><button id="b" class="sec">VOLTAR</button>`);
    wire();
  };
  const wire = () => {
    ui.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; note = ''; render(); }); ui.querySelector('#b').onclick = back;
    const D = Store.data, T = el => D.menu.tracks[+el.dataset.i], q = id => ui.querySelector(id);
    ui.querySelectorAll('[data-f]').forEach(el => el.onchange = () => { const f = el.dataset.f, t = el.dataset.i != null ? T(el) : null, ch = el.dataset.team ? D.chants[el.dataset.team] : null;
      if (t && f === 'name') t.name = el.value.slice(0, 60) || t.name; if (t && f === 'en') t.enabled = el.checked; if (t && f === 'vol') { t.vol = +el.value; if (AM.cur?.entry === t) AM.applyVol(); }
      if (ch && f === 'cen') ch.enabled = el.checked; if (ch && f === 'cvol') { ch.vol = +el.value; if (AM.cur?.entry === ch) AM.applyVol(); } save(); });
    ui.querySelectorAll('[data-a]').forEach(el => el.onclick = () => {
      const a = el.dataset.a, i = +el.dataset.i, tm = el.dataset.team, k = el.dataset.k, L = D.menu.tracks;
      if (a === 'test') AM.test(T(el)); else if (a === 'sub') { const r = parseYouTube(prompt('Novo link do YouTube para esta música:') || ''); if (r.ok) { const t = T(el); t.vid = r.id; t.start = r.start; delete AM.status[t.id]; note = ''; save(); } else note = r.error; }
      else if (a === 'del') { if (AM.cur?.entry === T(el)) AM.stop(); L.splice(i, 1); save(); } else if (a === 'up' && i > 0) { [L[i - 1], L[i]] = [L[i], L[i - 1]]; save(); } else if (a === 'dn' && i < L.length - 1) { [L[i + 1], L[i]] = [L[i], L[i + 1]]; save(); }
      else if (a === 'add') { const e = mk(q('#addUrl').value, q('#addName').value, q('#addCat').value); if (e) { L.push(e); save(); } }
      else if (a === 'prev') AM.menuPrev(); else if (a === 'next') AM.menuNext(); else if (a === 'tog') { AM.gestured = true; AM.menuToggle(); }
      else if (a === 'shuf') { D.menu.shuffle = !D.menu.shuffle; save(); } else if (a === 'rep') { D.menu.repeat = { off: 'all', all: 'one', one: 'off' }[D.menu.repeat]; save(); }
      else if (a === 'csave') { const e = mk(q(`[data-f=curl][data-team=${tm}]`).value, q(`[data-f=cname][data-team=${tm}]`).value, 'canto'); if (e) { const old = D.chants[tm]; if (old) { e.vol = old.vol; e.enabled = old.enabled; e.id = old.id; delete AM.status[old.id]; } D.chants[tm] = e; save(); } }
      else if (a === 'ctest') AM.test(D.chants[tm]); else if (a === 'cdel') { if (AM.cur?.entry === D.chants[tm]) AM.stop(); delete D.chants[tm]; save(); }
      else if (a === 'ksave') { const e = mk(q(`[data-f=kurl][data-k=${k}]`).value, q(`[data-f=kname][data-k=${k}]`).value, 'campeao'); if (e) { D.champion[k] = e; save(); } }
      else if (a === 'ktest') AM.test(D.champion[k]); else if (a === 'kdel') { if (AM.cur?.entry === D.champion[k]) AM.stop(); D.champion[k] = null; save(); }
      else if (a === 'stopall') AM.stop(); else if (a === 'reset') { if (confirm('Restaurar todas as configurações de música aos padrões?')) { AM.stop(); Store.reset(); note = 'Padrões restaurados.'; } } else if (a === 'clear') { if (confirm('Apagar todas as músicas e cantos salvos?')) { AM.stop(); Store.clear(); note = 'Configurações apagadas.'; } }
      AM.gestured = true; render(); });
    ui.querySelectorAll('input[name=cm]').forEach(r => r.onchange = () => { D.champion.mode = r.value; save(); });
    const m = q('#master'); if (m) m.oninput = () => { D.play.master = +m.value; AM.applyVol(); save(); }; const s = q('#start'); if (s) s.onchange = () => { D.play.chantStart = s.value; save(); };
    const d = q('#duck'); if (d) d.onchange = () => { D.play.duckOnKick = d.checked; save(); }; const kp = q('#keep'); if (kp) kp.onchange = () => { D.play.keepMenuInMatch = kp.checked; save(); };
  };
  AM.onChange = () => { ui.querySelectorAll('[data-sid]').forEach(e => { e.textContent = stTxt(e.dataset.sid); e.className = 'st ' + stCls(e.dataset.sid); }); const n = ui.querySelector('#note'); if (n && AM.msg) n.textContent = AM.msg; };   // atualiza só os status (não perde o que está sendo digitado)
  render();
}
