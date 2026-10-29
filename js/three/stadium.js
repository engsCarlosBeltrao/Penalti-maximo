// Estádio mínimo em Three.js (gramado, gol com rede deformável, bola, placas de publicidade, arquibancada, torcida em sprites). Provisório: serve para
// testar os modelos GLB; o estádio completo (bandeiras, faixas, fumaça) continua no motor procedural. NÃO TESTADO com Three.js real.
import * as THREE from 'three';
import { Ads } from '../advertising.js';
import { fans, ROWS, ensureSprite } from '../crowd.js';
import { BALL_R, GOAL_W, GOAL_H, SPOT_Z } from '../rig.js';
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function pitchTexture() {                                             // 80x80 m cobrindo z ∈ [-4, 76]; listras de corte + marcações
  const S = 2048, c = canvas(S, S), g = c.getContext('2d'), X = x => (x + 40)/80*S, Z = z => (z + 4)/80*S;
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#2e9446' : '#277f3b'; g.fillRect(0, i*S/16, S, S/16 + 1); }
  g.strokeStyle = '#fff'; g.lineWidth = 7; g.strokeRect(X(-34), Z(0), X(34) - X(-34), Z(64) - Z(0)); g.strokeRect(X(-20.16), Z(0), X(20.16) - X(-20.16), Z(16.5) - Z(0)); g.strokeRect(X(-9.16), Z(0), X(9.16) - X(-9.16), Z(5.5) - Z(0));
  g.beginPath(); g.arc(X(0), Z(SPOT_Z), 9.15*S/80, .62, Math.PI - .62); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(X(0), Z(SPOT_Z), 7, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function ballTexture() {
  const c = canvas(512, 256), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#1d4fa6'; [[80, 60], [210, 100], [340, 60], [470, 110], [140, 190], [290, 200], [420, 190]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 34, 0, 7); g.fill(); });
  g.strokeStyle = '#19a35a'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 130); g.bezierCurveTo(130, 90, 300, 170, 512, 120); g.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function buildStadium(scene) {
  scene.background = new THREE.Color('#050914'); scene.fog = new THREE.Fog('#0a1226', 60, 160);
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x1a3a1a, .85)); const sun = new THREE.DirectionalLight(0xffffff, 1.25); sun.position.set(-8, 24, 18); sun.target.position.set(0, 0, 8); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 }); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; scene.add(sun, sun.target);
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 1 })); pitch.rotation.x = -Math.PI/2; pitch.position.set(0, 0, 36); pitch.receiveShadow = true; scene.add(pitch);
  // gol
  const white = new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: .4 }), grey = new THREE.MeshStandardMaterial({ color: '#9aa4ad' }), cyl = (a, b, r, m) => { const d = new THREE.Vector3().subVectors(b, a), mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 10), m); mesh.position.copy(a).addScaledVector(d, .5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); mesh.castShadow = true; scene.add(mesh); };
  const V = (x, y, z) => new THREE.Vector3(x, y, z), w = GOAL_W/2, bw = 3.3, bz = -2, bh = 2;
  cyl(V(-w, 0, 0), V(-w, GOAL_H, 0), .06, white); cyl(V(w, 0, 0), V(w, GOAL_H, 0), .06, white); cyl(V(-w, GOAL_H, 0), V(w, GOAL_H, 0), .06, white);
  cyl(V(-bw, 0, bz), V(-bw, bh, bz), .03, grey); cyl(V(bw, 0, bz), V(bw, bh, bz), .03, grey); cyl(V(-bw, bh, bz), V(bw, bh, bz), .03, grey); [-1, 1].forEach(s => { cyl(V(s*w, GOAL_H, 0), V(s*bw, bh, bz), .03, grey); cyl(V(s*w, 0, 0), V(s*bw, 0, bz), .03, grey); });
  const NX = 26, NY = 10, pts = new Float32Array((NX + 1)*(NY + 1)*3), seg = []; const idx = (i, j) => j*(NX + 1) + i;
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NY; j++) { if (i < NX) seg.push(idx(i, j), idx(i + 1, j)); if (j < NY) seg.push(idx(i, j), idx(i, j + 1)); }
  const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.BufferAttribute(pts, 3)); ng.setIndex(seg); const net = new THREE.LineSegments(ng, new THREE.LineBasicMaterial({ color: '#e8edf2', transparent: true, opacity: .55 })); net.frustumCulled = false; scene.add(net);
  const sideNet = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([...Array(9).keys()].flatMap(k => [[-w, GOAL_H*k/8, 0, -bw, bh*k/8, bz], [w, GOAL_H*k/8, 0, bw, bh*k/8, bz]]).flatMap(a => [V(a[0], a[1], a[2]), V(a[3], a[4], a[5])])), net.material); scene.add(sideNet);
  const updateNet = (amp, T) => { for (let i = 0; i <= NX; i++) for (let j = 0; j <= NY; j++) { const x = -bw + 2*bw*i/NX, y = bh*j/NY, dd = Math.exp(-(((x - T[0])/1.3)**2 + ((y - T[1])/.9)**2))*amp, o = idx(i, j)*3; pts[o] = x + (x - T[0])*dd*.25; pts[o + 1] = y - dd*.25; pts[o + 2] = bz - dd*.55; } ng.attributes.position.needsUpdate = true; }; updateNet(0, [0, 1]);
  // bola
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 28, 18), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: .55 })); ball.castShadow = true; scene.add(ball);
  // placas de publicidade (textura atualizada a cada 0,5 s a partir do sistema de anúncios)
  const boards = [...Array(6).keys()].map(k => { const cv = canvas(384, 64), t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(6, .9), new THREE.MeshBasicMaterial({ map: t })); m.position.set(-15 + k*6, .55, -3.6); scene.add(m); return { cv, t }; });
  let lastBoards = -9; const updateBoards = now => { if (now - lastBoards < .5) return; lastBoards = now; boards.forEach((b, k) => { const r = Ads.current('main', now, k), x = b.cv.getContext('2d'); x.fillStyle = r ? r.ad.backgroundColor : '#0d1b2a'; x.fillRect(0, 0, 384, 64); if (r) { x.fillStyle = r.ad.textColor; x.textAlign = 'center'; x.font = '800 26px Arial'; x.fillText(r.ad.sponsor.toUpperCase().slice(0, 24), 192, 41); } b.t.needsUpdate = true; }); };
  // arquibancada + torcida (sprites com os mesmos torcedores do motor procedural)
  const stand = new THREE.MeshStandardMaterial({ color: '#1c2438', roughness: 1 }); for (let r = 0; r < ROWS; r++) { const half = 14 + r*.9, m = new THREE.Mesh(new THREE.BoxGeometry(half*2, .6, .85), stand); m.position.set(0, .15 + r*.6 - .3, -4.6 - r*.85 + .42); scene.add(m); }
  const sprites = []; let built = false;
  const buildCrowd = () => { sprites.forEach(s => { scene.remove(s.o); s.o.material.map?.dispose(); s.o.material.dispose(); }); sprites.length = 0;
    fans.forEach(f => { const sp = ensureSprite(f); if (!sp) return; const t = new THREE.CanvasTexture(sp.cv); t.colorSpace = THREE.SRGBColorSpace; const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true })); o.scale.set(sp.w/sp.K, sp.h/sp.K, 1); const hip = f.y + (f.base === 0 ? .45 : .8); o.position.set(f.x, hip + (sp.ay - sp.h/2)/sp.K, f.z); scene.add(o); sprites.push({ o, f, y0: o.position.y }); }); built = true; };
  const updateCrowd = (now, exS, sad) => { if (!built) return; sprites.forEach(s => { const e = exS[s.f.side]*(.5 + .5*s.f.e); s.o.position.y = s.y0 + (e > .15 ? Math.abs(Math.sin(now*8 + s.f.p))*.22*e : 0) - sad[s.f.side]*.04; }); };
  return { ball, updateNet, updateBoards, buildCrowd, updateCrowd };
}
