// Núcleo da disputa: máquina de estados, física da bola, goleiro, regras e renderização Canvas.
import { Events } from './events.js';
import { GS } from './gameState.js';
import { Aim } from './aim.js';
import { sfx, crowd, ambient, level } from './audio.js';
import { Renderer } from './renderer.js';
import { pickKicker } from './players.js';
import { chipAt } from './hud.js';
import { kickSpec, cpuType, clipStart, TYPE_ORDER } from './kicks.js';
import { lerp, sub, len } from './vec.js';
import { sm } from './rig.js';
export const cfg = { hs: 0.9, vs: 0.6, diff: 'normal', sound: true, vol: 0.5, volCrowd: 0.5 };
// Dificuldade: tempo de reação, alcance do braço, erro de leitura, deslocamento máximo do mergulho
const DIFF = { easy:{react:.45,reach:.09,err:.22,dive:.3,vr:.3}, normal:{react:.3,reach:.12,err:.13,dive:.36,vr:.36}, hard:{react:.2,reach:.15,err:.07,dive:.42,vr:.42} };
const T_FLIGHT = .7, T_DIVE = .6, W = 960, H = 540;
const G = { l:300, r:660, t:150, b:290 }, START = { x:480, y:470 };
const gpt = (gx, gy) => ({ x: G.l + gx*(G.r-G.l), y: G.b - gy*(G.b-G.t) });  // coord. do gol → tela

