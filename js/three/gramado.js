// GRAMADO do motor 3D: textura procedural de grama (gerada UMA vez no Canvas, sem imagens externas), faixas de corte suaves, relevo (normal map),
// variação de cor, desgaste na marca do pênalti e na pequena área, linhas brancas como geometria pintada sobre a grama (sem z-fighting) e sombras
// de contato sob os pés dos jogadores e sob a bola. Só o chão: jogadores, bola, traves, torcida, câmera e física não são alterados.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPOT_Z } from '../rig.js';
const tela = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const sorteio = s => () => (s = (s*16807) % 2147483647)/2147483647;                  // aleatório com semente: o gramado sai sempre igual
export const CAMPO = { lado: 80, z0: -4, faixa: 5 };                                    // plano 80x80 m cobrindo z ∈ [-4, 76]; faixas de corte de 5 m
export const LINHA = .12;                                                               // largura das linhas (regra: até 12 cm)

// 1) DETALHE: folhas de grama (512 px, sem emenda) — cor em torno de cinza médio (multiplica a cor do campo) + altura para o relevo
function detalhe() {
  const N = 512, c = tela(N, N), g = c.getContext('2d'), r = sorteio(7), h = tela(N, N), gh = h.getContext('2d');
  g.fillStyle = '#7f7f7f'; g.fillRect(0, 0, N, N); gh.fillStyle = '#404040'; gh.fillRect(0, 0, N, N);
  const folha = (ctx, x, y, a, l, w, cor) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { const x0 = x + dx, y0 = y + dy; if (x0 < -l || x0 > N + l || y0 < -l || y0 > N + l) continue;
    ctx.strokeStyle = cor; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + Math.cos(a)*l*.5 + (r() - .5)*2, y0 + Math.sin(a)*l*.5, x0 + Math.cos(a)*l, y0 + Math.sin(a)*l); ctx.stroke(); } };
  for (let i = 0; i < 2600; i++) { const v = 70 + r()*30; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r()*N, r()*N, 1 + r()*3, 1 + r()*3); }      // terra/raiz entre as folhas
  for (let i = 0; i < 9000; i++) {                                                    // folhas cortadas: curtas, quase na mesma direção (o corte deita a grama)
    const x = r()*N, y = r()*N, a = -Math.PI/2 + (r() - .5)*1.1, l = 5 + r()*9, w = .8 + r()*1.4, v = 95 + r()*95, t = r();
    folha(g, x, y, a, l, w, `rgba(${v*(.92 + t*.1)|0},${v|0},${v*(.85 + t*.12)|0},${.55 + r()*.45})`); const hv = 90 + r()*165; folha(gh, x, y, a, l, w, `rgba(${hv|0},${hv|0},${hv|0},.8)`); }
  for (let i = 0; i < 1400; i++) { const v = 150 + r()*90; g.fillStyle = `rgba(${v},${v},${v*.9},.5)`; g.fillRect(r()*N, r()*N, 1, 1.5); }          // pontas iluminadas
  // relevo: normal map a partir da altura (Sobel), com emenda contínua
  const H = gh.getImageData(0, 0, N, N).data, nm = tela(N, N), gn = nm.getContext('2d'), out = gn.createImageData(N, N), at = (x, y) => H[(((y + N) % N)*N + (x + N) % N)*4]/255;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = (at(x + 1, y) - at(x - 1, y))*2.2, dy = (at(x, y + 1) - at(x, y - 1))*2.2, l = Math.hypot(dx, dy, 1), o = (y*N + x)*4;
    out.data[o] = (-dx/l*.5 + .5)*255; out.data[o + 1] = (dy/l*.5 + .5)*255; out.data[o + 2] = (1/l*.5 + .5)*255; out.data[o + 3] = 255; }
  gn.putImageData(out, 0, 0);
  const tx = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.NoColorSpace; return t; };
  return { cor: tx(c, true), normal: tx(nm, false) };
}
// 2) CAMPO (80x80 m): faixas de corte com transição suave, manchas de cor e desgaste na marca do pênalti e na pequena área (sem as linhas)
function campo() {
  const S = 1024, c = tela(S, S), g = c.getContext('2d'), r = sorteio(11), Z = z => (z - CAMPO.z0)/CAMPO.lado*S, X = x => (x + CAMPO.lado/2)/CAMPO.lado*S, px = S/CAMPO.lado;
  const claro = [66, 156, 72], escuro = [45, 117, 54], n = CAMPO.lado/CAMPO.faixa;
  for (let i = 0; i < n; i++) { const y0 = i*CAMPO.faixa*px, h = CAMPO.faixa*px, a = i % 2 ? claro : escuro, b = i % 2 ? escuro : claro, gr = g.createLinearGradient(0, y0, 0, y0 + h);
    gr.addColorStop(0, `rgb(${a.map((v, k) => (v + b[k])/2).join()})`); gr.addColorStop(.07, `rgb(${a.join()})`); gr.addColorStop(.93, `rgb(${a.join()})`); gr.addColorStop(1, `rgb(${a.map((v, k) => (v + b[k])/2).join()})`);
    g.fillStyle = gr; g.fillRect(0, y0, S, h + 1); }
  const mancha = (x, z, raio, cor, al) => { const gr = g.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), raio*px); gr.addColorStop(0, `rgba(${cor},${al})`); gr.addColorStop(1, `rgba(${cor},0)`); g.fillStyle = gr; g.fillRect(X(x) - raio*px, Z(z) - raio*px, raio*px*2, raio*px*2); };
  for (let i = 0; i < 160; i++) mancha((r() - .5)*80, CAMPO.z0 + r()*80, 1.5 + r()*5, r() < .5 ? '28,82,38' : '78,140,70', .05 + r()*.07);          // irregularidades naturais
  for (let i = 0; i < 40; i++) mancha((r() - .5)*80, CAMPO.z0 + r()*80, .8 + r()*2, '120,130,60', .04 + r()*.05);                                   // pontos mais secos
  mancha(0, SPOT_Z, 1.3, '128,120,72', .45); mancha(0, SPOT_Z + .6, 2.2, '104,120,62', .25);                                                           // marca do pênalti: grama gasta
  for (let x = -2.6; x <= 2.6; x += .65) mancha(x + (r() - .5)*.4, .7 + r()*.6, 1.1, '120,116,70', .22);                                              // pequena área: onde o goleiro pisa
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// 3) LINHAS: faixas de 12 cm como geometria (um só draw call), pintadas sobre a grama — posições e dimensões de sempre
function linhas() {
  const gs = [], w = LINHA, y = 0;
  const reta = (x0, z0, x1, z1) => { const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), p = new THREE.PlaneGeometry(L + w, w); p.rotateX(-Math.PI/2); p.rotateY(-Math.atan2(dz, dx)); p.translate((x0 + x1)/2, y, (z0 + z1)/2); gs.push(p); };
  const ret = (x0, z0, x1, z1) => { reta(x0, z0, x1, z0); reta(x0, z1, x1, z1); reta(x0, z0, x0, z1); reta(x1, z0, x1, z1); };
  ret(-34, 0, 34, 64); ret(-20.16, 0, 20.16, 16.5); ret(-9.16, 0, 9.16, 5.5);
  const arco = new THREE.RingGeometry(9.15 - w/2, 9.15 + w/2, 48, 1, Math.PI + .62, Math.PI - 1.24); arco.rotateX(-Math.PI/2); arco.translate(0, y, SPOT_Z); gs.push(arco);   // a meia-lua fora da grande área (virada para cima)
  const marca = new THREE.CircleGeometry(.11, 24); marca.rotateX(-Math.PI/2); marca.translate(0, y, SPOT_Z); gs.push(marca);
  return mergeGeometries(gs.map(g => g.toNonIndexed ? (g.index ? g.toNonIndexed() : g) : g));
}
// shader: detalhe da grama em 2 escalas (sem repetição visível), mais suave de longe; faixas de corte que clareiam/escurecem com o ângulo de visão
function grama(mat, det, { faixas = true, forca = 1 } = {}) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uDet = { value: det }; sh.uniforms.uForca = { value: forca };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMundo;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vMundo;\nuniform sampler2D uDet;\nuniform float uForca;').replace('#include <map_fragment>', `#include <map_fragment>
      vec2 pw = vMundo.xz; float dist = length(vMundo - cameraPosition);
      vec3 d1 = texture2D(uDet, pw / 1.25).rgb, d2 = texture2D(uDet, pw / 3.7 + vec2(.37, .61)).rgb, d3 = texture2D(uDet, pw / 11.0 + vec2(.13, .29)).rgb;
      vec3 det = (d1*.55 + d2*.3 + d3*.15) * 2.0 / 1.0;
      det = mix(det, vec3(dot(det, vec3(.333))), .15);
      float perto = 1.0 - smoothstep(8.0, 55.0, dist);
      diffuseColor.rgb *= mix(vec3(1.0), det, uForca * (.45 + .55*perto));
      ${faixas ? `float lado = smoothstep(-.35, .35, sin(3.14159265 * (vMundo.z - ${CAMPO.z0.toFixed(1)}) / ${CAMPO.faixa.toFixed(1)}));
      vec3 vd = normalize(vMundo - cameraPosition);
      diffuseColor.rgb *= 1.0 + (lado*2.0 - 1.0) * .11 * clamp(-vd.z*1.4, -1.0, 1.0);` : ''}`);
  };
  mat.customProgramCacheKey = () => 'grama' + (faixas ? 1 : 0);
}
// 4) SOMBRA DE CONTATO: manchas suaves sob os pés (somem quando o pé sobe), sob o corpo (goleiro no chão) e sob a bola
function contato(scene) {
  const c = tela(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.45, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c), geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI/2), pool = [];
  const pega = i => { if (!pool[i]) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 })); m.renderOrder = 2; scene.add(m); pool[i] = m; } return pool[i]; };
  // pés e quadril: nomes Mixamo (LeftFoot, LeftToeBase, Hips) ou Unreal (foot_l, ball_l, pelvis)
  const pos = new THREE.Vector3(), ossos = new WeakMap();
  const pes = root => { let o = ossos.get(root); if (!o) { o = { pes: [], quadril: null }; root.traverse(b => { if (!b.isBone) return; if (/(Left|Right)(Foot|ToeBase)$|(^|[:_])(foot|ball)_[lr]$/.test(b.name)) o.pes.push(b); else if (/Hips$|(^|[:_])pelvis$/.test(b.name) && !o.quadril) o.quadril = b; }); ossos.set(root, o); } return o; };
  const poe = (i, x, z, sx, sz, op) => { const m = pega(i); m.visible = op > .01; m.position.set(x, .006, z); m.scale.set(sx, 1, sz); m.material.opacity = op; };
  return (corpos, bola, bolaVisivel, raio) => { let n = 0;
    for (const root of corpos) { root.updateMatrixWorld(true); const o = pes(root);
      for (const b of o.pes) { b.getWorldPosition(pos); const al = Math.max(0, pos.y - .06), op = .5*Math.max(0, 1 - al/.35); poe(n++, pos.x, pos.z, .34 + al*.6, .42 + al*.6, op); }
      if (o.quadril) { o.quadril.getWorldPosition(pos); const op = .26*Math.max(0, 1 - pos.y/1.25) + .1; poe(n++, pos.x, pos.z, 1.0, 1.0, Math.min(.36, op)); } }
    if (bolaVisivel) { const al = Math.max(0, bola.y - raio), op = .62*Math.max(0, 1 - al/1.4); poe(n++, bola.x, bola.z, raio*3.4 + al*.5, raio*3.4 + al*.5, op); }
    for (let i = n; i < pool.length; i++) pool[i].visible = false; };
}
export function criaGramado(scene) {
  const det = detalhe();
  const mat = new THREE.MeshStandardMaterial({ map: campo(), roughness: .9, normalMap: det.normal, normalScale: new THREE.Vector2(.55, .55) });
  det.normal.repeat.set(CAMPO.lado/1.25, CAMPO.lado/1.25); grama(mat, det.cor);
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(CAMPO.lado, CAMPO.lado), mat); pitch.rotation.x = -Math.PI/2; pitch.position.set(0, 0, CAMPO.z0 + CAMPO.lado/2); pitch.receiveShadow = true; scene.add(pitch);
  const lmat = new THREE.MeshStandardMaterial({ color: '#eceff1', roughness: .85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); grama(lmat, det.cor, { faixas: true, forca: .3 });
  const lin = new THREE.Mesh(linhas(), lmat); lin.receiveShadow = true; lin.renderOrder = 1; scene.add(lin);
  return { pitch, linhas: lin, contato: contato(scene) };
}
