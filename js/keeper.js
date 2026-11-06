// GOLEIRO — decisão antecipada do lado, previsão do cruzamento no plano do gol, mergulho com os clipes retargetados das animações fornecidas
// (js/keeperClips.js, gerado por tools/blender/goleiro.py), ALCANCE REAL por colisores presos aos ossos do próprio clipe, detecção CONTÍNUA do contato,
// resultado do contato (agarrada · espalmada · rebatida · parcial · raspão) e física da bola depois do toque.
// Módulo puro (sem DOM/WebGL): o jogo (game.js) chama, o quadro (frame.js) lê, os testes (test_keeper.mjs) exercitam.
//
// Lados SEMPRE do ponto de vista do GOLEIRO: ele olha para +z (para o cobrador), a ESQUERDA dele é +x do mundo (= lado direito da tela, que olha de trás
// do cobrador). Nos clipes vale o mesmo (x = esquerda do goleiro), então animação, física e bola usam o mesmo referencial.
import { KEEPER_CLIPS } from './keeperClips.js';
import { goalToWorld, GOAL_W, GOAL_H, BALL_R, SPOT_Z, sm } from './rig.js';

export const KEEPER_CFG = {
  // PREPARAÇÃO: começa 1,5 s antes do instante PREVISTO em que o pé do cobrador atinge a bola (recalculado a cada passo; se o chute vier antes,
  // começa na hora). Nesse instante o lado escolhido TRAVA (sem escolha → centro) e o goleiro começa os ajustes de pés, flexão, braços e o split-step.
  decisaoAntes: 1.5,
  raiz: [0, 0, .2],                               // posição inicial: centro do gol, pés sobre a linha (a pelve a 20 cm do plano do gol)
  zonas: { centroX: .9, baixaY: .6, altaY: 1.45 },  // classificação no plano do gol (m): |x| < centroX = centro; y < baixaY = baixa; y > altaY = alta
  // preparação (gk_prepara, 1,5 s) e, com lado escolhido, o peso indo para aquele pé: o começo do mergulho (t) misturado com peso w, em `rampa` s
  prep: { anim: 'gk_prepara', clipe: { esq: 'gk_esq_media', dir: 'gk_dir_media' }, t: .3, w: .45, rampa: .6 },
  // quanto do começo do clipe pode ser "pulado" ao sincronizar. Nos clipes fornecidos o goleiro passa ~0,4 s só ajeitando e carregando o peso antes da
  // impulsão; com a preparação feita ANTES do chute essa fase já aconteceu (até 0,45 s); parado no centro, só 0,2 s.
  salto: { preparado: .45, parado: .25, centro: .35, curta: .12 },
  // ESCOLHA DA AÇÃO pela trajetória lida depois do chute: entre as ações possíveis (defesa no centro, passo curto com extensão dos braços, mergulho)
  // o goleiro usa a MENOR que cobre a bola (folga ≤ alvo); só mergulha se precisar. custo em "m" de folga.
  economia: { centro: 0, curta: .07, mergulho: .16, alvo: -.04, altura: .08 },   // altura: custo por nível de diferença entre a altura da ação e a lida
  // depois de pôr o peso num lado, voltar para uma defesa no centro custa tempo; para o lado OPOSTO só cabe um passo curto, ainda mais tarde
  atraso: { centro: .16, oposto: .18 },
  // defesas no CENTRO partem da própria base (não dependem de escolher lado) e os clipes fornecidos são lentos para elas (o Catch agacha ~0,4 s antes de
  // saltar): tocadas um pouco mais rápido. Os mergulhos laterais ficam no ritmo original.
  ritmo: { gk_centro_alta: 1.15, gk_centro_media: 1.1, gk_centro_baixa: 1.15 },
  correcao: .05,
  // AJUSTE LIMITADO DO BRAÇO (seção 9 do pedido): nos últimos instantes o goleiro leva a luva em direção à bola que está VENDO, girando o braço no ombro.
  // No máximo 25 cm de deslocamento da luva e só se a luva já passaria a menos de 60 cm da bola (não é ímã). O MESMO giro vale para os colisores e para o
  // osso do braço na tela (js/three/loader.js → ajustaBraco), depois do clipe — não há dois sistemas disputando o osso.
  ajuste: { max: .25, alcance: .6, antes: .3, rampa: .2 },                                  // correção limitada: troca a altura do mergulho (no MESMO lado) só se outra cobrir a bola lida ≥ 5 cm melhor
  reacao: { lado: { easy: .16, normal: .12, hard: .09 }, centro: { easy: .34, normal: .28, hard: .22 } },   // s depois do chute para ler a altura
  erro: { easy: .3, normal: .2, hard: .12, rapida: .4 },  // desvio (m) da leitura do ponto de cruzamento; cresce até +rapida (40%) na bola mais rápida (prob.vel)
  escolhaCPU: { esq: .4, dir: .4, centro: .2 },
  // PROBABILIDADES de defesa efetiva (agarrar ou desviar com firmeza) DEPOIS de confirmado o contato físico — parâmetros de balanceamento, não
  // estatística do futebol. Interpoladas pela velocidade da bola (vel: fraca → forte), pela distância lateral do contato ao centro do goleiro e pela altura;
  // multiplicadas pela qualidade do contato (centro da luva × ponta dos dedos, parte do corpo). Sem contato, a chance é ZERO (nada de sorteio).
  // forteAlto .17: com ele a defesa MEDIDA no chute forte no alto bem coberto fica perto dos 38% da tabela (toques parciais também tiram a bola por cima/fora)
  prob: { fracoCanto: .89, forteCanto: .62, forteAlto: .17, centro: .97, centroForte: .9, centroAlto: .85, vel: [14, 24], lateral: [.6, 2.2], alto: [1.4, 1.9] },
  dedos: 1.45,                                    // a cápsula da mão vai do punho até a ponta dos dedos (o osso middle_02 fica no meio do dedo)
  passo: .02,                                     // detecção contínua: a bola nunca anda mais que 2 cm entre duas verificações
  dt: 1/120,                                      // passo da física da bola depois do contato (o mesmo passo fixo do jogo)
};
// qualidade de cada parte do corpo para segurar/desviar (luva > corpo > braço > perna) — multiplicada pela geometria do contato
const PARTES = { mao: 1, antebraco: .85, braco: .75, tronco: .95, cabeca: .6, perna: .9, pe: .88 };   // perna/pé: bloqueio de bola rasteira
// ORIENTAÇÃO da superfície no contato: a normal geométrica da cápsula (eixo do osso → centro da bola) não sabe para onde a palma aponta; o goleiro
// vira a luva (e o peito) PARA a bola. Normal usada = mistura da direção contrária à bola com a normal geométrica (peso por parte).
const PALMA = { mao: .7, antebraco: .35, braco: .3, tronco: .55, cabeca: .3, perna: .35, pe: .3 };
export const grupoDe = n => n.startsWith('mao') ? 'mao' : n.startsWith('antebraco') ? 'antebraco' : n.startsWith('braco') ? 'braco' : n === 'tronco' ? 'tronco' : n === 'cabeca' ? 'cabeca' : n.startsWith('pe_') ? 'pe' : 'perna';
const FPS = 30, v3 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul: (a, k) => [a[0]*k, a[1]*k, a[2]*k],
  dot: (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2], len: a => Math.hypot(a[0], a[1], a[2]) }, { sub, add, mul, dot, len } = v3, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const norm = a => { const l = len(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
export const clipeDe = (lado, altura) => `gk_${lado}_${altura}`;

// ---------- clipes: duração, posição/rumo final (para a reação começar onde o mergulho terminou) ----------
export const CLIP_INFO = Object.fromEntries(Object.entries(KEEPER_CLIPS).map(([n, c]) => {
  const tr = c.trilhas, N = tr.tronco.length, P = tr.tronco[N - 1], L = tr.braco_l[N - 1], R = tr.braco_r[N - 1];
  return [n, { dur: c.dur, n: N, fim: [P[0], P[2]], yawFim: Math.atan2(-(L[2] - R[2]), L[0] - R[0]), loop: n === 'gk_espera' }];   // eixo ombro dir.→esq. = +x local girado de yaw
}));
function amostra(arr, f) { const i = Math.min(arr.length - 2, Math.floor(f)), u = f - i, a = arr[i], b = arr[i + 1]; return a.map((v, j) => v + (b[j] - v)*u); }
// colisores do clipe no instante ct (s), no mundo: raiz + escala (largura wd em x/z, altura hs em y), como o loader aplica no modelo
export function colisores(clip, ct, raiz = KEEPER_CFG.raiz, sc = [1, 1]) {
  const c = KEEPER_CLIPS[clip], info = CLIP_INFO[clip]; if (!c) return [];
  const tt = info.loop ? ((ct % info.dur) + info.dur) % info.dur : ct, f = clamp(tt*FPS, 0, info.n - 1), W = (v, i) => [raiz[0] + sc[0]*v[i], raiz[1] + sc[1]*v[i + 1], raiz[2] + sc[0]*v[i + 2]];
  return Object.entries(c.trilhas).map(([nome, arr]) => { const v = amostra(arr, f), a = W(v, 0); let b = v.length > 3 ? W(v, 3) : null;
    if (b && nome.startsWith('mao')) b = add(a, mul(sub(b, a), KEEPER_CFG.dedos));
    return { nome, grupo: grupoDe(nome), a, b, r: c.raios[nome]*sc[0] }; });
}
const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
const gira = (v, e, ang) => { const c = Math.cos(ang), s_ = Math.sin(ang), k = dot(e, v), x = cross(e, v); return [v[0]*c + x[0]*s_ + e[0]*k*(1 - c), v[1]*c + x[1]*s_ + e[1]*k*(1 - c), v[2]*c + x[2]*s_ + e[2]*k*(1 - c)]; };
const giraEm = (p, o, e, ang) => add(o, gira(sub(p, o), e, ang));
// peso do ajuste do braço no instante t (0 → 1 antes da chegada da bola, mantém um pouco e volta)
export function ajusteAgora(k, t) {
  const A = k.plano && k.plano.ajuste; if (!A) return null; const C = KEEPER_CFG.ajuste, out = {};
  for (const s of ['l', 'r']) { const a = A[s]; if (!a) continue; const w = sm((t - (a.t - C.antes))/C.rampa)*(1 - sm((t - (a.t + .25))/.3)); if (w > 1e-3) out[s] = { eixo: a.eixo, ang: a.ang*w }; }
  return Object.keys(out).length ? out : null;
}
// colisores do PLANO de mergulho no instante t do voo (clipe sincronizado + ajuste do braço)
export function colisoresPlano(k, t, sc = [1, 1]) {
  const cols = colisores(k.plano.clip, ctDe(k, t), KEEPER_CFG.raiz, sc), aj = ajusteAgora(k, t); if (!aj) return cols;
  for (const s of ['l', 'r']) { const a = aj[s]; if (!a) continue; const o = cols.find(c => c.nome === 'braco_' + s).a;
    for (const c of cols) if (c.nome === 'braco_' + s || c.nome === 'antebraco_' + s || c.nome === 'mao_' + s) { c.a = giraEm(c.a, o, a.eixo, a.ang); if (c.b) c.b = giraEm(c.b, o, a.eixo, a.ang); } }
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
  prepIni: null, prepIniBola: null, tContatoPrev: null, tContatoReal: null, x: .5, tx: .5, t0: null, log: [] });
const registra = (k, msg) => { k.log.push(msg); if (k.log.length > 40) k.log.shift(); if (KEEPER_CFG.console) console.info('[goleiro]', msg); };
// escolha do lado (jogador: setas/clique; CPU: sorteio). Só vale ANTES do limite; depois, é registrada como tentativa ignorada.
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
  if (!k || !k.log || k.tContatoReal != null) return; k.tContatoReal = agora;
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
export const ctDe = (k, t) => k.plano.off + (t - k.plano.tIni)*(k.plano.ritmo || 1);
// distância mínima (superfície a superfície) entre a trajetória da bola e o corpo do goleiro com o clipe começando em off
function folga(b, clip, off, tIni, raiz, sc, t1, so = null) {
  let best = { d: 9, parte: null, t: null }; const rt = KEEPER_CFG.ritmo[clip] || 1;
  for (let t = Math.max(0, tIni); t <= t1; t += 1/90) {
    const p = ballFlight(b, t); if (p[2] > 4.5) continue;
    for (const c of colisores(clip, off + (t - tIni)*rt, raiz, sc)) { if (so && !so(c)) continue; const d = len(sub(p, pontoMaisProximo(p, c.a, c.b).c)) - c.r - BALL_R; if (d < best.d) best = { d, parte: c.nome, t }; }
  }
  return best;
}
const H = ['baixa', 'media', 'alta'];
// ações possíveis a partir do lado travado: no centro tudo (mergulho tardio); com peso num lado, mergulhos só para ele, centro e passo curto do
// lado oposto com atraso (correção limitada) — nunca um mergulho para o lado oposto
export function candidatos(lado) {
  const C = KEEPER_CFG, out = [], meu = s => lado === s, oposto = s => lado !== 'centro' && lado !== s;
  for (const h of H) out.push({ clip: `gk_centro_${h}`, tipo: 'centro', lado: 'centro', altura: h, atraso: lado === 'centro' ? 0 : C.atraso.centro });
  for (const s of ['esq', 'dir']) {
    for (const h of H) out.push({ clip: `gk_${s}_curta_${h}`, tipo: 'curta', lado: s, altura: h, atraso: oposto(s) ? C.atraso.oposto : 0 });
    if (!oposto(s)) for (const h of H) out.push({ clip: `gk_${s}_${h}`, tipo: 'mergulho', lado: s, altura: h, atraso: 0, preparado: meu(s) });
  }
  return out.filter(c => KEEPER_CLIPS[c.clip]);
}
export function planejar(k, b, { dif = 'normal', sc = [1, 1], rng = Math.random } = {}) {
  const C = KEEPER_CFG, E = C.economia, [cx, cy] = cruzamento(b), e = (C.erro[dif] ?? C.erro.normal)*(1 - C.erro.rapida + C.erro.rapida*faixa(len(ballVel(b, .02)), C.prob.vel)*2), px = cx + gauss(rng)*e, py = Math.max(BALL_R, cy + gauss(rng)*e*.8);
  const lido = classificar(px, py), prev = { ...b, gx: px/GOAL_W + .5, gy: py/GOAL_H }, tf = b.tf || .7;   // a trajetória que o goleiro LEU (com o erro), não a verdadeira
  // sincroniza: o instante do clipe em que a bola chega (o goleiro "cronometra" o movimento pela leitura), dentro do que o clipe permite pular
  const sincroniza = c => { const S = C.salto, offMin = c.tipo === 'mergulho' && c.preparado ? C.prep.t*.5 : 0,
      offMax = c.tipo === 'centro' ? S.centro : c.tipo === 'curta' ? S.curta : c.preparado ? S.preparado : S.parado, tIni = b.t + c.atraso;
    let off = offMin, best = null;
    for (let o = offMin; o <= offMax + 1e-9; o += .02) { const f = folga(prev, c.clip, o, tIni, C.raiz, sc, tf + .02); if (!best || f.d < best.d - 1e-3) { best = f; off = o; } }
    return { ...c, off, best, tIni, custo: E[c.tipo] + E.altura*Math.abs(H.indexOf(c.altura) - H.indexOf(lido.altura)) };
  };
  // "cobre": alcança a bola lida e não é absurda para a altura (nada de mergulho alto para bola rasteira ou o contrário, se houver outra opção)
  const av = candidatos(k.lado).map(sincroniza), cobre = av.filter(a => a.best.d <= E.alvo);
  // a MENOR ação que cobre a bola lida; se nenhuma cobre, a tentativa que chega mais perto (com um pouco de preferência pelas menores)
  // nota de cada ação = folga prevista (limitada ao alvo: cobrir com sobra não vale mais) + custo do movimento (+ diferença de altura): a menor vence
  const nota = a => Math.max(a.best.d, E.alvo) + a.custo, esc = av.slice().sort((a, b_) => nota(a) - nota(b_) || a.best.d - b_.best.d)[0];
  const { clip, off, best, tIni } = esc;
  k.plano = { clip, tipo: esc.tipo, lado: esc.lado, altura: esc.altura, tIni, off: +off.toFixed(3), atraso: esc.atraso, lido: { x: +px.toFixed(2), y: +py.toFixed(2), cat: lido.cat },
    real: classificar(cx, cy).cat, folgaPrevista: +best.d.toFixed(3), cobria: best.d <= E.alvo, opcoes: av.length, ritmo: C.ritmo[clip] || 1, blend: esc.tipo === 'curta' ? .15 : .2,
    motivoEscolha: best.d <= E.alvo ? `menor ação que cobre a bola lida (${esc.tipo}, ${cobre.length} cobriam)` : cobre.length ? `${esc.tipo} quase cobre e custa bem menos que as ${cobre.length} que cobriam` : 'nenhuma ação cobre a bola lida: tentativa que chega mais perto' };
  k.plano.ajuste = calculaAjuste(k, b, sc);
  k.tx = .5 + (esc.lado === 'esq' ? .3 : esc.lado === 'dir' ? -.3 : 0); k.t0 = b.t;   // campos antigos (pose procedural de reserva)
  registra(k, `ação ${clip} (${k.plano.motivoEscolha}) em t=${tIni.toFixed(2)} s; leu ${lido.cat} x=${px.toFixed(2)} y=${py.toFixed(2)}; real ${k.plano.real}; folga prevista ${Math.round(best.d*100)} cm; clipe a partir de ${off.toFixed(2)} s`);
  return k.plano;
}

// ajuste do braço: para cada luva, o instante em que ela passa mais perto da bola REAL (o goleiro já está vendo a bola) e o giro no ombro que a leva até lá
function calculaAjuste(k, b, sc) {
  const C = KEEPER_CFG.ajuste, tf = b.tf || .7, out = {};
  for (const s of ['l', 'r']) {
    let best = null;
    for (let t = k.plano.tIni; t <= tf + .02; t += 1/120) { const p = ballFlight(b, t); if (p[2] > 4) continue;
      const cols = colisores(k.plano.clip, ctDe(k, t), KEEPER_CFG.raiz, sc), m = cols.find(c => c.nome === 'mao_' + s), P = add(m.a, mul(sub(m.b, m.a), .5)), d = len(sub(p, P));
      if (!best || d < best.d) best = { d, t, P, B: p, S: cols.find(c => c.nome === 'braco_' + s).a }; }
    if (!best || best.d > C.alcance) continue;
    let D = sub(best.B, best.P); const L = len(D); if (L > C.max) D = mul(D, C.max/L);
    const u = norm(sub(best.P, best.S)), v = norm(sub(add(best.P, D), best.S)), e = cross(u, v), se = len(e); if (se < 1e-6) continue;
    out[s] = { eixo: mul(e, 1/se), ang: Math.atan2(se, dot(u, v)), t: best.t, desloc: +len(D).toFixed(3), distAntes: +best.d.toFixed(3) };
  }
  return Object.keys(out).length ? out : null;
}

// ---------- detecção CONTÍNUA entre dois instantes do voo (a bola é subdividida em passos de ≤ 2 cm; cada passo usa a pose do clipe naquele instante) ----------
export function detectar(k, b, tA, tB, sc = [1, 1]) {
  if (!k.plano || b.fis) return null;
  const C = KEEPER_CFG, pA = ballFlight(b, tA), pB = ballFlight(b, tB), n = Math.max(1, Math.ceil(len(sub(pB, pA))/C.passo));
  for (let i = 1; i <= n; i++) {
    const t = tA + (tB - tA)*i/n; if (t < k.plano.tIni) continue; const p = ballFlight(b, t), ct = ctDe(k, t); let hit = null;
    for (const c of colisoresPlano(k, t, sc)) { const q = pontoMaisProximo(p, c.a, c.b), d = len(sub(p, q.c)) - c.r - BALL_R;
      if (k.dmin == null || d < k.dmin.d) k.dmin = { d: +d.toFixed(3), parte: c.nome };
      if (d <= 0 && (!hit || d < hit.d)) hit = { d, c, q, p, t, ct }; }
    if (hit) return descreverContato(k, b, hit, sc);
  }
  return null;
}
// geometria do contato: parte, profundidade (quão no CENTRO da parte a bola vinha: 0 = raspão, 1 = em cheio), duas mãos, corpo atrás, velocidades
function descreverContato(k, b, h, sc) {
  const C = KEEPER_CFG, vIn = ballVel(b, h.t), dir = norm(vIn), ap = {};
  for (let s = 0; s <= .3; s += .01) { const p = add(h.p, mul(dir, s)), cols = colisoresPlano(k, h.t + s/len(vIn), sc);
    for (const c of cols) { const d = len(sub(p, pontoMaisProximo(p, c.a, c.b).c)); if (!(c.nome in ap) || d < ap[c.nome].d) ap[c.nome] = { d, r: c.r }; } }
  const prof = n => clamp(1 - ap[n].d/(ap[n].r + BALL_R), 0, 1), depth = prof(h.c.nome), perto = (n, folga = 0) => ap[n] && ap[n].d < ap[n].r + BALL_R + folga;
  const vel = t => colisoresPlano(k, t, sc).find(c => c.nome === h.c.nome), A = vel(h.t - 1/FPS), B = vel(h.t + 1/FPS);
  const vHand = mul(sub(add(A.a, mul(sub(A.b || A.a, A.a), h.q.s)), add(B.a, mul(sub(B.b || B.a, B.a), h.q.s))), -FPS/2);
  let ng = norm(sub(h.p, h.q.c)); if (dot(ng, vIn) > 0) ng = mul(ng, -1); const al = PALMA[h.c.grupo], n = norm(add(mul(dir, -al), mul(ng, 1 - al)));
  return { parte: h.c.nome, grupo: h.c.grupo, t: h.t, ct: h.ct, p: h.p, ponto: h.q.c, s: h.q.s, normal: n, normalGeo: ng, depth: +depth.toFixed(3),
    duasMaos: h.c.grupo === 'mao' && perto('mao_l', .12) && perto('mao_r', .12),   // as duas luvas em volta da bola (a outra a até 12 cm)
    corpoAtras: h.c.grupo !== 'tronco' && perto('tronco'), vIn, vMao: vHand, vel: +len(vIn).toFixed(2) };
}

// ---------- resultado do contato: (1) contato físico já confirmado → (2) probabilidade de controle pela geometria/velocidade/parte → (3) física ----------
const lerp = (a, b, u) => a + (b - a)*u, faixa = (v, [a, b]) => clamp((v - a)/(b - a), 0, 1);
// chance de defesa EFETIVA para um contato (só é chamada com contato físico confirmado): situação (tabela KEEPER_CFG.prob) × qualidade do contato
export function chanceDefesa(ct, craque = 75) {
  const P = KEEPER_CFG.prob, s = faixa(ct.vel, P.vel), e = faixa(Math.abs(ct.p[0] - KEEPER_CFG.raiz[0]), P.lateral), a = faixa(ct.p[1], P.alto);
  const canto = lerp(P.fracoCanto, lerp(P.forteCanto, P.forteAlto, a), s), centro = lerp(P.centro, P.centroForte, s)*lerp(1, P.centroAlto/P.centro, a), base = lerp(centro, canto, e);
  const fDepth = sm(ct.depth/.45), qual = (.55 + .45*fDepth)*PARTES[ct.grupo]*(ct.duasMaos ? 1.03 : 1)*(ct.corpoAtras ? 1.03 : 1)*(1 - (craque - 75)/400);
  return { p: clamp(base*qual, 0, .99), base, qual, s, e, a, fDepth };
}
export function resultadoContato(ct, { rng = Math.random, craque = 75 } = {}) {
  const G = ct.grupo, ch = chanceDefesa(ct, craque), { fDepth } = ch, q = ch.qual, pFirme = ch.p;
  const pAgarra = G === 'mao' || G === 'tronco' ? clamp((ct.duasMaos || G === 'tronco' || ct.corpoAtras ? .72 : .3)*(1 - .8*ch.s)*(1 - .5*ch.e)*fDepth, 0, .8) : 0;
  const u = rng(); let tipo, e, mu, kh;
  if (u < pFirme*pAgarra) tipo = 'agarrada';
  else if (u < pFirme) { tipo = 'firme'; e = G === 'tronco' || G === 'perna' ? .3 + .1*rng() : .38 + .17*rng(); mu = .55; kh = .8; }
  else if (u < pFirme + (1 - pFirme)*(.35 + .5*fDepth)) { tipo = 'parcial'; e = .12 + .08*rng(); mu = .85; kh = .35; }
  else { tipo = 'raspao'; e = .04; mu = .97; kh = .08; }
  const motivo = `${G}${ct.duasMaos ? ' (duas mãos)' : ''}, ${Math.round(ct.depth*100)}% no centro da parte, ${ct.vel.toFixed(1)} m/s, ${Math.abs(ct.p[0]).toFixed(2)} m do centro, ${ct.p[1].toFixed(2)} m de altura → situação ${Math.round(ch.base*100)}% × contato ${q.toFixed(2)} = defesa ${Math.round(pFirme*100)}% (agarra ${Math.round(pFirme*pAgarra*100)}%)`;
  if (tipo === 'agarrada') return { tipo, q, pFirme, chance: ch, motivo, vOut: [0, 0, 0] };
  // pequena variação controlada da normal (±8°): a superfície da luva/corpo não é perfeita
  const a = (rng() - .5)*.28, n = norm(add(ct.normal, [Math.sin(a)*.5, Math.cos(a)*.1 - .05, 0]));
  let vOut;
  if (tipo === 'firme') { const vRel = sub(ct.vIn, ct.vMao), vn = mul(n, dot(vRel, n)), vt = sub(vRel, vn); vOut = add(add(mul(vn, -e), mul(vt, mu)), mul(ct.vMao, kh)); }
  else {   // parcial / raspão: a luva NÃO segura a bola — ela segue em frente, mais lenta e desviada pela superfície que tocou (normal geométrica)
    const v = len(ct.vIn), ng = ct.normalGeo || ct.normal, k = tipo === 'parcial' ? .18 + .14*rng() : .04 + .04*rng(), keep = tipo === 'parcial' ? .55 + .2*rng() : .88 + .07*rng();
    vOut = add(add(mul(ct.vIn, keep), mul(ng, v*k)), mul(ct.vMao, kh)); }
  return { tipo, q, pFirme, chance: ch, motivo, e, mu, vOut };
}

// ---------- física da bola depois do contato (gravidade, quique, travessão/trave, rede); passo fixo — o MESMO na previsão e no jogo ----------
export function novaBolaLivre(p, v) { return { p: p.slice(), v: v.slice(), t: 0, estado: 'livre', gol: false, res: null, trave: 0, cruzou: false }; }
export function passoLivre(f, dt = KEEPER_CFG.dt) {
  const g = 9.81, pz = f.p[2]; f.t += dt;
  f.v[1] -= g*dt; const dr = 1 - .015*dt*len(f.v); f.v = mul(f.v, Math.max(.9, dr)); f.p = add(f.p, mul(f.v, dt));
  if (f.p[1] < BALL_R) { f.p[1] = BALL_R; if (f.v[1] < 0) { f.v[1] = -f.v[1]*.5; f.v[0] *= .85; f.v[2] *= .85; if (f.v[1] < .6) f.v[1] = 0; } if (f.v[1] === 0) { const k = Math.max(0, 1 - 1.4*dt); f.v[0] *= k; f.v[2] *= k; } }
  const hw = GOAL_W/2;
  if (!f.gol && pz > 0 && f.p[2] <= 0) {                                         // cruzou o plano do gol
    const dentro = Math.abs(f.p[0]) < hw - BALL_R && f.p[1] < GOAL_H - BALL_R, ferro = !dentro && Math.abs(f.p[0]) < hw + BALL_R + .06 && f.p[1] < GOAL_H + BALL_R + .06;
    if (dentro) f.gol = true;
    else if (ferro) { f.p[2] = .01; f.v[2] = -f.v[2]*.55; f.v[0] *= .8; f.trave++; }                          // trave/travessão: volta
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
export const ROTULOS = { agarrada: 'A · agarrada', espalmada: 'B · espalmada para fora', rebatida_esquerda: 'C · rebatida para a esquerda', rebatida_direita: 'C · rebatida para a direita',
  rebatida_frente: 'C · rebatida para a frente', parcial_gol: 'D · parcial: entrou', parcial_fora: 'D · parcial: foi para fora', parcial_campo: 'D · parcial: continua em jogo',
  raspao_gol: 'E · raspão: entrou', raspao_fora: 'E · raspão: foi para fora', raspao_campo: 'E · raspão: continua em jogo' };

// ponto em que a bola agarrada fica: entre as duas luvas (ou junto da parte que segurou)
export function ancora(k, sc = [1, 1], t) {
  const cols = colisoresPlano(k, t, sc), m = n => cols.find(c => c.nome === n), ponta = c => add(c.a, mul(sub(c.b, c.a), .55));
  const c = k.contato; if (c.grupo === 'mao' && c.duasMaos) { const a = ponta(m('mao_l')), b = ponta(m('mao_r')); return add(mul(add(a, b), .5), mul(c.normal, BALL_R*.6)); }
  const p = m(c.parte), q = p.b ? add(p.a, mul(sub(p.b, p.a), c.s)) : p.a; return add(q, mul(c.normal, p.r + BALL_R*.9));
}

// ---------- um passo do goleiro (chamado pelo jogo a cada passo fixo, com a bola em jogo) ----------
// Devolve 'contato' quando houve toque neste passo (o jogo então deixa a física livre da bola decidir o resultado).
export function passo(k, b, tA, tB, { dif = 'normal', sc = [1, 1], rng = Math.random, craque = 75 } = {}) {
  const C = KEEPER_CFG;
  if (k.prepIni == null && k.prepIniBola == null && tB >= -C.decisaoAntes) { k.prepIniBola = Math.max(tA, -C.decisaoAntes); travar(k, -k.prepIniBola); }   // sem o jogo (testes): relógio da bola
  if (!k.plano && tB >= 0) { const r = k.lado === 'centro' ? C.reacao.centro : C.reacao.lado; if (tB >= (r[dif] ?? r.normal)) planejar(k, b, { dif, sc, rng }); }
  if (k.plano && !b.fis && tB > 0) {
    const c = detectar(k, b, Math.max(tA, 0), tB, sc);
    if (c) {
      const r = resultadoContato(c, { rng, craque }); k.contato = { ...c, ...r };
      if (r.tipo === 'agarrada') { b.fis = { ...novaBolaLivre(c.p, [0, 0, 0]), estado: 'preso', t0: c.t, de: c.p.slice(), res: 'defesa' }; k.contato.rotulo = 'agarrada'; k.contato.prev = { res: 'defesa' }; }
      else { const prev = preverDesvio(c.p, r.vOut); k.contato.prev = prev; k.contato.rotulo = rotulo(r, prev); b.fis = novaBolaLivre(c.p, r.vOut); }
      k.contato.vOutMod = +len(k.contato.vOut || [0, 0, 0]).toFixed(2);
      registra(k, `CONTATO ${c.parte} t=${c.t.toFixed(3)} s · ${ROTULOS[k.contato.rotulo] || k.contato.rotulo} · ${r.motivo} · ${c.vel.toFixed(1)} → ${k.contato.vOutMod} m/s`);
      return 'contato';
    }
  }
  return null;
}
// a bola depois do contato, a cada passo (agarrada: vai junto com as luvas até o fim do mergulho, depois cai)
export function passoBola(k, b, dt, sc = [1, 1]) {
  const f = b.fis; if (!f) return;
  if (f.estado === 'preso') {
    const ct = ctDe(k, b.t), info = CLIP_INFO[k.plano.clip];
    if (ct >= info.dur - .35) { Object.assign(f, novaBolaLivre(f.p, [0, -.5, .3]), { res: f.res }); return; }   // fim do mergulho: o goleiro solta a bola no chão
    const u = sm((b.t - f.t0)/.1), A = ancora(k, sc, b.t); f.p = add(mul(f.de, 1 - u), mul(A, u)); f.p[1] = Math.max(BALL_R, f.p[1]); return;
  }
  passoLivre(f, dt);
}
// motivo de não ter havido contato (para a depuração e o registro)
export function motivoSemContato(k, b) {
  const [cx, cy] = cruzamento(b), real = classificar(cx, cy), p = k.plano;
  if (!p) return 'o goleiro não chegou a reagir';
  const lado = p.lado, errado = real.lado !== 'centro' && lado !== 'centro' && real.lado !== lado;
  const falta = k.dmin ? `${Math.round(k.dmin.d*100)} cm (parte mais próxima: ${k.dmin.parte})` : '?';
  if (errado) return `lado errado: o peso estava ${k.lado}, a bola foi ${real.lado}; a ação possível (${p.clip}) não alcançou (faltaram ${falta})`;
  if (!p.cobria) return `nenhuma ação alcançava a bola lida (${p.lido.cat}); tentativa ${p.clip} — fora do alcance por ${falta}`;
  const S = KEEPER_CFG.salto, lim = p.tipo === 'centro' ? S.centro : p.tipo === 'curta' ? S.curta : k.lado === 'centro' ? S.parado : S.preparado;
  return `fora do alcance por ${falta}${p.off >= lim - 1e-6 ? ' (bola rápida: o movimento ainda não tinha chegado à extensão máxima)' : ''}`;
}

// ---------- animação do goleiro para o quadro (frame.js): espera (laço) + preparação → mergulho sincronizado → reação no lugar onde caiu ----------
export function animGoleiro(k, b, { agora = 0, tJogo = 0, sc = [1, 1], nk = 0, cheer, sad } = {}) {
  const C = KEEPER_CFG, R = C.raiz;
  if (b && k && k.plano && b.t >= k.plano.tIni) {
    const ct = ctDe(k, b.t), info = CLIP_INFO[k.plano.clip], fim = info.dur - .35;
    if (b.res && ct >= fim && cheer) { const gol = b.res === 'gol';
      return { clip: (gol ? sad : cheer)[nk % 3], pe: nk % 2 ? 'l' : 'r', t: ct - fim, pos: [R[0] + sc[0]*info.fim[0], 0, R[2] + sc[0]*info.fim[1]], yaw: info.yawFim, blend: .45, state: gol ? 'keeperSad' : 'keeperCheer' }; }
    return { gk: true, clip: k.plano.clip, t: Math.min(ct, info.dur), pos: R.slice(), yaw: 0, blend: k.plano.blend, state: 'keeperDive', ajuste: ajusteAgora(k, b.t) };
  }
  // preparação (1,5 s antes do contato previsto): ajustes de pés, flexão, braços, split-step; com lado escolhido, o peso vai para aquele pé
  const tp = k && (b && k.prepIniBola != null ? b.t - k.prepIniBola : k.prepIni != null ? tJogo - k.prepIni : null);
  if (tp != null && KEEPER_CLIPS[C.prep.anim]) { const lado = k.lado === 'esq' || k.lado === 'dir' ? k.lado : null;
    return { gk: true, idle: true, clip: C.prep.anim, t: Math.max(0, tp), pos: R.slice(), yaw: 0, state: 'keeperPrep', ready: lado ? { clip: C.prep.clipe[lado], t: C.prep.t, w: C.prep.w*sm(tp/C.prep.rampa) } : null }; }
  return { gk: true, idle: true, clip: 'gk_espera', t: agora, pos: R.slice(), yaw: 0, state: 'keeperWait', ready: null };
}
// colisores do instante atual (depuração): os do mergulho, ou os da espera
export function colisoresAgora(k, b, agora, sc = [1, 1]) {
  if (b && k && k.plano && b.t >= k.plano.tIni) return colisoresPlano(k, b.t, sc);
  return colisores('gk_espera', agora, KEEPER_CFG.raiz, sc);
}
