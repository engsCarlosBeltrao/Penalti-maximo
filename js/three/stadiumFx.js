// EFEITOS DA ARQUIBANCADA (noite de Libertadores): faixas com o nome do clube na grade e nos degraus, bandeirões nos mastros (balançam mais quando a
// torcida comemora), sinalizadores, fumaça colorida, luzes de celular piscando no meio da torcida, névoa leve na luz dos refletores e os refletores
// acesos nas torres atrás do topo. Cores sempre dos clubes da partida; nenhum escudo inventado (só texto e as cores).
// Tudo criado uma vez por partida: a fumaça são 120 sprites reaproveitados; as luzes de celular, um único THREE.Points.
import * as THREE from 'three';
import { degrau, ARQ } from './arquibancada.js';
import { Humor } from '../torcidaHumor.js';
const rnd = Math.random, lum = h => { const n = parseInt(h.slice(1), 16); return (.3*(n >> 16) + .59*(n >> 8 & 255) + .11*(n & 255))/255; };
const rowY = r => degrau(r).y, rowZ = r => degrau(r).z, TOPO = degrau(ARQ.n - 1).y + ARQ.alt, FUNDO = ARQ.z0 - ARQ.n*ARQ.prof;
const tex = cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
function bannerCanvas(t, txt, w = 1024, h = 96) {                                  // faixa: texto legível nas cores do clube
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); c.fillStyle = t.c1; c.fillRect(0, 0, w, h); c.fillStyle = t.c2; c.fillRect(0, h*.8, w, h*.2); c.fillRect(0, 0, w, h*.08);
  c.fillStyle = lum(t.c1) > .55 ? '#111' : '#fff'; c.textAlign = 'center'; let fs = h*.56; c.font = `italic 900 ${fs}px Arial`; while (c.measureText(txt).width > w*.94 && fs > 14) c.font = `italic 900 ${--fs}px Arial`; c.fillText(txt, w/2, h*.64); return cv;
}
function flagCanvas(t) { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = t.c1; c.fillRect(0, 0, 128, 64); c.fillStyle = t.c2; c.fillRect(0, 22, 128, 20); return cv; }
function glowCanvas(inner, mid) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, inner); g.addColorStop(.3, mid); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); return cv; }
export function createStadiumFx(scene) {
  const group = new THREE.Group(); scene.add(group);
  const puff = tex(glowCanvas('rgba(255,255,255,.9)', 'rgba(255,255,255,.45)')), flareTex = tex(glowCanvas('rgba(255,255,255,1)', 'rgba(255,220,180,.7)'));
  let names = [null, null], heat = .25, flags = [], flares = [];
  const smoke = [...Array(120).keys()].map(() => { const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0 })); o.visible = false; group.add(o); return { o, life: 0 }; });
  const standTop = z => rowY(Math.max(0, Math.min(ARQ.n - 1, Math.round((ARQ.z0 - z)/ARQ.prof - .5)))) + 1.9;
  const emit = (x, y, z, col, big) => { const p = smoke.find(s => s.life <= 0); if (!p) return; Object.assign(p, { x, y: Math.max(y, standTop(z)), z, vy: .5 + rnd()*(big ? .6 : .4), vx: (rnd() - .5)*.3, r: big ? .6 + rnd()*.6 : .4 + rnd()*.3, life: 3 }); p.o.material.color.set(col); p.o.visible = true; };
  // refletores acesos nas torres atrás do topo (câmeras abertas) + brilho alto nas pontas do enquadramento
  const holo = tex(glowCanvas('rgba(255,255,240,1)', 'rgba(255,250,215,.45)'));
  for (const x of [-22, -8, 8, 22]) for (let k = -1; k <= 1; k++) { const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: holo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); o.position.set(x + k*1.2, TOPO + 9.3, FUNDO - .8); o.scale.set(3.4, 3.4, 1); scene.add(o); }
  // névoa leve na luz dos refletores, na frente da parte alta da arquibancada (planos com degradê, aditivos e quase transparentes)
  { const cv = document.createElement('canvas'); cv.width = 16; cv.height = 128; const c = cv.getContext('2d'), g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(200,215,255,0)'); g.addColorStop(.45, 'rgba(200,215,255,.55)'); g.addColorStop(1, 'rgba(200,215,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 16, 128);
    const t = tex(cv); [[-9, 7.5, .1], [-15, 10.5, .085]].forEach(([z, y, op]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2*ARQ.X, 7), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.set(0, y, z); m.renderOrder = 3; scene.add(m); }); }
  // luzes de celular piscando no meio da torcida (um THREE.Points, cintilação no shader)
  const cel = (() => { const n = 420, pos = new Float32Array(n*3), fase = new Float32Array(n); for (let i = 0; i < n; i++) { const r = 2 + (rnd()*(ARQ.n - 3) | 0), d = degrau(r); let x = (rnd()*2 - 1)*(ARQ.X - 1); if (Math.abs(x) < 1.2) x += x < 0 ? -1.2 : 1.2;
      pos.set([x, d.y + 1.85 + rnd()*.25, d.z + .2], i*3); fase[i] = rnd()*100; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aF', new THREE.BufferAttribute(fase, 1));
    const u = { uT: { value: 0 }, uK: { value: .5 }, uMap: { value: holo } };
    const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aF; uniform float uT, uK; varying float vA; void main() { vec4 mv = modelViewMatrix*vec4(position, 1.); float on = step(.35, fract(aF*.137 + uT*.05*(1. + fract(aF)*.5)));
        vA = on*uK*(.6 + .4*sin(uT*(2. + fract(aF*3.)*4.) + aF)); gl_PointSize = 900.*.09/max(1., -mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: 'uniform sampler2D uMap; varying float vA; void main() { vec4 c = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(c.rgb, c.a*vA); }' });
    const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 4; scene.add(p); return u; })();
  const clear = () => { [...group.children].forEach(o => { if (smoke.some(s => s.o === o)) return; group.remove(o); o.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material && m.material.map && m.material.map !== puff && m.material.map !== flareTex) m.material.map.dispose(); if (m.material) m.material.dispose(); }); }); };
  function setTeams(a, b) {
    clear(); names = [a, b]; heat = .25; smoke.forEach(s => { s.life = 0; s.o.visible = false; });
    [a, b].forEach((t, s) => {
      const sg = s ? 1 : -1, nome = t.nome.toUpperCase();
      // faixa comprida na grade da frente, de ponta a ponta do setor (como os "trapos" do anel inferior)
      const tf = tex(bannerCanvas(t, `SEMPRE ESTAREI AO SEU LADO, ${nome}!`, 2048, 96)), f = new THREE.Mesh(new THREE.PlaneGeometry(ARQ.X - 2, .78), new THREE.MeshStandardMaterial({ map: tf, roughness: .9, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: tf, emissiveIntensity: .3 }));
      f.position.set(sg*(ARQ.X/2 + .25), 1.58, -4.7); group.add(f);   // na grade, logo acima das placas: as cabeças da 1ª fileira ficam à mostra
      // faixas menores penduradas na frente de alguns degraus
      [['VAMOS, ' + nome + '!', 7, 12.5, 4.6], ['ATÉ O FIM!', 11, 5.5, 3.6], ['NOSSA PAIXÃO!', 15, 17, 4]].forEach(([txt, r, x, w]) => {
        const tb = tex(bannerCanvas(t, txt, 512, 84)), m = new THREE.Mesh(new THREE.PlaneGeometry(w, .7), new THREE.MeshStandardMaterial({ map: tb, roughness: .9, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: tb, emissiveIntensity: .28 }));
        m.position.set(sg*x, rowY(r) + 1.3, rowZ(r) + ARQ.prof*.5 + .45); m.rotation.x = -.18; group.add(m); });   // presa no alto, à frente da fileira: fica à mostra por cima das cabeças
    });
    // bandeirões em mastros (grandes) — balançam conforme o humor de cada lado
    flags = []; [0, 1].forEach(s => { for (let i = 0; i < 6; i++) { const t = names[s], r = 2 + (rnd()*12 | 0), x = (s ? 1 : -1)*(2.5 + i*3.8 + rnd()*1.5), y = rowY(r), z = rowZ(r);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 3.2, 5), new THREE.MeshStandardMaterial({ color: '#dddddd' })); pole.position.set(x, y + 1.6, z); group.add(pole);
      const g = new THREE.PlaneGeometry(2.1, 1.25, 10, 3); g.translate(1.05, 0, 0); const tfl = tex(flagCanvas(t)), cloth = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tfl, roughness: .9, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: tfl, emissiveIntensity: .25 }));
      cloth.position.set(x, y + 2.55, z); cloth.scale.x = s ? -1 : 1; group.add(cloth); flags.push({ g, s, base: Float32Array.from(g.attributes.position.array), p: rnd()*6 }); } });
    flares = []; [0, 1].forEach(s => [0, 1, 2, 3].forEach(i => { const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, color: names[s].c1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      const r = 1 + (i % 2)*3, d = degrau(r); o.position.set((s ? 1 : -1)*(3 + i*4.5 + rnd()*1.5), d.y + 1.4, d.z + .3); group.add(o); flares.push({ o, s, ph: rnd()*6 }); }));
  }
  const burst = s => { const t = names[s]; if (!t) return; for (let i = 0; i < 22; i++) { const r = 1 + (rnd()*9 | 0), d = degrau(r); emit((s ? 1 : -1)*(2 + rnd()*20), d.y + 1.6, d.z, rnd() < .6 ? t.c1 : t.c2, true); } };
  function update(now, dt, game) {
    cel.uT.value = now; const L = Humor.lados, festa = L.some(s => s.humor === 2 || s.humor === 5); cel.uK.value += ((festa ? 1 : L.some(s => s.humor === 1) ? .75 : .5) - cel.uK.value)*(1 - Math.exp(-2*dt));
    if (!names[0]) return; heat += ((game.fin ? 1 : game.dec ? .6 : .25) - heat)*(1 - Math.exp(-2*dt));
    flags.forEach(f => { const s = L[f.s], ag = s.humor === 2 || s.humor === 5 ? 1 : s.humor === 1 ? .35 : s.humor >= 3 ? .15 : .5, a = f.g.attributes.position, b = f.base, w = 2 + ag*3;
      for (let i = 0; i < a.count; i++) { const x = b[i*3]; a.array[i*3 + 2] = b[i*3 + 2] + Math.sin(now*w + f.p + x*2.2)*(.06 + .16*ag)*x; a.array[i*3 + 1] = b[i*3 + 1] + Math.sin(now*w*.8 + f.p)*.06*x*ag; } a.needsUpdate = true; });
    flares.forEach(f => { const k = .55*(1 + .25*Math.sin(now*9 + f.ph)); f.o.scale.set(k*2, k*2, 1); const t = names[f.s]; if (rnd() < heat*dt*4) emit(f.o.position.x, f.o.position.y, f.o.position.z, rnd() < .6 ? t.c1 : t.c2, false); });
    smoke.forEach(p => { if (p.life <= 0) return; p.life -= dt; if (p.life <= 0) { p.o.visible = false; return; } p.y += p.vy*dt; p.x += p.vx*dt; p.r += .3*dt; p.o.position.set(p.x, p.y, p.z); p.o.scale.set(p.r*2, p.r*2, 1); p.o.material.opacity = Math.max(0, p.life/3)*.36; });
  }
  return { setTeams, burst, update, smoke };
}
