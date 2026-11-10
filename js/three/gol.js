// GOL do motor 3D: traves de metal pintado (alinhadas aos colisores de js/fisicaGol.js), estrutura traseira e REDE TRIDIMENSIONAL com fios de
// espessura real (fitas cruzadas, um único draw call) e simulação massa-mola: o toque da bola empurra os fios da região atingida e a onda se
// espalha pelas malhas vizinhas até voltar ao repouso. Tudo VISUAL: a bola, a física dos ferros, a detecção de gol e as regras não mudam.
import * as THREE from 'three';
import { GOAL_W, GOAL_H, BALL_R } from '../rig.js';
import { R_FERRO } from '../fisicaGol.js';
import { DBG } from '../debug.js';
// medidas: eixo das traves/travessão IGUAL ao da física (o de dentro do gol fica 7,32 × 2,44 m); fundo da rede como antes (2 m atrás, 2 m de altura)
export const GOL = { W: GOAL_W/2 + R_FERRO, H: GOAL_H + R_FERRO, R: R_FERRO, D: 2, BH: 2, BW: 3.3, malha: .12, fio: .018 };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// estrutura: traves e travessão (metal pintado de branco, liso, com reflexo discreto) + estrutura traseira (tubos finos)
function estrutura(scene) {
  const metal = new THREE.MeshPhysicalMaterial({ color: '#ffffff', emissive: '#2a2e33', roughness: .3, metalness: 0, clearcoat: .7, clearcoatRoughness: .15 });   // tinta branca brilhante (o emissivo leve compensa a noite)
  const apoio = new THREE.MeshStandardMaterial({ color: '#dfe4ea', roughness: .45, metalness: .1 });
  const tubo = (a, b, r, m, lados = 24) => { const d = new THREE.Vector3().subVectors(b, a), mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), lados, 1), m);
    mesh.position.copy(a).addScaledVector(d, .5); mesh.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize()); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh; };
  const { W, H, R, D, BH, BW } = GOL;
  tubo(V(-W, 0, 0), V(-W, H, 0), R, metal); tubo(V(W, 0, 0), V(W, H, 0), R, metal); tubo(V(-W, H, 0), V(W, H, 0), R, metal);
  for (const s of [-1, 1]) { const j = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), metal); j.position.set(s*W, H, 0); j.castShadow = true; scene.add(j); }   // cantos arredondados
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(R*1.25, R*1.25, .02, 24), apoio); b.position.set(s*W, .01, 0); scene.add(b); }      // base das traves no gramado
  const r = .022; tubo(V(-BW, 0, -D), V(-BW, BH, -D), r, apoio, 10); tubo(V(BW, 0, -D), V(BW, BH, -D), r, apoio, 10); tubo(V(-BW, BH, -D), V(BW, BH, -D), r, apoio, 10);
  for (const s of [-1, 1]) { tubo(V(s*W, H - .02, -R*.6), V(s*BW, BH, -D), r, apoio, 10); tubo(V(s*W, .012, 0), V(s*BW, .012, -D), r*.8, apoio, 8); }
  tubo(V(-BW, .012, -D), V(BW, .012, -D), r*.8, apoio, 8);
}
// painéis da rede: grade de nós entre 4 cantos (u ao longo, v ao través), com forma natural (barriga) e bordas presas na estrutura
function painel(nome, c00, c10, c01, c11, barriga, normal) {
  const lu = Math.max(c00.distanceTo(c10), c01.distanceTo(c11)), lv = Math.max(c00.distanceTo(c01), c10.distanceTo(c11)), nu = Math.max(2, Math.round(lu/GOL.malha)), nv = Math.max(2, Math.round(lv/GOL.malha));
  const n = (nu + 1)*(nv + 1), rest = new Float32Array(n*3), p = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const u = i/nu, v = j/nv, k = (j*(nu + 1) + i)*3;
    a.lerpVectors(c00, c10, u); b.lerpVectors(c01, c11, u); p.lerpVectors(a, b, v); p.addScaledVector(barriga, Math.sin(Math.PI*u)*Math.sin(Math.PI*v)); rest[k] = p.x; rest[k + 1] = p.y; rest[k + 2] = p.z; }
  return { nome, nu, nv, n, rest, d: new Float32Array(n*3), vel: new Float32Array(n*3), normal: normal.clone().normalize(), preso: (i, j) => i === 0 || j === 0 || i === nu || j === nv };
}
export function criaGol(scene) {
  estrutura(scene);
  const { W, H, R, D, BH, BW } = GOL, f = -R*.6;
  const P = [   // teto (travessão → barra de trás), fundo (barra de trás → chão), laterais (trave → canto de trás)
    painel('teto', V(-W, H - .02, f), V(W, H - .02, f), V(-BW, BH, -D), V(BW, BH, -D), V(0, -.11, 0), V(0, 1, .2)),
    painel('fundo', V(-BW, BH, -D), V(BW, BH, -D), V(-BW, .02, -D), V(BW, .02, -D), V(0, .02, -.16), V(0, 0, -1)),
    painel('lado_esq', V(-W, H - .02, f), V(-BW, BH, -D), V(-W, .02, f), V(-BW, .02, -D), V(-.1, 0, 0), V(-1, 0, 0)),
    painel('lado_dir', V(W, H - .02, f), V(BW, BH, -D), V(W, .02, f), V(BW, .02, -D), V(.1, 0, 0), V(1, 0, 0)),
  ];
  // fios: cada trecho entre nós vizinhos vira DUAS fitas cruzadas (visíveis de qualquer ângulo); uma geometria só para a rede inteira
  const segs = []; P.forEach((p, pi) => { for (let j = 0; j <= p.nv; j++) for (let i = 0; i <= p.nu; i++) { const k = j*(p.nu + 1) + i; if (i < p.nu) segs.push(pi, k, k + 1); if (j < p.nv) segs.push(pi, k, k + p.nu + 1); } });
  P.forEach((p, pi) => { p.s0 = segs.findIndex((v, k) => k % 3 === 0 && v === pi)/3; }); P.forEach((p, pi) => { p.s1 = pi < P.length - 1 ? P[pi + 1].s0 : segs.length/3; p.vivo = false; p.sujo = true; });
  const ns = segs.length/3, pos = new Float32Array(ns*8*3), nor = new Float32Array(ns*8*3), idx = new Uint32Array(ns*12);
  for (let s = 0; s < ns; s++) { const o = s*8; idx.set([o, o + 1, o + 2, o + 2, o + 1, o + 3, o + 4, o + 5, o + 6, o + 6, o + 5, o + 7], s*12); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mat = new THREE.MeshStandardMaterial({ color: '#edf1f4', roughness: .78, metalness: 0, side: THREE.DoubleSide });
  const rede = new THREE.Mesh(geo, mat); rede.castShadow = true; rede.receiveShadow = true; rede.frustumCulled = false; scene.add(rede);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), dir = new THREE.Vector3(), lado = new THREE.Vector3(), w = GOL.fio/2;
  const no = (p, k, out) => out.set(p.rest[k*3] + p.d[k*3], p.rest[k*3 + 1] + p.d[k*3 + 1], p.rest[k*3 + 2] + p.d[k*3 + 2]);
  const fita = (b0, e, nrm) => { pos[b0] = A.x - e.x*w; pos[b0 + 1] = A.y - e.y*w; pos[b0 + 2] = A.z - e.z*w; pos[b0 + 3] = A.x + e.x*w; pos[b0 + 4] = A.y + e.y*w; pos[b0 + 5] = A.z + e.z*w;
    pos[b0 + 6] = B.x - e.x*w; pos[b0 + 7] = B.y - e.y*w; pos[b0 + 8] = B.z - e.z*w; pos[b0 + 9] = B.x + e.x*w; pos[b0 + 10] = B.y + e.y*w; pos[b0 + 11] = B.z + e.z*w;
    for (let v = 0; v < 4; v++) { nor[b0 + v*3] = nrm.x; nor[b0 + v*3 + 1] = nrm.y; nor[b0 + v*3 + 2] = nrm.z; } };
  function monta(todos = false) { let mudou = false;
    for (const p of P) { if (!todos && !p.vivo && !p.sujo) continue; p.sujo = false; mudou = true; const nn = p.normal;
      for (let s = p.s0; s < p.s1; s++) { no(p, segs[s*3 + 1], A); no(p, segs[s*3 + 2], B); dir.subVectors(B, A).normalize(); lado.crossVectors(dir, nn).normalize(); fita(s*24, lado, nn); fita(s*24 + 12, nn, lado); } }
    if (mudou) { geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true; }
  }
  monta(true);
  // SIMULAÇÃO (massa-mola com acoplamento entre vizinhos): mola de volta à forma de repouso + "tensão" que espalha a onda; bordas presas
  const K = 32, C = 3600, AMORT = .9935, DT = 1/180, RB = BALL_R + .018;
  const info = { estado: 'repouso', energia: 0, impacto: null, tImpacto: -9, regiao: 0, nos: P.reduce((s, p) => s + p.n, 0), fios: ns };
  let ativo = false, ultimaBola = null, empurrou = false;
  const passo = () => { let e = 0; for (const p of P) { if (!p.vivo) continue; const { nu, nv, d, vel } = p, L = nu + 1; let ep = 0;
      for (let j = 1; j < nv; j++) for (let i = 1; i < nu; i++) { const k = j*L + i; for (let c = 0; c < 3; c++) { const x = k*3 + c, lap = d[x - 3] + d[x + 3] + d[x - L*3] + d[x + L*3] - 4*d[x];
        vel[x] = (vel[x] + (-K*d[x] + C*lap)*DT)*AMORT; } }
      for (let j = 1; j < nv; j++) for (let i = 1; i < nu; i++) { const k = (j*L + i)*3; for (let c = 0; c < 3; c++) { d[k + c] += vel[k + c]*DT; ep += vel[k + c]*vel[k + c] + d[k + c]*d[k + c]*20; } }
      e += ep; if (ep < 5e-6) { d.fill(0); vel.fill(0); p.vivo = false; p.sujo = true; } }   // parou: volta exatamente à forma de repouso
    return e; };
  // contato: nós dentro da bola são empurrados para a superfície dela e ganham a velocidade da bola (a bola não é afetada)
  // CONTATO COM A BOLA: quanto a bola passou da superfície de repouso da rede (pen, ao longo da normal de cada painel) vira um BOJO em cone ao redor
  // dela — largo e suave, mais largo quanto mais a rede estica —; os fios presos nas bordas seguram. A bola não é afetada (a trajetória vem do jogo).
  const contato = (bola, vb) => { let n = 0; for (const p of P) { const { nu, nv, rest, d, vel, normal: nn } = p, L = nu + 1;
      for (let j = 1; j < nv; j++) for (let i = 1; i < nu; i++) { const k = (j*L + i)*3, rx = bola.x - rest[k], ry = bola.y - rest[k + 1], rz = bola.z - rest[k + 2], al = rx*nn.x + ry*nn.y + rz*nn.z, pen = al + RB;
        if (pen <= 0) continue; const lx = rx - nn.x*al, ly = ry - nn.y*al, lz = rz - nn.z*al, rho = Math.hypot(lx, ly, lz), R = .45 + pen*1.7; if (rho >= R) continue;
        const f = Math.cos(Math.PI/2*rho/R)**2, alvo = pen*f, atual = d[k]*nn.x + d[k + 1]*nn.y + d[k + 2]*nn.z; if (alvo <= atual) continue;
        const dz = alvo - atual; d[k] += nn.x*dz; d[k + 1] += nn.y*dz; d[k + 2] += nn.z*dz;
        const vn = Math.max(0, vb.x*nn.x + vb.y*nn.y + vb.z*nn.z)*f, va = vel[k]*nn.x + vel[k + 1]*nn.y + vel[k + 2]*nn.z; if (vn > va) { vel[k] += nn.x*(vn - va); vel[k + 1] += nn.y*(vn - va); vel[k + 2] += nn.z*(vn - va); }
        n++; p.vivo = true; } }
    return n; };
  const vb = new THREE.Vector3(), dbg = debug(scene, P);
  function atualiza(dt, bola, bolaVisivel, gol, pausado) {
    if (pausado) return info;
    if (bolaVisivel) { if (ultimaBola) vb.subVectors(bola, ultimaBola).divideScalar(Math.max(dt, 1e-3)); ultimaBola = (ultimaBola || new THREE.Vector3()).copy(bola); } else ultimaBola = null;
    // a rede só é tocada num GOL, com a bola já dentro do gol (por dentro): bola que passa por fora, por cima ou que bate na trave não mexe nela
    const perto = gol && bolaVisivel && bola.z < .15 && bola.z > -D - .6 && Math.abs(bola.x) < W + .2 && bola.y < H + .2;
    if (!perto) empurrou = false;
    if (perto || ativo) { const n = Math.max(1, Math.min(8, Math.round(dt/DT))); let toques = 0, e = 0;
      for (let s = 0; s < n; s++) { if (perto) { const t = contato(bola, vb); toques += t; if (t && !empurrou) { empurrou = true; info.impacto = bola.clone(); info.tImpacto = performance.now()/1000; } } e = passo(); }
      info.energia = e; info.regiao = toques; ativo = P.some(p => p.vivo) || toques > 0; info.estado = toques ? 'em contato' : ativo ? 'oscilando' : 'repouso'; monta(); }
    dbg.atualiza(info); return info;
  }
  atualiza.info = info; atualiza.paineis = P; DBG.gol = atualiza;   // depuração/testes: estado da rede
  return atualiza;
}
// DEBUG DA REDE (tecla N ou DBG.rede = true): nós coloridos pela deformação (azul → vermelho), pontos de fixação (amarelo), impacto (esfera)
function debug(scene, P) {
  const n = P.reduce((s, p) => s + p.n, 0), pos = new Float32Array(n*3), cor = new Float32Array(n*3), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: .045, vertexColors: true, depthTest: false })); pts.renderOrder = 10; pts.frustumCulled = false; pts.visible = false; scene.add(pts);
  const bolha = new THREE.Mesh(new THREE.SphereGeometry(.3, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff3b6b', wireframe: true, depthTest: false })); bolha.visible = false; bolha.renderOrder = 11; scene.add(bolha);
  if (typeof window !== 'undefined') window.addEventListener('keydown', e => { if ((e.key === 'n' || e.key === 'N') && !/INPUT|TEXTAREA/.test(e.target?.tagName || '')) DBG.rede = !DBG.rede; });
  return { atualiza(info) { pts.visible = !!DBG.rede; bolha.visible = !!DBG.rede && !!info.impacto && performance.now()/1000 - info.tImpacto < 3; if (!DBG.rede) return;
    let o = 0; for (const p of P) for (let j = 0; j <= p.nv; j++) for (let i = 0; i <= p.nu; i++) { const k = (j*(p.nu + 1) + i)*3, m = Math.hypot(p.d[k], p.d[k + 1], p.d[k + 2]), t = Math.min(1, m/.25);
      pos[o] = p.rest[k] + p.d[k]; pos[o + 1] = p.rest[k + 1] + p.d[k + 1]; pos[o + 2] = p.rest[k + 2] + p.d[k + 2];
      if (p.preso(i, j)) { cor[o] = 1; cor[o + 1] = .85; cor[o + 2] = .1; } else { cor[o] = .2 + .8*t; cor[o + 1] = .5*(1 - t); cor[o + 2] = 1 - t; } o += 3; }
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; if (info.impacto) bolha.position.copy(info.impacto); } };
}
