// Shader do cabelo/barba (materiais HairCap e Beard do athlete.glb): lê o atributo _hair = [cobertura, tom, u, v] gravado por tools/hair-geometry.mjs.
// - cobertura mistura a PELE (a textura de pele, amostrada pelo UV do ponto mais próximo, × cor de pele do jogador) com o cabelo: degradê pontilhado, linha do cabelo e barba rala.
// - tom escolhe entre a cor da lateral/raiz e a do topo/pontas (platinado com lateral escura, mechas, pontas descoloridas, grisalho salpicado).
// - u, v amostram uma textura de fios gerada aqui (sem arquivo externo), compartilhada por todos os jogadores.
import * as THREE from 'three';
let STRAND = null;
// Textura 256×256 em repetição: R = fios (variação por coluna, esticada ao longo de v), G = mechas (manchas grandes), B = pontilhado fino (degradê, barba por fazer).
export function strandTexture() {
  if (STRAND) return STRAND; const N = 256, d = new Uint8Array(N*N*4), hash = (a, b) => { let h = (a*374761393 + b*668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0)/4294967296; };
  const vn = (x, y, p) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx*fx*(3 - 2*fx), v = fy*fy*(3 - 2*fy), P = i => ((i % p) + p) % p; const a = hash(P(xi), P(yi)), b = hash(P(xi + 1), P(yi)), c = hash(P(xi), P(yi + 1)), e = hash(P(xi + 1), P(yi + 1)); return a + (b - a)*u + (c - a)*v + (a - b - c + e)*u*v; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y*N + x)*4, col = x/N*64;
    const strand = .55*vn(col, y/N*3, 64) + .3*vn(col*2.1, y/N*5, 128) + .15*vn(x/N*16, y/N*16, 16), clump = vn(x/N*6, y/N*3, 6)*.7 + vn(x/N*12, y/N*6, 12)*.3, dots = vn(x/N*48, y/N*48, 48)*.6 + hash(x, y)*.4;
    d[i] = strand*255; d[i + 1] = clump*255; d[i + 2] = dots*255; d[i + 3] = 255; }
  STRAND = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); STRAND.wrapS = STRAND.wrapT = THREE.RepeatWrapping; STRAND.magFilter = THREE.LinearFilter; STRAND.minFilter = THREE.LinearMipmapLinearFilter; STRAND.generateMipmaps = true; STRAND.anisotropy = 4; STRAND.needsUpdate = true;
  return STRAND;
}
// Prepara um material (já clonado por instância) para o shader; devolve os uniforms que o loader atualiza em apply().
export function setupHairMaterial(m) {
  if (m.userData.hairU) return m.userData.hairU;
  const U = { uTop: { value: new THREE.Color('#2b1d12') }, uSide: { value: new THREE.Color('#1f150d') }, uSkin: { value: new THREE.Color('#c68642') }, uHl: { value: new THREE.Color('#e8d9b0') },
    uHlAmt: { value: 0 }, uTipAmt: { value: 0 }, uGrey: { value: 0 }, uStrand: { value: strandTexture() } };
  m.userData.hairU = U; m.polygonOffset = true; m.polygonOffsetFactor = -3; m.polygonOffsetUnits = -6; m.color.set('#ffffff');
  m.customProgramCacheKey = () => 'hair-v1';
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 _hair;\nvarying vec4 vHair;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHair = _hair;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vHair;\nuniform vec3 uTop, uSide, uSkin, uHl;\nuniform float uHlAmt, uTipAmt, uGrey;\nuniform sampler2D uStrand;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec4 sN = texture2D(uStrand, vHair.zw * 0.125);
        float tone = clamp(vHair.y + (sN.g - 0.5) * 0.3, 0.0, 1.0);
        vec3 hc = mix(uSide, uTop, smoothstep(0.2, 0.75, tone));
        hc = mix(hc, uHl, uHlAmt * smoothstep(0.58, 0.7, sN.r) * smoothstep(0.35, 0.6, sN.g) * smoothstep(0.35, 0.8, vHair.y));                 // mechas
        hc = mix(hc, uHl, uTipAmt * smoothstep(0.45, 0.85, sN.r * 0.45 + vHair.y * 0.65));                         // pontas descoloridas
        hc = mix(hc, vec3(0.5, 0.49, 0.47), uGrey * smoothstep(0.4, 0.8, sN.b) * (0.6 + 0.4 * sN.r));                               // grisalho salpicado
        hc *= (0.48 + 0.8 * sN.r) * (0.82 + 0.36 * sN.g);                                                                                 // fios
        float w = vHair.x, cov = clamp(w + (sN.b - 0.5) * 3.2 * w * (1.0 - w), 0.0, 1.0); cov = smoothstep(0.12, 0.85, cov);
        vec3 skinC = diffuseColor.rgb * uSkin * mix(1.0, 0.82, smoothstep(0.0, 0.35, w));                       // pele (com a sombra do pelo raspado)
        diffuseColor.rgb = mix(skinC, hc, cov);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.82, 0.62 + 0.3 * (1.0 - sN.r), cov);'); };
  m.needsUpdate = true; return U;
}
