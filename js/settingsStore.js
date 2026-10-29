// Configurações de áudio/músicas persistentes (localStorage) com validação: dados antigos ou corrompidos nunca travam o jogo.
const KEY = 'pm_audio_v1', ID = /^[A-Za-z0-9_-]{11}$/;
const MODES = ['team', 'exclusive', 'default', 'off'], STARTS = ['apresentacao', 'preparacao', 'cobranca', 'gol'], REPS = ['off', 'one', 'all'];
export const uid = () => 'm' + Math.random().toString(36).slice(2, 9);
export const defaults = () => ({ v: 1, menu: { tracks: [], shuffle: false, repeat: 'all' }, chants: {}, champion: { mode: 'team', exclusive: null, defaultSong: null }, play: { chantStart: 'preparacao', duckOnKick: true, keepMenuInMatch: false, master: 80 } });
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
  return { data: d, dropped };
}
export const Store = {
  data: defaults(), warning: '',
  load() {
    let raw = null; try { const s = localStorage.getItem(KEY); raw = s ? JSON.parse(s) : null; } catch { this.warning = 'Configurações salvas estavam corrompidas e foram ignoradas.'; }
    const r = sanitize(raw); this.data = r.data; if (r.dropped) this.warning = `${r.dropped} item(ns) inválido(s) foram descartados.`; return this.data;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); return true; } catch { this.warning = 'Não foi possível salvar (armazenamento bloqueado).'; return false; } },
  reset() { this.data = defaults(); this.save(); },                              // restaurar padrão
  clear() { this.data = defaults(); try { localStorage.removeItem(KEY); } catch {} }   // limpar tudo
};
