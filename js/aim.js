// Mira estilo "FIFA": a linha oscila SEMPRE na horizontal; ao segurar o botão, um marcador de altura sobe ao mesmo tempo.
// Clique rápido = chute rasteiro na posição capturada; segurar = mais alto. Coordenadas do gol: gx 0..1 (esq→dir), gy 0..1 (chão→travessão).
export const AIM_LIM = { xmin: -0.08, xmax: 1.08, ymin: 0.05, ymax: 1.1 };
export const AIM_BASE = 0.14;                       // altura de um clique rápido
export class Aim {
  constructor() { this.reset(); }
  reset() { this.x = 0.5; this.y = AIM_BASE; this.dir = 1; this.ativa = false; this.hold = false; }
  run() { this.ativa = true; }                      // começa a oscilar (vez do jogador)
  start() { this.ativa = true; this.hold = true; this.y = AIM_BASE; }   // botão pressionado: sobe o marcador sem mexer em x
  update(dt, hs, vs) {                              // dt em segundos → independe do FPS
    if (!this.ativa) return;
    this.x += this.dir * hs * dt;
    if (this.x >= AIM_LIM.xmax) { this.x = AIM_LIM.xmax; this.dir = -1; }
    if (this.x <= AIM_LIM.xmin) { this.x = AIM_LIM.xmin; this.dir = 1; }
    if (this.hold) this.y = Math.min(AIM_LIM.ymax, this.y + vs * dt);
  }
  release() { this.ativa = false; this.hold = false; return { gx: this.x, gy: this.y }; }   // congela e devolve o ponto final
}
