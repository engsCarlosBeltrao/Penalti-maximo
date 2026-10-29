// Receitas sintetizadas (originais). Skills game-audio/audio-design: variação de pitch por disparo, torcida em varreduras de ruído.
// Arquivos próprios: coloque em assets/sfx/ e liste em SFX_FILES (ex.: { gol: 'assets/sfx/gol.mp3' }).
export const SFX_FILES = {};
export const VAR = { pitch: 1 };
export const taper = v => v <= 0 ? 0 : Math.pow(10, (-40*(1 - v))/20);        // slider 0..1 → ganho em dB (percepção logarítmica)
const rd = (a, b) => a + Math.random()*(b - a);
const tone = (c, o, t, type, f0, f1, d, g) => { const os = c.createOscillator(), gn = c.createGain(), p = VAR.pitch; os.type = type; os.frequency.setValueAtTime(f0*p, t); os.frequency.exponentialRampToValueAtTime(Math.max(1, f1*p), t + d); gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(.001, t + d); os.connect(gn).connect(o); os.start(t); os.stop(t + d + .02); };
const nbuf = (c, d) => { const n = c.sampleRate*d | 0, buf = c.createBuffer(1, n, c.sampleRate), a = buf.getChannelData(0); for (let i = 0; i < n; i++) a[i] = Math.random()*2 - 1; return buf; };
const noise = (c, o, t, d, g, f, q = 1) => { const s = c.createBufferSource(), fl = c.createBiquadFilter(), gn = c.createGain(); s.buffer = nbuf(c, d); fl.type = 'bandpass'; fl.frequency.value = f*VAR.pitch; fl.Q.value = q; gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(.001, t + d); s.connect(fl).connect(gn).connect(o); s.start(t); };
const sweep = (c, o, t, d, g, f0, f1, att, q = .6) => { const s = c.createBufferSource(), fl = c.createBiquadFilter(), gn = c.createGain(); s.buffer = nbuf(c, d); fl.type = 'bandpass'; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + d); gn.gain.setValueAtTime(.001, t); gn.gain.linearRampToValueAtTime(g, t + att); gn.gain.exponentialRampToValueAtTime(.001, t + d); s.connect(fl).connect(gn).connect(o); s.start(t); };
const notes = (c, o, t, fs, step, d, g, type = 'triangle') => fs.forEach((f, i) => tone(c, o, t + i*step, type, f, f, d, g));
export const RECIPES = {
  chute: (c, o, t) => { tone(c, o, t, 'sine', 170, 55, .12, 1); noise(c, o, t, .05, .6, 1800); noise(c, o, t, .03, .4, 400); },   // contato do pé
  trave: (c, o, t) => { tone(c, o, t, 'square', 1900, 1750, .4, .25); tone(c, o, t, 'sine', 2600, 2500, .3, .2); noise(c, o, t, .04, .5, 3000); },
  travessao: (c, o, t) => { tone(c, o, t, 'square', 1150, 1080, .5, .25); tone(c, o, t, 'sine', 1700, 1600, .35, .2); noise(c, o, t, .04, .5, 2200); },
  rede: (c, o, t) => { noise(c, o, t, .45, .6, 900, .6); tone(c, o, t, 'sine', 120, 70, .25, .5); },
  gol: (c, o, t) => notes(c, o, t + .05, [523, 659, 784, 1047], .09, .35, .3),
  defesa: (c, o, t) => { noise(c, o, t, .09, .9, 1300, 1.5); tone(c, o, t, 'sine', 230, 120, .15, .6); },
  fora: (c, o, t) => tone(c, o, t, 'triangle', 320, 110, .35, .3),
  decisiva: (c, o, t) => { tone(c, o, t, 'sine', 75, 50, .18, .9); tone(c, o, t + .26, 'sine', 75, 50, .18, .9); },
  vitoria: (c, o, t) => notes(c, o, t, [523, 523, 523, 698, 659, 784], .16, .35, .3, 'square'),
  click: (c, o, t) => tone(c, o, t, 'square', 900, 700, .05, .15),
  // torcida (canal próprio): ruído filtrado em várias faixas = muitas vozes; durações/aberturas aleatórias evitam repetição mecânica
  expect: (c, o, t) => { const d = rd(.9, 1.3); sweep(c, o, t, d, .9, 350, rd(900, 1300), d*.8); sweep(c, o, t + .05, d, .5, 700, 1700, d*.85, .8); },       // "uuuuh" de expectativa antes do chute
  roar: (c, o, t) => { const d = rd(1.4, 2); sweep(c, o, t, d, 1, 500, rd(800, 1100), .12); sweep(c, o, t + .04, d*.85, .6, 1200, 1700, .15, .8); sweep(c, o, t, d, .5, 280, 340, .1, .5); },   // explosão do gol / defesa
  roarBig: (c, o, t) => { sweep(c, o, t, 3.2, 1, 500, 900, .2); sweep(c, o, t + .1, 3, .8, 1200, 1800, .25, .8); sweep(c, o, t, 3.2, .6, 260, 360, .2, .5); notes(c, o, t + .1, [392, 392, 523], .3, .5, .12, 'sine'); },   // fim da disputa
  groan: (c, o, t) => sweep(c, o, t, rd(.8, 1.2), .6, 480, 220, .1, .5)                                        // frustração
};