export const Game = {
  aim: new Aim(), m: null, tipoSel: ['medio', 'medio'], kick: null, kmove: null, ball: null, t: 0, wait: 0, cb: null, keeperKey: null,
  init(canvas) {
    this.cv = canvas; this.c = canvas.getContext('2d');
    this.hudHit = e => { const r = canvas.getBoundingClientRect(); return chipAt((e.clientX - r.left)/r.width*W, (e.clientY - r.top)/r.height*H); };
    canvas.addEventListener('pointerdown', e => { e.preventDefault(); this.down(e); });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('dragstart', e => e.preventDefault());
    window.addEventListener('pointerup', () => this.up());          // soltar dentro OU fora do canvas
    window.addEventListener('pointercancel', () => this.cancel());
    window.addEventListener('blur', () => this.cancel());
    window.addEventListener('keydown', e => { const n = { 1: 'chapada', 2: 'medio', 3: 'bomba' }[e.key]; if (n) { this.setTipo(n); return; } const k = {ArrowLeft:[.15,.4],ArrowRight:[.85,.4],ArrowUp:[.5,.85],ArrowDown:[.5,.15]}[e.key]; if (k) { e.preventDefault(); this.keeperChoose(k[0], k[1]); } });
    let last = performance.now();
    const STEP = 1/120, loop = n => { const dt = Math.min(.05, (n-last)/1000); last = n; this.acc = (this.acc || 0) + dt; let i = 0; while (this.acc >= STEP && i++ < 12) { this.update(STEP); this.acc -= STEP; }   // passo FIXO (skill physics-tuning): mira e bola não dependem do FPS
      this.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  },
  start(a, b, onEnd, two = false, escolha = [null, null]) {
    this.two = two; this.escolha = escolha;                       // a = jogador, b = adversário
    this.cb = onEnd; this.paused = false; this.fin = null; Renderer.setTeams?.(a, b); ambient(true);
    GS.equipes = [a, b]; GS.placar = [0,0]; GS.cobranca = 1; GS.cobrancasRealizadas = 0; GS.vencedor = null; GS.ultimaCobranca = null;
    this.m = { taken:[0,0], marks:[[],[]], fim:false };
    Events.emit('partida_iniciada', { equipes: GS.equipes });
    this.setTurn(0);
  },
  hum(k = GS.cobrador) { return this.two || k === 0; },     // este chute é de um humano? (no modo 2 pessoas, sempre)
  stop() { ambient(false); this.fin = null; this.m = null; this.ball = null; GS.estado = 'MENU'; },
  restart() { const [a, b] = GS.equipes, cb = this.cb, t = this.two, e = this.escolha; if (!a) return; Events.emit('partida_reiniciada'); this.start(a, b, cb, t, e); },
  setTurn(k) {
    GS.cobrador = k; this.ball = null; this.kmove = null;
    const p = pickKicker(GS.equipes[k], GS.cobranca, this.escolha[k]); this.kick = kickSpec(p.id, this.hum(k) ? this.tipoSel[k] : cpuType(p.id));   /* tipo: o do jogador humano; a CPU sorteia conforme o estilo do cobrador */ this.aim.reset(); if (this.hum(k)) this.aim.run(); this.keeperKey = null; this.t = 0; this.keeper = { x:.5, tx:.5, t0:0 };   // a linha de mira já oscila durante a espera
    this.wait = this.hum(k) ? 0 : 1.1; this.dec = this.m.taken[k] >= 4; if (this.dec) sfx('decisiva'); level(this.dec ? .85 : .45);     // cobrança decisiva: 5ª ou morte súbita                       // adversário cobra após breve pausa
    GS.estado = this.hum(k) ? 'AGUARDANDO_COBRANCA' : 'DEFESA_DO_GOLEIRO';
    Events.emit('cobranca_mudou', { cobranca: GS.cobranca, cobrador: k });
  },
  // troca o tipo de cobrança (1/2/3 ou os botões do HUD) antes de mirar; se o ponto de partida muda, o cobrador caminha até lá
  setTipo(t) {
    if (!this.m || this.ball || !this.hum() || GS.estado !== 'AGUARDANDO_COBRANCA' || !TYPE_ORDER.includes(t)) return false;
    this.tipoSel[GS.cobrador] = t; const p = pickKicker(GS.equipes[GS.cobrador], GS.cobranca, this.escolha[GS.cobrador]), old = this.kick, nk = kickSpec(p.id, t);
    if (!old || nk.id === old.id) { this.kick = nk; return true; }
    const mv = this.kmove, cur = mv ? lerp(mv.from, clipStart(old.clip).root, sm(mv.t/mv.dur)) : clipStart(old.clip).root, to = clipStart(nk.clip).root;
    this.kick = nk; if (this.t >= .9) this.kmove = { from: cur, t: 0, dur: Math.max(.5, Math.min(1.8, len(sub(to, cur))/1.4)) };   // caminha a ~1,4 m/s
    Events.emit('tipo_cobranca', { tipoCobranca: nk.tipo, estilo: nk.estilo }); return true;
  },
  down(e) {
    if (this.paused || !this.m) return;
    if (e && this.hudHit && GS.estado === 'AGUARDANDO_COBRANCA') { const t = this.hudHit(e); if (t) { this.setTipo(t); return; } }   // botões de tipo no HUD
    if (this.t < .9 || this.kmove) return;     // espera o cobrador chegar ao ponto de partida
    if (GS.estado === 'AGUARDANDO_COBRANCA') { this.aim.start(); GS.estado = 'MIRANDO'; level(.75); crowd('expect'); }   // só inicia aqui
    else if (GS.estado === 'DEFESA_DO_GOLEIRO' && this.ball && e) {          // toque/clique no campo escolhe o lado e a altura do mergulho
      const r = this.cv.getBoundingClientRect(), nx = (e.clientX - r.left)/r.width, ny = (e.clientY - r.top)/r.height; this.keeperChoose(nx < .38 ? .15 : nx > .62 ? .85 : .5, ny < .3 ? .85 : ny > .6 ? .15 : .4);
    }
  },
  up() {
    if (GS.estado !== 'MIRANDO') return;                  // ignora soltar fora de contexto → sem disparo duplo
    const p = this.aim.release(); this.launch(p.gx, p.gy);
  },
  cancel() { if (GS.estado === 'MIRANDO') { this.aim.reset(); this.aim.run(); GS.estado = 'AGUARDANDO_COBRANCA'; } },  // perda de foco: cancela mira
  launch(gx, gy) {
    GS.estado = this.hum() ? 'CHUTANDO' : 'DEFESA_DO_GOLEIRO';
    const ks = this.kick; this.ball = { gx, gy, t: ks.t0, t0: ks.t0, tf: ks.tf, curl: ks.curl, tipo: ks.tipo, res: null, som: false };   // t<0: aproximação do clipe; a bola só sai no CONTATO (t=0)
    this.rating = pickKicker(GS.equipes[GS.cobrador], GS.cobranca, this.escolha[GS.cobrador]).rating;
    this.keeper.t0 = null; level(1); Events.emit('chute', { equipe: GS.cobrador, tipoCobranca: ks.tipo, estilo: ks.estilo });
    if (this.hum()) {                              // goleiro CPU: decide só após o tempo de reação, vendo a bola
      const d = DIFF[cfg.diff]; this.keeper.est = null; this.keeper.d = d;
    }
  },
  keeperChoose(x, th = .4) {                                       // goleiro do jogador: decisão nos primeiros 0,3 s do voo
    const b = this.ball; if (this.hum() || !b || b.t > .3 || this.keeper.t0 != null) return;
    this.keeper.tx = x; this.keeper.th = th; this.keeper.t0 = b.t;
  },
  resolve() {
    const b = this.ball, k = this.keeper; let r;
    const out = b.gx < 0 || b.gx > 1 || b.gy > 1, post = !out && (b.gx < .035 || b.gx > .965 || b.gy > .955);
    if (out) r = 'fora'; else if (post) r = 'trave';
    else {
      const kx = .5 + (k.tx - .5) * Math.min(1, k.t0 == null ? 0 : ((b.tf || T_FLIGHT) - k.t0) / T_DIVE);
      const reach = (this.hum() ? DIFF[cfg.diff].reach : .12) * (b.gy > .8 ? .6 : 1) * (1 - ((this.rating || 75) - 75) / 500);   // craque dificulta um pouco
      const ky = .3 + ((k.th ?? .3) - .3) * Math.min(1, k.t0 == null ? 0 : ((b.tf || T_FLIGHT) - k.t0) / T_DIVE);   // altura alcançada pelo goleiro
      r = Math.abs(kx - b.gx) < reach && Math.abs(ky - b.gy) < (this.hum() ? DIFF[cfg.diff].vr : .36) ? 'defesa' : 'gol';
    }
    b.res = r; GS.estado = 'RESOLVENDO_COBRANCA';
    const q = GS.cobrador, m = this.m;
    m.taken[q]++; m.marks[q].push(r === 'gol' ? 'g' : r === 'defesa' ? 'd' : 'x'); GS.cobrancasRealizadas++;
    GS.ultimaCobranca = { equipe: q, resultado: r, gx: +b.gx.toFixed(3), gy: +b.gy.toFixed(3) };
    Events.emit(r, { equipe: q, gx: b.gx, gy: b.gy });                      // evento único por cobrança
    // sons ligados ao evento CONFIRMADO (um só resultado por cobrança)
    if (r === 'gol') { sfx('rede'); sfx('gol', .05); crowd('roar'); } else if (r === 'trave') { sfx(b.gy > .955 ? 'travessao' : 'trave'); crowd('groan'); } else if (r === 'defesa') { sfx('defesa'); crowd('groan'); } else { sfx('fora'); crowd('groan'); }
    level(r === 'gol' ? 1 : .6);
    if (r === 'gol') { GS.placar[q]++; Events.emit('placar_alterado', { placar: [...GS.placar] }); }
    // Encerramento antecipado: quem está à frente por mais que as cobranças restantes do outro
    const [a, c] = m.taken, [sa, sc] = GS.placar, ra = Math.max(0, 5 - a), rc = Math.max(0, 5 - c);
    if (a <= 5 || c <= 5) m.fim = sa > sc + rc || sc > sa + ra;
    if (a > 5 || c > 5 || (a >= 5 && c >= 5)) m.fim = a === c && sa !== sc;
    this.wait = 1.9; this.after = true; b.decisiva = m.taken[q] >= 5; GS.estado = 'RESULTADO';
  },
  next() {
    const m = this.m;
    if (m.fim) {
      GS.vencedor = GS.placar[0] > GS.placar[1] ? 0 : 1; GS.estado = 'RESULTADO';
      Events.emit('partida_encerrada', { placar: [...GS.placar], vencedor: GS.vencedor });
      Events.emit(GS.vencedor === 0 ? 'vitoria' : 'derrota'); sfx('vitoria'); crowd('roarBig'); level(1);
      this.fin = { t: 0 }; return;      // comemoração SÓ agora (resultado final confirmado); o callback vem em finish()
    }
    if (GS.cobrador === 1) GS.cobranca++;
    this.setTurn(GS.cobrador ^ 1);
  },
  finish() { const marks = this.m.marks; this.m = null; this.fin = null; ambient(false); this.cb?.(GS.vencedor === 0, [...GS.placar], marks); },
  update(dt) {
    if (this.paused || !this.m) return;
    if (this.fin) { this.fin.t += dt; this.t += dt; if (this.fin.t > 4.4) this.finish(); return; }
    this.t += dt; this.aim.update(dt, cfg.hs, cfg.vs);
    if (this.kmove && (this.kmove.t += dt) >= this.kmove.dur) this.kmove = null;
    const b = this.ball, k = this.keeper;
    if (GS.estado === 'DEFESA_DO_GOLEIRO' && !b) {                     // adversário prepara o chute
      this.wait -= dt; if (this.wait <= 0) this.launch(Math.min(1.05, Math.max(-.05, .08 + Math.random() * .84)), .12 + Math.random() * .8 + (Math.random() < .08 ? .3 : 0));
    }
    if (b && !b.res) {
      b.t += dt; if (b.t >= 0 && !b.som) { b.som = true; sfx('chute'); }   // som no instante do contato
      if (this.hum() && k.t0 == null && b.t >= k.d.react) {      // CPU reage vendo a direção da bola
        k.t0 = b.t; k.th = Math.max(0, Math.min(1, b.gy + (Math.random() * 2 - 1) * k.d.err*1.5)); const est = b.gx + (Math.random() * 2 - 1) * k.d.err; k.tx = .5 + Math.max(-k.d.dive, Math.min(k.d.dive, est - .5));
      }
      if (k.t0 != null) k.x = .5 + (k.tx - .5) * Math.min(1, (b.t - k.t0) / T_DIVE);
      if (b.t >= (b.tf || T_FLIGHT)) this.resolve();   // tf: tempo de voo do tipo de cobrança (js/kicks.js); sem tipo, 0,7 s
    } else if (b?.res) { b.t += dt; if (this.after && (this.wait -= dt) <= 0) { this.after = false; this.next(); } }
  },
  draw() { if (this.c) Renderer.drawScene?.(this.c, this); }   // desenho: js/three/engine.js
};
