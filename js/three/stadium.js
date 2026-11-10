// Estádio do motor 3D: gramado, gol com rede deformável, bola, placas de publicidade, arquibancada e torcida em sprites.
// Faixas, bandeiras, sinalizadores, fumaça e refletores ficam em stadiumFx.js.
import * as THREE from 'three';
import { criaPlacasLed } from './placasLed.js';
import { BALL_R } from '../rig.js';
import { criaGramado } from './gramado.js';
import { criaGol } from './gol.js';
import { criaArquibancada } from './arquibancada.js';   // gramado: textura de grama, faixas de corte, linhas e sombras de contato
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function ballTexture() {
  const c = canvas(512, 256), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#1d4fa6'; [[80, 60], [210, 100], [340, 60], [470, 110], [140, 190], [290, 200], [420, 190]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 34, 0, 7); g.fill(); });
  g.strokeStyle = '#19a35a'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 130); g.bezierCurveTo(130, 90, 300, 170, 512, 120); g.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function buildStadium(scene) {
  scene.background = new THREE.Color('#050914'); scene.fog = new THREE.Fog('#0a1226', 60, 160);
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x1a3a1a, .85)); const sun = new THREE.DirectionalLight(0xffffff, 1.25); sun.position.set(-8, 24, 18); sun.target.position.set(0, 0, 8); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 }); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; scene.add(sun, sun.target);
  const gramado = criaGramado(scene); sun.shadow.normalBias = .02;   // relevo da grama sem 'acne' de sombra
  // gol: traves de metal pintado e rede 3D com movimento (js/three/gol.js)
  const rede = criaGol(scene);
  // bola
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 28, 18), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: .55 })); ball.castShadow = true; scene.add(ball);
  // placas de LED atrás do gol com os patrocinadores (js/three/placasLed.js + js/advertising.js)
  const placas = criaPlacasLed(scene), updateBoards = now => placas.update(now);
  // arquibancada coberta atrás do gol + torcida (js/three/arquibancada.js)
  const arq = criaArquibancada(scene), buildCrowd = arq.buildCrowd, updateCrowd = arq.updateCrowd;   // arquibancada lotada sem cobertura + torcida 3D
  return { ball, rede, updateBoards, buildCrowd, updateCrowd, arq, contato: gramado.contato };
}
