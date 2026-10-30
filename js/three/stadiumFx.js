// EFEITOS DA ARQUIBANCADA no motor 3D (os mesmos do antigo motor procedural): faixas com texto nas cores de cada torcida, bandeiras tremulando,
// sinalizadores pulsando, fumaça colorida (mais intensa na decisão, no fim e logo depois de um gol) e o brilho dos refletores.
// Geometria simples e texturas de canvas geradas uma vez por partida; a fumaça é um conjunto fixo de 120 sprites reaproveitados.
import * as THREE from 'three';
import { ROWS } from '../crowd.js';
const rnd = Math.random, lum = h => { const n = parseInt(h.slice(1), 16); return (.3*(n >> 16) + .59*(n >> 8 & 255) + .11*(n & 255))/255; };
const rowY = r => .15 + r*.6, rowZ = r => -4.6 - r*.85;                                             // degrau r da arquibancada (igual a stadium.js)
const tex = cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
function bannerCanvas(t, txt) {                                                                      // faixa: texto legível nas cores do clube
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 84; const c = cv.getContext('2d'); c.fillStyle = t.c1; c.fillRect(0, 0, 512, 84); c.fillStyle = t.c2; c.fillRect(0, 62, 512, 22); c.fillRect(0, 0, 512, 8);
  c.fillStyle = lum(t.c1) > .55 ? '#111' : '#fff'; c.textAlign = 'center'; let fs = 44; c.font = `900 ${fs}px Arial`; while (c.measureText(txt).width > 480 && fs > 16) c.font = `900 ${--fs}px Arial`; c.fillText(txt, 256, 52); return cv;
}
function flagCanvas(t) { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32; const c = cv.getContext('2d'); c.fillStyle = t.c1; c.fillRect(0, 0, 64, 32); c.fillStyle = t.c2; c.fillRect(0, 18, 64, 14); return cv; }
function glowCanvas(inner, mid) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, inner); g.addColorStop(.3, mid); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); return cv; }
export function createStadiumFx(scene) {
  const group = new THREE.Group(); scene.add(group);
  const puff = tex(glowCanvas('rgba(255,255,255,.9)', 'rgba(255,255,255,.45)')), flareTex = tex(glowCanvas('rgba(255,255,255,1)', 'rgba(255,220,180,.7)'));
  let names = [null, null], heat = .25, flags = [], flares = [];
  // fumaça: 120 sprites fixos (sem criar/destruir objetos durante a partida)
  const smoke = [...Array(120).keys()].map(() => { const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0 })); o.visible = false; group.add(o); return { o, life: 0 }; });
  const standTop = z => rowY(Math.max(0, Math.min(ROWS - 1, Math.round((-4.6 - z)/.85)))) + 1.4;   // acima da cabeça da torcida daquele degrau
  const emit = (x, y, z, col, big) => { const p = smoke.find(s => s.life <= 0); if (!p) return; Object.assign(p, { x, y: Math.max(y, standTop(z)), z, vy: .5 + rnd()*(big ? .6 : .4), vx: (rnd() - .5)*.3, r: big ? .5 + rnd()*.5 : .35 + rnd()*.3, life: 2.8 }); p.o.material.color.set(col); p.o.visible = true; };
  // refletores: brilho fixo no alto
  [[-16, 13, -12], [16, 13, -12], [-9, 15, -16], [9, 15, -16]].forEach(([x, y, z]) => { const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(glowCanvas('rgba(255,255,235,.95)', 'rgba(255,250,200,.35)')), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); o.position.set(x, y, z); o.scale.set(9, 9, 1); scene.add(o); });
  const clear = () => { [...group.children].forEach(o => { if (smoke.some(s => s.o === o)) return; group.remove(o); o.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material && m.material.map && m.material.map !== puff && m.material.map !== flareTex) m.material.map.dispose(); if (m.material) m.material.dispose(); }); }); };
  function setTeams(a, b) {
    clear(); names = [a, b]; heat = .25; smoke.forEach(s => { s.life = 0; s.o.visible = false; });
    [a, b].forEach((t, s) => [`VAMOS, ${t.nome.toUpperCase()}!`, 'ATÉ O FIM!', 'NOSSA PAIXÃO!', 'JAMAIS ABANDONAREMOS!'].sort(() => rnd() - .5).slice(0, 3).forEach((txt, i) => {
      const r = Math.min(ROWS - 1, [1, 4, 7][i]), w = [4.4, 3.8, 4.2][i], m = new THREE.Mesh(new THREE.PlaneGeometry(w, .75), new THREE.MeshStandardMaterial({ map: tex(bannerCanvas(t, txt)), roughness: .9, side: THREE.DoubleSide }));
      m.position.set((s ? 1 : -1)*[10.2, 4.4, 8.6][i], rowY(r) + .85 + .375, rowZ(r) + .5); group.add(m); }));
    flags = []; [0, 1].forEach(s => { for (let i = 0; i < 7; i++) { const t = names[s], r = Math.min(ROWS - 1, 1 + (rnd()*8 | 0)), x = (s ? 1 : -1)*(1.5 + rnd()*11), y = rowY(r), z = rowZ(r);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 2.1, 5), new THREE.MeshStandardMaterial({ color: '#dddddd' })); pole.position.set(x, y + 1.05, z); group.add(pole);
      const g = new THREE.PlaneGeometry(1.1, .5, 6, 1); g.translate(.55, 0, 0); const cloth = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex(flagCanvas(t)), roughness: .9, side: THREE.DoubleSide })); cloth.position.set(x, y + 1.85, z); group.add(cloth);
      flags.push({ g, base: Float32Array.from(g.attributes.position.array), p: rnd()*6 }); } });
    flares = []; [0, 1].forEach(s => [0, 1, 2, 3].forEach(i => { const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, color: names[s].c1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      o.position.set((s ? 1 : -1)*(2.5 + i*3 + rnd()*1.5), 1.6 + (i % 2)*1.4, -5.5 - (i % 2)*1.6); group.add(o); flares.push({ o, s, ph: rnd()*6 }); }));
  }
  // explosão de fumaça da torcida que comemora (gol, fim de jogo)
  const burst = s => { const t = names[s]; if (!t) return; for (let i = 0; i < 18; i++) emit((s ? 1 : -1)*(2 + rnd()*10), 2 + rnd()*3, -6 - rnd()*5, rnd() < .6 ? t.c1 : t.c2, true); };
  function update(now, dt, game) {
    if (!names[0]) return; heat += ((game.fin ? 1 : game.dec ? .6 : .25) - heat)*(1 - Math.exp(-2*dt));
    flags.forEach(f => { const a = f.g.attributes.position, b = f.base; for (let i = 0; i < a.count; i++) { const x = b[i*3]; a.array[i*3 + 2] = b[i*3 + 2] + Math.sin(now*4 + f.p + x*3)*.12*x; a.array[i*3 + 1] = b[i*3 + 1] + Math.sin(now*4 + f.p)*.05*x; } a.needsUpdate = true; });
    flares.forEach(f => { const k = .5*(1 + .25*Math.sin(now*9 + f.ph)); f.o.scale.set(k*2, k*2, 1); const t = names[f.s]; if (rnd() < heat*dt*4) emit(f.o.position.x, f.o.position.y, f.o.position.z, rnd() < .6 ? t.c1 : t.c2, false); });
    smoke.forEach(p => { if (p.life <= 0) return; p.life -= dt; if (p.life <= 0) { p.o.visible = false; return; } p.y += p.vy*dt; p.x += p.vx*dt; p.r += .3*dt; p.o.position.set(p.x, p.y, p.z); p.o.scale.set(p.r*2, p.r*2, 1); p.o.material.opacity = Math.max(0, p.life/2.8)*.38; });
  }
  return { setTeams, burst, update, smoke };   // smoke exposto para depuração (JOGO.DBG.fx)
}
