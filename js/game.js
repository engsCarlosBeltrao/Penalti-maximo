// Núcleo da disputa: máquina de estados, física da bola, goleiro, regras e renderização Canvas.
import { Events } from './events.js';
import { GS } from './gameState.js';
import { Aim, AIM_BASE } from './aim.js';
import { Humor } from './torcidaHumor.js';
import { sfx, ambient } from './audio.js';
import { Renderer } from './renderer.js';
import { pickKicker } from './players.js';
import { kickSpec, waitSpec, forceFromAim, typeFromForce, fatorVelocidade, ENTRY_S, GOAL_REACTIONS, MISS_REACTIONS, reactionBag, RESULT_WAIT, CORRIDA, VICTORY_REACTIONS, FIN_S, FIN_PULAR } from './kicks.js';
import * as GK from './keeper.js';
import { keeperScale, planoFesta } from './frame.js';
import { memoriaDe, sortear, registrar, probabilidades } from './goleiroMemoria.js';
import { keeperOf } from './players.js';
export const cfg = { hs: 0.9, vs: 0.6, diff: 'normal', sound: true, vol: 0.5, volCrowd: 0.5 };
// GOLEIRO: js/keeper.js (decisão antecipada, previsão, colisores dos ossos, contato e física). A dificuldade muda o tempo de reação e o erro de leitura
// do goleiro da CPU; quando o goleiro é do jogador, ela vale para o cobrador da CPU (no fácil o goleiro do jogador reage mais rápido).
const T_FLIGHT = .7, W = 960, H = 540, INV = { easy: 'hard', normal: 'normal', hard: 'easy' };
const embaralha = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
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
    // CHUTE pelo teclado: ESPAÇO apertado trava a direção e começa a carga; solto, chuta (o mesmo down/up do mouse e do arcade)
    window.addEventListener('keydown', e => { if (e.code === 'Space' && this.m && !this.paused) { e.preventDefault(); if (!e.repeat) this.down(null); } });
    window.addEventListener('keyup', e => { if (e.code === 'Space') this.up(); });
    let last = performance.now();
    const STEP = 1/120, loop = n => { const dt = Math.min(.05, (n-last)/1000); last = n; this.acc = (this.acc || 0) + dt; let i = 0; while (this.acc >= STEP && i++ < 12) { this.update(STEP); this.acc -= STEP; }   // passo FIXO (skill physics-tuning): mira e bola não dependem do FPS
      this.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  },
  start(a, b, onEnd, two = false, escolha = [null, null]) {
    GK.aquecer(); this.two = two; this.escolha = escolha;                       // a = jogador, b = adversário
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
    this.wait = this.hum(k) ? 0 : ENTRY_S + .6;   /* a CPU espera o cobrador terminar a entrada (caminhada) */ this.dec = this.m.taken[k] >= 4; if (this.dec) sfx('decisiva');     // cobrança decisiva: 5ª ou morte súbita                       // adversário cobra após breve pausa
    GS.estado = this.hum(k) ? 'AGUARDANDO_COBRANCA' : 'DEFESA_DO_GOLEIRO';
    Events.emit('cobranca_mudou', { cobranca: GS.cobranca, cobrador: k, decisiva: this.dec });
  },
  down(e) {
    if (this.paused || !this.m) return;
    if (this.fin) { if (this.fin.t > FIN_PULAR) this.finish(); return; }   // festa do título: clique / ESPAÇO / ARCADE pula para o resultado
    if (this.t < ENTRY_S) return;     // espera o cobrador chegar ao ponto de partida (clipe de entrada)
    if (GS.estado === 'AGUARDANDO_COBRANCA') { this.aim.start(); this.aimT = this.t; GS.estado = 'MIRANDO'; }   // só inicia aqui
    else if (GS.estado === 'DEFESA_DO_GOLEIRO' && e) {                      // toque/clique: terço esquerdo/central/direito da tela escolhe o lado (só antes do limite)
      const r = this.cv.getBoundingClientRect(), nx = (e.clientX - r.left)/r.width, ny = (e.clientY - r.top)/r.height; this.keeperChoose(nx < .38 ? .15 : nx > .62 ? .85 : .5, ny < .3 ? .85 : ny > .6 ? .15 : .4);
    }
  },
  up() {
    if (GS.estado !== 'MIRANDO' || this.paused) return;                  // ignora soltar fora de contexto → sem disparo duplo
    const a = this.aim, incl = a.inclinacao, p = a.release(); this.launch(p.gx, p.gy, p.forca); if (this.ball?.mira) this.ball.mira.inclinacao = incl;
  },
  cancel() { if (GS.estado === 'MIRANDO') { const a = this.aim; a.hold = false; a.y = AIM_BASE; a.carga = 0; GS.estado = 'AGUARDANDO_COBRANCA'; } },  // perda de foco: cancela a carga e a seta volta a oscilar
  // A SETA DA MIRA só existe com a cobrança LIBERADA de verdade: vez do jogador, cobrador já no ponto, sem bola em jogo, sem pausa nem fim de jogo
  miraVisivel() { return !!this.m && !this.fin && !this.paused && this.hum() && !this.ball && ((GS.estado === 'AGUARDANDO_COBRANCA' && this.t >= ENTRY_S) || GS.estado === 'MIRANDO'); },
  launch(gx, gy, forcaJogador) {
    GS.estado = this.hum() ? 'CHUTANDO' : 'DEFESA_DO_GOLEIRO';
    // jogador (seta 3D): direção travada ao apertar, altura = inclinação da seta e força = tempo apertado (os dois saem da mesma barra); a bola usa
    // EXATAMENTE esses valores — o tipo/clipe e a velocidade saem da força (mais força, voo mais curto). CPU / testes antigos: launch(gx, gy) com a força pela altura.
    const p = pickKicker(GS.equipes[GS.cobrador], GS.cobranca, this.escolha[GS.cobrador]), forca = forcaJogador ?? forceFromAim(gy), ks = this.kick = kickSpec(p.id, typeFromForce(forca));
    const mira = forcaJogador != null ? { gx, gy, forca, inclinacao: this.aim.inclinacao } : null;
    const tf = forcaJogador != null ? ks.tf*fatorVelocidade(forca) : ks.tf;
    this.ball = { gx, gy, mira, t: ks.t0/CORRIDA, t0: ks.t0/CORRIDA, tf, curl: ks.curl, tipo: ks.tipo, forca, res: null, som: false,
      chute: { clipe: ks.id, contatoClipe: +(ks.clip.contato ?? 0).toFixed(3), folgaPeMm: ks.clip.folgaContatoMm ?? null, velPe: ks.clip.velPe ?? null, forca: +forca.toFixed(3) } };   // contato do pé com a bola medido no clipe (tools/build-kick-clips.mjs): a bola sai nesse instante   // t<0: aproximação do clipe; a bola só sai no CONTATO (t=0)
    this.rating = p.rating;
    Events.emit('chute', { equipe: GS.cobrador, tipoCobranca: ks.tipo, estilo: ks.estilo, forca: +forca.toFixed(3) });
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
    return this.t + Math.max(0, this.wait) - ks.t0/CORRIDA;                                    // espera da CPU + duração da corrida (t0 < 0) do clipe que ela vai usar
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
    const out = b.gx < 0 || b.gx > 1 || b.gy > 1;   // trave/travessão: só pela colisão física (js/fisicaGol.js), nunca pela mira
    if (forcado) r = forcado;                                       // houve contato com o goleiro: quem decidiu foi a física da bola depois do toque
    else if (out) r = 'fora'; else r = 'gol';   // sem contato, o goleiro não alcançou (o motivo fica em keeper.sem)
    if (k && !k.contato && k.log) k.sem = GK.motivoSemContato(k, b);
    b.res = r; GS.estado = 'RESOLVENDO_COBRANCA';
    b.reacao = r === 'gol' ? this.bagGol() : this.bagMiss();             // reação do cobrador: sorteada UMA vez por cobrança (sacola sem repetição imediata)
    const q = GS.cobrador, m = this.m;
    m.taken[q]++; m.marks[q].push(r === 'gol' ? 'g' : r === 'defesa' ? 'd' : 'x'); GS.cobrancasRealizadas++;
    const gk = k && k.log ? { lado: k.lado, origem: k.origem, clipe: k.plano?.clip ?? null, contato: k.contato ? { parte: k.contato.parte, tipo: k.contato.rotulo, vel: k.contato.vel, velDepois: k.contato.vOutMod } : null, motivo: k.contato ? k.contato.motivo : k.sem } : null;
    GS.ultimaCobranca = { equipe: q, resultado: r, gx: +b.gx.toFixed(3), gy: +b.gy.toFixed(3), goleiro: gk };
    Events.emit(r, { equipe: q, gx: b.gx, gy: b.gy, reacao: b.reacao, goleiro: gk });       // evento único por cobrança
    // sons ligados ao evento CONFIRMADO (um só resultado por cobrança)
    if (r === 'gol') { sfx('rede'); sfx('gol', .05); } else if (r === 'trave') { sfx(b.fis?.ferros?.[0] === 'travessao' ? 'travessao' : 'trave'); } else if (r === 'defesa') { sfx('defesa'); } else { sfx('fora'); }
    // a torcida (explosão de quem comemora, lamento de quem sofreu) reage ao evento acima: js/torcidaSom.js pelo humor de cada lado
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
      Events.emit(GS.vencedor === 0 ? 'vitoria' : 'derrota'); sfx('vitoria');
      this.fin = { t: 0, vit: embaralha(Object.keys(VICTORY_REACTIONS)), perdeu: embaralha(Object.keys(MISS_REACTIONS))[0] }; this.fin.festa = planoFesta(this, this.rng || Math.random); return;   // cada vencedor com uma comemoração diferente      // comemoração SÓ agora (resultado final confirmado); o callback vem em finish()
    }
    if (GS.cobrador === 1) GS.cobranca++;
    this.setTurn(GS.cobrador ^ 1);
  },
  finish() { const marks = this.m.marks; this.m = null; this.fin = null; ambient(false); this.cb?.(GS.vencedor === 0, [...GS.placar], marks); },
  update(dt) {
    if (this.paused || !this.m) return;
    if (this.fin) { this.fin.t += dt; this.t += dt; Humor.update(dt); if (this.fin.t > FIN_S) this.finish(); return; }   // festa do título (js/frame.js → festa)
    this.t += dt; this.aim.update(dt, cfg.hs, cfg.vs); Humor.update(dt);   // humor da torcida (para junto com a pausa)
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
      const tA = b.t; b.t += dt; if (b.t >= 0 && !b.som) { b.som = true; b.impulsos = (b.impulsos || 0) + 1; sfx('chute'); GK.registraChute(k, this.t - b.t); }   // o pé toca a bola: ÚNICO impulso (b.som trava o 2º)   // som (e registro do goleiro) no instante do contato
      const o = this.gkOpts();
      if (!b.fis) GK.passo(k, b, tA, b.t, o);                                         // trava o lado no limite, planeja o mergulho, detecta o toque (contínuo)
      else GK.passoBola(k, b, dt, o.sc);                                              // depois do toque a bola segue a física (ou fica nas luvas)
      if (b.fis) { if (b.fis.res) this.resolve(b.fis.res !== 'gol' && b.fis.trave && !k.contato ? 'trave' : b.fis.res); }   // bateu no ferro sem o goleiro tocar e não entrou: trave
      else if (b.t >= (b.tf || T_FLIGHT)) this.resolve();   // tf: tempo de voo do tipo de cobrança (js/kicks.js); sem tipo, 0,7 s
    } else if (b?.res) { b.t += dt; if (b.fis) GK.passoBola(k, b, dt, keeperScale(this)); if (this.after && (this.wait -= dt) <= 0) { this.after = false; this.next(); } }
  },
  draw() { if (this.c) Renderer.drawScene?.(this.c, this); }   // desenho: js/three/engine.js
};
