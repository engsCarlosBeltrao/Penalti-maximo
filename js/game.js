// Núcleo da disputa: máquina de estados, física da bola, goleiro, regras e renderização Canvas.
import { Events } from './events.js';
import { GS } from './gameState.js';
import { Aim } from './aim.js';
import { sfx, crowd, ambient, level } from './audio.js';
import { Renderer } from './renderer.js';
import { pickKicker } from './players.js';
import { kickSpec, waitSpec, forceFromAim, typeFromForce, ENTRY_S, GOAL_REACTIONS, MISS_REACTIONS, reactionBag, RESULT_WAIT } from './kicks.js';
import * as GK from './keeper.js';
import { keeperScale } from './frame.js';
import { memoriaDe, sortear, registrar, probabilidades } from './goleiroMemoria.js';
import { keeperOf } from './players.js';
export const cfg = { hs: 0.9, vs: 0.6, diff: 'normal', sound: true, vol: 0.5, volCrowd: 0.5 };
// GOLEIRO: js/keeper.js (decisão antecipada, previsão, colisores dos ossos, contato e física). A dificuldade muda o tempo de reação e o erro de leitura
// do goleiro da CPU; quando o goleiro é do jogador, ela vale para o cobrador da CPU (no fácil o goleiro do jogador reage mais rápido).
const T_FLIGHT = .7, W = 960, H = 540, INV = { easy: 'hard', normal: 'normal', hard: 'easy' };
const G = { l:300, r:660, t:150, b:290 }, START = { x:480, y:470 };
const gpt = (gx, gy) => ({ x: G.l + gx*(G.r-G.l), y: G.b - gy*(G.b-G.t) });  // coord. do gol → tela

