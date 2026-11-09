// LINKS DO SPOTIFY POR CLUBE (Músicas e Torcidas). O jogo NÃO toca, não baixa e não sincroniza nada do Spotify: só guarda os links que o usuário
// cadastra e os ABRE fora do jogo — no aplicativo do Windows pela URI oficial (spotify:track:ID) ou no navegador (https://open.spotify.com/...).
// Nome e capa: oEmbed público e documentado do Spotify (https://open.spotify.com/oembed, sem login nem chave); se não responder, o usuário digita o nome.
export const TIPOS = { track: 'FAIXA', playlist: 'PLAYLIST' };
const ID = /^[A-Za-z0-9]{22}$/;
// aceita: https://open.spotify.com/(intl-xx/)track|playlist/ID(?si=...), open.spotify.com/... sem https, spotify:track:ID, spotify:playlist:ID
export function parseSpotify(raw) {
  const s = String(raw ?? '').trim(); if (!s) return { ok: false, error: 'Cole o link da música ou playlist do Spotify.' };
  let tipo, id;
  const uri = /^spotify:(track|playlist):([A-Za-z0-9]+)$/i.exec(s);
  if (uri) { tipo = uri[1].toLowerCase(); id = uri[2]; }
  else {
    let u; try { u = new URL(/^[a-z]+:\/\//i.test(s) ? s : 'https://' + s); } catch { return { ok: false, error: 'Link inválido.' }; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: 'Link inválido.' };
    const host = u.hostname.toLowerCase();
    if (host === 'spotify.link' || host.endsWith('.app.link')) return { ok: false, error: 'Link curto não é aceito: no Spotify use Compartilhar → Copiar link (open.spotify.com/...).' };
    if (host !== 'open.spotify.com' && host !== 'play.spotify.com') return { ok: false, error: 'Não é um link do Spotify (open.spotify.com).' };
    const p = u.pathname.split('/').filter(Boolean); if (/^intl-[a-z-]+$/i.test(p[0] || '')) p.shift();
    if (p[0] === 'embed') p.shift();
    if (['album', 'artist', 'episode', 'show'].includes(p[0])) return { ok: false, error: `Link de ${({ album: 'álbum', artist: 'artista', episode: 'episódio', show: 'podcast' })[p[0]]}: cadastre uma faixa ou uma playlist.` };
    if (p[0] !== 'track' && p[0] !== 'playlist') return { ok: false, error: 'Use o link de uma faixa ou de uma playlist.' };
    tipo = p[0]; id = p[1];
  }
  if (!ID.test(id || '')) return { ok: false, error: 'O código da faixa/playlist no link está incompleto.' };
  return { ok: true, tipo, id, uri: `spotify:${tipo}:${id}`, url: `https://open.spotify.com/${tipo}/${id}` };
}
export const uidS = () => 's' + Math.random().toString(36).slice(2, 9);
const txt = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const capaOk = c => typeof c === 'string' && /^https:\/\/([a-z0-9-]+\.)*(scdn\.co|spotifycdn\.com)\//i.test(c) ? c.slice(0, 300) : '';   // capa só da CDN do Spotify
// entrada válida (ou null): { id, tipo, sid, nome, autor, capa }
export function limpaEntrada(e) {
  if (!e || typeof e !== 'object') return null; const p = parseSpotify(e.uri || e.url || (e.tipo && e.sid ? `spotify:${e.tipo}:${e.sid}` : ''));
  if (!p.ok) return null;
  return { id: typeof e.id === 'string' && /^[a-z0-9]{2,12}$/i.test(e.id) ? e.id : uidS(), tipo: p.tipo, sid: p.id, nome: txt(e.nome, 80) || 'Sem nome', autor: txt(e.autor, 60), capa: capaOk(e.capa) };
}
export const MAX_POR_CLUBE = 30;
export function limpaLista(raw) {                                    // { clube: [entradas] } — clube com key válida, até 30 por clube, sem duplicar
  const out = {}; let descartados = 0; if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { lista: out, descartados };
  for (const [k, v] of Object.entries(raw)) { if (!/^[a-z0-9-]{1,30}$/.test(k) || !Array.isArray(v)) { descartados++; continue; } const vistos = new Set(), l = [];
    for (const e of v) { const c = limpaEntrada(e); if (!c || vistos.has(c.tipo + c.sid) || l.length >= MAX_POR_CLUBE) { descartados++; continue; } vistos.add(c.tipo + c.sid); l.push(c); }
    if (l.length) out[k] = l; }
  return { lista: out, descartados };
}
export const uriDe = e => `spotify:${e.tipo}:${e.sid}`, urlDe = e => `https://open.spotify.com/${e.tipo}/${e.sid}`;
// CADASTRO (lista = Store.data.spotify): cada clube tem a própria lista; nada é compartilhado entre clubes
export function adicionar(lista, clube, link, nome = '', meta = {}) {
  const p = parseSpotify(link); if (!p.ok) return p; const l = lista[clube] ||= [];
  if (l.some(e => e.tipo === p.tipo && e.sid === p.id)) return { ok: false, error: 'Este link já está cadastrado para este clube.' };
  if (l.length >= MAX_POR_CLUBE) return { ok: false, error: `Limite de ${MAX_POR_CLUBE} músicas por clube.` };
  const e = limpaEntrada({ tipo: p.tipo, sid: p.id, uri: p.uri, nome: nome || meta.nome || (p.tipo === 'playlist' ? 'Playlist' : 'Música'), autor: meta.autor, capa: meta.capa }); l.push(e); return { ok: true, entrada: e };
}
export function editar(lista, clube, id, { link, nome, meta } = {}) {
  const l = lista[clube] || [], e = l.find(x => x.id === id); if (!e) return { ok: false, error: 'Música não encontrada.' };
  if (link != null && link.trim() && parseSpotify(link).url !== urlDe(e)) { const p = parseSpotify(link); if (!p.ok) return p;
    if (l.some(x => x !== e && x.tipo === p.tipo && x.sid === p.id)) return { ok: false, error: 'Este link já está cadastrado para este clube.' };
    Object.assign(e, { tipo: p.tipo, sid: p.id, capa: capaOk(meta?.capa), autor: txt(meta?.autor, 60) }); }
  if (nome != null) e.nome = txt(nome, 80) || e.nome; return { ok: true, entrada: e };
}
export function remover(lista, clube, id) { const l = lista[clube] || [], i = l.findIndex(x => x.id === id); if (i < 0) return false; l.splice(i, 1); if (!l.length) delete lista[clube]; return true; }
export function mover(lista, clube, id, d) { const l = lista[clube] || [], i = l.findIndex(x => x.id === id), j = i + d; if (i < 0 || j < 0 || j >= l.length) return false; [l[i], l[j]] = [l[j], l[i]]; return true; }
// nome/autor/capa pelo oEmbed oficial (opcional; falha em silêncio)
export async function buscaMeta(link, f = typeof fetch === 'function' ? fetch : null) {
  const p = parseSpotify(link); if (!p.ok || !f) return null;
  try { const r = await f(`https://open.spotify.com/oembed?url=${encodeURIComponent(p.url)}`); if (!r.ok) return null; const j = await r.json();
    return { nome: txt(j.title, 80), autor: txt(j.author_name ?? '', 60), capa: capaOk(j.thumbnail_url) }; } catch { return null; }
}
// ABRIR FORA DO JOGO: app do Windows (protocolo spotify:, registrado pelo instalador do Spotify). O navegador pode pedir confirmação; se o app não
// estiver instalado, nada acontece — por isso a tela oferece "ABRIR NO NAVEGADOR". Sinal de que abriu: a janela do jogo perde o foco logo depois.
export function abrirNoApp(e, w = typeof window !== 'undefined' ? window : null) {
  if (!w) return Promise.resolve(false); const uri = uriDe(e);
  return new Promise(res => { let ok = false; const blur = () => { ok = true; }; w.addEventListener('blur', blur, { once: true });
    try { w.location.assign(uri); } catch { w.removeEventListener('blur', blur); return res(false); }
    setTimeout(() => { w.removeEventListener('blur', blur); res(ok || (w.document && w.document.hasFocus && !w.document.hasFocus())); }, 1600); });
}
export function abrirNoNavegador(e, w = typeof window !== 'undefined' ? window : null) { if (!w) return false; const j = w.open(urlDe(e), '_blank', 'noopener'); return j !== undefined; }
