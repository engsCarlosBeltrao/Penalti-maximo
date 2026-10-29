// Núcleo da disputa: máquina de estados, física da bola, goleiro, regras e renderização Canvas.
import { Events } from './events.js';
import { GS } from './gameState.js';
import { Aim } from './aim.js';
import { sfx } from './audio.js';
import { drawScene } from './render.js';
import { pickKicker } from './players.js';
export const cfg = { hs: 0.9, vs: 0.6, diff: 'normal', sound: true, vol: 0.5 };
// Dificuldade: tempo de reação, alcance do braço, erro de leitura, deslocamento máximo do mergulho
const DIFF = { easy:{react:.45,reach:.09,err:.22,dive:.3}, normal:{react:.3,reach:.12,err:.13,dive:.36}, hard:{react:.2,reach:.15,err:.07,dive:.42} };
const T_FLIGHT = .7, T_DIVE = .6, W = 960, H = 540;
const G = { l:300, r:660, t:150, b:290 }, START = { x:480, y:470 };
const gpt = (gx, gy) => ({ x: G.l + gx*(G.r-G.l), y: G.b - gy*(G.b-G.t) });  // coord. do gol → tela

export const Game = {
  aim: new Aim(), m: null, ball: null, t: 0, wait: 0, cb: null, keeperKey: null,
  init(canvas) {
    this.cv = canvas; this.c = canvas.getContext('2d');
    canvas.addEventListener('pointerdown', e => { e.preventDefault(); this.down(e); });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('dragstart', e => e.preventDefault());
    window.addEventListener('pointerup', () => this.up());          // soltar dentro OU fora do canvas
    window.addEventListener('pointercancel', () => this.cancel());
    window.addEventListener('blur', () => this.cancel());
    window.addEventListener('keydown', e => { const k = {ArrowLeft:0.15,ArrowRight:0.85,ArrowUp:0.5,ArrowDown:0.5}[e.key]; if (k!=null) { e.preventDefault(); this.keeperChoose(k); } });
    let last = performance.now();
    const loop = n => { const dt = Math.min(.05, (n-last)/1000); last = n; this.update(dt); this.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  },
  start(a, b, onEnd, two = false, escolha = [null, null]) {
    this.two = two; this.escolha = escolha;                       // a = jogador, b = adversário
    this.cb = onEnd; this.paused = false;
    GS.equipes = [a, b]; GS.placar = [0,0]; GS.cobranca = 1; GS.cobrancasRealizadas = 0; GS.vencedor = null; GS.ultimaCobranca = null;
    this.m = { taken:[0,0], marks:[[],[]], fim:false };
    Events.emit('partida_iniciada', { equipes: GS.equipes });
    this.setTurn(0);
  },
  hum(k = GS.cobrador) { return this.two || k === 0; },     // este chute é de um humano? (no modo 2 pessoas, sempre)
  stop() { this.m = null; this.ball = null; GS.estado = 'MENU'; },
  restart() { const [a, b] = GS.equipes, cb = this.cb, t = this.two, e = this.escolha; if (!a) return; Events.emit('partida_reiniciada'); this.start(a, b, cb, t, e); },
  setTurn(k) {
    GS.cobrador = k; this.ball = null; this.aim.reset(); this.keeperKey = null; this.t = 0; this.keeper = { x:.5, tx:.5, t0:0 };
    this.wait = this.hum(k) ? 0 : 1.1;                       // adversário cobra após breve pausa
    GS.estado = this.hum(k) ? 'AGUARDANDO_COBRANCA' : 'DEFESA_DO_GOLEIRO';
    Events.emit('cobranca_mudou', { cobranca: GS.cobranca, cobrador: k });
  },
  down() {
    if (this.paused || !this.m || this.t < .9) return;     // espera o cobrador chegar à bola
    if (GS.estado === 'AGUARDANDO_COBRANCA') { this.aim.start(); GS.estado = 'MIRANDO'; }   // só inicia aqui
    else if (GS.estado === 'DEFESA_DO_GOLEIRO' && this.ball) { /* mouse: lado clicado */ }
  },
  up() {
    if (GS.estado !== 'MIRANDO') return;                  // ignora soltar fora de contexto → sem disparo duplo
    const p = this.aim.release(); this.launch(p.gx, p.gy);
  },
  cancel() { if (GS.estado === 'MIRANDO') { this.aim.reset(); GS.estado = 'AGUARDANDO_COBRANCA'; } },  // perda de foco: cancela mira
  launch(gx, gy) {
    GS.estado = this.hum() ? 'CHUTANDO' : 'DEFESA_DO_GOLEIRO';
    this.ball = { gx, gy, t: -.2, res: null, som: false };     // t<0: corrida de aproximação; a bola só sai no CONTATO (t=0)
    this.rating = pickKicker(GS.equipes[GS.cobrador], GS.cobranca, this.escolha[GS.cobrador]).rating;
    this.keeper.t0 = null;
    if (this.hum()) {                              // goleiro CPU: decide só após o tempo de reação, vendo a bola
      const d = DIFF[cfg.diff]; this.keeper.est = null; this.keeper.d = d;
    }
  },
  keeperChoose(x) {                                       // goleiro do jogador: decisão nos primeiros 0,3 s do voo
    const b = this.ball; if (this.hum() || !b || b.t > .3 || this.keeper.t0 != null) return;
    this.keeper.tx = x; this.keeper.t0 = b.t;
  },
  resolve() {
    const b = this.ball, k = this.keeper; let r;
    const out = b.gx < 0 || b.gx > 1 || b.gy > 1, post = !out && (b.gx < .035 || b.gx > .965 || b.gy > .955);
    if (out) r = 'fora'; else if (post) r = 'trave';
    else {
      const kx = .5 + (k.tx - .5) * Math.min(1, k.t0 == null ? 0 : (T_FLIGHT - k.t0) / T_DIVE);
      const reach = (this.hum() ? DIFF[cfg.diff].reach : .12) * (b.gy > .8 ? .6 : 1) * (1 - ((this.rating || 75) - 75) / 500);   // craque dificulta um pouco
      r = Math.abs(kx - b.gx) < reach && b.gy < .9 ? 'defesa' : 'gol';
    }
    b.res = r; GS.estado = 'RESOLVENDO_COBRANCA';
    const q = GS.cobrador, m = this.m;
    m.taken[q]++; m.marks[q].push(r === 'gol' ? 'g' : r === 'defesa' ? 'd' : 'x'); GS.cobrancasRealizadas++;
    GS.ultimaCobranca = { equipe: q, resultado: r, gx: +b.gx.toFixed(3), gy: +b.gy.toFixed(3) };
    Events.emit(r, { equipe: q, gx: b.gx, gy: b.gy });                      // evento único por cobrança
    sfx(r);
    if (r === 'gol') { GS.placar[q]++; Events.emit('placar_alterado', { placar: [...GS.placar] }); }
    // Encerramento antecipado: quem está à frente por mais que as cobranças restantes do outro
    const [a, c] = m.taken, [sa, sc] = GS.placar, ra = Math.max(0, 5 - a), rc = Math.max(0, 5 - c);
    if (a <= 5 || c <= 5) m.fim = sa > sc + rc || sc > sa + ra;
    if (a > 5 || c > 5 || (a >= 5 && c >= 5)) m.fim = a === c && sa !== sc;
    this.wait = 1.4; this.after = true; GS.estado = 'RESULTADO';
  },
  next() {
    const m = this.m;
    if (m.fim) {
      GS.vencedor = GS.placar[0] > GS.placar[1] ? 0 : 1; GS.estado = 'RESULTADO';
      Events.emit('partida_encerrada', { placar: [...GS.placar], vencedor: GS.vencedor });
      Events.emit(GS.vencedor === 0 ? 'vitoria' : 'derrota'); sfx('fim');
      const marks = this.m.marks; this.m = null; this.cb?.(GS.vencedor === 0, [...GS.placar], marks); return;
    }
    if (GS.cobrador === 1) GS.cobranca++;
    this.setTurn(GS.cobrador ^ 1);
  },
  update(dt) {
    if (this.paused || !this.m) return;
    this.t += dt; this.aim.update(dt, cfg.hs, cfg.vs);
    const b = this.ball, k = this.keeper;
    if (GS.estado === 'DEFESA_DO_GOLEIRO' && !b) {                     // adversário prepara o chute
      this.wait -= dt; if (this.wait <= 0) this.launch(Math.min(1.05, Math.max(-.05, .08 + Math.random() * .84)), .12 + Math.random() * .8 + (Math.random() < .08 ? .3 : 0));
    }
    if (b && !b.res) {
      b.t += dt; if (b.t >= 0 && !b.som) { b.som = true; sfx('chute'); }   // som no instante do contato
      if (this.hum() && k.t0 == null && b.t >= k.d.react) {      // CPU reage vendo a direção da bola
        k.t0 = b.t; const est = b.gx + (Math.random() * 2 - 1) * k.d.err; k.tx = .5 + Math.max(-k.d.dive, Math.min(k.d.dive, est - .5));
      }
      if (k.t0 != null) k.x = .5 + (k.tx - .5) * Math.min(1, (b.t - k.t0) / T_DIVE);
      if (b.t >= T_FLIGHT) this.resolve();
    } else if (b?.res) { b.t += dt; if (this.after && (this.wait -= dt) <= 0) { this.after = false; this.next(); } }
  },
  draw() { if (this.c) drawScene(this.c, this); }   // desenho em js/render.js
};
