// Configurações de áudio/músicas persistentes (localStorage) com validação: dados antigos ou corrompidos nunca travam o jogo.
// spotify: links do Spotify por clube ({ flamengo: [{ id, tipo, sid, nome, autor, capa }] }, js/spotify.js) — só cadastro; o jogo apenas os abre fora dele.
import { limpaLista } from './spotify.js';
// torcidas: músicas locais por clube tocadas pelo jogo na partida (js/torcidas.js; o áudio fica no IndexedDB) · torcidaRegras: eventos, pausa, fim, repetição, volume
import { limpaTorcidas, limpaRegras, REGRAS_PADRAO } from './torcidas.js';
const KEY = 'pm_audio_v1', ID = /^[A-Za-z0-9_-]{11}$/;
const MODES = ['team', 'exclusive', 'default', 'off'], STARTS = ['apresentacao', 'preparacao', 'cobranca', 'gol'], REPS = ['off', 'one', 'all'];
export const uid = () => 'm' + Math.random().toString(36).slice(2, 9);
export const defaults = () => ({ v: 1, menu: { tracks: [], shuffle: false, repeat: 'all' }, chants: {}, champion: { mode: 'team', exclusive: null, defaultSong: null }, play: { chantStart: 'preparacao', duckOnKick: true, keepMenuInMatch: false, master: 80 }, spotify: {}, torcidas: {}, torcidaRegras: REGRAS_PADRAO() });
const clamp = (n, a, b, d) => Number.isFinite(+n) ? Math.min(b, Math.max(a, +n)) : d;
export function cleanEntry(e) {                          // devolve entrada válida ou null
  if (!e || typeof e !== 'object' || typeof e.vid !== 'string' || !ID.test(e.vid)) return null;
  return { id: typeof e.id === 'string' && e.id ? e.id.slice(0, 24) : uid(), name: String(e.name ?? '').slice(0, 60) || 'Sem nome', vid: e.vid, start: clamp(e.start, 0, 86400, 0), vol: clamp(e.vol, 0, 100, 80), enabled: e.enabled !== false, cat: String(e.cat ?? 'menu').slice(0, 20) };
}
export function sanitize(raw) {
  const d = defaults(); let dropped = 0; if (!raw || typeof raw !== 'object') return { data: d, dropped: 0 };
  if (Array.isArray(raw.menu?.tracks)) raw.menu.tracks.forEach(t => { const c = cleanEntry(t); c ? d.menu.tracks.push(c) : dropped++; });
  if (typeof raw.menu?.shuffle === 'boolean') d.menu.shuffle = raw.menu.shuffle; if (REPS.includes(raw.menu?.repeat)) d.menu.repeat = raw.menu.repeat;
  if (raw.chants && typeof raw.chants === 'object') Object.entries(raw.chants).forEach(([k, v]) => { const c = cleanEntry(v); c && /^[a-z0-9-]{1,30}$/.test(k) ? d.chants[k] = c : dropped++; });
  const ch = raw.champion || {}; if (MODES.includes(ch.mode)) d.champion.mode = ch.mode; d.champion.exclusive = cleanEntry(ch.exclusive); d.champion.defaultSong = cleanEntry(ch.defaultSong);
  const p = raw.play || {}; if (STARTS.includes(p.chantStart)) d.play.chantStart = p.chantStart; ['duckOnKick', 'keepMenuInMatch'].forEach(k => { if (typeof p[k] === 'boolean') d.play[k] = p[k]; }); d.play.master = clamp(p.master, 0, 100, 80);
  const sp = limpaLista(raw.spotify); d.spotify = sp.lista; dropped += sp.descartados;
  const to = limpaTorcidas(raw.torcidas); d.torcidas = to.lista; dropped += to.descartados; d.torcidaRegras = limpaRegras(raw.torcidaRegras);
  return { data: d, dropped };
}
export const Store = {
  data: defaults(), warning: '',
  load() {
    let raw = null; try { const s = localStorage.getItem(KEY); raw = s ? JSON.parse(s) : null; this._temLocal = !!s; } catch { this.warning = 'Configurações salvas estavam corrompidas e foram ignoradas.'; }
    const r = sanitize(raw); this.data = r.data; if (r.dropped) this.warning = `${r.dropped} item(ns) inválido(s) foram descartados.`; return this.data;
  },
  save() { this.gravaDisco(); try { localStorage.setItem(KEY, JSON.stringify(this.data)); return true; } catch { this.warning = 'Não foi possível salvar (armazenamento bloqueado).'; return !!this.disco; } },
  // CÓPIA EM ARQUIVO (dados/musicas-salvas.json, pelo servidor do jogo): os links ficam salvos mesmo sem o Client ID do Spotify (que só é preciso para
  // o jogo TOCAR), e não somem quando o navegador limpa os dados ou o jogo abre por outro endereço. Sem o servidor (arquivo aberto direto), só o navegador.
  disco: false, _gravando: null,
  gravaDisco() { if (typeof fetch !== 'function' || typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return; clearTimeout(this._gravando);
    this._gravando = setTimeout(() => fetch('/musicas-salvas', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Penalti': '1' }, body: JSON.stringify(this.data) })
      .then(r => { this.disco = r.ok; }, () => { this.disco = false; }), 300); },
  async carregaDisco(f = typeof fetch === 'function' ? fetch : null) {      // junta o arquivo com o que o navegador tem; devolve quantos links vieram do arquivo
    if (!f || typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return 0; let raw;
    try { const r = await f('/musicas-salvas', { cache: 'no-store' }); if (!r.ok) return 0; raw = await r.json(); } catch { return 0; }
    const n = this.junta(raw); this.disco = true; this.save(); return n;
  },
  junta(raw) {                                          // une sem duplicar: links do Spotify e músicas do menu de ambos; o resto, do navegador (ou do arquivo se o navegador não tiver)
    const arq = sanitize(raw).data, d = this.data, ant = JSON.stringify(d.spotify); let n = 0;
    for (const [k, l] of Object.entries(arq.spotify)) { const atual = d.spotify[k] ||= []; for (const e of l) if (!atual.some(x => x.tipo === e.tipo && x.sid === e.sid)) { atual.push(e); n++; } }
    d.spotify = limpaLista(d.spotify).lista;
    for (const t of arq.menu.tracks) if (!d.menu.tracks.some(x => x.vid === t.vid)) { d.menu.tracks.push(t); n++; }
    for (const [k, v] of Object.entries(arq.chants)) if (!d.chants[k]) { d.chants[k] = v; n++; }
    for (const [k, v] of Object.entries(arq.torcidas)) if (!d.torcidas[k]?.length) d.torcidas[k] = v;
    if (!this._temLocal) { d.champion = arq.champion; d.play = arq.play; d.torcidaRegras = arq.torcidaRegras; d.menu.shuffle = arq.menu.shuffle; d.menu.repeat = arq.menu.repeat; }
    return n || (JSON.stringify(d.spotify) !== ant ? 1 : 0);
  },
  reset() { this.data = defaults(); this.save(); },                              // restaurar padrão
  clear() { this.data = defaults(); try { localStorage.removeItem(KEY); } catch {} }   // limpar tudo
};
