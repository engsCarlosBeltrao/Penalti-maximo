// Reprodutor da playlist: play/pause, anterior/próxima, volume, aleatório, repetir, tratamento de erros, persistência.
import { PLAYLIST } from './musicPlaylist.js';
import { taper } from './soundEffects.js';
const KEY = 'pm_music';
export const Music = {
  tracks: PLAYLIST.filter(t => t.enabled !== false), i: 0, vol: .5, shuffle: false, repeat: false, playing: false, msg: '', duck: false, fails: 0, onChange: null, a: null,
  init() { try { Object.assign(this, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {} if (!this.tracks.length) this.msg = 'Nenhuma faixa cadastrada. Adicione arquivos em assets/music/ e registre em js/musicPlaylist.js.'; },
  save() { try { localStorage.setItem(KEY, JSON.stringify({ vol: this.vol, shuffle: this.shuffle, repeat: this.repeat })); } catch {} },
  emit() { this.onChange?.(); },
  get cur() { return this.tracks[this.i]; },
  _audio() {
    if (this.a || typeof Audio === 'undefined') return this.a;
    this.a = new Audio(); this.a.onended = () => this.next(true);
    this.a.onerror = () => { this.msg = `Arquivo não encontrado: ${this.cur?.src}`; this.playing = false; if (++this.fails < this.tracks.length) this.next(true); this.emit(); };
    return this.a;
  },
  play() {
    if (!this.tracks.length) return this.emit(); const a = this._audio(); if (!a) return;
    if (!a.src || a.dataset.i !== String(this.i)) { a.src = this.cur.src; a.dataset.i = this.i; }
    this.setVol(this.vol, true); a.play().then(() => { this.playing = true; this.fails = 0; this.msg = ''; this.emit(); }).catch(e => { this.playing = false; this.msg = e.name === 'NotAllowedError' ? 'O navegador bloqueou o áudio: clique em ▶.' : 'Não foi possível tocar esta faixa.'; this.emit(); });
  },
  pause() { this.a?.pause(); this.playing = false; this.emit(); },
  toggle() { this.playing ? this.pause() : this.play(); },
  next(auto) { if (!this.tracks.length) return; if (auto && this.repeat) { this.a.currentTime = 0; return this.play(); } this.i = this.shuffle ? Math.floor(Math.random()*this.tracks.length) : (this.i+1) % this.tracks.length; this.play(); },
  prev() { if (!this.tracks.length) return; this.i = (this.i-1+this.tracks.length) % this.tracks.length; this.play(); },
  setVol(v, quiet) { this.vol = v; if (this.a) this.a.volume = taper(v)*(this.duck ? .25 : 1); if (!quiet) { this.save(); this.emit(); } },
  setMode(m) { this.duck = m === 'game'; this.setVol(this.vol, true); },     // na partida: volume reduzido
  flag(k) { this[k] = !this[k]; this.save(); this.emit(); }
};