export const Game = {
  bagGol: reactionBag(Object.keys(GOAL_REACTIONS)), bagMiss: reactionBag(Object.keys(MISS_REACTIONS)),
  aim: new Aim(), m: null, kick: null, aimT: 0, ball: null, t: 0, wait: 0, cb: null, keeperKey: null,
  init(canvas) {
    this.cv = canvas; this.c = canvas.getContext('2d');
    canvas.addEventListener('pointerdown', e => { e.preventDefault(); this.down(e); });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('dragstart', e => e.preventDefault());
    window.addEventListener('pointerup', () => this.up());          // soltar dentro OU fora do canvas
    window.addEventListener('pointercancel', () => this.cancel());
    window.addEventListener('blur', () => this.cancel());
    window.addEventListener('keydown', e => { const k = {ArrowLeft:[.15,.4],ArrowRight:[.85,.4],ArrowUp:[.5,.85],ArrowDown:[.5,.15]}[e.key]; if (k) { e.preventDefault(); this.keeperChoose(k[0], k[1]); } });
    let last = performance.now();
    const STEP = 1/120, loop = n => { const dt = Math.min(.05, (n-last)/1000); last = n; this.acc = (this.acc || 0) + dt; let i = 0; while (this.acc >= STEP && i++ < 12) { this.update(STEP); this.acc -= STEP; }   // passo FIXO (skill physics-tuning): mira e bola não dependem do FPS
      this.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  },
  start(a, b, onEnd, two = false, escolha = [null, null]) {
    this.two = two; this.escolha = escolha;                       // a = jogador, b = adversário
    this.cb = onEnd; this.paused = false; GS.pausado = false; this.fin = null; Renderer.setTeams?.(a, b); ambient(true);
    GS.equipes = [a, b]; GS.placar = [0,0]; GS.cobranca = 1; GS.cobrancasRealizadas = 0; GS.vencedor = null; GS.ultimaCobranca = null;
    this.m = { taken:[0,0], marks:[[],[]], fim:false };
    Events.emit('partida_iniciada', { equipes: GS.equipes });
    this.setTurn(0);
  },
  hum(k = GS.cobrador) { return this.two || k === 0; },     // este chute é de um humano? (no modo 2 pessoas, sempre)
  // PAUSA: congela a simulação (bola, cobrador, goleiro, mira e cronômetros não avançam); retomar continua exatamente de onde parou
  pausar() { if (!this.m || this.fin || this.paused) return false; this.paused = true; GS.pausado = true; Events.emit('pausa', { placar: [...GS.placar] }); return true; },
  retomar() { if (!this.paused) return false; this.paused = false; GS.pausado = false; Events.emit('retomada', { placar: [...GS.placar] }); return true; },
  stop() { this.paused = false; GS.pausado = false; ambient(false); this.fin = null; this.m = null; this.ball = null; GS.estado = 'MENU'; },
  restart() { const [a, b] = GS.equipes, cb = this.cb, t = this.two, e = this.escolha; if (!a) return; Events.emit('partida_reiniciada'); this.start(a, b, cb, t, e); },
  setTurn(k) {
    GS.cobrador = k; this.ball = null;
    const p = pickKicker(GS.equipes[k], GS.cobranca, this.escolha[k]); this.kick = waitSpec(p.id);   /* espera no ponto de partida do estilo; o TIPO só sai da força, ao soltar */ this.aim.reset(); if (this.hum(k)) this.aim.run(); this.keeperKey = null; this.t = 0; this.keeper = GK.novoGoleiro();   /* goleiro zerado a cada vez: nada da cobrança anterior sobra */   // a linha de mira já oscila durante a espera
    this.cpuMira = { gx: Math.min(1.05, Math.max(-.05, .08 + Math.random() * .84)), gy: .12 + Math.random() * .8 + (Math.random() < .08 ? .3 : 0) };   /* a CPU decide a mira antes de correr: assim o instante do chute é previsível */
    this.wait = this.hum(k) ? 0 : ENTRY_S + .6;   /* a CPU espera o cobrador terminar a entrada (caminhada) */ this.dec = this.m.taken[k] >= 4; if (this.dec) sfx('decisiva'); level(this.dec ? .85 : .45);     // cobrança decisiva: 5ª ou morte súbita                       // adversário cobra após breve pausa
    GS.estado = this.hum(k) ? 'AGUARDANDO_COBRANCA' : 'DEFESA_DO_GOLEIRO';
    Events.emit('cobranca_mudou', { cobranca: GS.cobranca, cobrador: k });
  },
  down(e) {
    if (this.paused || !this.m) return;
    if (this.t < ENTRY_S) return;     // espera o cobrador chegar ao ponto de partida (clipe de entrada)
    if (GS.estado === 'AGUARDANDO_COBRANCA') { this.aim.start(); this.aimT = this.t; GS.estado = 'MIRANDO'; level(.75); crowd('expect'); }   // só inicia aqui
    else if (GS.estado === 'DEFESA_DO_GOLEIRO' && e) {                      // toque/clique: terço esquerdo/central/direito da tela escolhe o lado (só antes do limite)
      const r = this.cv.getBoundingClientRect(), nx = (e.clientX - r.left)/r.width, ny = (e.clientY - r.top)/r.height; this.keeperChoose(nx < .38 ? .15 : nx > .62 ? .85 : .5, ny < .3 ? .85 : ny > .6 ? .15 : .4);
    }
  },
  up() {
    if (GS.estado !== 'MIRANDO' || this.paused) return;                  // ignora soltar fora de contexto → sem disparo duplo
    const p = this.aim.release(); this.launch(p.gx, p.gy);
  },
  cancel() { if (GS.estado === 'MIRANDO') { this.aim.reset(); this.aim.run(); GS.estado = 'AGUARDANDO_COBRANCA'; } },  // perda de foco: cancela mira
  launch(gx, gy) {
    GS.estado = this.hum() ? 'CHUTANDO' : 'DEFESA_DO_GOLEIRO';
    // FORÇA = altura da barra no instante em que solta (a mesma que dá a altura do chute); o tipo é decidido UMA vez, aqui, e vale para a animação e para a bola
    const p = pickKicker(GS.equipes[GS.cobrador], GS.cobranca, this.escolha[GS.cobrador]), forca = forceFromAim(gy), ks = this.kick = kickSpec(p.id, typeFromForce(forca));
    this.ball = { gx, gy, t: ks.t0, t0: ks.t0, tf: ks.tf, curl: ks.curl, tipo: ks.tipo, forca, res: null, som: false };   // t<0: aproximação do clipe; a bola só sai no CONTATO (t=0)
    this.rating = p.rating;
    level(1); Events.emit('chute', { equipe: GS.cobrador, tipoCobranca: ks.tipo, estilo: ks.estilo, forca: +forca.toFixed(3) });
    // goleiro da CPU (o jogador cobra): sorteia o lado AGORA, sem olhar a mira; se a corrida começar depois do limite, o lado trava logo em seguida
    if (this.hum()) GK.escolherLado(this.keeper, null, this.forcar?.lado || sortear(this.memGoleiro(), this.rng || Math.random), 'CPU', this.t);   // memória do goleiro (js/goleiroMemoria.js)
    else if (this.forcar?.lado && !this.keeper.lado) GK.escolherLado(this.keeper, null, this.forcar.lado, 'cena de teste', this.t);
    if (this.forcar && !this.forcar.manter) this.forcar = null;
  },
  // opções do goleiro nesta cobrança: dificuldade, escala do corpo (a mesma do modelo na tela), sorteio e a qualidade do cobrador
  // instante previsto (relógio do jogo) em que o pé do cobrador atinge a bola; null enquanto o jogador ainda não soltou a barra
  contatoPrevisto() {
    const b = this.ball; if (b) return b.t < 0 ? this.t - b.t : null;
    if (this.hum() || GS.estado !== 'DEFESA_DO_GOLEIRO') return null;
    const f = this.forcar, gy = f?.gy ?? this.cpuMira?.gy; if (gy == null) return null;
    const p = pickKicker(GS.equipes[GS.cobrador], GS.cobranca, this.escolha[GS.cobrador]), ks = kickSpec(p.id, typeFromForce(forceFromAim(gy)));
    return this.t + Math.max(0, this.wait) - ks.t0;                                    // espera da CPU + duração da corrida (t0 < 0) do clipe que ela vai usar
  },
  // goleiro que está defendendo agora (o do time que NÃO cobra) e a memória das escolhas dele
  idGoleiro() { const t = GS.equipes[1 - GS.cobrador]; if (!t) return 'gk'; return keeperOf(t)?.id || 'gk-' + (t.key || t.id); },
  memGoleiro() { return memoriaDe(this.idGoleiro()); },
  gkOpts() { return { dif: this.hum() ? cfg.diff : INV[cfg.diff], sc: keeperScale(this), rng: this.rng || Math.random, craque: this.rating || 75 }; },
  keeperChoose(x) {                                                // goleiro do jogador: escolhe o canto ANTES do limite (1,5 s antes do chute); depois, ignorado
    if (this.hum() || GS.estado !== 'DEFESA_DO_GOLEIRO' || !this.m) return false;
    return GK.escolherLado(this.keeper, this.ball, x < .38 ? 'dir' : x > .62 ? 'esq' : 'centro', 'jogador', this.t);   // canto esquerdo da TELA = direita do goleiro
  },
  // cena de teste (console: JOGO.Game.testeGoleiro({ gx, gy, lado, manter })): a próxima cobrança da CPU vai nesse ponto e o goleiro escolhe esse lado
  testeGoleiro(o = {}) { this.forcar = { ...o }; return this.forcar; },
  resolve(forcado) {
    const b = this.ball, k = this.keeper; let r;
    const out = b.gx < 0 || b.gx > 1 || b.gy > 1, post = !out && (b.gx < .035 || b.gx > .965 || b.gy > .955);
    if (forcado) r = forcado;                                       // houve contato com o goleiro: quem decidiu foi a física da bola depois do toque
    else if (out) r = 'fora'; else if (post) r = 'trave'; else r = 'gol';   // sem contato, o goleiro não alcançou (o motivo fica em keeper.sem)
    if (k && !k.contato && k.log) k.sem = GK.motivoSemContato(k, b);
    b.res = r; GS.estado = 'RESOLVENDO_COBRANCA';
    b.reacao = r === 'gol' ? this.bagGol() : this.bagMiss();             // reação do cobrador: sorteada UMA vez por cobrança (sacola sem repetição imediata)
    const q = GS.cobrador, m = this.m;
    m.taken[q]++; m.marks[q].push(r === 'gol' ? 'g' : r === 'defesa' ? 'd' : 'x'); GS.cobrancasRealizadas++;
    const gk = k && k.log ? { lado: k.lado, origem: k.origem, clipe: k.plano?.clip ?? null, contato: k.contato ? { parte: k.contato.parte, tipo: k.contato.rotulo, vel: k.contato.vel, velDepois: k.contato.vOutMod } : null, motivo: k.contato ? k.contato.motivo : k.sem } : null;
    GS.ultimaCobranca = { equipe: q, resultado: r, gx: +b.gx.toFixed(3), gy: +b.gy.toFixed(3), goleiro: gk };
    Events.emit(r, { equipe: q, gx: b.gx, gy: b.gy, reacao: b.reacao, goleiro: gk });       // evento único por cobrança
    // sons ligados ao evento CONFIRMADO (um só resultado por cobrança)
    if (r === 'gol') { sfx('rede'); sfx('gol', .05); crowd('roar'); } else if (r === 'trave') { sfx(b.gy > .955 ? 'travessao' : 'trave'); crowd('groan'); } else if (r === 'defesa') { sfx('defesa'); crowd('groan'); } else { sfx('fora'); crowd('groan'); }
    level(r === 'gol' ? 1 : .6);
    if (r === 'gol') { GS.placar[q]++; Events.emit('placar_alterado', { placar: [...GS.placar] }); }
    // Encerramento antecipado: quem está à frente por mais que as cobranças restantes do outro
    const [a, c] = m.taken, [sa, sc] = GS.placar, ra = Math.max(0, 5 - a), rc = Math.max(0, 5 - c);
    if (a <= 5 || c <= 5) m.fim = sa > sc + rc || sc > sa + ra;
    if (a > 5 || c > 5 || (a >= 5 && c >= 5)) m.fim = a === c && sa !== sc;
    this.wait = RESULT_WAIT; this.after = true;   // tempo para a reação do cobrador e do goleiro b.decisiva = m.taken[q] >= 5; GS.estado = 'RESULTADO';
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
    const b = this.ball, k = this.keeper;
    if (GS.estado === 'DEFESA_DO_GOLEIRO' && !b) {                     // adversário prepara o chute
      this.wait -= dt; const f = this.forcar, mira = this.cpuMira; if (this.wait <= 0) this.launch(f?.gx ?? mira.gx, f?.gy ?? mira.gy);
    }
    // PREPARAÇÃO DO GOLEIRO 1,5 s antes do instante PREVISTO do pé na bola (recalibrado a cada passo): com a bola em jogo, o relógio da cobrança dá o
    // instante exato (contato = agora − b.t); antes disso, só a CPU tem o momento da corrida definido (espera + duração da corrida do clipe escolhido).
    if (k && k.log && this.forcar?.lado && !k.lado && !this.hum()) GK.escolherLado(k, b, this.forcar.lado, "cena de teste", this.t);   // cena de teste: lado do goleiro do jogador
    if (k && k.log && !(b && b.t >= 0)) GK.agendar(k, this.t, this.contatoPrevisto());
    if (k && k.log && k.travado && !k.memorizado) { const m = this.memGoleiro(); k.probAntes = probabilidades(m); registrar(m, k.lado); k.memorizado = true; k.idGoleiro = this.idGoleiro(); k.probDepois = probabilidades(m); k.historico = m.historico.slice(); }   // a escolha travada entra na memória deste goleiro
    if (b && !b.res) {
      const tA = b.t; b.t += dt; if (b.t >= 0 && !b.som) { b.som = true; sfx('chute'); GK.registraChute(k, this.t - b.t); }   // som (e registro do goleiro) no instante do contato
      const o = this.gkOpts();
      if (!b.fis) GK.passo(k, b, tA, b.t, o);                                         // trava o lado no limite, planeja o mergulho, detecta o toque (contínuo)
      else GK.passoBola(k, b, dt, o.sc);                                              // depois do toque a bola segue a física (ou fica nas luvas)
      if (b.fis) { if (b.fis.res) this.resolve(b.fis.res); }
      else if (b.t >= (b.tf || T_FLIGHT)) this.resolve();   // tf: tempo de voo do tipo de cobrança (js/kicks.js); sem tipo, 0,7 s
    } else if (b?.res) { b.t += dt; if (b.fis) GK.passoBola(k, b, dt, keeperScale(this)); if (this.after && (this.wait -= dt) <= 0) { this.after = false; this.next(); } }
  },
  draw() { if (this.c) Renderer.drawScene?.(this.c, this); }   // desenho: js/three/engine.js
};
