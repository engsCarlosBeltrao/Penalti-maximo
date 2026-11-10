// PLACAS DE LED atrás do gol: uma faixa contínua de ponta a ponta (como nos estádios), com a arte do patrocinador na altura inteira, repetida lado a
// lado sobre a cor de fundo dela. A faixa corre devagar (só o deslocamento da textura: custo zero), troca de patrocinador a cada `duration` s com a
// arte nova subindo e empurrando a anterior, e tem os pontinhos de LED acesos (brilho próprio, fora do tone mapping). No GOL e na DEFESA a placa
// inteira vira a comemoração nas cores do time por alguns segundos. A imagem só é redesenhada na troca, na comemoração e quando uma arte termina de carregar.
import * as THREE from 'three';
import { Ads } from '../advertising.js';
import { Events } from '../events.js';
import { GS } from '../gameState.js';
const LARG = 42, ALT = .9, W = 2048, H = 128, M_POR_TELA = W*ALT/H;      // a textura cobre 14,4 m e se repete ao longo da faixa
const lum = h => { const n = parseInt(String(h).slice(1), 16); return (.3*(n >> 16) + .59*(n >> 8 & 255) + .11*(n & 255))/255; };
export function criaPlacasLed(scene) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(LARG/M_POR_TELA, 1); tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  mat.onBeforeCompile = sh => {                                                       // pontinhos de LED (somem com a distância para não fazer moiré)
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec2 px = vMapUv*vec2(${W}.0, ${H}.0)/2.0, cel = fract(px) - .5; float led = smoothstep(.5, .28, length(cel)), longe = clamp(max(fwidth(px.x), fwidth(px.y))*1.2, 0., 1.);
      diffuseColor.rgb *= mix(.5 + .75*led, .9, longe)*1.12;`); };
  mat.customProgramCacheKey = () => 'placaLed';
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(LARG, ALT), mat); tela.position.set(0, .55, -3.6); scene.add(tela);
  const base = new THREE.Mesh(new THREE.BoxGeometry(LARG + .2, 1.0, .25), new THREE.MeshStandardMaterial({ color: '#15181d', roughness: .8 })); base.position.set(0, .5, -3.74); scene.add(base);
  // fundo de cada arte: a cor do canto da própria imagem (casa com a arte); sem imagem, a cor da lista
  const fundo = {}; const corDe = (ad, im) => { if (fundo[ad.id]) return fundo[ad.id]; if (!im) return ad.backgroundColor;
    try { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.drawImage(im, 6, 6, 1, 1, 0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; fundo[ad.id] = `rgb(${d[0]},${d[1]},${d[2]})`; } catch { fundo[ad.id] = ad.backgroundColor; }
    return fundo[ad.id]; };
  // uma tela inteira (W×H) com o patrocinador, deslocada dy pixels para cima (a troca empurra uma tela pela outra)
  function desenhaAd(ad, dy) {
    const im = Ads.imagem(ad); g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip(); g.fillStyle = corDe(ad, im); g.fillRect(0, -dy, W, H);
    if (im) { const ah = H - 6, aw = ah*im.naturalWidth/im.naturalHeight, n = Math.max(1, Math.floor(W/(aw*1.12))), slot = W/n;   // n cópias inteiras: emenda sem costura
      for (let i = 0; i < n; i++) g.drawImage(im, i*slot + (slot - aw)/2, 3 - dy, aw, ah); }
    else { g.fillStyle = ad.textColor; g.font = `900 ${H*.5}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; for (let i = 0; i < 4; i++) g.fillText(ad.sponsor.toUpperCase(), (i + .5)*W/4, H/2 - dy); }
    g.restore();
  }
  // comemoração na placa: GOOOL! / QUE DEFESA! nas cores do time, piscando
  let festa = null;
  const comemora = (q, texto) => { const t = GS.equipes?.[q]; if (t) festa = { ate: performance.now()/1000 + 4.5, t, texto }; };
  Events.on('gol', e => comemora(e.equipe, 'GOOOL!'));
  Events.on('defesa', e => comemora(1 - e.equipe, 'QUE DEFESA!'));
  Events.on('partida_iniciada', () => { festa = null; });
  function desenhaFesta(now) {
    const { t, texto } = festa, pisca = Math.floor(now*4) % 2, c1 = t.c1 || '#ffe66d', c2 = t.c2 || '#111111', fundoC = pisca ? c1 : c2, letra = pisca ? (lum(c1) > .55 ? '#111' : '#fff') : (lum(c2) > .55 ? '#111' : '#fff');
    g.fillStyle = fundoC; g.fillRect(0, 0, W, H); g.fillStyle = letra; g.font = `italic 900 ${H*.62}px Arial`; g.textBaseline = 'middle'; g.textAlign = 'center';
    const bloco = `${texto}  ${String(t.nome || '').toUpperCase()}`; for (let i = 0; i < 2; i++) g.fillText(bloco, (i + .5)*W/2, H*.54);
  }
  let chave = '';
  function update(now) {
    tex.offset.x = (now*.32/M_POR_TELA) % 1;                                          // a faixa corre devagar para a esquerda
    if (festa && now < festa.ate) { desenhaFesta(now); tex.needsUpdate = true; chave = 'festa'; return; }
    festa = null;
    const r = Ads.current('main', now); if (!r) return;
    const k = `${r.ad.id}|${r.tp < 1 ? Math.round(r.tp*40) : 'ok'}|${!!Ads.imagem(r.ad)}|${!!Ads.imagem(r.ant)}`; if (k === chave) return; chave = k;
    if (r.tp < 1) { const e = 1 - Math.pow(1 - r.tp, 3), dy = Math.round(e*H); desenhaAd(r.ant, dy); desenhaAd(r.ad, dy - H); }   // a nova sobe e empurra a anterior
    else desenhaAd(r.ad, 0);
    tex.needsUpdate = true;
  }
  return { update, tela, textura: tex };
}
