// SETA DA MIRA 3D (mecânica do FIFA 17): uma seta de verdade — contorno extrudado com espessura e chanfro, material com luz (MeshStandardMaterial) —
// deitada no gramado logo à frente da bola, girando para a direção da mira. Apertando o chute, a seta se PREENCHE da base até a ponta (verde → amarelo
// → laranja conforme a força) e a ponta SOBE: a seta gira em torno da base (inclinação = altura do chute). A parte ainda vazia fica branca translúcida.
// Uma malha só; por quadro mudam o giro, a inclinação e dois uniforms (preenchimento e opacidade). Nada é recriado.
import * as THREE from 'three';
import { GOAL_W, BALL0 } from '../rig.js';
import { MIRA_CFG } from '../aim.js';
export function criaSetaMira(scene) {
  const { comprimento: L, largura: W, ponta: P, espessura: E } = MIRA_CFG, haste = L - P;
  // contorno no plano XY (x = através, y = ao longo): haste com a base arredondada e ponta triangular bem definida
  const s = new THREE.Shape(); s.moveTo(-W/2, W/2); s.absarc(0, W/2, W/2, Math.PI, 2*Math.PI, false); s.lineTo(W/2, haste); s.lineTo(W*1.25, haste); s.lineTo(0, L); s.lineTo(-W*1.25, haste); s.lineTo(-W/2, haste); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: E, bevelEnabled: true, bevelThickness: E*.35, bevelSize: E*.35, bevelSegments: 2, curveSegments: 10 });
  g.rotateX(-Math.PI/2);                         // deita no gramado: ao longo → -z (para o gol), espessura → +y
  g.translate(0, E*.35, 0);                      // a face de baixo encosta no chão (o chanfro também)
  { const p = g.attributes.position, al = new Float32Array(p.count); for (let i = 0; i < p.count; i++) al[i] = Math.min(1, Math.max(0, -p.getZ(i)/L)); g.setAttribute('aAo', new THREE.BufferAttribute(al, 1)); }
  g.computeVertexNormals();
  const u = { uFill: { value: 0 }, uAlpha: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5, metalness: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aAo;\nvarying float vAo;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvAo = aAo;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uFill, uAlpha; varying float vAo;
vec3 gradForca(float a) { vec3 g = vec3(.24, .84, .2), y = vec3(1., .84, .1), o = vec3(1., .42, .06); return a < .5 ? mix(g, y, a*2.) : mix(y, o, (a - .5)*2.); }`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `float cheio = 1. - smoothstep(uFill - .012, uFill + .012, vAo);
vec3 corSeta = mix(vec3(.96), gradForca(vAo), cheio);
vec4 diffuseColor = vec4(corSeta, mix(.5, .97, cheio)*uAlpha);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += corSeta*mix(.18, .42, cheio);');
  };
  mat.customProgramCacheKey = () => 'setaMira3d';
  const malha = new THREE.Mesh(g, mat); malha.renderOrder = 5; malha.castShadow = false; malha.receiveShadow = false;
  const pivo = new THREE.Group(); pivo.add(malha); pivo.visible = false; scene.add(pivo);
  let alpha = 0, incl = MIRA_CFG.inclMin;
  // game: o Game (js/game.js). A seta só existe com game.miraVisivel() — o estado verdadeiro da cobrança, nunca um temporizador.
  function update(game, dt) {
    const quer = !!game.miraVisivel?.(); alpha = quer ? Math.min(1, alpha + dt*6) : 0;   // aparece em ~0,17 s; some na hora (soltou = chute)
    pivo.visible = alpha > 0; if (!pivo.visible) { incl = MIRA_CFG.inclMin; return; }
    const a = game.aim, tx = (a.x - .5)*GOAL_W, ang = Math.atan2(-tx, BALL0[2]), ini = .24;
    pivo.rotation.y = ang; pivo.position.set(BALL0[0] - Math.sin(ang)*ini, .004, BALL0[2] - Math.cos(ang)*ini);   // base ancorada logo à frente da bola
    incl += (a.inclinacao - incl)*(1 - Math.exp(-dt*22));                                                          // sobe junto com a carga, sem tremer
    malha.rotation.x = THREE.MathUtils.degToRad(incl);                                                             // gira em torno da BASE: só a ponta sobe
    u.uFill.value = a.hold ? a.forca : 0; u.uAlpha.value = alpha;
  }
  return { update, malha, pivo, uniforms: u };
}
