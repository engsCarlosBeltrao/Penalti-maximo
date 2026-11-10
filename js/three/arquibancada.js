// ARQUIBANCADA ATRÁS DO GOL — só o que as câmeras da partida enxergam (z < 0, x de -26 a 26): UM lance contínuo de degraus subindo até acima do
// topo do enquadramento (sem cobertura, sem corredor no meio), UMA escadaria central, cadeiras em todo o setor esquerdo (torcida da equipe 0) e direito
// (equipe 1), muro e grade na frente, paredes laterais e de fundo, torres de refletores atrás do último degrau (fora da câmera da cobrança).
// Estrutura mesclada em poucas malhas; cadeiras num InstancedMesh; a torcida (js/three/torcedores.js) fica em pé nos degraus, um torcedor por lugar.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { criaTorcedores } from './torcedores.js';
// degraus: 0,8 m de fundo e 0,5 m de altura (≈32°, inclinação de anel superior), a partir do muro em z = -5
export const ARQ = { n: 22, z0: -5.0, prof: .8, y0: 1.1, alt: .5, X: 26, escada: 1.5 };
export const FILAS = ARQ.n;
// degrau r: altura do piso e z do meio do degrau (usado pela torcida e pelos efeitos: faixas, bandeiras, fumaça)
export function degrau(r) { return { y: ARQ.y0 + r*ARQ.alt, z: ARQ.z0 - (r + .5)*ARQ.prof, prof: ARQ.prof }; }
export const ESCADAS = [0];
const X = ARQ.X, TOPO = degrau(ARQ.n - 1).y + ARQ.alt, FUNDO = ARQ.z0 - ARQ.n*ARQ.prof;
const caixa = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const naEscada = x => Math.abs(x) < ARQ.escada/2 + .2;
function concreto(scene) {
  const gs = [], esc = [], escuro = [], aco = [];
  gs.push(caixa(2*X, .02, 1.1, 0, .01, -4.55));                                                       // piso entre as placas e o muro
  gs.push(caixa(2*X, ARQ.y0, .3, 0, ARQ.y0/2, ARQ.z0 + .15));                                          // muro da frente
  for (let r = 0; r < ARQ.n; r++) { const d = degrau(r); gs.push(caixa(2*X, d.y, ARQ.prof + .02, 0, d.y/2, d.z)); gs.push(caixa(2*X, .06, .08, 0, d.y + .03, d.z + ARQ.prof/2 - .04)); }   // degrau + quina
  // escadaria central: meio-degraus mais claros + corrimãos dos dois lados, do primeiro degrau ao topo
  const w = ARQ.escada; for (let r = 0; r < ARQ.n; r++) { const d = degrau(r); esc.push(caixa(w, .03, d.prof, 0, d.y + .015, d.z), caixa(w, ARQ.alt/2, d.prof/2, 0, d.y + ARQ.alt/4, d.z - d.prof/4)); }
  const corr = (x0, y0, z0, x1, y1, z1, r = .025) => { const A = new THREE.Vector3(x0, y0, z0), B = new THREE.Vector3(x1, y1, z1), d = B.clone().sub(A), g = new THREE.CylinderGeometry(r, r, d.length(), 6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate((A.x + B.x)/2, (A.y + B.y)/2, (A.z + B.z)/2); aco.push(g); };
  for (const s of [-1, 1]) { const x = s*(w/2 + .05), a = degrau(0), b = degrau(ARQ.n - 1); corr(x, a.y + .95, a.z + .4, x, b.y + .95, b.z - .4);
    for (let r = 0; r < ARQ.n; r += 3) { const d = degrau(r); corr(x, d.y, d.z, x, d.y + .95, d.z, .02); } }
  // parede do fundo (acima do último degrau) e paredes laterais com o perfil da arquibancada
  gs.push(caixa(2*X, TOPO + 2.2, .4, 0, (TOPO + 2.2)/2, FUNDO - .2));
  for (const s of [-1, 1]) { const sh = new THREE.Shape(); sh.moveTo(-4.4, 0); sh.lineTo(-4.4, 2.6); sh.lineTo(ARQ.z0 + .3, 2.6); sh.lineTo(FUNDO - .4, TOPO + 2.2); sh.lineTo(FUNDO - .4, 0); sh.closePath();
    const g = new THREE.ShapeGeometry(sh); g.rotateY(-Math.PI/2); g.translate(s*X, 0, 0); gs.push(g); }
  // torres de refletores atrás do topo (vistas só nas câmeras abertas); as luzes acesas ficam em stadiumFx
  for (const x of [-22, -8, 8, 22]) { aco.push(new THREE.CylinderGeometry(.18, .26, 9, 8).translate(x, TOPO + 4.5, FUNDO - 1.2)); escuro.push(caixa(4.2, 1.6, .4, x, TOPO + 9.2, FUNDO - 1.1)); }
  const mesh = (lista, cor, rough = .92, metal = 0) => { const m = new THREE.Mesh(mergeGeometries(lista.map(g => (g.index ? g.toNonIndexed() : g).deleteAttribute('uv') || g)), new THREE.MeshStandardMaterial({ color: cor, roughness: rough, metalness: metal, side: THREE.DoubleSide })); m.receiveShadow = true; scene.add(m); return m; };
  mesh(gs, '#7d848c'); mesh(esc, '#b3b8bd', .85); mesh(escuro, '#0b0d10', 1); mesh(aco, '#c9ced4', .4, .6);
}
// cadeiras (assento + encosto), azul-escuras — ficam quase escondidas atrás da torcida em pé; devolve os lugares
function cadeiras(scene) {
  const g = mergeGeometries([caixa(.44, .07, .38, 0, .42, 0), caixa(.44, .4, .06, 0, .64, -.17), caixa(.06, .4, .06, 0, .2, 0)].map(x => x.toNonIndexed()));
  const lugares = []; for (let r = 0; r < ARQ.n; r++) { const d = degrau(r); for (let x = -X + .4; x <= X - .4; x += .55) if (!naEscada(x)) lugares.push({ x, y: d.y, z: d.z - d.prof*.18, r }); }
  const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: .55 }), lugares.length), M = new THREE.Matrix4(), c = new THREE.Color();
  lugares.forEach((l, i) => { M.makeTranslation(l.x, l.y, l.z); m.setMatrixAt(i, M); c.set('#26344f').multiplyScalar(.85 + ((i*7919) % 100)/400); m.setColorAt(i, c); });
  m.receiveShadow = true; scene.add(m); return lugares;
}
// grade de proteção atrás das placas: barras verticais (textura com transparência) + pilares e corrimãos
function grade(scene) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#d8dde2'; for (let x = 0; x < 512; x += 16) g.fillRect(x, 0, 3, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(2*X/2.6, 1);
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(2*X, 1.9), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: .35, side: THREE.DoubleSide, roughness: .5, metalness: .4 })); tela.position.set(0, 1.95, -4.75); scene.add(tela);
  const ps = []; for (let x = -X; x <= X + .01; x += 2.75) ps.push(caixa(.08, 3, .08, x, 1.5, -4.75)); ps.push(caixa(2*X, .07, .07, 0, 2.95, -4.75), caixa(2*X, .06, .06, 0, 1.0, -4.75));
  const m = new THREE.Mesh(mergeGeometries(ps.map(x => x.toNonIndexed())), new THREE.MeshStandardMaterial({ color: '#2c3136', roughness: .45, metalness: .6 })); m.castShadow = true; scene.add(m);
}
export function criaArquibancada(scene) {
  concreto(scene); const lugares = cadeiras(scene); grade(scene);
  const t = criaTorcedores(scene, lugares, { degrau, ARQ });
  return { buildCrowd: teams => t.build(teams), updateCrowd: (now, dt) => t.update(now, dt), torcida: t, info: () => ({ lugares: lugares.length, ...t.info() }) };
}
