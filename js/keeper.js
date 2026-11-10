// GOLEIRO — decisão antecipada do lado, previsão do cruzamento no plano do gol, mergulho com os clipes retargetados das animações fornecidas
// (js/keeperClips.js, gerado por tools/blender/goleiro.py), ALCANCE REAL por colisores presos aos ossos do próprio clipe, detecção CONTÍNUA do contato,
// resultado do contato (agarrada · espalmada · rebatida · parcial · raspão) e física da bola depois do toque.
// Módulo puro (sem DOM/WebGL): o jogo (game.js) chama, o quadro (frame.js) lê, os testes (test_keeper.mjs) exercitam.
//
// Lados SEMPRE do ponto de vista do GOLEIRO: ele olha para +z (para o cobrador), a ESQUERDA dele é +x do mundo (= lado direito da tela, que olha de trás
// do cobrador). Nos clipes vale o mesmo (x = esquerda do goleiro), então animação, física e bola usam o mesmo referencial.
import { KEEPER_CLIPS } from './keeperClips.js';
import { goalToWorld, GOAL_W, GOAL_H, BALL_R, SPOT_Z, sm } from './rig.js';
import { varreFerro, reflete, separa } from './fisicaGol.js';

export const KEEPER_CFG = {
  // PREPARAÇÃO: começa 1,5 s antes do instante PREVISTO em que o pé do cobrador atinge a bola (recalculado a cada passo; se o chute vier antes,
  // começa na hora). Nesse instante o lado escolhido TRAVA (sem escolha → centro) e o goleiro começa os ajustes de pés, flexão, braços e o split-step.
  decisaoAntes: 1.5,
  compromisso: .45,
  corpo: { e: .3, atrito: .8, cede: .25 },   // rebote da bola LIVRE no corpo do goleiro (depois do 1º toque)
  regua: { meia: GOAL_W/6 },   // régua roxa (MEIO): meia-largura = 1,22 m (a área central inteira)
  erroLateral: .6,
  luva: .04,   // m: espessura da espuma da luva — a outra mão conta como contato se a bola chega a ela (no mesmo trajeto de ~0,02 s)   // fração do erro de leitura aplicada à direção lateral   // m: com lado escolhido, bola lida a menos disso para dentro do lado → segue o mergulho (não troca por passo curto)
  raiz: [0, 0, .2],                               // posição inicial: centro do gol, pés sobre a linha (a pelve a 20 cm do plano do gol)
  zonas: { centroX: .9, baixaY: .6, altaY: 1.45 },  // classificação no plano do gol (m): |x| < centroX = centro; y < baixaY = baixa; y > altaY = alta
  // preparação (gk_prepara, 1,5 s) e, com lado escolhido, o peso indo para aquele pé: o começo do mergulho (t) misturado com peso w, em `rampa` s
  prep: { anim: 'gk_prepara', clipe: { esq: 'gk_esq_media', dir: 'gk_dir_media' }, t: .2, w: .3, rampa: .6 },
  // quanto do começo do clipe pode ser "pulado" ao sincronizar. Nos clipes fornecidos o goleiro passa ~0,4 s só ajeitando e carregando o peso antes da
  // impulsão; com a preparação feita ANTES do chute essa fase já aconteceu (até 0,45 s); parado no centro, só 0,2 s.
  // quanto do começo do clipe pode ser pulado (s). Pular muito faz a pose "saltar" (pernas travadas no meio da mistura): o resto do sincronismo vem
  // de tocar o clipe um pouco mais rápido (ritmos), como um goleiro que reage mais rápido — o movimento continua inteiro e contínuo
  salto: { preparado: .4, parado: .18, centro: .3, curta: .08, passos: .08 },
  ritmos: [1, 1.2, 1.4, 1.6],
  ritmosMeio: [1.8, 2],
  meio: { erro: .5, ikMax: .55, caixa: 1.3 },   // MEIO com a bola no meio: de frente para a bola, lê com metade do erro e o braço alcança mais (45 cm)   // MEIO com a bola no meio: os passos podem ser mais rápidos (o goleiro já está na frente da bola, só precisa chegar a tempo)
  // SAÍDA ANTES DO CHUTE: com lado escolhido, nos últimos `antes` s antes do pé na bola o goleiro já começa o movimento para aquele lado (carrega o
  // peso, o primeiro passo/agachamento do mergulho); no chute ele só escolhe a altura e continua de onde está — sem recomeçar parado
  saida: { antes: .3, noAr: .6 },   // o mergulho para o lado escolhido começa 0,3 s antes do pé do cobrador tocar a bola (sempre que a escolha é esquerda/direita); noAr: depois disso no clipe, não troca de altura
  // CORREÇÃO NO MEIO DO LANCE: ~0,1 s depois de começar, o goleiro relê a bola (erro bem menor: já viu mais da trajetória) e, se outra ação cobrir
  // a bola muito melhor, troca uma vez (com transição curta). É o "ajuste" que todo goleiro faz acompanhando a bola.
  correcao: { apos: .1, fatorErro: .4, ganho: .08, zMin: 3 },
  // ESCOLHA DA AÇÃO pela trajetória lida depois do chute: entre as ações possíveis (defesa no centro, passo curto com extensão dos braços, mergulho)
  // o goleiro usa a MENOR que cobre a bola (folga ≤ alvo); só mergulha se precisar. custo em "m" de folga.
  economia: { centro: 0, curta: .09, passos: .12, bloqueio: .15, mergulho: .16, alvo: -.04, altura: .12, corpo: .35, salto: .25 },   // altura: custo por nível de diferença entre a altura da ação e a lida
  // depois de pôr o peso num lado, voltar para uma defesa no centro custa tempo; para o lado OPOSTO só cabe um passo curto, ainda mais tarde
  atraso: { centro: .16, oposto: .18 },
  // defesas no CENTRO partem da própria base (não dependem de escolher lado) e os clipes fornecidos são lentos para elas (o Catch agacha ~0,4 s antes de
  // saltar): tocadas um pouco mais rápido. Os mergulhos laterais ficam no ritmo original.
  ritmo: { gk_centro_alta: 1.15, gk_centro_media: 1.1, gk_centro_baixa: 1.15 },
  // AJUSTE LIMITADO DO BRAÇO (seção 9 do pedido): nos últimos instantes o goleiro leva a luva em direção à bola que está VENDO, girando o braço no ombro.
  // No máximo 25 cm de deslocamento da luva e só se a luva já passaria a menos de 60 cm da bola (não é ímã). O MESMO giro vale para os colisores e para o
  // osso do braço na tela (js/three/loader.js → ajustaBraco), depois do clipe — não há dois sistemas disputando o osso.
  // ÁREA DE ALCANCE DE CADA MÃO: caixa presa ao centro da palma (meia-largura x, meia-altura y, meia-profundidade z, em m). Se a trajetória da bola passa
  // por ela, o braço daquela mão é acionado (tentativa); a defesa só existe se a bola encostar no COLISOR da mão.
  caixaMao: [.55, .55, .45],
  ajuste: { max: .3, alcance: .65, antes: .3, rampa: .18, cotovelo: .6, frentes: [0, .08, .16, .25, .35] },   // cotovelo: no máximo 0,6 rad (~34°) de extensão                                  // correção limitada: troca a altura do mergulho (no MESMO lado) só se outra cobrir a bola lida ≥ 5 cm melhor
  reacao: { lado: { easy: .12, normal: .08, hard: .05 }, centro: { easy: .18, normal: .12, hard: .09 } },   // s depois do chute para ler a altura
  erro: { easy: .3, normal: .2, hard: .12, rapida: .4 },  // desvio (m) da leitura do ponto de cruzamento; cresce até +rapida (40%) na bola mais rápida (prob.vel)
  escolhaCPU: { esq: .4, dir: .4, centro: .2 },
  // PROBABILIDADES de defesa efetiva (agarrar ou desviar com firmeza) DEPOIS de confirmado o contato físico — parâmetros de balanceamento, não
  // estatística do futebol. Interpoladas pela velocidade da bola (vel: fraca → forte), pela distância lateral do contato ao centro do goleiro e pela altura;
  // multiplicadas pela qualidade do contato (centro da luva × ponta dos dedos, parte do corpo). Sem contato, a chance é ZERO (nada de sorteio).
  // forteAlto .12: com ele a defesa MEDIDA no chute forte no alto bem coberto fica perto dos 38% da tabela (toques parciais também tiram a bola por cima/fora)
  prob: { fracoCanto: .89, forteCanto: .62, forteAlto: .12, centro: .97, centroForte: .9, centroAlto: .85, vel: [14, 24], lateral: [.6, 2.2], alto: [1.4, 1.9] },
  dedos: 1.45,                                    // a cápsula da mão vai do punho até a ponta dos dedos (o osso middle_02 fica no meio do dedo)
  passo: .02,                                     // detecção contínua: a bola nunca anda mais que 2 cm entre duas verificações
  dt: 1/120,                                      // passo da física da bola depois do contato (o mesmo passo fixo do jogo)
};
// qualidade de cada parte do corpo para segurar/desviar (luva > corpo > braço > perna) — multiplicada pela geometria do contato
const PARTES = { mao: 1, antebraco: .85, braco: .75, tronco: .95, cabeca: .6, perna: .9, pe: .88 };   // perna/pé: bloqueio de bola rasteira
// ORIENTAÇÃO da superfície no contato: a normal geométrica da cápsula (eixo do osso → centro da bola) não sabe para onde a palma aponta; o goleiro
// vira a luva (e o peito) PARA a bola. Normal usada = mistura da direção contrária à bola com a normal geométrica (peso por parte).
// na ESCOLHA da ação, o goleiro quer a bola nas mãos/no peito: pegar só com a perna, o braço ou a cabeça "cobre" menos (m somados à folga)
const PREFERE = { mao: 0, antebraco: .03, tronco: 0, braco: .07, perna: .1, pe: .08, cabeca: .15 };
const PALMA = { mao: .7, antebraco: .35, braco: .3, tronco: .8, cabeca: .3, perna: .7, pe: .6 };   // corpo e pernas de frente para a bola (bloqueio): o rebote volta para o campo
// PARTES DO CORPO (para o contato e para a depuração): cada colisor dos ossos é dividido nas regiões que o goleiro de verdade usa. Cápsulas e esferas
// presas ao esqueleto do clipe (as mesmas posições que aparecem na tela). regiao → família (lógica geral), qualidade para defender, quanto a superfície
// se vira para a bola (palma), se pode ENCAIXAR a bola e o nome mostrado.
export const REGIAO = {
  palma:     { fam: 'mao',    q: 1,   pal: .75, agarra: 1,   nome: 'palma da mão' },
  dedos:     { fam: 'mao',    q: .8,  pal: .6,  agarra: 0,   nome: 'ponta dos dedos' },
  punho:     { fam: 'mao',    q: .9,  pal: .6,  agarra: .45, nome: 'punho' },
  maos:      { fam: 'mao',    q: 1,   pal: .8,  agarra: 1,   nome: 'as duas mãos' },
  antebraco: { fam: 'braco',  q: .85, pal: .4,  agarra: 0,   nome: 'antebraço' },
  cotovelo:  { fam: 'braco',  q: .7,  pal: .3,  agarra: 0,   nome: 'cotovelo' },
  braco:     { fam: 'braco',  q: .75, pal: .3,  agarra: 0,   nome: 'braço' },
  ombro:     { fam: 'braco',  q: .7,  pal: .25, agarra: 0,   nome: 'ombro' },
  peito:     { fam: 'tronco', q: .95, pal: .85, agarra: .8,  nome: 'peito' },
  abdomen:   { fam: 'tronco', q: .9,  pal: .8,  agarra: .35, nome: 'abdômen' },
  lateral:   { fam: 'tronco', q: .8,  pal: .5,  agarra: 0,   nome: 'lateral do tronco' },
  cabeca:    { fam: 'cabeca', q: .6,  pal: .3,  agarra: 0,   nome: 'cabeça' },
  pescoco:   { fam: 'cabeca', q: .55, pal: .3,  agarra: 0,   nome: 'pescoço' },
  quadril:   { fam: 'tronco', q: .85, pal: .6,  agarra: 0,   nome: 'quadril' },
  coxa:      { fam: 'perna',  q: .85, pal: .65, agarra: 0,   nome: 'coxa' },
  joelho:    { fam: 'perna',  q: .8,  pal: .6,  agarra: 0,   nome: 'joelho' },
  canela:    { fam: 'perna',  q: .85, pal: .7,  agarra: 0,   nome: 'canela' },
  pe:        { fam: 'pe',     q: .8,  pal: .55, agarra: 0,   nome: 'pé' },
};
const REG_CACHE = new Map();
export const regiaoDe = n => { let r = REG_CACHE.get(n); if (r === undefined) { r = n === 'maos' ? 'maos' : n.replace(/_[lr]$/, ''); REG_CACHE.set(n, r); } return r; };
// divide os colisores brutos dos ossos nas partes acima (pontos e raios proporcionais ao osso)
export function detalha(cols, sc = [1, 1]) {
  const out = [], m = n => cols.find(c => c.nome === n), lerpP = (a, b, u) => add(a, mul(sub(b, a), u)), P = (nome, a, b, r) => out.push({ nome, grupo: REGIAO[regiaoDe(nome)].fam, regiao: regiaoDe(nome), a, b, r });
  for (const s of ['l', 'r']) {
    const h = m('mao_' + s), fa = m('antebraco_' + s), ua = m('braco_' + s), th = m('coxa_' + s), sh = m('canela_' + s), ft = m('pe_' + s);
    const meio = lerpP(h.a, h.b, .42);
    P('palma_' + s, h.a, meio, h.r); P('dedos_' + s, meio, h.b, h.r*.82); P('punho_' + s, h.a, null, h.r*.85);
    P('antebraco_' + s, fa.a, fa.b, fa.r); P('cotovelo_' + s, fa.a, null, fa.r*1.1); P('braco_' + s, ua.a, ua.b, ua.r); P('ombro_' + s, ua.a, null, ua.r*1.65);   // o ombro (deltoide) sobressai do tronco e do braço — antes ficava escondido dentro deles
    P('coxa_' + s, th.a, th.b, th.r); P('joelho_' + s, th.b, null, th.r*1.1); P('canela_' + s, sh.a, sh.b, sh.r); P('pe_' + s, ft.a, ft.b, ft.r);   // joelho: a patela sobressai um pouco da coxa e da canela (antes ficava escondido e nunca era a parte tocada)
  }
  const t = m('tronco'), cint = lerpP(t.a, t.b, .45); P('abdomen', t.a, cint, t.r); P('peito', cint, t.b, t.r*.94);
  const cb = m('cabeca'); P('cabeca', cb.a, null, cb.r); P('pescoco', t.b, cb.a, .06);
  const qL = m('coxa_l').a, qR = m('coxa_r').a; P('quadril', qL, qR, .12); const ms = m('maos'); if (ms) P('maos', ms.a, ms.b, ms.r);   // barreira do corpo inteiro: pescoço entre o peito e a cabeça; quadril entre as duas coxas
  return out;
}
export const grupoDe = n => n.startsWith('mao') ? 'mao' : n.startsWith('antebraco') ? 'antebraco' : n.startsWith('braco') ? 'braco' : n === 'tronco' ? 'tronco' : n === 'cabeca' ? 'cabeca' : n.startsWith('pe_') ? 'pe' : 'perna';
const FPS = 30, v3 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul: (a, k) => [a[0]*k, a[1]*k, a[2]*k],
  dot: (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2], len: a => Math.hypot(a[0], a[1], a[2]) }, { sub, add, mul, dot, len } = v3, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const norm = a => { const l = len(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
export const clipeDe = (lado, altura) => `gk_${lado}_${altura}`;

// ---------- clipes: duração, posição/rumo final (para a reação começar onde o mergulho terminou) ----------
export const CLIP_INFO = Object.fromEntries(Object.entries(KEEPER_CLIPS).map(([n, c]) => {
  const tr = c.trilhas, N = tr.tronco.length, P = tr.tronco[N - 1], L = tr.braco_l[N - 1], R = tr.braco_r[N - 1];
  const xs = tr.tronco.map(p => p[0] - tr.tronco[0][0]);
  return [n, { dur: c.dur, n: N, fim: [P[0], P[2]], yawFim: Math.atan2(-(L[2] - R[2]), L[0] - R[0]), loop: n === 'gk_espera', trMin: Math.min(...xs), trMax: Math.max(...xs) }];   // eixo ombro dir.→esq. = +x local girado de yaw
}));
// caixa de alcance das mãos de cada clipe (para descartar de cara ações que nem chegam perto da bola lida)
const CAIXA = Object.fromEntries(Object.entries(KEEPER_CLIPS).map(([n, c]) => { const ps = c.trilhas.mao_l.concat(c.trilhas.mao_r).flatMap(p => [p.slice(0, 3), p.slice(3, 6)]);
  return [n, { x0: Math.min(...ps.map(p => p[0])), x1: Math.max(...ps.map(p => p[0])), y0: Math.min(...ps.map(p => p[1])), y1: Math.max(...ps.map(p => p[1])) }]; }));
function amostra(arr, f) { const i = Math.min(arr.length - 2, Math.floor(f)), u = f - i, a = arr[i], b = arr[i + 1]; return a.map((v, j) => v + (b[j] - v)*u); }
// colisores do clipe no instante ct (s), no mundo: raiz + escala (largura wd em x/z, altura hs em y), como o loader aplica no modelo
export function colisores(clip, ct, raiz = KEEPER_CFG.raiz, sc = [1, 1]) {
  const c = KEEPER_CLIPS[clip], info = CLIP_INFO[clip]; if (!c) return [];
  const tt = info.loop ? ((ct % info.dur) + info.dur) % info.dur : ct, f = clamp(tt*FPS, 0, info.n - 1), W = (v, i) => [raiz[0] + sc[0]*v[i], raiz[1] + sc[1]*v[i + 1], raiz[2] + sc[0]*v[i + 2]];
  const cols = Object.entries(c.trilhas).map(([nome, arr]) => { const v = amostra(arr, f), a = W(v, 0); let b = v.length > 3 ? W(v, 3) : null;
    if (b && nome.startsWith('mao')) b = add(a, mul(sub(b, a), KEEPER_CFG.dedos));
    return { nome, grupo: grupoDe(nome), a, b, r: c.raios[nome]*sc[0] }; });
  // AS DUAS LUVAS JUNTAS: com as palmas a menos de ~32 cm uma da outra a bola (22 cm) não passa entre elas — o espaço entre as luvas também é "mão"
  const L = cols.find(c => c.nome === 'mao_l'), R = cols.find(c => c.nome === 'mao_r'), pl = add(L.a, mul(sub(L.b, L.a), .45)), pr = add(R.a, mul(sub(R.b, R.a), .45));
  if (len(sub(pl, pr)) < .32*sc[0]) cols.push({ nome: 'maos', grupo: 'mao', a: pl, b: pr, r: .05*sc[0] });
  return cols;
}
const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
const gira = (v, e, ang) => { const c = Math.cos(ang), s_ = Math.sin(ang), k = dot(e, v), x = cross(e, v); return [v[0]*c + x[0]*s_ + e[0]*k*(1 - c), v[1]*c + x[1]*s_ + e[1]*k*(1 - c), v[2]*c + x[2]*s_ + e[2]*k*(1 - c)]; };
const giraEm = (p, o, e, ang) => add(o, gira(sub(p, o), e, ang));
// peso do ajuste do braço no instante t (0 → 1 antes da chegada da bola, mantém um pouco e volta)
export function ajusteAgora(k, t) {
  const A = k.plano && k.plano.ajuste; if (!A) return null; const C = KEEPER_CFG.ajuste, out = {};
  for (const s of ['l', 'r']) { const a = A[s]; if (!a) continue; const w = sm((t - (a.t - C.antes))/C.rampa)*(1 - sm((t - (a.t + .25))/.3)); if (w > 1e-3) out[s] = { eixo: a.eixo, ang: a.ang*w, eixoC: a.eixoC, angC: (a.angC || 0)*w }; }
  return Object.keys(out).length ? out : null;
}
// colisores do PLANO de mergulho no instante t do voo (clipe sincronizado + ajuste do braço)
// TRANSIÇÃO igual à da tela: ao trocar de clipe, o loader mistura a "foto" da pose anterior com o clipe novo por `blend` s (tempo do clipe, curva sm).
// A física usa a MESMA mistura — a mão que defende é a mão que aparece (antes, nesses ~0,2 s a mão da física podia estar até ~80 cm da desenhada).
const misturaCols = (A, B, w) => B.map(c => { const o = A.find(x => x.nome === c.nome); if (!o) return c; const l = (p, q) => p.map((v, i) => v + (q[i] - v)*w);
  return { ...c, a: l(o.a, c.a), b: c.b && o.b ? l(o.b, c.b) : c.b }; });
// pose que a tela mostra agora no instante t (do voo) — para a foto da transição
function poseNaTela(k, t, sc) {
  const C = KEEPER_CFG, R = C.raiz;
  if (k.plano && t >= k.plano.tIni) { const info = CLIP_INFO[k.plano.clip]; if (ctDe(k, t) < info.dur) return colisoresPlano(k, t, sc); return colisores('gk_espera', 0, R, sc); }
  const tp = k.prepIniBola != null ? t - k.prepIniBola : null, P = KEEPER_CLIPS[C.prep.anim];
  if (tp != null && P && tp < P.dur - .05) { const cols = colisores(C.prep.anim, Math.max(0, tp), R, sc), lado = k.lado === 'esq' || k.lado === 'dir' ? k.lado : null;
    return lado ? misturaCols(cols, colisores(C.prep.clipe[lado], C.prep.t, R, sc), C.prep.w*sm(Math.max(0, tp)/C.prep.rampa)) : cols; }
  return colisores('gk_espera', 0, R, sc);
}
// foto da pose na tela no instante em que o plano novo começa (só quando o clipe muda: com o mesmo clipe a tela não faz transição)
const fotoPara = (k, clipNovo, tIni, sc) => (k.plano && k.plano.clip === clipNovo && tIni >= k.plano.tIni) ? null : poseNaTela(k, tIni, sc).map(c => ({ ...c }));
export function colisoresPlano(k, t, sc = [1, 1]) {
  let cols = colisores(k.plano.clip, ctDe(k, t), KEEPER_CFG.raiz, sc);
  if (k.plano.foto && k.plano.blend > 0) { const u = (ctDe(k, t) - k.plano.off)/k.plano.blend; if (u < 1) cols = misturaCols(k.plano.foto, cols, sm(Math.max(0, u))); }
  const aj = ajusteAgora(k, t); if (!aj) return cols;
  for (const s of ['l', 'r']) { const a = aj[s]; if (!a) continue; const o = cols.find(c => c.nome === 'braco_' + s).a;
    for (const c of cols) if (c.nome === 'braco_' + s || c.nome === 'antebraco_' + s || c.nome === 'mao_' + s) { c.a = giraEm(c.a, o, a.eixo, a.ang); if (c.b) c.b = giraEm(c.b, o, a.eixo, a.ang); }
    if (a.angC) { const cot = cols.find(c => c.nome === 'antebraco_' + s).a;   // depois o COTOVELO estende (antebraço e mão giram em volta dele)
      for (const c of cols) if (c.nome === 'antebraco_' + s || c.nome === 'mao_' + s) { c.a = giraEm(c.a, cot, a.eixoC, a.angC); if (c.b) c.b = giraEm(c.b, cot, a.eixoC, a.angC); } } }
  // as luvas mudaram de lugar: refaz o colisor "as duas mãos"
  const L = cols.find(c => c.nome === 'mao_l'), R = cols.find(c => c.nome === 'mao_r'), i = cols.findIndex(c => c.nome === 'maos'); if (i >= 0) cols.splice(i, 1);
  const pl = add(L.a, mul(sub(L.b, L.a), .45)), pr = add(R.a, mul(sub(R.b, R.a), .45)); if (len(sub(pl, pr)) < .32*sc[0]) cols.push({ nome: 'maos', grupo: 'mao', a: pl, b: pr, r: .05*sc[0] });
  return cols;
}
export function pontoMaisProximo(p, a, b) { if (!b) return { c: a, s: 0 }; const ab = sub(b, a), s = clamp(dot(sub(p, a), ab)/(dot(ab, ab) || 1), 0, 1); return { c: add(a, mul(ab, s)), s }; }

// ---------- bola: voo analítico (o MESMO de frame.js → ballWorld) e o ponto em que cruza o plano do gol ----------
const DRAG = .18;
export function ballFlight(b, t) {
  const T = goalToWorld(b.gx, b.gy); T[1] = Math.max(BALL_R, T[1]); const tf = b.tf || .7, u = t/tf, e = (1 - Math.exp(-DRAG*u))/(1 - Math.exp(-DRAG)), h = T[1] - BALL_R, gw = 9.81*sm((h - .05)/.35), vy = (h + gw*tf*tf/2)/tf;
  return [T[0]*e + (b.curl || 0)*Math.sin(Math.PI*e), BALL_R + vy*t - gw*t*t/2, SPOT_Z*(1 - e)];
}
export const ballVel = (b, t) => mul(sub(ballFlight(b, t + 1e-3), ballFlight(b, t - 1e-3)), 500);
export const cruzamento = b => { const T = goalToWorld(b.gx, b.gy); return [T[0], Math.max(BALL_R, T[1])]; };   // (x, y) no plano z = 0, no instante tf
export function classificar(x, y, z = KEEPER_CFG.zonas) {
  const lado = Math.abs(x) < z.centroX ? 'centro' : x > 0 ? 'esq' : 'dir', altura = y < z.baixaY ? 'baixa' : y > z.altaY ? 'alta' : 'media';
  return { lado, altura, cat: `${lado}_${altura}` };
}

// ---------- estado do goleiro (um por cobrança: novo a cada vez, nada da anterior sobra) ----------
export const novoGoleiro = () => ({ lado: null, origem: null, tEscolha: null, travado: false, travadoEm: null, ignoradas: [], plano: null, contato: null, sem: null, dmin: null,
  prepIni: null, prepIniBola: null, tContatoPrev: null, tContatoReal: null, x: .5, tx: .5, t0: null, log: [], eventos: [] });
// EVENTOS da cobrança (para o debug G e os testes): cada tipo uma vez — sensor da mão detectou a bola, tentativa (braço acionado), toques, ferro, chute
export const evento = (k, tipo, t, extra = {}) => { if (!k.eventos) k.eventos = []; if (k.eventos.some(e => e.tipo === tipo)) return; k.eventos.push({ tipo, t: t != null ? +t.toFixed(3) : null, ...extra }); };
const registra = (k, msg) => { k.log.push(msg); if (k.log.length > 40) k.log.shift(); if (KEEPER_CFG.console) console.info('[goleiro]', msg); };
// escolha do lado (jogador: setas/clique; CPU: sorteio). Só vale ANTES do limite; depois, é registrada como tentativa ignorada.
// aquece o código do goleiro (a busca da ação e o ajuste das luvas) antes da 1ª cobrança: sem isso o 1º chute da partida pode custar alguns quadros
let aquecido = false;
export function aquecer() {
  if (aquecido) return; aquecido = true;
  try { for (const [lado, gx] of [['centro', .62], ['esq', .8]]) { const k = novoGoleiro(); escolherLado(k, null, lado, 'aquecimento'); const b = { gx, gy: .45, t: -.25, tf: .62, curl: 0 }; let n = 0;
      while (b.t < .62 && n++ < 200) { const tA = b.t; b.t += 1/120; passo(k, b, tA, b.t, { rng: () => .5 }); if (b.fis) break; } } } catch (e) { /* só aquecimento */ }
}
export function escolherLado(k, b, lado, origem, agora = 0) {
  if (k.travado) { k.ignoradas.push({ lado, t: b ? +b.t.toFixed(2) : null }); registra(k, `escolha "${lado}" ignorada: o lado já está travado`); return false; }
  if (k.lado !== lado) { k.tPrep = agora; }
  k.lado = lado; k.origem = origem; k.tEscolha = b ? b.t : null; registra(k, `escolheu ${lado} (${origem})`); return true;
}
export function sorteiaLado(rng = Math.random, p = KEEPER_CFG.escolhaCPU) { const u = rng(); return u < p.esq ? 'esq' : u < p.esq + p.dir ? 'dir' : 'centro'; }
// trava o lado no limite (ou na saída da corrida, se ela começou depois do limite): sem escolha → centro
export function travar(k, falta) {
  if (k.travado) return; k.travado = true; k.travadoEm = falta != null ? -(+falta.toFixed(3)) : null;   // em s relativos ao contato (negativo = antes)
  if (!k.lado) { k.lado = 'centro'; k.origem = 'sem escolha'; } registra(k, `lado travado: ${k.lado} (${k.origem}) a ${falta != null ? falta.toFixed(2) : '?'} s do contato`);
}
// AGENDA DA PREPARAÇÃO (chamada pelo jogo a cada passo): tContato = instante previsto (relógio do jogo) em que o pé do cobrador atinge a bola, ou null
// enquanto não dá para prever (o jogador ainda não soltou a barra). Recalibra sempre; a preparação começa quando faltar decisaoAntes (1,5 s) — ou já,
// se o chute foi previsto com menos tempo que isso (o goleiro reage ao tempo que existe, sem esperar o cronômetro).
// instante REAL em que o pé atingiu a bola (relógio do jogo): fica no registro junto com o início da preparação, para conferir os 1,5 s
export function registraChute(k, agora) {
  if (!k || !k.log || k.tContatoReal != null) return; k.tContatoReal = agora; evento(k, 'chute', 0);
  k.prepAntesReal = k.prepIni != null ? +(agora - k.prepIni).toFixed(3) : null;
  registra(k, `pé na bola em t=${agora.toFixed(2)} s · preparação começou ${k.prepAntesReal != null ? k.prepAntesReal.toFixed(2) + ' s antes' : '(sem registro)'}`);
}
export function agendar(k, agora, tContato) {
  if (tContato == null) return null; k.tContatoPrev = tContato; const falta = tContato - agora;
  if (k.prepIni == null && falta <= KEEPER_CFG.decisaoAntes + 1e-9) {
    k.prepIni = agora; k.prepIniBola = -falta; k.prepAntes = +falta.toFixed(3); travar(k, falta);
    registra(k, `preparação iniciada a ${falta.toFixed(2)} s do contato previsto (t=${agora.toFixed(2)} s; contato previsto em t=${tContato.toFixed(2)} s)`);
    return 'preparacao';
  }
  return null;
}

// ---------- plano do mergulho: depois do chute, lê a altura (com erro) e sincroniza o clipe com a chegada da bola ----------
const gauss = rng => { let u = 0; for (let i = 0; i < 4; i++) u += rng(); return (u - 2)/.577; };   // ~N(0,1), limitado
export const ctDe = (k, t) => { const P = k.plano, T = P.troca; return T && t > T.t ? T.ct + (t - T.t)*T.r : P.off + (t - P.tIni)*(P.ritmo || 1); };
// distância mínima (superfície a superfície) entre a trajetória da bola e o corpo do goleiro com o clipe começando em off
// (só leitura: a busca da ação avalia o mesmo clipe em instantes muito próximos — pose amostrada a cada 1/240 s e guardada, sem travar o quadro do chute)
const CACHE_POSE = new Map();
function colisoresBusca(clip, ct, raiz, sc) {
  const q = Math.round(ct*240), key = clip + '|' + q + '|' + raiz.join() + '|' + sc.join(); let v = CACHE_POSE.get(key);
  if (!v) { if (CACHE_POSE.size > 40000) CACHE_POSE.clear(); v = colisores(clip, q/240, raiz, sc); CACHE_POSE.set(key, v); }
  return v;
}
function folga(b, clip, off, tIni, raiz, sc, t1, so = null, rt = KEEPER_CFG.ritmo[clip] || 1) {
  let best = { d: 9, parte: null, t: null };
  for (let t = Math.max(0, tIni); t <= t1; t += 1/60) {
    const p = ballFlight(b, t); if (p[2] > 4.5) continue;
    for (const c of colisoresBusca(clip, off + (t - tIni)*rt, raiz, sc)) { if (so && !so(c)) continue; const d = len(sub(p, pontoMaisProximo(p, c.a, c.b).c)) - c.r - BALL_R + (PREFERE[c.grupo] || 0); if (d < best.d) best = { d, parte: c.nome, t }; }
  }
  return best;
}
const H = ['baixa', 'media', 'alta'];
// ações possíveis a partir do lado travado.
//  - CENTRO: fica no meio (abaixa, levanta os braços) ou AJUSTA com passos laterais reais — um passo curto ou dois passos — para qualquer lado; nunca o
//    mergulho completo para um canto (a escolha de ficar no meio é respeitada; bola longe: tenta com o alcance que os passos e os braços dão).
//  - ESQUERDA/DIREITA: a decisão manda no movimento — mergulho ou passo curto PARA O LADO ESCOLHIDO, mesmo com a bola no meio (o sensor só diz onde a bola
//    passa e para onde as mãos vão; não troca a escolha). Nada de "ficar no centro" depois de escolher um lado: era essa opção (a mais barata) que fazia o
//    goleiro cancelar a saída e esperar parado no meio. Bola no meio: passo curto para o lado escolhido e as mãos/o corpo tentam alcançá-la.
// RÉGUA ROXA (só quando a decisão é MEIO): faixa de deslocamento lateral do goleiro, presa a ele antes do chute (acompanha a posição do tronco e a altura
// das mãos), CONGELADA no instante do chute; depois do chute, o tronco só anda dentro dela (meia-largura = um terço do gol de cada lado: a área central).
export function atualizaRegua(k, tB, sc = [1, 1]) {
  if (k.lado !== 'centro' || !k.travado) { k.regua = null; return null; }
  const R = k.regua || (k.regua = { ativa: true, centro: KEEPER_CFG.raiz[0], altura: 1, meia: KEEPER_CFG.regua.meia, congelada: false, tCongelada: null });
  if (R.congelada) return R;
  if (tB >= 0) { R.congelada = true; R.tCongelada = +tB.toFixed(3); return R; }
  const cols = poseNaTela(k, tB, sc), tr = cols.find(c => c.nome === 'tronco').a, ml = cols.find(c => c.nome === 'mao_l').a, mr = cols.find(c => c.nome === 'mao_r').a;
  R.centro = +tr[0].toFixed(3); R.altura = +((ml[1] + mr[1])/2).toFixed(3); return R;
}
// a ação de MEIO cabe na régua? (o deslocamento do tronco no clipe, somado ao centro congelado, não passa dos limites)
export function dentroDaRegua(k, c) {
  const R = k.regua; if (!R || c.tipo === 'mergulho') return true; const I = CLIP_INFO[c.clip]; if (!I) return true;
  return R.centro + I.trMax <= R.centro + R.meia + 1e-6 && R.centro + I.trMin >= R.centro - R.meia - 1e-6 && Math.abs(R.centro + I.trMax) <= KEEPER_CFG.regua.meia + .3 && Math.abs(R.centro + I.trMin) <= KEEPER_CFG.regua.meia + .3;
}
export function candidatos(lado) {
  const out = [], meu = s => lado === s, centro = lado === 'centro' || !lado;
  if (centro) for (const h of H) out.push({ clip: `gk_centro_${h}`, tipo: 'centro', lado: 'centro', altura: h, atraso: 0 });
  // DOIS SISTEMAS SEPARADOS pela decisão registrada antes do chute:
  //  - MEIO → RÉGUA ROXA: ficar, um passo ou dois passos para qualquer lado, DENTRO da régua; nunca mergulho (nem o bloqueio baixo lateral).
  //  - ESQUERDA/DIREITA → SALTO/MERGULHO para o lado escolhido (nas três alturas); nunca os passos laterais da régua.
  for (const s of ['esq', 'dir']) {
    if (centro) for (const h of H) { out.push({ clip: `gk_${s}_curta_${h}`, tipo: 'curta', lado: s, altura: h, atraso: 0 }); out.push({ clip: `gk_${s}_passos_${h}`, tipo: 'passos', lado: s, altura: h, atraso: 0 }); }
    if (meu(s)) for (const h of H) out.push({ clip: `gk_${s}_${h}`, tipo: 'mergulho', lado: s, altura: h, atraso: 0, preparado: true });
  }
  return out.filter(c => KEEPER_CLIPS[c.clip]);
}
export function planejar(k, b, { dif = 'normal', sc = [1, 1], rng = Math.random } = {}, { fatorErro = 1, atual = null, forcar = false } = {}) {
  const C = KEEPER_CFG, E = C.economia, [cx, cy] = cruzamento(b), e = fatorErro*(k.lado === 'centro' && Math.abs(cx) <= TERCO ? C.meio.erro : 1)*(C.erro[dif] ?? C.erro.normal)*(1 - C.erro.rapida + C.erro.rapida*faixa(len(ballVel(b, .02)), C.prob.vel)*2);
  const px = cx + gauss(rng)*e*C.erroLateral, py = Math.max(BALL_R, cy + gauss(rng)*e*.8), lido = classificar(px, py), tf = b.tf || .7;   // a direção (lado) se lê melhor que a altura
  const via = (x, y) => ({ ...b, gx: x/GOAL_W + .5, gy: Math.max(BALL_R, y)/GOAL_H });   // trajetória LIDA (com o erro), não a verdadeira
  const meioGarantido = k.lado === 'centro' && Math.abs(px) <= TERCO + .1;   // escolheu MEIO e a bola vem no meio: a defesa tem de sair (ver resultadoContato)
  const prev = via(px, py), extras = [via(px, py + .5*e), via(px, py - .5*e)];            // e a incerteza da leitura (mais alta / mais baixa)
  // sincroniza: o instante do clipe e o ritmo com que a bola chega na melhor posição; depois, a folga média também nas leituras vizinhas
  const mesmo = c => atual && !atual.pre && c.clip === atual.clip, ctAgora = atual ? ctDe(k, b.t) : 0;
  const continua = c => atual && atual.pre && c.clip === atual.clip;   // o mergulho já começou antes do chute: segue do mesmo ponto do MESMO clipe
  // EMENDA: o goleiro já saiu para o lado antes do chute e a ação nova é OUTRO clipe (passo curto, outra altura): começa no instante do clipe novo em que o
  // tronco está onde o goleiro já está — sem voltar para o centro e sem o corpo "correr" para a pose nova
  const tronco0 = atual && b.t >= atual.tIni ? colisoresPlano(k, b.t, sc).find(c => c.nome === 'tronco').a : null, emendas = {};
  const mesmaFamilia = c => atual && c.lado === atual.lado && c.tipo === atual.tipo && (c.tipo === 'passos' || ((c.tipo === 'curta' || c.tipo === 'centro') && !/_alta$/.test(c.clip) && !/_alta$/.test(atual.clip)));   // mesmos pés, só muda a altura das mãos
  const emenda = c => { if (!tronco0 || continua(c) || mesmo(c)) return null; if (mesmaFamilia(c)) return ctAgora; if (emendas[c.clip] != null) return emendas[c.clip]; let best = 0, dm = 9;
    for (let o = 0; o <= Math.min(.7, CLIP_INFO[c.clip].dur - .1); o += .02) { const q = colisores(c.clip, o, C.raiz, sc).find(x => x.nome === 'tronco').a, d = Math.abs(q[0] - tronco0[0]) + .25*Math.hypot(q[1] - tronco0[1], q[2] - tronco0[2]) + .1*o; if (d < dm) { dm = d; best = o; } }   // o que importa é o lado (x); sem pular adiante à toa
    return (emendas[c.clip] = best); };   // o mergulho já começou antes do chute: segue da mesma fase   // na correção, a MESMA ação pode só mudar de ritmo a partir da pose atual (sem salto)
  const sincroniza = (c, semPoda = false) => { const S = C.salto, em = emenda(c), offMin = mesmo(c) || continua(c) ? ctAgora : em != null ? em : c.tipo === 'mergulho' && c.preparado ? C.prep.t*.5 : 0,
      offMax = mesmo(c) ? ctAgora : continua(c) ? ctAgora + .12 : em != null ? em + (mesmaFamilia(c) ? 0 : .04) : c.tipo === 'centro' ? S.centro : c.tipo === 'curta' || c.tipo === 'passos' ? S.curta : c.preparado ? S.preparado : S.parado,
      tIni = mesmo(c) || continua(c) ? b.t : b.t + c.atraso, r0 = C.ritmo[c.clip] || 1;
    let off = offMin, rt = r0, best = null; const cx_ = CAIXA[c.clip];
    if (!semPoda && (px < cx_.x0 - .9 || px > cx_.x1 + .9 || py > cx_.y1 + .9 || py < cx_.y0 - .9)) return { ...c, off, rt, best: { d: 9 }, dm: 9, tIni, custo: 9 };   // nem perto: descartada
    for (const rr of (meioGarantido && c.lado !== undefined && c.tipo !== 'mergulho' ? C.ritmos.concat(C.ritmosMeio) : C.ritmos)) for (let o = offMin; o <= offMax + 1e-9; o += .05) { const f = folga(prev, c.clip, o, tIni, C.raiz, sc, tf + .02, null, r0*rr);
      if (!best || f.d < best.d - 1e-3) { best = f; off = o; rt = r0*rr; } }
    const dm = (best.d + extras.reduce((a, v) => a + folga(v, c.clip, off, tIni, C.raiz, sc, tf + .02, null, rt).d, 0))/3;
    // CORPO ATRÁS DA BOLA (bola de meia altura): quem defende na altura do peito põe o tronco na frente dela e as duas mãos juntas — a ação que deixa a
    // bola longe do tronco (braço esticado para o lado) custa mais; o passo que leva o corpo até a bola fica mais barato
    let longe = 0; if (best.t != null && c.tipo !== 'mergulho' && py > .6 && py < 1.6) { const tr = colisoresBusca(c.clip, off + (best.t - tIni)*rt, C.raiz, sc).find(q => q.nome === 'tronco').a, bx = ballFlight(prev, best.t)[0]; longe = Math.max(0, Math.abs(bx - tr[0]) - .22); }
    return { ...c, off, rt, best, dm, tIni, longe, custo: E[c.tipo] + E.altura*Math.abs(H.indexOf(c.altura) - H.indexOf(lido.altura)) + (c.tipo === 'centro' ? .01 : .03)*(rt/r0 - 1)/.1 + E.corpo*longe + (/_alta$/.test(c.clip) && py < 1.45 ? E.salto : 0) };   // agarrada com SALTO só para bola alta   // acelerar a defesa no centro (mãos ao peito) quase não custa
  };
  // COMPROMISSO COM O LADO: com esquerda/direita escolhida e a bola lida fora desse lado (no meio ou do outro lado), o goleiro NÃO troca o deslocamento
  // por um passinho que o deixa no meio: segue o mergulho para o lado escolhido (a saída já começou) e tenta a bola com o que ficar no caminho — pernas,
  // pés, a mão de trás. O passo curto para o lado escolhido fica para a bola que vem desse lado, perto do corpo.
  const sg = k.lado === 'esq' ? 1 : k.lado === 'dir' ? -1 : 0, comprometido = sg !== 0 && px*sg < C.compromisso;
  const noAr = atual && atual.tipo === 'mergulho' && b.t >= atual.tIni && ctDe(k, b.t) > C.saida.noAr;   // o mergulho começou antes do chute e o goleiro já está no ar: segue o MESMO mergulho (sem trocar de clipe no voo)
  const av = candidatos(k.lado).filter(c => !(comprometido && c.tipo === 'curta') && dentroDaRegua(k, c) && (!noAr || c.clip === atual.clip)).map(c => sincroniza(atual && !atual.pre ? { ...c, atraso: Math.max(0, c.atraso - (b.t - atual.tIni)) } : c)), cobre = av.filter(a => a.dm <= E.alvo);
  // nota = folga média prevista (limitada ao alvo: cobrir com sobra não vale mais) + custo do movimento (+ altura diferente da lida, + pressa): a menor vence
  // MEIO com a bola no meio: se alguma ação ALCANÇA a bola, só elas concorrem (a economia nunca troca uma defesa possível por um gesto que não chega)
  const pool = meioGarantido && av.some(a => a.dm <= 0) ? av.filter(a => a.dm <= 0) : av;
  const nota = a => meioGarantido && !pool.some(q => q.dm <= 0) ? a.dm + .02*Math.abs(H.indexOf(a.altura) - H.indexOf(lido.altura)) : Math.max(a.dm, E.alvo) + a.custo;   // MEIO, nada alcança com sobra: a que chega mais perto
  const esc0 = pool.slice().sort((a, b_) => nota(a) - nota(b_) || a.dm - b_.dm)[0];
  // NENHUMA ação alcança a bola lida: o goleiro não fica parado nem faz um gesto pequeno à toa. Se já pôs o peso num lado, MERGULHA para esse lado
  // (o lance clássico de quem escolheu errado); no centro, mergulha para o lado da bola (atrasado). Só na correção o goleiro mantém o que já faz.
  const desesperada = (!atual || forcar) && !cobre.length && Math.abs(px) > C.zonas.centroX, ladoDive = k.lado === 'esq' || k.lado === 'dir' ? k.lado : px > 0 ? 'esq' : 'dir';
  // (das três alturas de mergulho desse lado, a que leva o corpo mais perto da bola — com folga igual, a da altura lida)
  const mergulhos = desesperada && k.lado !== 'centro' ? candidatos(k.lado).filter(c => c.tipo === 'mergulho' && c.lado === ladoDive && (!noAr || c.clip === atual.clip)).map(c => sincroniza(c, true))
    : desesperada ? candidatos('centro').filter(c => c.lado === ladoDive && c.tipo === 'passos').map(c => sincroniza(c, true)) : [];   // centro: os passos para o lado da bola, o máximo que dá
  const esc = mergulhos.length ? mergulhos.sort((a, b_) => (a.dm + .15*Math.abs(H.indexOf(a.altura) - H.indexOf(lido.altura))) - (b_.dm + .15*Math.abs(H.indexOf(b_.altura) - H.indexOf(lido.altura))))[0] : esc0;
  if (atual && !forcar) {   // correção: compara com CONTINUAR a ação atual do jeito que está, avaliada com a leitura nova
    const cont = folga(prev, atual.clip, ctAgora, b.t, C.raiz, sc, tf + .02, null, atual.ritmo).d, nCont = Math.max(cont, E.alvo) + E[atual.tipo] + E.altura*Math.abs(H.indexOf(atual.altura) - H.indexOf(lido.altura));
    if (!(nota(esc) < nCont - (meioGarantido ? .02 : C.correcao.ganho))) return null;
  }
  const { clip, off, best, tIni } = esc;
  const foto = fotoPara(k, clip, tIni, sc);
  k.plano = { clip, foto, tipo: esc.tipo, lado: esc.lado, altura: esc.altura, tIni, off: +off.toFixed(3), atraso: esc.atraso, lido: { x: +px.toFixed(2), y: +py.toFixed(2), cat: lido.cat },
    real: classificar(cx, cy).cat, folgaPrevista: +esc.dm.toFixed(3), cobria: esc.dm <= E.alvo, opcoes: av.length, ritmo: esc.rt, blend: mesmo(esc) ? atual.blend : continua(esc) ? .1 : atual?.pre ? .15 : atual ? .12 : esc.tipo === 'curta' || esc.tipo === 'passos' ? .12 : .15, corrigido: !!atual && !atual.pre, saiuAntes: !!atual?.pre,
    motivoEscolha: (atual && !atual.pre ? `CORREÇÃO (antes ${atual.clip}): ` : atual?.pre ? 'já em movimento desde antes do chute; ' : '') + (esc.dm <= E.alvo ? `menor ação que cobre a bola lida (${esc.tipo}, ${cobre.length} cobriam)` : cobre.length ? `${esc.tipo} quase cobre e custa bem menos que as ${cobre.length} que cobriam` : 'nenhuma ação cobre a bola lida: tentativa que chega mais perto') };
  // para a depuração: a trajetória que ele LEU, o ponto previsto de interceptação e a parte do corpo com que pretende chegar
  k.plano.leitura = { gx: prev.gx, gy: prev.gy, tf: prev.tf, curl: prev.curl };
  if (esc.best && esc.best.t != null) k.plano.intercepta = { t: +esc.best.t.toFixed(3), p: ballFlight(prev, esc.best.t).map(v => +v.toFixed(2)), parte: esc.best.parte, regiao: REGIAO[regiaoDe(esc.best.parte || 'mao_l')]?.nome || esc.best.parte };
  k.plano.avaliadas = av.slice().sort((a, b_) => nota(a) - nota(b_)).slice(0, 5).map(a => `${a.clip} off ${a.off.toFixed(2)} ritmo ${a.rt.toFixed(2)} folga ${Math.round(a.dm*100)} cm nota ${nota(a).toFixed(2)}`);
  k.plano.ajuste = calculaAjuste(k, b, sc);
  k.tx = .5 + (esc.lado === 'esq' ? .3 : esc.lado === 'dir' ? -.3 : 0); k.t0 = b.t;   // campos antigos (pose procedural de reserva)
  registra(k, `${atual && !atual.pre ? 'CORREÇÃO → ' : ''}ação ${clip} (${k.plano.motivoEscolha}) em t=${tIni.toFixed(2)} s; leu ${lido.cat} x=${px.toFixed(2)} y=${py.toFixed(2)}; real ${k.plano.real}; folga prevista ${Math.round(esc.dm*100)} cm; clipe a partir de ${off.toFixed(2)} s, ritmo ${esc.rt.toFixed(2)}`);
  return k.plano;
}

// ajuste do braço: para cada luva, o instante em que ela passa mais perto da bola REAL (o goleiro já está vendo a bola) e o giro no ombro que a leva até lá
const naCaixa = (d, f = 1) => { const H_ = KEEPER_CFG.caixaMao; return Math.abs(d[0]) <= H_[0]*f && Math.abs(d[1]) <= H_[1]*f && Math.abs(d[2]) <= H_[2]*f; };
// as duas áreas de alcance agora (centro = centro da palma da pose atual, com o ajuste do braço) e se a bola está dentro de cada uma
export function sensoresMaos(k, b, t, sc = [1, 1]) {
  const cols = k.plano && t >= k.plano.tIni ? colisoresPlano(k, t, sc) : colisores('gk_espera', 0, KEEPER_CFG.raiz, sc), p = b && t > 0 ? ballFlight(b, t) : null, out = {};
  for (const s of ['l', 'r']) { const m = cols.find(c => c.nome === 'mao_' + s), c = add(m.a, mul(sub(m.b, m.a), .22)); out[s] = { centro: c, meia: KEEPER_CFG.caixaMao, dentro: !!p && naCaixa(sub(p, c)) }; }
  return out;
}
function calculaAjuste(k, b, sc) {
  const C = KEEPER_CFG.ajuste, tf = b.tf || .7, out = {};
  for (const s of ['l', 'r']) {
    let best = null;
    for (let t = k.plano.tIni; t <= tf + .02; t += 1/120) { const p = ballFlight(b, t); if (p[2] > 4) continue;
      const cols = colisores(k.plano.clip, ctDe(k, t), KEEPER_CFG.raiz, sc), m = cols.find(c => c.nome === 'mao_' + s), P = add(m.a, mul(sub(m.b, m.a), .22)), d = len(sub(p, P));   // mira o CENTRO DA PALMA
      if (!best || d < best.d) best = { d, t, P, B: p, S: cols.find(c => c.nome === 'braco_' + s).a }; }
    if (!best || !naCaixa(sub(best.B, best.P), k.meioGarantido ? KEEPER_CFG.meio.caixa : 1)) continue;   // a bola NÃO passa pela área de alcance desta mão: o braço não é acionado
    // a luva pode ir ao encontro da bola no ponto mais próximo ou um pouco MAIS CEDO na trajetória (à frente do antebraço). Cada opção é conferida
    // com a varredura da bola contra o braço ajustado: fica a que faz a PALMA chegar primeiro (o antebraço não fica no caminho) e mais perto
    let melhor = null;
    for (const frente of C.frentes || [0]) { const aj = miraLuva(k, b, sc, s, best, frente); if (!aj) continue; const av = avaliaLuva(k, b, sc, s, aj, out, best.t);
      if (!melhor || av.nota < melhor.av.nota - 1e-6) melhor = { aj, av }; if (MAO_FAM.has(av.primeiro) && av.margem >= .35) break; }   // já seguro: não precisa antecipar mais
    if (melhor) out[s] = Object.assign(melhor.aj, { primeiro: melhor.av.primeiro });
  }
  return Object.keys(out).length ? out : null;
}
// giro no ombro + extensão/flexão do cotovelo que leva o centro da palma ao ponto da trajetória (antecipado em `frente` metros na direção do chute)
function miraLuva(k, b, sc, s, best, frente) {
  const C = KEEPER_CFG.ajuste, MAX = k.meioGarantido ? KEEPER_CFG.meio.ikMax : C.max; let B = best.B;
  if (frente) { const v = ballVel(b, best.t); if (Math.abs(v[2]) > 1) B = sub(B, mul(v, frente/Math.abs(v[2]))); }
  let D = sub(B, best.P); const L = len(D); if (L > MAX) D = mul(D, MAX/L);
  const u = norm(sub(best.P, best.S)), v = norm(sub(add(best.P, D), best.S)), e = cross(u, v), se = len(e); if (se < 1e-6) return null;
  const eixo = mul(e, 1/se), ang = Math.atan2(se, dot(u, v)), aj = { eixo, ang, t: best.t, frente, desloc: +len(D).toFixed(3), distAntes: +best.d.toFixed(3) };
  // 2ª etapa, o COTOVELO: o giro no ombro mantém o braço do tamanho que está. Se a luva ainda não chegou, o cotovelo ESTENDE (no máximo até o braço
  // ficar reto, nunca dobra para trás) ou FLEXIONA (bola mais perto do ombro do que a luva: traz a luva para dentro, na frente do corpo), até o limite
  const cols = colisores(k.plano.clip, ctDe(k, best.t), KEEPER_CFG.raiz, sc), ua = cols.find(c => c.nome === 'braco_' + s), fa = cols.find(c => c.nome === 'antebraco_' + s), m = cols.find(c => c.nome === 'mao_' + s);
  const gS = q => giraEm(q, ua.a, eixo, ang), cot = gS(fa.a), P2 = gS(add(m.a, mul(sub(m.b, m.a), .22))), dirU = norm(sub(cot, gS(ua.a))), dirF = norm(sub(P2, cot)), resto = sub(B, P2);
  const dobra = Math.acos(clamp(dot(dirU, dirF), -1, 1));                                               // 0 = braço reto
  if (len(resto) > .02) { const alvo = norm(sub(add(P2, mul(resto, Math.min(1, MAX/len(resto)))), cot)), ec = cross(dirF, alvo), sec = len(ec);
    const estende = Math.acos(clamp(dot(dirU, alvo), -1, 1)) < dobra, lim = estende ? dobra*.9 : C.cotovelo;
    if (sec > 1e-6 && lim > .01) { aj.eixoC = mul(ec, 1/sec); aj.angC = Math.min(Math.atan2(sec, dot(dirF, alvo)), lim, C.cotovelo); aj.flexiona = !estende; } }
  return aj;
}
// varre a bola contra o braço com o ajuste e repete a regra do contato real (a parte tocada primeiro, ou a que a bola encontra bem mais EM CHEIO logo
// depois): qual parte DESTE braço ficaria com a bola, e a menor folga da palma
const MAO_FAM = new Set(['palma', 'dedos', 'punho', 'maos']);
function avaliaLuva(k, b, sc, s, aj, out, tm) {
  const salvo = k.plano.ajuste; k.plano.ajuste = { ...out, [s]: aj }; let primeiro = null, folga = 9, margem = 0;
  const doBraco = c => c.nome.endsWith('_' + s) || c.nome === 'maos';
  try { const zm = colisoresPlano(k, tm, sc).find(c => c.nome === 'mao_' + s).a[2];   // bola ainda bem à frente da luva: nada a conferir (poupa o quadro)
    for (let t = Math.max(k.plano.tIni, tm - .12); t <= Math.min((b.tf || .7) + .02, tm + .06); t += 1/180) { const p = ballFlight(b, t); if (p[2] > zm + .55) continue; let hit = null;
      for (const c of detalha(colisoresPlano(k, t, sc), sc)) { if (!doBraco(c)) continue; const d = len(sub(p, pontoMaisProximo(p, c.a, c.b).c)) - c.r - BALL_R;
        if (MAO_FAM.has(c.regiao)) folga = Math.min(folga, d); if (d <= 0 && (!hit || d < hit.d)) hit = { d, c }; }
      if (hit) { const vIn = ballVel(b, t), dir = norm(vIn), ap = {};
        for (let u = 0; u <= .3; u += .03) { const q = add(p, mul(dir, u)); for (const c of detalha(colisoresPlano(k, t + u/len(vIn), sc), sc)) { if (!doBraco(c)) continue; const d = len(sub(q, pontoMaisProximo(q, c.a, c.b).c)); if (!(c.nome in ap) || d < ap[c.nome].d) ap[c.nome] = { d, r: c.r }; } }
        const prof = n => clamp(1 - ap[n].d/(ap[n].r + BALL_R), 0, 1); let nome = hit.c.nome, dep = prof(nome);
        for (const n of Object.keys(ap)) if (n !== hit.c.nome && ap[n].d < ap[n].r + BALL_R && prof(n) > dep + .2) { nome = n; dep = prof(n); }
        primeiro = regiaoDe(nome); const pm = Object.keys(ap).filter(n => MAO_FAM.has(regiaoDe(n))).map(prof), pb = Object.keys(ap).filter(n => !MAO_FAM.has(regiaoDe(n))).map(prof);
        margem = (pm.length ? Math.max(...pm) : 0) - (pb.length ? Math.max(...pb) : 0); break; } } }
  finally { k.plano.ajuste = salvo; }
  return { primeiro, folga, margem, nota: (primeiro && !MAO_FAM.has(primeiro) ? 1 : 0) + Math.max(0, folga) - .3*clamp(margem, -1, 1) + aj.frente*.05 };   // margem: palma bem mais em cheio que o antebraço = escolha segura
}

// ---------- detecção CONTÍNUA entre dois instantes do voo (a bola é subdividida em passos de ≤ 2 cm; cada passo usa a pose do clipe naquele instante) ----------
export function detectar(k, b, tA, tB, sc = [1, 1]) {
  if (!k.plano || b.fis) return null;
  const C = KEEPER_CFG, pA = ballFlight(b, tA), pB = ballFlight(b, tB), n = Math.max(1, Math.ceil(len(sub(pB, pA))/C.passo));
  for (let i = 1; i <= n; i++) {
    const t = tA + (tB - tA)*i/n; if (t < k.plano.tIni) continue; const p = ballFlight(b, t), ct = ctDe(k, t); let hit = null;
    for (const c of detalha(colisoresPlano(k, t, sc), sc)) { const q = pontoMaisProximo(p, c.a, c.b), d = len(sub(p, q.c)) - c.r - BALL_R;
      if (k.dmin == null || d < k.dmin.d) k.dmin = { d: +d.toFixed(3), parte: c.nome };
      if (d <= 0 && (!hit || d < hit.d)) hit = { d, c, q, p, t, ct }; }
    if (hit) return descreverContato(k, b, hit, sc);
  }
  return null;
}
// geometria do contato: parte, profundidade (quão no CENTRO da parte a bola vinha: 0 = raspão, 1 = em cheio), duas mãos, corpo atrás, velocidades
function descreverContato(k, b, h, sc) {
  const C = KEEPER_CFG, vIn = ballVel(b, h.t), dir = norm(vIn), ap = {};
  for (let s = 0; s <= .3; s += .01) { const p = add(h.p, mul(dir, s)), cols = detalha(colisoresPlano(k, h.t + s/len(vIn), sc), sc);
    for (const c of cols) { const d = len(sub(p, pontoMaisProximo(p, c.a, c.b).c)); if (!(c.nome in ap) || d < ap[c.nome].d) ap[c.nome] = { d, r: c.r }; } }
  const prof = n => clamp(1 - ap[n].d/(ap[n].r + BALL_R), 0, 1), depth = h.c.nome === 'maos' ? Math.max(prof('maos'), .85) : prof(h.c.nome), perto = (n, folga = 0) => ap[n] && ap[n].d < ap[n].r + BALL_R + folga;   // entre as duas luvas: bola encaixada
  const vel = t => detalha(colisoresPlano(k, t, sc), sc).find(c => c.nome === h.c.nome) || h.c, A = vel(h.t - 1/FPS), B = vel(h.t + 1/FPS);   // "as duas mãos" pode não existir no quadro vizinho
  const vHand = mul(sub(add(A.a, mul(sub(A.b || A.a, A.a), h.q.s)), add(B.a, mul(sub(B.b || B.a, B.a), h.q.s))), -FPS/2);
  let ng = norm(sub(h.p, h.q.c)); if (dot(ng, vIn) > 0) ng = mul(ng, -1); const al = REGIAO[h.c.regiao].pal; let n = norm(add(mul(dir, -al), mul(ng, 1 - al)));
  // a bola que raspa uma parte e logo depois encontra outra em cheio (a beira da luva e o peito atrás) fica na parte em cheio: o corpo atrás segura
  let parte = h.c.nome, regiao = h.c.regiao, dep = depth;
  const maoPrimeiro = REGIAO[h.c.regiao]?.fam === 'mao';   // PRIORIDADE DA MÃO: tocou primeiro numa luva → o contato é de mão (pode passar a outra parte da luva, nunca ao tronco)
  for (const nm of Object.keys(ap)) { if (!perto(nm) || nm === h.c.nome) continue; if (maoPrimeiro && REGIAO[regiaoDe(nm)]?.fam !== 'mao') continue; const pd = nm === 'maos' ? Math.max(prof(nm), .85) : prof(nm); if (pd > dep + .2) { parte = nm; regiao = regiaoDe(nm); dep = pd; } }
  // bola que chega CENTRADA na mão (mão apontada para ela) entra na luva: é palma. "Ponta dos dedos" é o toque de raspão, na beira dos dedos
  if (regiao === 'dedos' && dep >= .5) { regiao = 'palma'; const ps = parte.replace('dedos', 'palma'); if (ap[ps]) parte = ps; }
  // peito/abdômen tocados de lado (a bola chega pela lateral do corpo): lateral do tronco
  if ((regiao === 'peito' || regiao === 'abdomen') && Math.abs(ng[0]) > .75 && Math.abs(dir[2]) < .9) regiao = 'lateral';
  const grupo = REGIAO[regiao].fam;
  if (parte !== h.c.nome || regiao !== h.c.regiao) { const al2 = REGIAO[regiao].pal; n = norm(add(mul(dir, -al2), mul(ng, 1 - al2))); }
  return { parte, regiao, nomeParte: REGIAO[regiao].nome, grupo, primeiro: h.c.nome, t: h.t, ct: h.ct, p: h.p, pen: Math.max(0, -h.d), ponto: h.q.c, s: h.q.s, normal: n, normalGeo: ng, depth: +dep.toFixed(3),
    // ENCAIXE exige as DUAS mãos em contato válido com a bola (palma ou dedos de cada lado, ≤ 4 cm além do toque — a espuma da luva) — não basta uma
    duasMaos: grupo === 'mao' && (perto('palma_l', C.luva) || perto('dedos_l', C.luva)) && (perto('palma_r', C.luva) || perto('dedos_r', C.luva)),
    maoE: perto('palma_l', C.luva) || perto('dedos_l', C.luva), maoD: perto('palma_r', C.luva) || perto('dedos_r', C.luva),   // as duas luvas em volta da bola (a outra a até 12 cm)
    corpoAtras: grupo !== 'tronco' && (perto('peito') || perto('abdomen')), vIn, vMao: vHand, vel: +len(vIn).toFixed(2) };
}

// ---------- resultado do contato: (1) contato físico já confirmado → (2) probabilidade de controle pela geometria/velocidade/parte → (3) física ----------
const lerp = (a, b, u) => a + (b - a)*u, faixa = (v, [a, b]) => clamp((v - a)/(b - a), 0, 1);
// chance de defesa EFETIVA para um contato (só é chamada com contato físico confirmado): situação (tabela KEEPER_CFG.prob) × qualidade do contato
export function chanceDefesa(ct, craque = 75) {
  const P = KEEPER_CFG.prob, s = faixa(ct.vel, P.vel), e = faixa(Math.abs(ct.p[0] - KEEPER_CFG.raiz[0]), P.lateral), a = faixa(ct.p[1], P.alto);
  const canto = lerp(P.fracoCanto, lerp(P.forteCanto, P.forteAlto, a), s), centro = lerp(P.centro, P.centroForte, s)*lerp(1, P.centroAlto/P.centro, a), base = lerp(centro, canto, e);
  const fDepth = sm(ct.depth/.45), qual = (.55 + .45*fDepth)*(REGIAO[ct.regiao]?.q ?? PARTES[ct.grupo])*(ct.duasMaos ? 1.06 : 1)*(ct.corpoAtras ? 1.05 : 1)*(1 - (craque - 75)/400);
  return { p: clamp(base*qual, 0, .99), base, qual, s, e, a, fDepth };
}
export function resultadoContato(ct, { rng = Math.random, craque = 75, garantida = false } = {}) {
  const G = ct.grupo, ch = chanceDefesa(ct, craque), { fDepth } = ch, q = ch.qual, pFirme = garantida ? 1 : ch.p;   // garantida: MEIO com a bola no meio
  // ENCAIXE: só onde dá para segurar (palmas/duas mãos, punho, peito, abdômen); a ponta dos dedos, os braços, as pernas e os pés nunca encaixam
  // ENCAIXE: só com as DUAS mãos em contato e a bola controlada; com uma mão, peito, braço, perna ou pé nunca é encaixe (espalma, bloqueia ou rebate).
  // Mesmo com as duas mãos, a bola forte pode escapar (fica como defesa firme/rebote, nunca "presa").
  const pAgarra = ct.duasMaos && ct.regiao !== 'dedos' ? clamp(.85*(1 - .7*ch.s)*(1 - .4*ch.e)*(.4 + .6*fDepth)*(ct.corpoAtras ? 1.1 : 1), 0, .9) : 0;
  const u = rng(); let tipo, e, mu, kh;
  if (u < pFirme*pAgarra) tipo = 'agarrada';
  else if (u < pFirme) { tipo = 'firme'; e = G === 'tronco' || G === 'perna' ? .3 + .1*rng() : .38 + .17*rng(); mu = .55; kh = .8; }
  else if (u < pFirme + (1 - pFirme)*(.35 + .5*fDepth)) { tipo = 'parcial'; e = .12 + .08*rng(); mu = .85; kh = .35; }
  else { tipo = 'raspao'; e = .04; mu = .97; kh = .08; }
  const motivo = `${ct.nomeParte || G}${ct.duasMaos && ct.regiao !== 'maos' ? ' (duas mãos)' : ''}, ${Math.round(ct.depth*100)}% no centro da parte, ${ct.vel.toFixed(1)} m/s, ${Math.abs(ct.p[0]).toFixed(2)} m do centro, ${ct.p[1].toFixed(2)} m de altura → situação ${Math.round(ch.base*100)}% × contato ${q.toFixed(2)} = defesa ${Math.round(pFirme*100)}% (agarra ${Math.round(pFirme*pAgarra*100)}%)`;
  if (tipo === 'agarrada') return { tipo, q, pFirme, pAgarra, chance: ch, motivo, vOut: [0, 0, 0] };
  // pequena variação controlada da normal (±8°): a superfície da luva/corpo não é perfeita
  const a = (rng() - .5)*.28; let n = norm(add(ct.normal, [Math.sin(a)*.5, Math.cos(a)*.1 - .05, 0]));
  // CONTROLE DE DESVIO (como os jogos da EA): a mão que desvia com firmeza vira a bola para FORA do gol — para o lado da trave mais próxima e, se alta,
  // por cima do travessão. Ponta dos dedos depende mais disso (só dá para "tirar"); peito, pernas e pés não escolhem: rebote para o campo.
  const desvio = { palma: .3, maos: .25, punho: .3, dedos: .55, antebraco: .2 }[ct.regiao] || 0;
  if (desvio && tipo === 'firme') { const fora = norm([Math.sign(ct.p[0] || 1)*1, ct.p[1] > 1.5 ? .9 : .15, .35]); n = norm(add(mul(n, 1 - desvio), mul(fora, desvio))); }
  let vOut;
  if (tipo === 'firme') { const vRel = sub(ct.vIn, ct.vMao), vn = mul(n, dot(vRel, n)), vt = sub(vRel, vn); vOut = add(add(mul(vn, -e), mul(vt, mu)), mul(ct.vMao, kh)); }
  else {   // parcial / raspão: a luva NÃO segura a bola — ela segue em frente, mais lenta e desviada pela superfície que tocou (normal geométrica)
    const v = len(ct.vIn), ng = ct.normalGeo || ct.normal, k = tipo === 'parcial' ? .18 + .14*rng() : .04 + .04*rng(), keep = tipo === 'parcial' ? .55 + .2*rng() : .88 + .07*rng();
    vOut = add(add(mul(ct.vIn, keep), mul(ng, v*k)), mul(ct.vMao, kh)); }
  return { tipo, q, pFirme, pAgarra, escapou: ct.duasMaos && tipo !== 'agarrada', chance: ch, motivo, e, mu, vOut };
}

// ---------- física da bola depois do contato (gravidade, quique, travessão/trave, rede); passo fixo — o MESMO na previsão e no jogo ----------
export function novaBolaLivre(p, v) { return { p: p.slice(), v: v.slice(), t: 0, estado: 'livre', gol: false, res: null, trave: 0, ferros: [], cruzou: false }; }
// QUIQUE da bola no gramado: restituição (fração da velocidade vertical que volta), perda horizontal por toque e velocidade mínima para ainda quicar
export const QUIQUE = { e: .62, atrito: .86, min: .42 };
export function passoLivre(f, dt = KEEPER_CFG.dt) {
  const g = 9.81, pz = f.p[2], p0 = f.p.slice(); f.t += dt;
  f.v[1] -= g*dt; const dr = 1 - .015*dt*len(f.v); f.v = mul(f.v, Math.max(.9, dr)); f.p = add(f.p, mul(f.v, dt));
  { const h = varreFerro(p0, f.p); if (h) { f.p = separa(h.p, h); f.v = reflete(f.v, h.normal); f.trave++; (f.ferros ||= []).push(h.ferro.nome); } }   // trave/travessão: colisão contínua com o cilindro (js/fisicaGol.js)
  if (f.p[1] < BALL_R) { f.p[1] = BALL_R; if (f.v[1] < 0) { f.v[1] = -f.v[1]*QUIQUE.e; f.v[0] *= QUIQUE.atrito; f.v[2] *= QUIQUE.atrito; if (f.v[1] < QUIQUE.min) f.v[1] = 0; } if (f.v[1] === 0) { const k = Math.max(0, 1 - 1.4*dt); f.v[0] *= k; f.v[2] *= k; } }   // quica algumas vezes e depois rola
  const hw = GOAL_W/2;
  if (!f.gol && pz > 0 && f.p[2] <= 0) {                                         // cruzou o plano do gol
    const dentro = Math.abs(f.p[0]) < hw - BALL_R && f.p[1] < GOAL_H - BALL_R;   // (os ferros já são colisão física acima)
    if (dentro) f.gol = true;
    else { f.cruzou = true; f.res ??= 'defesa'; }                                                              // tocada pelo goleiro e foi para fora
  }
  if (f.gol) {                                                                                                // rede: segura a bola dentro do gol
    if (f.p[2] < -1.6) { f.p[2] = -1.6; f.v[2] = -f.v[2]*.15; f.v[0] *= .5; f.v[1] *= .5; }
    if (Math.abs(f.p[0]) > hw - BALL_R) { f.p[0] = Math.sign(f.p[0])*(hw - BALL_R); f.v[0] = -f.v[0]*.2; }
    if (f.p[1] > GOAL_H - BALL_R) { f.p[1] = GOAL_H - BALL_R; f.v[1] = -Math.abs(f.v[1])*.2; }
    f.res ??= 'gol';
  }
  if (!f.res && f.t > .25 && ((f.v[2] > 0 && f.p[2] > 1.2) || len(f.v) < .8)) f.res = 'defesa';           // voltou para o campo (ou parou): não entra mais
  if (!f.res && f.t > 2.5) f.res = 'defesa';
  return f;
}
// rótulo do resultado pela trajetória SIMULADA (mesmo integrador do jogo): para onde a bola foi depois do toque
export function preverDesvio(p, v) {
  const f = novaBolaLivre(p, v); while (!f.res && f.t < 3) passoLivre(f);
  const dirn = Math.abs(f.v[0]) < .45*Math.abs(f.v[2]) ? 'frente' : (f.p[0] - p[0]) > 0 ? 'esquerda' : 'direita';
  return { res: f.res || 'defesa', gol: f.gol, fora: f.cruzou, campo: !f.gol && !f.cruzou, dir: dirn, fim: f.p.map(x => +x.toFixed(2)), trave: f.trave };
}
export function rotulo(r, prev) {
  if (r.tipo === 'agarrada') return 'agarrada';
  if (prev.gol) return r.tipo === 'raspao' ? 'raspao_gol' : 'parcial_gol';
  if (r.tipo === 'raspao') return prev.fora ? 'raspao_fora' : 'raspao_campo';
  if (r.tipo === 'parcial') return prev.fora ? 'parcial_fora' : 'parcial_campo';
  return prev.fora ? 'espalmada' : 'rebatida_' + prev.dir;
}
export const ROTULOS = { agarrada: 'A · encaixe', espalmada: 'B · espalmada para fora', rebatida_esquerda: 'D · rebote para a esquerda', rebatida_direita: 'D · rebote para a direita',
  rebatida_frente: 'D · rebote para a frente', parcial_gol: 'C · defesa parcial: entrou', parcial_fora: 'C · defesa parcial: foi para fora', parcial_campo: 'C · defesa parcial: continua em jogo',
  raspao_gol: 'C · raspão: entrou', raspao_fora: 'C · raspão: foi para fora', raspao_campo: 'C · raspão: continua em jogo' };
// nome da defesa pela parte que tocou e pelo que aconteceu com a bola (para o registro, a depuração e os testes)
export function defesaNome(c) {
  if (!c) return 'sem contato';
  const r = c.rotulo || '', reb = r.startsWith('rebatida') ? ' · rebote' : r.includes('_gol') ? ' · não segurou: entrou' : r === 'espalmada' || r.endsWith('_fora') ? ' · para fora' : '';
  if (r === 'agarrada') return 'Encaixe com as duas mãos';
  switch (c.regiao) {
    case 'dedos': return 'Defesa com a ponta dos dedos' + reb;
    case 'palma': case 'punho': case 'maos': return (r === 'espalmada' ? 'Espalmada' : c.duasMaos ? 'Defesa com as duas mãos (sem encaixe)' : 'Defesa com uma mão') + (r === 'espalmada' ? '' : reb);
    case 'antebraco': case 'cotovelo': case 'braco': return 'Defesa com o braço' + reb;
    case 'ombro': return 'Bloqueio com o ombro' + reb;
    case 'peito': case 'lateral': return 'Bloqueio com o peito' + reb;
    case 'abdomen': return 'Bloqueio com o abdômen' + reb;
    case 'cabeca': return 'Bloqueio com a cabeça' + reb;
    case 'coxa': case 'joelho': case 'canela': return 'Defesa com a perna' + reb;
    case 'pe': return 'Defesa com o pé' + reb;
  }
  return c.parte + reb;
}
// os quatro resultados principais (A encaixe · B espalmada · C defesa parcial · D rebote) a partir do rótulo detalhado
export const classe = r => r === 'agarrada' ? 'A' : r === 'espalmada' ? 'B' : r.startsWith('rebatida') ? 'D' : 'C';

// ponto em que a bola agarrada fica: entre as duas luvas (ou junto da parte que segurou)
export function ancora(k, sc = [1, 1], t) {
  const cols = detalha(colisoresPlano(k, t, sc), sc), m = n => cols.find(c => c.nome === n), ponta = c => c.b ? add(c.a, mul(sub(c.b, c.a), .55)) : c.a;
  const c = k.contato; if (c.grupo === 'mao' && c.duasMaos) { const a = ponta(m('palma_l')), b = ponta(m('palma_r'));
    const meio = add(mul(add(a, b), .5), mul(c.normal, BALL_R*.6)), w = sm((len(sub(a, b)) - .28)/.08); if (w <= 0) return meio;   // entre as duas palmas
    const ult = k.bolaPresa || meio, perto = len(sub(a, ult)) <= len(sub(b, ult)) ? a : b; return add(mul(meio, 1 - w), mul(add(perto, mul(c.normal, BALL_R*.9)), w)); }   // a animação abriu os braços: a bola passa SUAVEMENTE para a mão mais próxima (nunca flutua)
  const p = m(c.parte), q = p.b ? add(p.a, mul(sub(p.b, p.a), c.s)) : p.a; return add(q, mul(c.normal, p.r + BALL_R*.9));
}

// ---------- SENSOR DE TRAJETÓRIA E INTERCEPTAÇÃO ----------
// A cada passo, com a bola no ar: posição e velocidade, direção, o PONTO (x, y em metros) em que vai cruzar o plano do gol, região descrita em
// coordenadas reais (não só 9 casas), tempo até chegar, e a parte do corpo que está mais perto de alcançá-la. A percepção começa com o erro de
// leitura e fica mais precisa conforme a bola se aproxima (o erro é proporcional à distância). As mãos (IK) são recalculadas a partir dele.
// AS TRÊS ÁREAS DO GOL (terços iguais da largura, lados do ponto de vista do goleiro: esquerda = +x): a divisão inicial de decisão. A escolha do goleiro
// (memória 1/3) é uma delas; o sensor diz em qual delas a bola vai passar — e continua dando as coordenadas exatas (x, y) dentro da área.
export const TERCO = GOAL_W/6;   // meia largura da área do meio (1,22 m)
export const areaDe = x => x > TERCO ? 'esq' : x < -TERCO ? 'dir' : 'centro';
// nomes como aparecem na TELA (os mesmos do aviso "Canto travado"): o lado esquerdo do goleiro fica à DIREITA de quem olha para o gol
export const NOME_AREA = { esq: 'DIREITA', centro: 'MEIO', dir: 'ESQUERDA' };
const regiaoGol = (x, y) => { const lado = x > 2.1 ? 'canto esquerdo' : x > .9 ? 'meio esquerdo' : x < -2.1 ? 'canto direito' : x < -.9 ? 'meio direito' : 'centro', alt = y < .6 ? 'baixo' : y > 1.5 ? 'alto' : 'meia altura';
  return `${lado}, ${alt}`; };
export function atualizaSensor(k, b, tB, sc = [1, 1], rng = Math.random) {
  if (!k.ruido) k.ruido = [gauss(rng), gauss(rng)];
  const p = ballFlight(b, tB), v = ballVel(b, tB), [cx, cy] = cruzamento(b), tf = b.tf || .7, falta = Math.max(0, tf - tB);
  const sig = .3*clamp((p[2] - KEEPER_CFG.raiz[2])/SPOT_Z, 0, 1), px = cx + k.ruido[0]*sig, py = Math.max(BALL_R, cy + k.ruido[1]*sig*.8);
  let parte = null, dist = null;
  if (k.plano) { const tz = Math.min(tf, tB + Math.max(0, falta - .03)), q = ballFlight({ ...b, gx: px/GOAL_W + .5, gy: py/GOAL_H }, tz);
    for (const c of detalha(colisoresPlano(k, tz, sc), sc)) { const d = len(sub(q, pontoMaisProximo(q, c.a, c.b).c)) - c.r - BALL_R; if (dist == null || d < dist) { dist = d; parte = c.nome; } } }
  k.sensor = { t: tB, pos: p.map(x => +x.toFixed(2)), vel: +len(v).toFixed(1), dir: areaDe(px), area: areaDe(px), areaReal: areaDe(cx), ponto: [+px.toFixed(2), +py.toFixed(2)], real: [+cx.toFixed(2), +cy.toFixed(2)],
    erro: +Math.hypot(px - cx, py - cy).toFixed(2), regiao: regiaoGol(px, py), tempo: +falta.toFixed(2), parte, regiaoParte: parte ? REGIAO[regiaoDe(parte)]?.nome : null, dist: dist != null ? +dist.toFixed(2) : null };
  return k.sensor;
}
// velocidade do corpo do goleiro agora (pelve, m/s) — para a depuração
export function velocidadeGoleiro(k, b, sc = [1, 1]) {
  if (!k.plano || !b || b.t < k.plano.tIni) return 0; const A = colisoresPlano(k, b.t - 1/60, sc).find(c => c.nome === 'tronco').a, B = colisoresPlano(k, b.t + 1/60, sc).find(c => c.nome === 'tronco').a;
  return len(sub(B, A))*30;
}

// ---------- um passo do goleiro (chamado pelo jogo a cada passo fixo, com a bola em jogo) ----------
// Devolve 'contato' quando houve toque neste passo (o jogo então deixa a física livre da bola decidir o resultado).
export function passo(k, b, tA, tB, { dif = 'normal', sc = [1, 1], rng = Math.random, craque = 75 } = {}) {
  const C = KEEPER_CFG;
  if (k.prepIni == null && k.prepIniBola == null && tB >= -C.decisaoAntes) { k.prepIniBola = Math.max(tA, -C.decisaoAntes); travar(k, -k.prepIniBola); }   // sem o jogo (testes): relógio da bola
  k.meioGarantido = k.lado === 'centro' && tB > 0 && Math.abs(cruzamento(b)[0]) <= TERCO;
  atualizaRegua(k, tB, sc);   // régua roxa: só existe com a decisão MEIO; presa ao goleiro antes do chute, congela no chute
  if (!k.plano && (k.lado === 'esq' || k.lado === 'dir') && tB >= -C.saida.antes && tB < 0) {   // já sai para o lado escolhido antes do pé na bola
    k.plano = { clip: clipeDe(k.lado, 'media'), foto: fotoPara(k, clipeDe(k.lado, 'media'), tB, sc), tipo: 'mergulho', lado: k.lado, altura: 'media', tIni: tB, off: C.prep.t*.5, ritmo: C.saida.ctNoChute ? Math.max(.15, (C.saida.ctNoChute - C.prep.t*.5)/Math.max(.05, -tB)) : 1, blend: .15, pre: true, lido: { x: 0, y: 0, cat: '—' }, real: '—', folgaPrevista: 0,
      motivoEscolha: `saída para ${k.lado} ${(-tB).toFixed(2)} s antes do chute`, opcoes: 0 };
    registra(k, `começa a sair para ${k.lado} a ${(-tB).toFixed(2)} s do chute (carrega o peso e dá o primeiro passo)`);
  }
  if ((!k.plano || k.plano.pre) && tB >= 0) { const r = k.lado === 'centro' ? C.reacao.centro : C.reacao.lado; if (tB >= (r[dif] ?? r.normal)) planejar(k, b, { dif, sc, rng }, { atual: k.plano?.pre ? k.plano : null, forcar: true }); }
  else if (k.plano && !k.plano.pre && !b.fis && tB >= k.plano.tIni + C.correcao.apos && (!k.corrigiu || (k.meioGarantido && (k.nCorr || 0) < 3 && tB - k.tCorr >= .06))) {
    // correção: uma vez; com MEIO e a bola no meio, até 3 (o goleiro de frente para a bola vai ajustando os passos enquanto ela chega)
    k.corrigiu = true; k.nCorr = (k.nCorr || 0) + 1; k.tCorr = tB; if (ballFlight(b, tB)[2] > (k.meioGarantido ? 1.5 : C.correcao.zMin)) planejar(k, b, { dif, sc, rng }, { fatorErro: C.correcao.fatorErro, atual: k.plano }); }
  if (tB > 0 && !b.fis) {
    atualizaSensor(k, b, tB, sc, rng);
    // MÃOS NO PONTO DA BOLA: com o sensor mais preciso a cada passo, o ajuste dos braços (ombro + cotovelo) é refeito a cada ~0,04 s
    if (k.plano && !k.plano.pre && tB < (b.tf || .7) - .04 && (!k.tAjuste || tB - k.tAjuste >= .04)) { k.tAjuste = tB; k.plano.ajuste = calculaAjuste(k, { ...b, gx: k.sensor.ponto[0]/GOAL_W + .5, gy: k.sensor.ponto[1]/GOAL_H }, sc); }
    if (k.plano && !k.plano.pre) { const S_ = sensoresMaos(k, b, tB, sc); for (const s of ['l', 'r']) { if (k.plano.ajuste?.[s]) { evento(k, 'sensor_mao_' + s, tB); evento(k, 'tentativa_mao_' + s, tB); } if (S_[s].dentro) evento(k, 'na_area_mao_' + s, tB); } }   // sensor: a trajetória prevista passa pela área da mão → tentativa (braço); depois, a bola entra de fato na área
  }
  // FERROS NO VOO: a bola encosta na trave/no travessão antes de chegar ao goleiro? (colisão contínua; o goleiro só é testado até esse instante)
  let hf = null;
  if (!b.fis && tB > 0) { const t0 = Math.max(tA, 0), h = varreFerro(ballFlight(b, t0), ballFlight(b, tB)); if (h) hf = { ...h, t: t0 + (tB - t0)*h.u }; }
  if (k.plano && !k.plano.pre && !b.fis && tB > 0) {
    const c = detectar(k, b, Math.max(tA, 0), hf ? hf.t : tB, sc);
    if (c) {
      // MEIO e bola no meio (área central): o goleiro está na frente da bola — tocou, defendeu (firme ou encaixe), qualquer que seja a força do chute
      const garantida = k.lado === 'centro' && Math.abs(cruzamento(b)[0]) <= TERCO;
      // depois do toque o resto do movimento volta a um ritmo natural (o ritmo alto servia para CHEGAR à bola; levar a bola ao peito a 2× ficaria irreal)
      if ((k.plano.ritmo || 1) > 1.2) k.plano.troca = { t: c.t, ct: ctDe(k, c.t), r: 1.2 };   // a partir do toque, o clipe segue a 1,2× (sem mexer no início da ação)
      const r = resultadoContato(c, { rng, craque, garantida }); k.contato = { ...c, ...r, garantida };
      if (r.tipo === 'agarrada') { k.bolaPresa = c.p.slice(); b.fis = { ...novaBolaLivre(c.p, [0, 0, 0]), estado: 'preso', t0: c.t, de: c.p.slice(), res: 'defesa' }; k.contato.rotulo = 'agarrada'; k.contato.prev = { res: 'defesa' }; }
      else { let prev = preverDesvio(c.p, r.vOut);
        if (garantida && prev.res === 'gol') {   // a bola rebatida não pode voltar para dentro: sai para o campo, para o lado de fora do corpo
          const v = len(c.vIn), sx = Math.sign(c.p[0] - KEEPER_CFG.raiz[0]) || 1; r.vOut = [sx*v*.22, v*.1 + 1.2, v*.32]; k.contato.vOut = r.vOut; prev = preverDesvio(c.p, r.vOut); }
        k.contato.prev = prev; k.contato.rotulo = rotulo(r, prev); b.fis = novaBolaLivre(add(c.p, mul(c.normalGeo || c.normal, (c.pen || 0) + .002)), r.vOut); }   // a bola sai FORA da superfície tocada
      k.contato.vOutMod = +len(k.contato.vOut || [0, 0, 0]).toFixed(2); k.contato.defesa = defesaNome(k.contato);
      if (c.maoE) evento(k, 'toque_mao_l', c.t); if (c.maoD) evento(k, 'toque_mao_r', c.t); if (c.maoE && c.maoD) evento(k, 'duas_maos', c.t); evento(k, 'toque_' + c.regiao, c.t, { parte: c.parte });
      registra(k, `CONTATO ${c.parte} t=${c.t.toFixed(3)} s · ${k.contato.defesa} · ${ROTULOS[k.contato.rotulo] || k.contato.rotulo} · ${r.motivo} · ${c.vel.toFixed(1)} → ${k.contato.vOutMod} m/s`);
      return 'contato';
    }
  }
  if (hf) { const v = ballVel(b, hf.t); b.fis = { ...novaBolaLivre(separa(hf.p, hf), reflete(v, hf.normal)), trave: 1, ferros: [hf.ferro.nome] };
    evento(k, hf.ferro.nome === 'travessao' ? 'travessao' : 'trave', hf.t, { ferro: hf.ferro.nome });
    k.ferro = { nome: hf.ferro.nome, rotulo: hf.ferro.rotulo, t: +hf.t.toFixed(3), ponto: hf.ponto.map(x => +x.toFixed(3)), vel: +len(v).toFixed(1) };
    registra(k, `BOLA NO FERRO: ${hf.ferro.rotulo} em t=${hf.t.toFixed(3)} s, ${len(v).toFixed(1)} m/s → ${len(b.fis.v).toFixed(1)} m/s`); return 'ferro'; }
  return null;
}
// a bola depois do contato, a cada passo (agarrada: vai junto com as luvas até o fim do mergulho, depois cai)
export function passoBola(k, b, dt, sc = [1, 1]) {
  const f = b.fis; if (!f) return;
  if (f.estado === 'preso') {
    const ct = ctDe(k, b.t), info = CLIP_INFO[k.plano.clip];
    if (ct >= info.dur - .08) { Object.assign(f, novaBolaLivre(f.p, [0, -.4, 1.1]), { res: f.res }); colideCorpo(k, f, f.p.slice(), b.t, sc); return; }   // fim da animação de encaixe: o goleiro solta a bola à frente (fora do corpo)
    const u = sm((b.t - f.t0)/.1), A = ancora(k, sc, b.t); f.p = add(mul(f.de, 1 - u), mul(A, u)); f.p[1] = Math.max(BALL_R, f.p[1]); k.bolaPresa = f.p.slice(); return;
  }
  const p0 = f.p.slice(); passoLivre(f, dt);
  if (k && k.plano) colideCorpo(k, f, p0, b.t, sc, k.contato);   // o corpo do goleiro continua SÓLIDO depois do 1º toque (rebote não atravessa)
}
// BARREIRA DO CORPO para a bola livre: varredura contínua (passos de ≤ 2 cm) contra todos os colisores do goleiro na pose deste instante; a bola que
// encosta é empurrada para fora da superfície e, se vinha contra ela, rebate (restituição baixa do corpo, atrito). Uma colisão por passo (sem duplicar).
export function colideCorpo(k, f, p0, t, sc = [1, 1], ct = null) {
  // depois de um toque de MÃO/BRAÇO, as luvas e os braços cedem junto com a bola por 0,25 s (a luva que toca de raspão não vira parede); cabeça, tronco e pernas continuam sólidos
  const cede = ct && ['mao', 'antebraco', 'braco'].includes(ct.grupo) && t < ct.t + KEEPER_CFG.corpo.cede;   // as luvas e os braços cedem com a bola logo depois de um toque de mão
  const cols = detalha(colisoresPlano(k, t, sc), sc).filter(c => !(cede && ['mao', 'antebraco', 'braco'].includes(c.grupo))), n = Math.max(1, Math.ceil(len(sub(f.p, p0))/KEEPER_CFG.passo));
  for (let i = 1; i <= n; i++) { const p = add(p0, mul(sub(f.p, p0), i/n)); let pior = null;
    for (const c of cols) { const q = pontoMaisProximo(p, c.a, c.b).c, d = len(sub(p, q)) - c.r - BALL_R; if (d < 0 && (!pior || d < pior.d)) pior = { d, q, c }; }
    if (!pior) continue;
    // resolve TODAS as sobreposições deste instante (a bola entre duas partes — as duas luvas, braço e peito — não fica presa pulando de uma para a outra)
    let q = p; const tocadas = [];
    for (let it = 0; it < 16; it++) { let pi = null; for (const c of cols) { const qq = pontoMaisProximo(q, c.a, c.b).c, d = len(sub(q, qq)) - c.r - BALL_R; if (d < 0 && (!pi || d < pi.d)) pi = { d, q: qq, c }; }
      if (!pi) break; let nrm = sub(q, pi.q); nrm = len(nrm) > 1e-6 ? norm(nrm) : [0, 0, 1]; q = add(q, mul(nrm, -pi.d + .001)); tocadas.push(pi.c.nome);
      const vn = dot(f.v, nrm); if (vn < 0) { const vN = mul(nrm, vn), vT = sub(f.v, vN); f.v = add(mul(vN, -KEEPER_CFG.corpo.e), mul(vT, KEEPER_CFG.corpo.atrito)); } }
    q[1] = Math.max(BALL_R, q[1]);   // nunca para baixo do gramado; se o chão a devolver para dentro do corpo (goleiro deitado sobre a bola), sai pelo chão: para o lado/frente
    for (let it = 0; it < 12; it++) { let pi = null; for (const c of cols) { const qq = pontoMaisProximo(q, c.a, c.b).c, d = len(sub(q, qq)) - c.r - BALL_R; if (d < 0 && (!pi || d < pi.d)) pi = { d, q: qq }; }
      if (!pi) break; let h = sub(q, pi.q); h = [h[0], 0, h[2]]; h = len(h) > 1e-6 ? norm(h) : [0, 0, 1]; q = add(q, mul(h, -pi.d + .001)); if (dot(f.v, h) < 0) f.v = sub(f.v, mul(h, dot(f.v, h)*1.3)); }
    f.p = q; (f.corpo ||= []).push(...tocadas); return tocadas[0];
  }
  return null;
}
// motivo de não ter havido contato (para a depuração e o registro)
export function motivoSemContato(k, b) {
  const [cx, cy] = cruzamento(b), real = classificar(cx, cy), p = k.plano;
  if (!p) return 'o goleiro não chegou a reagir';
  const lado = p.lado, errado = real.lado !== 'centro' && lado !== 'centro' && real.lado !== lado;
  const falta = k.dmin ? `${Math.round(k.dmin.d*100)} cm (parte mais próxima: ${k.dmin.parte})` : '?';
  if (errado) return `lado errado: o peso estava ${k.lado}, a bola foi ${real.lado}; a ação possível (${p.clip}) não alcançou (faltaram ${falta})`;
  if (!p.cobria) return `nenhuma ação alcançava a bola lida (${p.lido.cat}); tentativa ${p.clip} — fora do alcance por ${falta}`;
  const S = KEEPER_CFG.salto, lim = p.tipo === 'centro' ? S.centro : p.tipo === 'curta' || p.tipo === 'passos' ? S.curta : k.lado === 'centro' ? S.parado : S.preparado;
  return `fora do alcance por ${falta}${p.off >= lim - 1e-6 ? ' (bola rápida: o movimento ainda não tinha chegado à extensão máxima)' : ''}`;
}

// ---------- animação do goleiro para o quadro (frame.js): espera (laço) + preparação → mergulho sincronizado → reação no lugar onde caiu ----------
export function animGoleiro(k, b, { agora = 0, tJogo = 0, sc = [1, 1], nk = 0, cheer, sad } = {}) {
  const C = KEEPER_CFG, R = C.raiz;
  if (b && k && k.plano && b.t >= k.plano.tIni) {
    const ct = ctDe(k, b.t), info = CLIP_INFO[k.plano.clip], fim = info.dur - .35;
    if (b.res && ct >= fim && cheer) { const gol = b.res === 'gol';
      const lista = gol ? sad : cheer;
      return { clip: lista[nk % lista.length], pe: nk % 2 ? 'l' : 'r', t: ct - fim, pos: [R[0] + sc[0]*info.fim[0], 0, R[2] + sc[0]*info.fim[1]], yaw: info.yawFim, blend: .45, state: gol ? 'keeperSad' : 'keeperCheer' }; }
    if (ct >= info.dur && !b.res) return { gk: true, idle: true, clip: 'gk_espera', t: agora, pos: [R[0] + sc[0]*info.fim[0], 0, R[2] + sc[0]*info.fim[1]], yaw: info.yawFim, state: 'keeperWait', ready: null };   // acabou a ação e a jogada segue: volta à base onde está
    return { gk: true, clip: k.plano.clip, t: Math.min(ct, info.dur), pos: R.slice(), yaw: 0, blend: k.plano.blend, state: 'keeperDive', ajuste: ajusteAgora(k, b.t) };
  }
  // preparação (1,5 s antes do contato previsto): ajustes de pés, flexão, braços, split-step; com lado escolhido, o peso vai para aquele pé
  const tp = k && (b && k.prepIniBola != null ? b.t - k.prepIniBola : k.prepIni != null ? tJogo - k.prepIni : null);
  if (tp != null && KEEPER_CLIPS[C.prep.anim] && tp < KEEPER_CLIPS[C.prep.anim].dur - .05) { const lado = k.lado === 'esq' || k.lado === 'dir' ? k.lado : null;   // depois da preparação (chute atrasado) volta à espera: nunca parado num quadro
    return { gk: true, idle: true, clip: C.prep.anim, t: Math.max(0, tp), pos: R.slice(), yaw: 0, state: 'keeperPrep', ready: lado ? { clip: C.prep.clipe[lado], t: C.prep.t, w: C.prep.w*sm(tp/C.prep.rampa) } : null }; }
  return { gk: true, idle: true, clip: 'gk_espera', t: agora, pos: R.slice(), yaw: 0, state: 'keeperWait', ready: null };
}
// colisores do instante atual (depuração): os do mergulho, ou os da espera
export function colisoresAgora(k, b, agora, sc = [1, 1]) {
  if (b && k && k.plano && b.t >= k.plano.tIni) return detalha(colisoresPlano(k, b.t, sc), sc);
  return detalha(colisores('gk_espera', agora, KEEPER_CFG.raiz, sc), sc);
}
