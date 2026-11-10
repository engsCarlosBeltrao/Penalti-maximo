// SOM DA TORCIDA (noite de Libertadores) — 100% sintetizado em tempo real (Web Audio), nenhuma gravação de terceiros. Cada torcida soa do SEU lado do
// estéreo (equipe 0 à esquerda, equipe 1 à direita) e segue o HUMOR dela (js/torcidaHumor.js):
//  · murmúrio contínuo de milhares de pessoas (ruído em 3 faixas com oscilação lenta própria);
//  · CANTOS em coro: vogais cantadas por muitas vozes levemente desafinadas entre si (filtros de formante), melodias próprias que se alternam, andamento
//    e tom variando a cada frase — nunca o mesmo trecho repetido igual;
//  · PALMAS ritmadas: cada batida são ~12 palmas com pequenos atrasos (gente de verdade não bate junto);
//  · REAÇÕES: explosão de gol/defesa/erro do adversário (do lado de quem comemora), lamento, "uuuh" de expectativa no chute, silêncio de quem sofreu.
// Mixagem: tudo passa pelo barramento da torcida (volume "Torcida" das Configurações) e pelo limitador do jogo; no máximo uma reação por lado ao mesmo
// tempo (a nova entra por cima da anterior com crossfade, sem corte seco); mudanças de volume sempre em rampa.
import { Humor } from './torcidaHumor.js';
const rd = (a, b) => a + Math.random()*(b - a);
// melodias dos cantos (semitons acima da base, duração em batidas) — originais
const MOTIVOS = [
  [[0, 1], [0, 1], [3, 1], [5, 2], [3, 1], [0, 2]],
  [[7, 1], [5, 1], [3, 1], [5, 1], [7, 2], [0, 2]],
  [[0, .5], [0, .5], [0, 1], [5, 1], [3, 1], [2, 1], [0, 2]],
  [[3, 1], [3, 1], [7, 1], [5, 1], [3, 1], [5, 1], [0, 2]]
];
const VOGAIS = [[480, 820], [700, 1150], [380, 950]];        // "ô", "á", "ê" (formantes F1, F2)
export function criaTorcidaSom({ ctx, saida }) {
  const lados = [-.62, .62].map((pan, l) => {
    const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(saida);
    const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(p);
    const canto = ctx.createGain(); canto.gain.value = 0; canto.connect(bus);
    const palmas = ctx.createGain(); palmas.gain.value = 0; palmas.connect(bus);
    const reac = ctx.createGain(); reac.gain.value = 1; reac.connect(bus);
    // murmúrio: 3 faixas de ruído
    const mur = ctx.createGain(); mur.gain.value = 0; mur.connect(bus); const fontes = [];
    [[320, .5, .5, .11], [850, .7, .32, .27], [1900, .9, .14, .06]].forEach(([f, q, g, hz]) => { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), gn = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      s.buffer = ruido(ctx, 4); s.loop = true; s.playbackRate.value = rd(.96, 1.04); fl.type = 'bandpass'; fl.frequency.value = f*(l ? 1.03 : .97); fl.Q.value = q; gn.gain.value = g; lfo.frequency.value = hz*rd(.8, 1.2); lg.gain.value = g*.5;
      lfo.connect(lg).connect(gn.gain); s.connect(fl).connect(gn).connect(mur); s.start(); lfo.start(); fontes.push(s, lfo); });
    return { bus, canto, palmas, reac, mur, fontes, prox: 0, frase: null, ultimaReac: null, tReac: -9 };
  });
  // ---- uma sílaba cantada por um coro (n vozes) ----
  function silaba(L, t, freq, dur, vog, ganho) {
    const [f1, f2] = vog, a = ctx.createBiquadFilter(), b = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), env = ctx.createGain();
    a.type = b.type = 'bandpass'; a.frequency.value = f1*rd(.95, 1.05); a.Q.value = 5; b.frequency.value = f2*rd(.95, 1.05); b.Q.value = 7; lp.type = 'lowpass'; lp.frequency.value = 2600;
    a.connect(env); b.connect(env); env.connect(lp).connect(L.canto);
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(ganho, t + .06); env.gain.setValueAtTime(ganho, t + dur*.7); env.gain.linearRampToValueAtTime(0, t + dur*.98);
    for (let i = 0; i < 7; i++) { const o = ctx.createOscillator(), g = ctx.createGain(), at = rd(0, .045); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq*Math.pow(2, rd(-.35, .35)/12)*(i % 3 ? 1 : 2), t);
      o.frequency.linearRampToValueAtTime(freq*Math.pow(2, rd(-.2, .2)/12)*(i % 3 ? 1 : 2), t + dur); g.gain.value = .045; o.connect(g); g.connect(a); g.connect(b); o.start(t + at); o.stop(t + dur + .05); }
  }
  // ---- uma batida de palmas (muitas mãos, pequenos atrasos) ----
  function palma(L, t, ganho) { for (let i = 0; i < 12; i++) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), at = t + rd(0, .035);
    s.buffer = CLAP || (CLAP = ruido(ctx, .08)); f.type = 'bandpass'; f.frequency.value = rd(1300, 2600); f.Q.value = 1.2; g.gain.setValueAtTime(ganho*rd(.5, 1), at); g.gain.exponentialRampToValueAtTime(.001, at + .07);
    s.connect(f).connect(g).connect(L.palmas); s.start(at); s.stop(at + .09); } }
  let CLAP = null;
  // ---- reações (uma por lado de cada vez, com crossfade) ----
  function reacao(l, tipo, I = 1) {
    const L = lados[l], t = ctx.currentTime; if (t - L.tReac < .25) return; L.tReac = t;
    if (L.ultimaReac) { const v = L.ultimaReac; v.gain.cancelScheduledValues(t); v.gain.setTargetAtTime(0, t, .12); }
    const v = ctx.createGain(); v.gain.value = 1; v.connect(L.reac); L.ultimaReac = v;
    const varre = (d, g, f0, f1, at, q = .6, atraso = 0) => { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), gn = ctx.createGain(), t0 = t + atraso; s.buffer = ruido(ctx, d); fl.type = 'bandpass'; fl.Q.value = q;
      fl.frequency.setValueAtTime(f0, t0); fl.frequency.exponentialRampToValueAtTime(f1, t0 + d); gn.gain.setValueAtTime(.0001, t0); gn.gain.exponentialRampToValueAtTime(g, t0 + at); gn.gain.setValueAtTime(g, t0 + d*.55); gn.gain.exponentialRampToValueAtTime(.0001, t0 + d);
      s.connect(fl).connect(gn).connect(v); s.start(t0); s.stop(t0 + d + .05); };
    if (tipo === 'explosao') { const d = rd(3.6, 4.6)*(.8 + .3*I); varre(d, 3.2*I, 420, rd(900, 1200), .1); varre(d*.9, 2.1*I, 1100, 1800, .14, .8, .03); varre(d, 1.5*I, 240, 330, .08, .5);
      for (let k = 0; k < 6; k++) varre(rd(.5, .9), .9*I, rd(1500, 2600), rd(2600, 3400), .03, 3, rd(.1, 1.6)); }          // gritos agudos espalhados
    else if (tipo === 'lamento') { const d = rd(1.4, 2.1); varre(d, 1.5*I, 520, 200, .08, .5); varre(d*.8, .6*I, 900, 380, .1, .7, .05); }
    else if (tipo === 'uuh') { const d = rd(1.3, 1.8); varre(d, 1.4*I, 300, rd(800, 1100), d*.75, .6); varre(d, .7*I, 650, 1500, d*.8, .8, .04); }
  }
  // ---- relógio: agenda frases de canto/palmas com 0,3 s de antecedência e ajusta os volumes pelo humor ----
  let rodando = false, timer = null;
  function passo() {
    const t = ctx.currentTime; if (ctx.state !== 'running') return;
    lados.forEach((L, l) => { const s = Humor.lados[l], e = Humor.energia(l), pausa = Humor.pausado;
      // volume de cada camada por humor: calmo canta e bate palma; tensão = murmúrio baixo e quase sem canto; euforia = canto forte; frustração = silêncio
      const canta = pausa ? .15 : s.humor === 0 ? .55 + .35*Humor.calor : s.humor === 2 || s.humor === 5 ? Math.min(1, .5 + e) : s.humor === 1 ? .08 : s.humor === 3 ? 0 : .05;
      const bate = pausa ? 0 : s.humor === 0 ? .5 : s.humor === 2 || s.humor === 5 ? .8 : 0, mur = pausa ? .25 : s.humor === 3 ? .18 : s.humor === 1 ? .55 + .25*s.I : .45 + .3*e;
      L.bus.gain.setTargetAtTime(2.2, t, .5); L.canto.gain.setTargetAtTime(canta, t, .6); L.palmas.gain.setTargetAtTime(bate, t, .4); L.mur.gain.setTargetAtTime(mur, t, .5);
      if (t + .3 >= L.prox && canta > .02) {                                         // próxima frase (melodia, vogal, tom e andamento sorteados)
        const m = MOTIVOS[Math.random()*MOTIVOS.length | 0], vog = VOGAIS[Math.random()*VOGAIS.length | 0], base = rd(150, 175)*(l ? 1.06 : 1), bt = 60/rd(118, 136)*(s.humor === 2 || s.humor === 5 ? .85 : 1);
        let tt = Math.max(t + .05, L.prox); m.forEach(([st, b]) => { silaba(L, tt, base*Math.pow(2, st/12), b*bt, vog, .9); if (bate > 0 && b >= 1) palma(L, tt, .5); tt += b*bt; });
        L.prox = tt + (Math.random() < .35 ? bt*rd(2, 6) : bt);                       // às vezes uma pausa entre as frases
      } else if (canta <= .02) L.prox = t + .3; });
  }
  const aoMudar = e => { if (!rodando) return; const { lado, humor, I, motivo } = e;
    if (humor === 2 || humor === 5) reacao(lado, 'explosao', motivo === 'entrada dos times' ? .45 : I);
    else if (humor === 4) reacao(lado, 'lamento', I); else if (humor === 3 && motivo !== 'volta ao normal') reacao(lado, 'lamento', .45*I);
    else if (humor === 1 && motivo === 'chute') reacao(lado, 'uuh', .8); };
  Humor.onMuda(aoMudar);
  return {
    lados, reacao,
    ligar() { if (rodando) return; rodando = true; lados.forEach(L => { L.prox = 0; }); timer = setInterval(passo, 100); passo(); },
    desligar() { rodando = false; clearInterval(timer); timer = null; const t = ctx.currentTime; lados.forEach(L => { L.bus.gain.cancelScheduledValues(t); L.bus.gain.setTargetAtTime(0, t, .3); }); },
    get rodando() { return rodando; }
  };
}
function ruido(ctx, d) { const n = Math.max(1, ctx.sampleRate*d | 0), b = ctx.createBuffer(1, n, ctx.sampleRate), a = b.getChannelData(0); for (let i = 0; i < n; i++) a[i] = Math.random()*2 - 1; return b; }
