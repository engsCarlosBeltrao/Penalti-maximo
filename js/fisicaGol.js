// FÍSICA DO GOL: traves e travessão como CÁPSULAS (cilindros de 12 cm de diâmetro com pontas arredondadas) no mundo do jogo, e a colisão CONTÍNUA da
// bola com elas (o segmento percorrido em cada passo é subdividido em passos de ≤ 2 cm — a bola rápida não atravessa o ferro). É usada no voo da bola
// (antes de qualquer toque) e na física livre depois de um toque (js/keeper.js → passoLivre): um único sistema de colisão para os ferros.
// Coordenadas: x = largura do gol (esquerda do goleiro = +x), y = altura, z = distância à linha do gol (o campo é z > 0). A medida oficial (7,32 × 2,44 m)
// é a parte de DENTRO: o eixo das traves fica R_FERRO para fora e o do travessão R_FERRO para cima.
import { GOAL_W, GOAL_H, BALL_R } from './rig.js';

export const R_FERRO = .06;
const HW = GOAL_W/2 + R_FERRO, HT = GOAL_H + R_FERRO;
export const FERROS = [
  { nome: 'trave_esq', rotulo: 'trave esquerda (do goleiro)', a: [HW, 0, 0], b: [HW, HT, 0] },
  { nome: 'trave_dir', rotulo: 'trave direita (do goleiro)', a: [-HW, 0, 0], b: [-HW, HT, 0] },
  { nome: 'travessao', rotulo: 'travessão', a: [-HW, HT, 0], b: [HW, HT, 0] },
];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, s) => [a[0]*s, a[1]*s, a[2]*s];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2], len = a => Math.hypot(a[0], a[1], a[2]);
const maisProximo = (p, a, b) => { const ab = sub(b, a), s = Math.max(0, Math.min(1, dot(sub(p, a), ab)/dot(ab, ab))); return add(a, mul(ab, s)); };
// a bola (centro p) toca o ferro? → { ferro, ponto (no eixo), normal (do ferro para a bola), pen (penetração) }
export function tocaFerro(p) {
  for (const f of FERROS) { const q = maisProximo(p, f.a, f.b), d = sub(p, q), L = len(d); if (L < R_FERRO + BALL_R) return { ferro: f, ponto: add(q, mul(d, R_FERRO/(L || 1))), normal: L > 1e-9 ? mul(d, 1/L) : [0, 0, 1], pen: R_FERRO + BALL_R - L }; }
  return null;
}
// varredura CONTÍNUA entre duas posições da bola: o 1º instante (fração u ∈ [0,1]) em que ela encosta num ferro
export function varreFerro(p0, p1) {
  if (Math.min(p0[2], p1[2]) > R_FERRO + BALL_R + .05 || Math.max(p0[2], p1[2]) < -(R_FERRO + BALL_R + .05)) return null;   // longe do plano do gol: nada a testar
  const n = Math.max(1, Math.ceil(len(sub(p1, p0))/.02));
  for (let i = 1; i <= n; i++) { const u = i/n, p = add(p0, mul(sub(p1, p0), u)), h = tocaFerro(p); if (h) return { ...h, u, p }; }
  return null;
}
// resposta ao impacto: a componente normal da velocidade volta (restituição do metal ~0,6), a tangencial perde um pouco (atrito)
export const RESTITUICAO_FERRO = .6, ATRITO_FERRO = .85;
export function reflete(v, n) { const vn = dot(v, n); if (vn >= 0) return v.slice(); const vN = mul(n, vn), vT = sub(v, vN); return add(mul(vN, -RESTITUICAO_FERRO), mul(vT, ATRITO_FERRO)); }
// empurra a bola para fora do ferro (sem ficar presa dentro dele)
export const separa = (p, h) => add(p, mul(h.normal, h.pen + 1e-3));
