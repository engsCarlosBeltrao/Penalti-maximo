// TORCIDA 3D — milhares de torcedores de verdade (corpo, cabeça com rosto, cabelo, camisa, braços com cotovelo, mãos), um por lugar da arquibancada.
// DESEMPENHO: duas malhas instanciadas (perto = mais detalhe, longe = menos), geometria e material compartilhados; NENHUM esqueleto: o corpo é dividido
// em partes (tronco, cabeça, braço/antebraço de cada lado, pernas) e a POSE é calculada no shader a partir do humor de cada lado (js/torcidaHumor.js) e
// de sementes individuais (atraso de reação, energia, estilo) — cada pessoa reage do seu jeito, nada sincronizado. Por quadro mudam só 5 uniforms.
// Variedade: altura, porte, tamanho da cabeça, tom de pele, cabelo (curto, comprido, careca, boné), barba, idade (cabelo grisalho), camisa do clube no
// padrão do uniforme (lisa, listras horizontais/verticais, faixa diagonal, faixa no peito), segunda cor, roupas neutras, bermuda/calça.
// Bandeiras na mão: alguns torcedores seguram bandeiras do clube (malha instanciada própria, tremulando no shader).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Humor } from '../torcidaHumor.js';

const SEED = 91; const rndDe = s => () => (s = s*16807 % 2147483647)/2147483647;
const PELE = ['#f3d2b3', '#e9bf98', '#d7a477', '#c08a5c', '#a06a43', '#7c4d2e', '#5c3820', '#e5b48c'];
const CABELO = ['#14100d', '#241812', '#3b2618', '#5a3b22', '#7d5530', '#a77b45', '#2a2a2a', '#9a958e', '#c9c4bc'];
const NEUTRO = ['#1b1d22', '#e9eaec', '#4b5563', '#2c3e66', '#5a3f2b', '#2f4f3a', '#6b1f2a'];
const CALCA = ['#1b2233', '#2a2f3a', '#3a3f4b', '#232323', '#3f4a5e', '#55555a'];
const PADRAO = { p: 0, h: 1, v: 2, d: 3, s: 4, f: 4 };
// ---------- geometria de UMA pessoa (em pé, pés em y = 0, olhando para +z = o campo) ----------
// aPC = (parte, categoria). Partes: 0 tronco/quadril/pescoço · 1 cabeça · 2 braço E · 3 antebraço+mão E · 4 braço D · 5 antebraço+mão D · 6 pernas e pés
// 7 cabelo curto · 8 cabelo comprido · 9 boné · 10 barba. Categorias de cor: 0 pele · 1 camisa · 2 calça · 3 cabelo · 4 tênis · 5 boné
function pessoa(det) {
  const S = det ? 10 : 6, R = det ? 8 : 5, lista = [];
  const add = (g, parte, cat) => { g.deleteAttribute('uv'); const n = g.attributes.position.count, a = new Float32Array(n*2); for (let i = 0; i < n; i++) { a[i*2] = parte; a[i*2 + 1] = cat; } g.setAttribute('aPC', new THREE.BufferAttribute(a, 2)); lista.push(g); };   // indexada: cada vértice é compartilhado (bem menos vértices por pessoa)
  const cil = (r0, r1, y0, y1, x = 0, z = 0, sz = 1, seg = R) => new THREE.CylinderGeometry(r1, r0, y1 - y0, seg, 1).scale(1, 1, sz).translate(x, (y0 + y1)/2, z);
  const esf = (r, x, y, z, sx = 1, sy = 1, sz = 1, t0 = 0, t1 = Math.PI) => new THREE.SphereGeometry(r, S, Math.max(4, S*.7 | 0), 0, Math.PI*2, t0, t1).scale(sx, sy, sz).translate(x, y, z);
  for (const s of [-1, 1]) { add(cil(.072, .082, .07, .86, s*.1, 0), 6, 2); add(new THREE.BoxGeometry(.11, .08, .26).translate(s*.1, .04, .04), 6, 4); }   // pernas e tênis
  add(cil(.165, .175, .8, 1.0, 0, 0, .7), 0, 2);                                                   // quadril (calça)
  add(cil(.17, .205, .97, 1.4, 0, 0, .62), 0, 1);                                                   // tronco (camisa)
  add(esf(.205, 0, 1.385, 0, 1, .33, .62, 0, Math.PI*.5), 0, 1);                                    // ombros
  add(cil(.052, .056, 1.38, 1.53, 0, 0), 0, 0);                                                      // pescoço
  add(esf(.105, 0, 1.62, 0, .9, 1.08, .98), 1, 0);                                                   // cabeça
  add(new THREE.BoxGeometry(.028, .045, .04).translate(0, 1.607, .098), 1, 0);                       // nariz
  if (det) for (const s of [-1, 1]) add(esf(.024, s*.094, 1.615, -.005, .5, 1, .8), 1, 0);           // orelhas
  add(esf(.112, 0, 1.637, -.008, .93, 1, 1.02, 0, Math.PI*.52), 7, 3);                               // cabelo curto
  add(esf(.116, 0, 1.64, -.012, .95, 1.02, 1.05, 0, Math.PI*.58), 8, 3); add(new THREE.BoxGeometry(.19, .26, .07).translate(0, 1.53, -.075), 8, 3);   // comprido
  add(esf(.118, 0, 1.645, -.004, .95, .95, 1.03, 0, Math.PI*.45), 9, 5); add(new THREE.BoxGeometry(.17, .014, .12).translate(0, 1.672, .1), 9, 5);   // boné + aba
  add(esf(.1, 0, 1.6, .012, .92, 1.05, .98, Math.PI*.56, Math.PI*.32), 10, 3);                       // barba
  for (const s of [-1, 1]) { const x = s*.205, b = s < 0 ? 2 : 4;
    add(cil(.06, .058, 1.22, 1.39, x, 0), b, 1);                                                      // manga
    add(cil(.046, .05, 1.08, 1.23, x, 0), b, 0);                                                      // braço
    add(cil(.036, .044, .83, 1.1, x, 0), b + 1, 0);                                                   // antebraço
    add(esf(.05, x, .79, .005, .78, 1.15, .62), b + 1, 0); }                                          // mão
  return mergeGeometries(lista);
}
// ---------- shader: pose (igual em todos os vértices de uma pessoa) ----------
const POSE = `
attribute vec2 aPC; attribute vec4 aPos; attribute vec4 aEsc; attribute vec4 aSeed; attribute vec4 aTipo;
attribute vec3 aPele; attribute vec3 aCam; attribute vec3 aCam2; attribute vec3 aCab; attribute vec3 aCalca;
uniform float uT; uniform vec4 uH0, uH1, uX0, uX1;
varying vec3 vCor; varying vec3 vCor2; varying vec3 vCabV; varying vec3 vLoc; varying float vCat; varying float vPart; varying float vBoca; varying float vPad; varying float vWY; varying float vWX;
struct Pose { vec4 bE; vec4 bD; float pulo; float incl; float lado; float cab; float boca; };   // braço = (elevação à frente, abertura lateral, cotovelo, giro para dentro)
vec3 rx(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, c*v.y - s*v.z, s*v.y + c*v.z); }
vec3 ry(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c*v.x + s*v.z, v.y, -s*v.x + c*v.z); }
vec3 rz(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c*v.x - s*v.y, s*v.x + c*v.y, v.z); }
Pose base0() { Pose p; p.bE = vec4(.07, .1, .18, 0.); p.bD = p.bE; p.pulo = 0.; p.incl = 0.; p.lado = 0.; p.cab = 0.; p.boca = 0.; return p; }
Pose mixP(Pose a, Pose b, float k) { a.bE = mix(a.bE, b.bE, k); a.bD = mix(a.bD, b.bD, k); a.pulo = mix(a.pulo, b.pulo, k); a.incl = mix(a.incl, b.incl, k); a.lado = mix(a.lado, b.lado, k); a.cab = mix(a.cab, b.cab, k); a.boca = mix(a.boca, b.boca, k); return a; }
// poses dos braços (radianos): mãos caídas · braços cruzados no peito · mãos na cintura · mãos na cabeça · mãos no rosto · mãos juntas (reza) · braço
// por cima do ombro do vizinho (abraço)
const vec4 BAIXO = vec4(.07, .1, .18, 0.), CRUZA = vec4(.3, .06, 1.72, .98), CINTURA = vec4(-.05, .72, 1.25, .95), CABECA = vec4(2.35, .72, 2.05, .42),
  ROSTO = vec4(.5, -.04, 2.3, .38), REZA = vec4(.48, -.08, 2.02, .62), ABRACO = vec4(.18, 1.42, .28, 0.);
vec4 palma(float c) { return vec4(.42, -.08, 1.22, .48 + .26*c); }          // c = 1: as mãos se encontram na frente do peito
vec4 alto(float w) { return vec4(2.85 + .1*w, .38 + .12*w, .12, 0.); }
vec4 punho(float w) { return vec4(2.3, .15, .75 + .55*w, .15); }
vec4 bandeira(float w) { return vec4(2.9, .15 + .05*w, .1, 0.); }
// pose de UM humor, t segundos depois de ele começar
Pose poseDe(float hum, float t, float I, float calor) {
  float ph = aSeed.x, dl = aSeed.y, en = aSeed.z, est = aSeed.w, flag = aTipo.w, barra = step(.86, en);
  Pose p = base0();
  if (hum < .5) {                                                                    // CALMO: cantando, palmas em frases, braços cruzados, balanço
    float k = calor*(.55 + .45*en), frase = smoothstep(.15, .55, sin(uT*.29 + ph*.8)), bate = pow(abs(sin(uT*3.6 + ph*.05)), 8.);
    p.lado = sin(uT*2.1 + ph)*.045*k; p.cab = .04*sin(uT*1.3 + ph*1.7) + .05*k;
    if (barra > .5) { float w = sin(uT*4.2 + ph*.2); p.pulo = abs(w)*.09*k; p.bE = alto(w); p.bD = punho(w); p.boca = .5 + .5*abs(w); }
    else if (est < .3) { p.bE = mix(BAIXO, palma(bate), frase); p.bD = p.bE; p.boca = .3*frase; }
    else if (est < .44) { p.bE = CRUZA; p.bD = CRUZA; }
    else if (est < .56) { p.bE = CINTURA; p.bD = CINTURA; }
    else if (est < .72) { float w = sin(uT*2.4 + ph); p.bD = mix(BAIXO, punho(w), frase*.9); p.boca = .4*frase; }
  }
  else if (hum < 1.5) {                                                              // TENSÃO: mãos juntas, braços cruzados, mão na boca, tronco à frente
    float k = smoothstep(dl*.4, dl*.4 + .5, t)*I;
    if (est < .3) { p.bE = mix(BAIXO, REZA, k); p.bD = p.bE; }
    else if (est < .5) { p.bE = mix(BAIXO, CRUZA, k); p.bD = p.bE; }
    else if (est < .66) { p.bE = mix(BAIXO, ROSTO, k*.85); p.bD = mix(BAIXO, ROSTO, k*.75); }
    else if (est < .8) { p.bE = mix(BAIXO, CABECA, k*.55); p.bD = p.bE; }
    p.incl = .12*k; p.cab = -.04*k + sin(uT*1.1 + ph)*.01; p.lado = sin(uT*.9 + ph)*.012;
  }
  else if (hum < 2.5 || hum > 4.5) {                                                 // EUFORIA (gol, defesa, erro do adversário) e FESTA (título)
    float on = smoothstep(dl*.55, dl*.55 + .22, t), env = on*(hum > 4.5 ? 1. : mix(1., .55, smoothstep(5., 10., t)))*I;   // a explosão passa e fica a comemoração (continua até o próximo resultado)
    float f = 5.4 + en*2.2, w = sin(uT*f + ph), pulo = abs(w);
    float grupo = floor(aPos.x/1.65 + 100.), gph = fract(sin(grupo*12.9898)*43758.5)*6.28;      // vizinhos de um mesmo grupinho balançam juntos (abraço)
    if (est < .34) { p.bE = alto(w); p.bD = alto(-w); p.pulo = pulo*.24*env; }
    else if (est < .52) { p.bE = alto(w); p.bD = punho(w); p.pulo = pulo*.18*env; }
    else if (est < .68) { p.bE = ABRACO; p.bD = ABRACO; p.lado = sin(uT*3.4 + gph)*.16*env; p.pulo = abs(sin(uT*3.4 + gph))*.12*env; }
    else if (est < .8) { float d = smoothstep(1.2, 2.2, t); p.bE = mix(CABECA, alto(w), d); p.bD = p.bE; p.pulo = pulo*.12*env*d; }   // "não acredito!" e depois vibra
    else { float bate = pow(abs(sin(uT*7. + ph)), 6.); p.bE = palma(bate); p.bD = p.bE; p.pulo = pulo*.08*env; }
    Pose c = base0(); c.bE = mix(BAIXO, palma(pow(abs(sin(uT*3.6 + ph)), 8.)), .6); c.bD = c.bE;
    p = mixP(c, p, env); p.cab = .26*env; p.boca = env*(.55 + .45*abs(sin(uT*2.7 + ph)));
  }
  else if (hum < 3.5) {                                                              // FRUSTRAÇÃO (gol do adversário / eliminado): silêncio, cabeça baixa
    float env = smoothstep(dl*.7, dl*.7 + .7, t)*I;
    if (est < .3) { p.bE = mix(BAIXO, CRUZA, env); p.bD = p.bE; }
    else if (est < .5) { p.bE = mix(BAIXO, CINTURA, env); p.bD = p.bE; }
    else if (est < .64) { p.bE = mix(BAIXO, ROSTO, env); p.bD = mix(BAIXO, ROSTO, env*.7); }
    else if (est < .78) { p.bE = mix(BAIXO, CABECA, env*.7); p.bD = p.bE; }
    p.cab = -.2*env; p.incl = .05*env;
  }
  else {                                                                             // DECEPÇÃO (o próprio time errou): mãos na cabeça, depois rosto/braços cruzados
    float env = smoothstep(dl*.5, dl*.5 + .3, t)*I, depois = smoothstep(2.6 + dl*1.5, 4.2 + dl*1.5, t);
    vec4 a = est < .55 ? CABECA : est < .75 ? ROSTO : est < .88 ? BAIXO : alto(0.);
    vec4 b = est < .4 ? CRUZA : est < .7 ? ROSTO*.8 + BAIXO*.2 : CINTURA;
    p.bE = mix(BAIXO, mix(a, b, depois), env); p.bD = p.bE; p.cab = mix(.12, -.22, depois)*env; p.incl = mix(.18, .06, depois)*env;
  }
  if (flag > .5) { float w = sin(uT*(hum > 1.5 && hum < 2.5 || hum > 4.5 ? 3.2 : 1.9) + ph); p.bD = bandeira(w); p.pulo = 0.; }   // quem tem bandeira segura o mastro
  return p;
}
Pose poseFinal() {
  vec4 H = aTipo.x < .5 ? uH0 : uH1, X = aTipo.x < .5 ? uX0 : uX1;               // H = (humor, tempo nele, intensidade, humor anterior) · X = (tempo no anterior, calor, -, -)
  Pose a = poseDe(H.w, X.x + H.y, H.z, X.y), b = poseDe(H.x, H.y, H.z, X.y);
  return mixP(a, b, smoothstep(0., .45, H.y - aSeed.y*.3));
}`;
const CORPO = `
Pose po = poseFinal(); float part = aPC.x, cat = aPC.y, hs = aTipo.y;
vec3 P = position, N = normal;
if ((part == 7. && hs != 1.) || (part == 8. && hs != 2.) || (part == 9. && hs != 3.) || (part == 10. && aTipo.z < .5)) { P = vec3(0., 1.6, 0.); }
vec3 HC = vec3(0., 1.62, 0.); if (part == 1. || part >= 7.) P = HC + (P - HC)*aEsc.z;
vLoc = P;
if (part >= 2. && part <= 5.) { float s = part < 4. ? -1. : 1.; vec4 b = part < 4. ? po.bE : po.bD; vec3 sh = vec3(.205*s, 1.38, 0.);
  if (part == 3. || part == 5.) { vec3 el = vec3(.205*s, 1.09, 0.); P = el + rx(P - el, -b.z); N = rx(N, -b.z); }
  P = sh + ry(rx(rz(P - sh, s*b.y), -b.x), -s*b.w); N = ry(rx(rz(N, s*b.y), -b.x), -s*b.w); }   // abre para o lado, depois levanta à frente, depois gira para dentro
if (part == 1. || part >= 7.) { vec3 nk = vec3(0., 1.48, 0.); P = nk + rx(P - nk, -po.cab); N = rx(N, -po.cab); }
if (part != 6.) { vec3 hp = vec3(0., .92, 0.); P = hp + rz(rx(P - hp, po.incl), po.lado); N = rz(rx(N, po.incl), po.lado); }
P *= vec3(aEsc.y, aEsc.x, aEsc.y); P.y += po.pulo;
P = ry(P, aPos.w) + aPos.xyz; N = ry(N, aPos.w);
vCat = cat; vPart = part; vBoca = po.boca; vPad = aEsc.w; vCabV = aCab; vCor2 = aCam2; vWY = P.y; vWX = P.x;
vCor = cat < .5 ? aPele : cat < 1.5 ? aCam : cat < 2.5 ? aCalca : cat < 3.5 ? aCab : cat < 4.5 ? vec3(.9, .9, .88) : aCam2;
vec3 objectNormal = N;`;
const FRAG = `
varying vec3 vCor; varying vec3 vCor2; varying vec3 vCabV; varying vec3 vLoc; varying float vCat; varying float vPart; varying float vBoca; varying float vPad; varying float vWY; varying float vWX;
uniform float uLuz;
vec3 corPessoa() {
  vec3 col = vCor; float x = vLoc.x, y = vLoc.y;
  if (vCat > .5 && vCat < 1.5) {                                                     // camisa no padrão do clube
    if (vPad > .5 && vPad < 1.5) col = mix(vCor, vCor2, step(.5, fract(y*8.5)));
    else if (vPad > 1.5 && vPad < 2.5) col = mix(vCor, vCor2, step(.5, fract(x*10. + .25)));
    else if (vPad > 2.5 && vPad < 3.5) col = mix(vCor, vCor2, step(abs(x + (y - 1.2)*.9), .05));
    else if (vPad > 3.5 && vPad < 4.5) col = mix(vCor, vCor2, step(abs(y - 1.26), .045));
    if (y > 1.385 && abs(x) < .085 && vPad < 4.9) col = vCor2;                         // gola
    col *= .92 + .08*sin(y*58. + x*17.);                                              // dobras do tecido
  }
  if (vPart > .5 && vPart < 1.5 && vCat < .5) {                                       // rosto: olhos, sobrancelhas, boca (abre gritando)
    vec3 h = vLoc - vec3(0., 1.62, 0.);
    if (h.z > .045) { float ex = abs(h.x) - .032, olho = length(vec2(ex, (h.y - .01)*1.25));
      col = mix(col, vec3(.93), smoothstep(.013, .009, olho)); col = mix(col, vec3(.07, .05, .04), smoothstep(.0075, .0045, olho));
      col = mix(col, vCabV*.8, smoothstep(.006, .003, abs(h.y - .036))*step(abs(ex), .019));
      float bx = h.x/.026, by = (h.y + .047)/(.005 + .022*vBoca); col = mix(col, vec3(.32, .07, .07), step(bx*bx + by*by, 1.));
      col *= 1. - .07*smoothstep(-.01, -.06, h.y); }
  }
  return col;
}`;
function materialTorcida(uni) {
  const m = new THREE.MeshStandardMaterial({ roughness: .78, metalness: 0 });
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + POSE).replace('#include <beginnormal_vertex>', CORPO).replace('#include <begin_vertex>', 'vec3 transformed = P;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + FRAG)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4(corPessoa(), 1.);')
      // luz dos refletores na torcida: faixas iluminadas e sombras ao longo da arquibancada, mais escuro lá em cima (sem mexer nas luzes da cena)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat poca = .55 + .45*smoothstep(.2, 1., cos(vWX*.36 + .8)); float alt = 1. - .45*smoothstep(4., 13., vWY);\ntotalEmissiveRadiance += diffuseColor.rgb*uLuz*poca*alt;'); };
  m.customProgramCacheKey = () => 'torcida3d';
  return m;
}
// ---------- bandeiras na mão (mastro + pano), instanciadas ----------
const BAND_VS = `attribute vec4 iPos; attribute vec3 iC1; attribute vec3 iC2; attribute vec2 iSeed; uniform float uT; uniform vec2 uAgita;
varying vec3 vC1; varying vec3 vC2; varying vec2 vUv2; varying float vPano;
vec3 rz2(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c*v.x - s*v.y, s*v.x + c*v.y, v.z); }`;
function bandeiras(scene, uni) {
  const pano = new THREE.PlaneGeometry(.95, .62, 8, 3).translate(.475, 1.25, 0), mastro = new THREE.CylinderGeometry(.015, .015, 1.85, 5).translate(0, .62, 0);
  [pano, mastro].forEach((g, i) => { const n = g.attributes.position.count; g.setAttribute('aPano', new THREE.BufferAttribute(new Float32Array(n).fill(i ? 0 : 1), 1)); if (i) g.deleteAttribute('uv'); else { /* mantém uv do pano */ } });
  mastro.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(mastro.attributes.position.count*2), 2));
  const geo = mergeGeometries([pano.toNonIndexed(), mastro.toNonIndexed()]);
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .85 });
  mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aPano;\n' + BAND_VS)
      .replace('#include <beginnormal_vertex>', `vec3 objectNormal = normal; vec3 P = position; float lado = iPos.w > 0. ? 1. : -1.;
        float ag = iSeed.y < .5 ? uAgita.x : uAgita.y, w = sin(uT*(1.9 + 1.4*ag) + iSeed.x);
        if (aPano > .5) { float u = clamp(P.x/.95, 0., 1.); P.z += sin(uT*(5. + 3.*ag) + iSeed.x*3. + u*4.)*(.06 + .12*ag)*u; P.y += sin(uT*4. + u*3.)*.03*u; vUv2 = uv; }
        P.x *= lado; P = rz2(P, -lado*(.15 + .35*ag)*w*.6); vPano = aPano; vC1 = iC1; vC2 = iC2;`)
      .replace('#include <begin_vertex>', 'vec3 transformed = P + iPos.xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vC1; varying vec3 vC2; varying vec2 vUv2; varying float vPano;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4(vPano > .5 ? mix(vC1, vC2, step(.62, vUv2.y)*step(vUv2.y, .86) + step(vUv2.y, .14)) : vec3(.85), 1.);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb*.32;'); };
  mat.customProgramCacheKey = () => 'bandeiraMao';
  let malha = null;
  return { build(lista) {                                     // lista: [{ x, y, z, lado, c1, c2, fase }] — posição da MÃO que segura
    if (malha) { scene.remove(malha); malha.geometry.dispose(); malha = null; } if (!lista.length) return;
    const g = new THREE.InstancedBufferGeometry().copy(geo); g.instanceCount = lista.length;
    const iPos = new Float32Array(lista.length*4), c1 = new Float32Array(lista.length*3), c2 = new Float32Array(lista.length*3), sd = new Float32Array(lista.length*2), c = new THREE.Color();
    lista.forEach((b, i) => { iPos.set([b.x, b.y, b.z, b.x < 0 ? -1 : 1], i*4); c.set(b.c1); c1.set([c.r, c.g, c.b], i*3); c.set(b.c2); c2.set([c.r, c.g, c.b], i*3); sd.set([b.fase, b.lado], i*2); });
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 4)); g.setAttribute('iC1', new THREE.InstancedBufferAttribute(c1, 3)); g.setAttribute('iC2', new THREE.InstancedBufferAttribute(c2, 3)); g.setAttribute('iSeed', new THREE.InstancedBufferAttribute(sd, 2));
    malha = new THREE.Mesh(g, mat); malha.frustumCulled = false; scene.add(malha); }, get n() { return malha ? malha.geometry.instanceCount : 0; } };
}
// posição da mão direita levantada segurando o mastro (mesma conta do shader com a pose 'bandeira', sem o balanço)
function maoBandeira(f) {
  const b = [2.9, .15, .1], sh = new THREE.Vector3(.205, 1.38, 0), el = new THREE.Vector3(.205, 1.09, 0), mao = new THREE.Vector3(.205, .79, 0);
  const rx = (v, a) => new THREE.Vector3(v.x, Math.cos(a)*v.y - Math.sin(a)*v.z, Math.sin(a)*v.y + Math.cos(a)*v.z), rz = (v, a) => new THREE.Vector3(Math.cos(a)*v.x - Math.sin(a)*v.y, Math.sin(a)*v.x + Math.cos(a)*v.y, v.z);
  let p = el.clone().add(rx(mao.clone().sub(el), -b[2])); p = sh.clone().add(rx(rz(p.sub(sh), b[1]), -b[0]));
  return { x: f.x + p.x*f.larg, y: f.y + p.y*f.alt, z: f.z + p.z*f.larg };
}
export function criaTorcedores(scene, lugares, { degrau }) {
  const uni = { uT: { value: 0 }, uH0: { value: new THREE.Vector4() }, uH1: { value: new THREE.Vector4() }, uX0: { value: new THREE.Vector4() }, uX1: { value: new THREE.Vector4() }, uLuz: { value: .38 }, uAgita: { value: new THREE.Vector2() } };
  const mat = materialTorcida(uni), geos = [pessoa(true), pessoa(false)], malhas = [null, null], band = bandeiras(scene, uni);
  // quem ocupa cada lugar: lotado (≈96%), sempre os mesmos (semente fixa); os buracos são poucos e espalhados
  const rnd = rndDe(SEED), ocupados = lugares.filter(() => rnd() < .965);
  let ultimo = null, nBand = 0;
  function build(teams) {
    const T = teams && teams[0] ? teams : [{ c1: '#c8102e', c2: '#111111', c3: '#ffffff', pat: 'h' }, { c1: '#f2f2f2', c2: '#111111', c3: '#111111', pat: 'p' }]; ultimo = T;
    const r = rndDe(SEED + 7), c = new THREE.Color(), cores = (arr, i, hex) => { c.set(hex); arr[i*3] = c.r; arr[i*3 + 1] = c.g; arr[i*3 + 2] = c.b; }, porLod = [[], []], flags = [];
    ocupados.forEach(l => { const lado = l.x < 0 ? 0 : 1, t = T[lado], perto = l.r < 8 ? 0 : 1;
      const barra = l.r >= 1 && l.r <= 10 && Math.abs(Math.abs(l.x) - 9) < 4.5;             // torcida organizada: no meio de cada setor, mais camisa do clube e mais bandeiras
      const idoso = r() < .14, f = { x: l.x + (r() - .5)*.08, y: l.y, z: l.z + .22 + (r() - .5)*.06, yaw: -l.x*.012 + (r() - .5)*.25, alt: .91 + r()*.16, larg: .9 + r()*.22, cab: .94 + r()*.12, lado };
      const u = r(), pad = PADRAO[t.pat] ?? 0; let cam = t.c1, cam2 = t.c2, padrao = pad;
      if (barra ? u > .9 : u > .7) { cam = NEUTRO[r()*NEUTRO.length | 0]; cam2 = cam; padrao = 5; } else if (u > (barra ? .82 : .58)) { cam = t.c2; cam2 = t.c1; padrao = 0; }
      const cabelo = r(), cab = idoso ? (r() < .6 ? 7 : 8) : r()*7 | 0, hs = cabelo < .08 ? 0 : cabelo < .66 ? 1 : cabelo < .84 ? 2 : 3, barba = r() < (idoso ? .5 : .25) ? 1 : 0;
      const temBandeira = perto < 1 || l.r < 14 ? r() < (barra ? .09 : .025) : 0;
      porLod[perto].push({ f, cam, cam2, padrao, hs, barba, pele: PELE[r()*PELE.length | 0], cabC: CABELO[cab], calca: CALCA[r()*CALCA.length | 0], seed: [r()*6.283, r(), barra ? .87 + r()*.13 : r()*.86, r()], flag: temBandeira ? 1 : 0 });
      if (temBandeira) flags.push({ ...maoBandeira(f), lado, c1: t.c1, c2: t.c2, fase: r()*6.283 }); });
    porLod.forEach((lista, k) => {
      if (malhas[k]) { scene.remove(malhas[k]); malhas[k].geometry.dispose(); malhas[k] = null; }
      const n = lista.length, A = nm => new Float32Array(n*nm), aPos = A(4), aEsc = A(4), aSeed = A(4), aTipo = A(4), aPele = A(3), aCam = A(3), aCam2 = A(3), aCab = A(3), aCalca = A(3);
      lista.forEach((p, i) => { const f = p.f; aPos.set([f.x, f.y, f.z, f.yaw], i*4); aEsc.set([f.alt, f.larg, f.cab, p.padrao], i*4); aSeed.set(p.seed, i*4); aTipo.set([f.lado, p.hs, p.barba, p.flag], i*4);
        cores(aPele, i, p.pele); cores(aCam, i, p.cam); cores(aCam2, i, p.cam2); cores(aCab, i, p.cabC); cores(aCalca, i, p.calca); });
      const g = new THREE.InstancedBufferGeometry().copy(geos[k]); g.instanceCount = n;
      Object.entries({ aPos: [aPos, 4], aEsc: [aEsc, 4], aSeed: [aSeed, 4], aTipo: [aTipo, 4], aPele: [aPele, 3], aCam: [aCam, 3], aCam2: [aCam2, 3], aCab: [aCab, 3], aCalca: [aCalca, 3] }).forEach(([nm, [a, s]]) => g.setAttribute(nm, new THREE.InstancedBufferAttribute(a, s)));
      const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; scene.add(m); malhas[k] = m; });
    band.build(flags); nBand = flags.length;
  }
  function update(now) {
    uni.uT.value = now; const L = Humor.lados;
    [[uni.uH0, uni.uX0, L[0]], [uni.uH1, uni.uX1, L[1]]].forEach(([H, Xv, s]) => { H.value.set(s.humor, s.t, s.I, s.ant); Xv.value.set(s.tAnt, Humor.calor, 0, 0); });
    const ag = s => s.humor === 2 || s.humor === 5 ? s.I*(s.humor === 5 ? 1 : s.dura ? Math.max(.3, 1 - s.t/s.dura) : Math.max(.5, 1 - s.t/14)) : s.humor === 1 ? .1 : s.humor >= 3 ? 0 : .35; uni.uAgita.value.set(ag(L[0]), ag(L[1]));
  }
  build(null);
  return { build, update, uniforms: uni, info: () => ({ torcedores: ocupados.length, perto: malhas[0]?.geometry.instanceCount ?? 0, longe: malhas[1]?.geometry.instanceCount ?? 0, bandeiras: nBand,
    vertsPerto: geos[0].attributes.position.count, vertsLonge: geos[1].attributes.position.count }), get times() { return ultimo; } };
}
