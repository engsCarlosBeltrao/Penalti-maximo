// MIRA DA COBRANÇA — mecânica do FIFA 17, com a seta 3D no gramado (js/three/setaMira.js):
//  1) cobrança liberada: a seta OSCILA sozinha de um lado para o outro (movimento senoidal, suave nas pontas);
//  2) apertou o chute: começa a carga — a seta CONTINUA oscilando (o jogador escolhe a direção no instante de soltar);
//  3) segurando: a força sobe com o tempo real apertado — a seta se preenche da base até a ponta e a ponta SOBE (inclinação = altura do chute);
//  4) soltou: a direção daquele instante, a altura e a força ficam registradas e a cobrança sai com esses valores.
// Coordenadas do gol: gx 0..1 (esquerda→direita na tela), gy 0..1 (chão→travessão); fora disso a bola vai para fora.
// Força e altura vêm da MESMA "barra" (sobe a cfg.vs por segundo a partir de AIM_BASE): forca = forceFromAim(barra) — js/kicks.js — e gy = barra.
export const AIM_LIM = { xmin: -0.08, xmax: 1.08, ymin: 0.05, ymax: 1.1 };   // amplitude da oscilação (x) e faixa da barra (força 0 em ymin, 100% em ymax)
export const AIM_BASE = 0.14;                       // barra num toque rápido: força mínima (~9%) e chute rasteiro
// AJUSTES DA MIRA (um lugar só). A velocidade da oscilação e a da carga vêm das Configurações do jogo (cfg.hs e cfg.vs, js/game.js):
//  - tempo até a força máxima = (AIM_LIM.ymax - AIM_BASE)/cfg.vs  (1,6 s no padrão cfg.vs = 0,6)
//  - período da oscilação = 2·(xmax - xmin)/cfg.hs              (≈2,6 s no padrão cfg.hs = 0,9)
export const MIRA_CFG = {
  centro: 0.5, amplitude: (AIM_LIM.xmax - AIM_LIM.xmin)/2,   // oscilação horizontal: centro e meia largura (de -8% a 108% da boca do gol)
  forcaMin: 0, forcaMax: 1,                                  // força registrada fica sempre nesse intervalo
  inclMin: 2, inclMax: 34,                                   // inclinação da seta em graus: quase rente ao gramado → ponta bem alta (força máxima)
  comprimento: 2.4, largura: 0.22, ponta: 0.5, espessura: 0.035   // forma da seta 3D (m)
};
export const tempoForcaMax = vs => (AIM_LIM.ymax - AIM_BASE)/vs;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export class Aim {
  constructor() { this.reset(); }
  reset() { this.fase = -Math.PI/2; this.x = MIRA_CFG.centro - MIRA_CFG.amplitude; this.y = AIM_BASE; this.ativa = false; this.hold = false; this.carga = 0; }   // começa num canto e vai para o outro
  run() { this.ativa = true; }                      // vez do jogador: começa a oscilar (a seta só APARECE quando a cobrança é liberada: Game.miraVisivel)
  start() { this.ativa = true; this.hold = true; this.y = AIM_BASE; this.carga = 0; }   // apertou: a carga começa do mínimo (a seta segue oscilando)
  update(dt, hs, vs) {                              // dt em segundos → independe do FPS
    if (!this.ativa) return;
    const periodo = 2*(AIM_LIM.xmax - AIM_LIM.xmin)/Math.max(.05, hs); this.fase += 2*Math.PI*dt/periodo; this.x = MIRA_CFG.centro + MIRA_CFG.amplitude*Math.sin(this.fase);   // oscila SEMPRE, também carregando
    if (this.hold) { this.carga += dt; this.y = Math.min(AIM_LIM.ymax, this.y + vs*dt); }   // segurando: a barra sobe (com teto)
  }
  get barra() { return this.y; }
  get forca() { return clamp((this.y - AIM_LIM.ymin)/(AIM_LIM.ymax - AIM_LIM.ymin), MIRA_CFG.forcaMin, MIRA_CFG.forcaMax); }
  get inclinacao() { return MIRA_CFG.inclMin + (MIRA_CFG.inclMax - MIRA_CFG.inclMin)*(this.hold ? this.forca : 0); }   // graus
  release() { const r = { gx: this.x, gy: this.y, forca: this.forca, inclinacao: this.inclinacao }; this.ativa = false; this.hold = false; return r; }   // congela e devolve o registrado
}
