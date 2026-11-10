// Mixer (skills audio-design/game-audio): barramentos efeitos + torcida → master → limitador. Volumes em dB, mute no master, iniciado após interação.
import { cfg } from './game.js';
import { RECIPES, SFX_FILES, VAR, taper } from './soundEffects.js';
import { criaTorcidaSom } from './torcidaSom.js';
let ctx, master, fx, cr, amb, torcida = null;   // torcida: cantos, palmas e reações por lado (js/torcidaSom.js)
const IMPACT = new Set(['trave', 'travessao', 'defesa', 'rede', 'gol']);
function init() {
  if (ctx) return true;
  try { ctx = new AudioContext(); const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -10; lim.ratio.value = 10; lim.attack.value = .005; lim.release.value = .25;
    master = ctx.createGain(); fx = ctx.createGain(); cr = ctx.createGain(); fx.connect(master); cr.connect(master); master.connect(lim); lim.connect(ctx.destination); return true; } catch { return false; }
}
function vols() { if (ctx.state === 'suspended') ctx.resume(); master.gain.value = cfg.sound ? 1 : 0; fx.gain.value = taper(cfg.vol); cr.gain.value = taper(cfg.volCrowd); }
const lvl = () => amb ? amb.cur*.9 + .1 : 1;
function duck(g, dur) { if (!amb) return; const a = amb.out.gain, t = ctx.currentTime; a.cancelScheduledValues(t); a.setValueAtTime(lvl()*g, t); a.linearRampToValueAtTime(lvl(), t + dur); }   // impacto abafa a torcida por um instante
export function sfx(n, delay = 0) {                                    // chamado pela lógica depois do evento confirmado
  if (!cfg.sound || !init()) return; vols();
  if (SFX_FILES[n]) { try { const a = new Audio(SFX_FILES[n]); a.volume = taper(n === 'roar' || n === 'groan' || n === 'expect' || n === 'roarBig' ? cfg.volCrowd : cfg.vol); setTimeout(() => a.play().catch(() => {}), delay*1000); } catch {} return; }
  VAR.pitch = .94 + Math.random()*.12;                                 // variação para não soar mecânico
  RECIPES[n]?.(ctx, ['roar', 'roarBig', 'groan', 'expect'].includes(n) ? cr : fx, ctx.currentTime + delay);
  if (IMPACT.has(n)) duck(.55, .4);
}
export const crowd = n => sfx(n);
export function ambient(on) {                                          // torcida da partida (js/torcidaSom.js) + murmúrio de fundo
  if (!cfg.sound || !init()) { if (!on) torcida?.desligar(); return; } vols();
  if (on) { (torcida ||= criaTorcidaSom({ ctx, saida: cr })).ligar(); } else torcida?.desligar();
  if (on && !amb) {
    const out = ctx.createGain(); out.gain.value = .55; out.connect(cr); const layers = [[300, .5, .07, .13], [900, .6, .05, .31], [1800, .8, .022, .07]].map(([f, q, g, hz]) => {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), gn = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(); const n = ctx.sampleRate*3, b = ctx.createBuffer(1, n, ctx.sampleRate), a = b.getChannelData(0); for (let i = 0; i < n; i++) a[i] = Math.random()*2 - 1;
      s.buffer = b; s.loop = true; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q; gn.gain.value = g; lfo.frequency.value = hz; lg.gain.value = g*.6; lfo.connect(lg).connect(gn.gain); s.connect(fl).connect(gn).connect(out); s.start(); lfo.start(); return { s, lfo }; });
    amb = { layers, out, cur: .45 };
  } else if (!on && amb) { amb.layers.forEach(l => { try { l.s.stop(); l.lfo.stop(); } catch {} }); amb = null; }
}
export function level(v) { if (!amb) return; amb.cur = v; amb.out.gain.setTargetAtTime(lvl(), ctx.currentTime, .4); }   // intensidade da torcida (expectativa → explosão)
export const _audioDbg = () => ({ ctx, cr, torcida });                     // só para os testes (medir o som da torcida e gravar demonstrações)
