// GERENCIADOR CENTRAL de músicas/cantos: um ÚNICO player oficial do YouTube (IFrame API), reutilizado, com prioridades:
//   teste(200) > campeão(100) > canto da equipe(50) > playlist do menu(10). Ouve os eventos reais da partida (events.js / gameState.js).
import { Events } from './events.js';
import { GS } from './gameState.js';
import { Store } from './settingsStore.js';
const PRI = { menu: 10, chant: 50, champion: 100, test: 200 };
const ERR = { 2: 'ID de vídeo inválido.', 5: 'Erro do player HTML5.', 100: 'Vídeo não encontrado, removido ou privado.', 101: 'O dono do vídeo não permite reprodução incorporada.', 150: 'O dono do vídeo não permite reprodução incorporada.', 153: 'Falha de configuração do player (abra pelo Live Server, não por file://).' };
export const AM = {
  cur: null, playing: false, status: {}, msg: '', onChange: null, gestured: false, duckF: 1, menuI: 0, fails: 0, inited: false, player: null, _p: null, _t: null,
  emit() { try { this.onChange?.(); } catch {} },
  box(v) { const b = typeof document !== 'undefined' && document.getElementById('ytbox'); if (b) b.hidden = !v; },
  // ---- player único ----
  makePlayer(events) {                                              // padrão: YouTube IFrame API; os testes injetam um player falso
    return new Promise((res, rej) => {
      const go = () => { try { const pl = new window.YT.Player('ytplayer', { width: 200, height: 200, playerVars: { controls: 1, rel: 0, playsinline: 1, modestbranding: 1 }, events: { ...events, onReady: () => res(pl) } }); } catch (e) { rej(e); } };
      if (window.YT?.Player) return go();
      if (location.protocol === 'file:') return rej(new Error('file'));
      const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = () => rej(new Error('rede')); window.onYouTubeIframeAPIReady = go; document.head.appendChild(s); setTimeout(() => rej(new Error('tempo')), 9000);
    });
  },
  ensure() {
    return this.player ? Promise.resolve(this.player) : this._p ??= this.makePlayer({
      onStateChange: e => this.onState(e.data), onError: e => this.onError(e.data), onAutoplayBlocked: () => { this.msg = 'O navegador bloqueou o início automático: toque em ▶ no player.'; this.emit(); }
    }).then(p => (this.player = p)).catch(e => { this._p = null; this.msg = e.message === 'file' ? 'O YouTube não funciona abrindo o arquivo direto (file://). Use o Live Server.' : 'Não foi possível carregar o player do YouTube (sem internet ou bloqueado).'; if (this.cur) this.status[this.cur.entry.id] = { ok: false, msg: this.msg }; this.cur = null; this.playing = false; this.box(false); this.emit(); throw e; });
  },
  onState(s) {                                                      // 1 tocando · 2 pausado · 0 terminou · 3 carregando
    if (s === 1) { this.playing = true; this.fails = 0; this.msg = ''; if (this.cur) this.status[this.cur.entry.id] = { ok: true }; }
    else if (s === 2) this.playing = false;
    else if (s === 0) { this.playing = false; if (this.cur?.kind === 'menu') this.menuNext(true); else if (this.cur) { this.cur = null; this.box(false); } }
    this.emit();
  },
  onError(code) {
    const m = ERR[code] || 'Erro ao reproduzir este vídeo.', c = this.cur; this.msg = m; this.playing = false; if (c) this.status[c.entry.id] = { ok: false, msg: m };
    if (c?.kind === 'menu' && ++this.fails < Math.max(1, this.menuList().length)) this.menuNext(true); else { this.cur = null; this.box(false); }
    this.emit();
  },
  vol() { return Math.round((this.cur?.entry.vol ?? 0) * Store.data.play.master/100 * this.duckF); },
  applyVol() { try { this.player?.setVolume(this.vol()); } catch {} },
  // ---- reprodução com prioridade ----
  async play(entry, kind) {
    if (!entry) return false; if (this.cur && this.playing && PRI[this.cur.kind] > PRI[kind]) return false;     // algo mais importante já toca
    this.cur = { entry, kind }; this.msg = ''; this.emit();
    try { const p = await this.ensure(); if (!this.cur || this.cur.entry !== entry) return false;               // trocou enquanto carregava
      this.box(true); p.loadVideoById({ videoId: entry.vid, startSeconds: entry.start || 0 }); this.applyVol(); return true; } catch { return false; }
  },
  stop(kinds) { if (!this.cur || (kinds && !kinds.includes(this.cur.kind))) return; try { this.player?.stopVideo(); } catch {} this.cur = null; this.playing = false; this.box(false); this.emit(); },
  test(entry) { this.cur?.kind === 'test' && this.cur.entry === entry ? this.stop() : this.play(entry, 'test'); },
  togglePause() { if (!this.player || !this.cur) return; try { this.playing ? this.player.pauseVideo() : this.player.playVideo(); } catch {} },
  // ---- playlist do menu ----
  menuList() { return Store.data.menu.tracks.filter(t => t.enabled); },
  startMenu() { if (!this.gestured) return; const L = this.menuList(); if (!L.length) return; this.menuI %= L.length; this.play(L[this.menuI], 'menu'); },
  menuNext(auto) {
    const L = this.menuList(), m = Store.data.menu; if (!L.length) return; if (auto && m.repeat === 'one') return this.play(L[this.menuI % L.length], 'menu');
    if (auto && m.repeat === 'off' && !m.shuffle && this.menuI >= L.length - 1) { this.cur = null; this.box(false); return this.emit(); }
    this.menuI = m.shuffle && L.length > 1 ? (this.menuI + 1 + Math.floor(Math.random()*(L.length - 1))) % L.length : (this.menuI + 1) % L.length; this.play(L[this.menuI], 'menu');
  },
  menuPrev() { const L = this.menuList(); if (!L.length) return; this.menuI = (this.menuI - 1 + L.length) % L.length; this.play(L[this.menuI], 'menu'); },
  menuToggle() { this.cur?.kind === 'menu' ? this.togglePause() : this.startMenu(); },
  userGesture() { if (this.gestured) return; this.gestured = true; if (GS.estado === 'MENU' && !this.cur) this.startMenu(); },
  enterMenu() { this.stop(['chant', 'champion', 'test']); if (!this.cur) this.startMenu(); },
  // ---- cantos por equipe / campeão (identificação pelo ESTADO da partida, não por texto da tela) ----
  teamKey(slot) { return GS.equipes[slot]?.key; },
  chantOf(slot) { const e = Store.data.chants[this.teamKey(slot)]; return e && e.enabled ? e : null; },
  chant(slot) {
    const e = this.chantOf(slot);
    if (!e) { this.stop(['chant']); if (Store.data.play.keepMenuInMatch && !this.cur) this.startMenu(); return null; }   // sem canto: segue com o áudio padrão
    if (this.cur?.entry.id === e.id && this.playing) return e; this.play(e, 'chant'); return e;
  },
  champion(slot) {                                                  // só com partida ENCERRADA e vencedor válido
    if (slot !== 0 && slot !== 1) return null; const c = Store.data.champion; let e = null;
    if (c.mode === 'team') e = this.chantOf(slot) || c.defaultSong; else if (c.mode === 'exclusive') e = c.exclusive; else if (c.mode === 'default') e = c.defaultSong;
    if (!e || !e.enabled) { this.stop(['chant', 'menu']); return null; } this.stop(['chant', 'menu']); this.play(e, 'champion'); return e;
  },
  duck() {                                                          // abaixa a música no chute para os efeitos aparecerem; restaura depois
    if (!Store.data.play.duckOnKick) return; this.duckF = .25; this.applyVol(); clearTimeout(this._t);
    this._t = setTimeout(() => { const step = () => { this.duckF = Math.min(1, this.duckF + .15); this.applyVol(); if (this.duckF < 1) this._t = setTimeout(step, 120); }; step(); }, 1500);
  },
  init() {
    if (this.inited) return; this.inited = true; const P = () => Store.data.play;
    Events.on('partida_iniciada', () => { if (!Store.data.play.keepMenuInMatch) this.stop(['menu', 'test']); if (P().chantStart === 'apresentacao') this.chant(0); });
    Events.on('cobranca_mudou', e => { if (P().chantStart === 'preparacao') this.chant(e.cobrador); });
    Events.on('chute', e => { if (P().chantStart === 'cobranca') this.chant(e.equipe); this.duck(); });
    Events.on('gol', e => { if (P().chantStart === 'gol') this.chant(e.equipe); });
    Events.on('partida_encerrada', e => this.champion(e.vencedor));
    Events.on('partida_reiniciada', () => this.stop(['chant', 'champion']));
  }
};
