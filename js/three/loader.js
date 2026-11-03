// Carregamento de modelos GLB/glTF com Three.js: valida o contrato ANTES de carregar, extrai o esqueleto de repouso, e cria instâncias
// independentes (SkeletonUtils.clone) que recebem uniforme/cores sem precisar de um modelo por time ou por jogador. NÃO TESTADO com Three.js real (ver INTEGRACAO_3D.md).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { inspect, SLOTS, OPT_SLOTS } from './glbInspect.js';
import { resolveBones, CANON } from './skeletonMap.js';
import { solvePose } from './retarget.js';
import { composeShirt, uniformColors, hairVisibility, beardVisibility, hairColors, LAYOUTS, crestImageFor } from './uniform.js';
import { setupHairMaterial } from './hairMaterial.js';
import { packMeta, packImage } from './kitPack.js';
import { faceOf } from '../face.js';
const ALL_SLOTS = { ...SLOTS, ...OPT_SLOTS }, LEG_RIG = .43 + .44;
const TEX = new WeakMap(), imgTex = img => { if (!img) return null; let t = TEX.get(img); if (!t) { t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; t.needsUpdate = true; TEX.set(img, t); } return t; };   // uma textura por imagem (calção/meião), compartilhada pelas instâncias
export async function fetchJSON(url) { try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; } }
export async function loadTemplate(url, { skeletonMap = {}, layout = LAYOUTS.wrap } = {}) {
  const res = await fetch(url); if (!res.ok) { const e = new Error(`${url}: HTTP ${res.status}`); e.status = res.status; throw e; }
  const ab = await res.arrayBuffer(), report = inspect(new Uint8Array(ab), { skeletonMap });
  if (!report.ok) { const e = new Error(`Modelo ${url} recusado:\n - ` + report.errors.join('\n - ')); e.report = report; throw e; }
  report.warnings.forEach(w => console.warn(`[${url}] ${w}`));
  const gltf = await new GLTFLoader().parseAsync(ab, url.replace(/[^/]*$/, '')), skinned = []; gltf.scene.traverse(o => { if (o.isSkinnedMesh) skinned.push(o); });
  if (!skinned.length) throw new Error(`${url}: nenhuma malha com esqueleto (SkinnedMesh) após o carregamento.`);
  neutralizeSkin(gltf.scene);
  const skeleton = skinned[0].skeleton, names = skeleton.bones.map(b => b.name), R = resolveBones(names, skeletonMap); skeleton.pose(); gltf.scene.updateMatrixWorld(true);
  const byName = new Map(skeleton.bones.map(b => [b.name, b])), rest = { bones: {}, scale: 1 }, v = new THREE.Vector3(), q = new THREE.Quaternion();
  CANON.forEach(c => { const b = byName.get(R.map[c]); if (!b) return; b.getWorldPosition(v); b.getWorldQuaternion(q); rest.bones[c] = { pos: [v.x, v.y, v.z], quat: [q.x, q.y, q.z, q.w] }; });     // pose de repouso (bind) no MUNDO
  const d = (a, b) => Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]), leg = s => d(rest.bones[s + 'UpLeg'], rest.bones[s + 'Leg']) + d(rest.bones[s + 'Leg'], rest.bones[s + 'Foot']);
  rest.scale = (leg('Left') + leg('Right'))/2/LEG_RIG;                                                                                         // proporção do modelo em relação ao rig.js
  return { url, scene: gltf.scene, animations: gltf.animations, rest, map: R.map, layout, report, shirtUV: (gltf.asset && gltf.asset.extras && gltf.asset.extras.shirtUV) || null, legUV: (gltf.asset && gltf.asset.extras && gltf.asset.extras.legUV) || null };   // shirtUV: mapa vertical gravado pelo prepare-athlete (null em GLB antigo)
}
// CLIPES feitos no Blender (tools/blender/*.py): arquivo só com esqueleto + animação, aplicado ao athlete.glb pelos NOMES dos ossos (o modelo não é reexportado).
// Os extras do nó "Armature" trazem o instante do contato (chute_contato_s) e a posição da bola no espaço do clipe. Sem o arquivo, devolve null.
export async function loadClip(url) {
  const res = await fetch(url); if (!res.ok) return null;
  const gltf = await new GLTFLoader().parseAsync(await res.arrayBuffer(), url.replace(/[^/]*$/, '')), clip = gltf.animations[0]; if (!clip) return null;
  clip.tracks = clip.tracks.filter(t => !t.name.endsWith('.scale'));                                // escala dos ossos fica a do modelo
  let ex = {}; gltf.scene.traverse(o => { if (o.userData && o.userData.chute_contato_s != null) ex = o.userData; });
  return { clip, contact: ex.chute_contato_s ?? 0, ball: ex.bola || [0, .11, 0] };
}
// A textura de pele do modelo já é morena (média ~ 0,65/0,47/0,34): multiplicada pela cor do jogador, escurecia todo mundo. Aqui ela vira neutra (mesma média em
// todos os canais, preservando os detalhes de rosto), para a cor de pele de cada jogador aparecer como na tabela. Uma vez por modelo; as instâncias compartilham a textura.
function neutralizeSkin(scene, target = .86) {
  let tex = null; scene.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (/^skin$/i.test(m.name || '') && m.map) tex = m.map; });
  const img = tex && tex.image; if (!img || typeof document === 'undefined' || tex.userData.neutral) return;
  const w = img.width, h = img.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); c.drawImage(img, 0, 0); const id = c.getImageData(0, 0, w, h), d = id.data, sum = [0, 0, 0]; let n = 0;
  for (let i = 0; i < d.length; i += 16) { if (d[i + 3] < 200) continue; sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; n++; } if (!n) return;
  const k = sum.map(v => target*255/(v/n)); for (let i = 0; i < d.length; i += 4) { d[i] = Math.min(255, d[i]*k[0]); d[i + 1] = Math.min(255, d[i + 1]*k[1]); d[i + 2] = Math.min(255, d[i + 2]*k[2]); }
  c.putImageData(id, 0, 0); tex.image = cv; tex.userData.neutral = true; tex.needsUpdate = true;
}
export function instantiate(tpl) {
  const root = SkeletonUtils.clone(tpl.scene), bones = {}, byName = {}, slots = Object.fromEntries(Object.keys(ALL_SLOTS).map(k => [k, []])), hair = [], beard = [], acc = [], hairU = { cap: [], beard: [] }, bandMats = [];
  root.traverse(o => { if (o.isBone) byName[o.name] = o; if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.name === 'HairCap' || m.name === 'Beard') { hairU[m.name === 'HairCap' ? 'cap' : 'beard'].push(setupHairMaterial(m)); return; } if (m.name === 'Band') { bandMats.push(m); return; }   // shader próprio, fora dos slots
      for (const [s, re] of Object.entries(ALL_SLOTS)) if (re.test(m.name || '')) slots[s].push(m); }); if (/^hair/i.test(o.name)) hair.push(o); else if (/^(beard|must|side)_/i.test(o.name)) beard.push(o); else if (/^acc_/i.test(o.name)) acc.push(o); } });
  CANON.forEach(c => { if (tpl.map[c]) bones[c] = byName[tpl.map[c]]; });
  const allBones = Object.values(byName), BLEND = .15;                                              // transição entre poses procedurais e clipes (s)
  const snapshot = () => { const hips = bones.Hips; hips.updateWorldMatrix(true, false); return { q: allBones.map(b => b.quaternion.clone()), p: allBones.map(b => b.position.clone()), hq: hips.getWorldQuaternion(new THREE.Quaternion()), hp: hips.getWorldPosition(new THREE.Vector3()) }; };
  const rebase = S => { const hips = bones.Hips, i = allBones.indexOf(hips); hips.parent.updateWorldMatrix(true, false); S.q[i] = hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(S.hq); S.p[i] = hips.parent.worldToLocal(S.hp.clone()); };   // o quadril no referencial novo (a raiz muda entre os modos)
  const blendFrom = (S, w) => { if (w >= 1) return; allBones.forEach((b, i) => { b.quaternion.slerpQuaternions(S.q[i], b.quaternion.clone(), w); b.position.lerpVectors(S.p[i], b.position.clone(), w); }); };
  const sm = u => { u = Math.min(1, Math.max(0, u)); return u*u*(3 - 2*u); };
  const q = new THREE.Quaternion(), pq = new THREE.Quaternion(), p = new THREE.Vector3(), api = {
    root, sig: '', shirtTex: null, hs: 1,
    apply(kit, look) {                                                                                // uniforme + aparência (só recompõe quando algo muda)
      api.last = [kit, look];
      const again = () => { api.sig = ''; if (api.last) api.apply(api.last[0], api.last[1]); }, extra = f => f ? packImage({ file: f }, again) : null;
      const meta = !kit.keeper ? packMeta(kit.key, kit.variant) : null, pimg = meta ? packImage(meta, again) : null, crImg = meta ? extra(meta.numCrest || `assets/kits/crests/${kit.key}.png`) : null, pack = pimg ? { ...meta, img: pimg, uv: tpl.shirtUV, numCrestImg: crImg } : null;
      const shImg = meta && tpl.legUV ? extra(meta.shortsFile) : null, soImg = meta && tpl.legUV ? extra(meta.socksFile) : null;   // calção/meião com textura só se o GLB tiver o UV dessas peças (tools/add-legwear-uv.mjs)   // uniforme do pack (se houver); senão, o procedural
      const F0 = look.face, sig = [kit.key || kit.c1, kit.pat, kit.sh, kit.keeper ? 1 : 0, look.nome, look.num, look.hair, look.skin, F0 ? [F0.skin, F0.hairC, F0.style, F0.beard, F0.build, F0.height, F0.mustache, F0.sideburn, F0.hairC2, F0.beardC, F0.hl, F0.hlAmt, F0.tips, F0.grey, F0.band].join(',') : '', meta ? meta.file : '', pimg ? 1 : 0, crImg ? 1 : 0, shImg ? 1 : 0, soImg ? 1 : 0].join('|'); if (sig === api.sig) return; api.sig = sig;
      const face = F0 || faceOf((look.nome || '') + (look.num ?? ''), { hair: look.hair }), col = uniformColors(kit, look, face, pack), cv = composeShirt(tpl.layout, kit, look, crestImageFor(kit.key), pack);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.flipY = false; tex.anisotropy = 4;
      slots.shirt.forEach(m => { m.map = tex; m.color.set('#ffffff'); m.needsUpdate = true; }); if (api.shirtTex) api.shirtTex.dispose(); api.shirtTex = tex;
      const legMap = { shorts: imgTex(shImg), socks: imgTex(soImg) };
      ['shorts', 'socks', 'skin', 'hair', 'boots', 'gloves', 'eyes', 'trim', 'sole'].forEach(s => slots[s].forEach(m => { if (s in legMap) { const t = legMap[s]; if (m.map !== t) { m.map = t; m.needsUpdate = true; } m.color.set(t ? '#ffffff' : col[s]); } else m.color.set(col[s]); }));
      const vis = hairVisibility(hair.map(h => h.name), face.style); hair.forEach(h => { h.visible = vis[h.name] !== false; });
      const bv = beardVisibility(beard.map(h => h.name), face.beard || 'none', face.mustache, face.sideburn); beard.forEach(h => { h.visible = bv[h.name] !== false; });
      const hc = hairColors(face), setU = (U, top, side) => { U.uTop.value.set(top); U.uSide.value.set(side); U.uSkin.value.set(hc.skin); U.uHl.value.set(hc.hl); U.uHlAmt.value = hc.hlAmt; U.uTipAmt.value = hc.tipAmt; U.uGrey.value = hc.grey; };
      hairU.cap.forEach(U => setU(U, hc.top, hc.side)); hairU.beard.forEach(U => setU(U, hc.beard, hc.beard)); acc.forEach(h => { h.visible = !!hc.band; }); bandMats.forEach(m => m.color.set(hc.band || '#ffffff'));
      api.hs = face.height || 1; const wd = (face.build || 1)*api.hs; root.scale.set(wd, api.hs, wd);                // altura e largura individuais (os pés continuam no chão: ver pose)
    },
    playClip(ci, t, pos, yaw) {                                                                       // toca um clipe do Blender no instante t (s) com o personagem posto em pos, virado yaw
      if (!api.mixer) api.mixer = new THREE.AnimationMixer(root);
      const a = api.mixer.clipAction(ci.clip); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.enabled = true; a.paused = false; a.setEffectiveWeight(1); if (!a.isScheduled()) a.play();
      let S = null; if (!api.clipOn && api.posed) S = snapshot();                                       // entrando no clipe: guarda a pose procedural para a transição
      root.position.set(pos[0], pos[1], pos[2]); root.rotation.set(0, yaw, 0); api.mixer.setTime(Math.max(0, Math.min(ci.clip.duration - 1e-4, t)));
      if (S) { rebase(S); api.into = { S, t0: t }; } api.clipOn = true; api.blendOut = null;
      if (api.into) { if (t < api.into.t0) api.into = null; else { blendFrom(api.into.S, sm((t - api.into.t0)/BLEND)); if (t - api.into.t0 >= BLEND) api.into = null; } }
    },
    pose(J) {                                                                                         // aplica a pose do rig.js: quaternions de mundo → locais, de pai para filho
      if (api.clipOn) { const S = snapshot(); root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); rebase(S); api.blendOut = { S, t0: performance.now() }; api.clipOn = false; api.into = null; }   // saindo de um clipe: a pose procedural trabalha no espaço do mundo; transição de BLEND s
      const sol = solvePose(tpl.rest, J);
      CANON.forEach(c => { const b = bones[c], W = sol.world[c]; if (!b || !W) return; b.parent.updateWorldMatrix(true, false); b.parent.getWorldQuaternion(pq); q.set(W[0], W[1], W[2], W[3]); b.quaternion.copy(pq.invert().multiply(q));
        if (c === 'Hips') { b.parent.updateWorldMatrix(true, false); p.set(sol.hips[0], sol.hips[1]*(api.hs || 1), sol.hips[2]); b.parent.worldToLocal(p); b.position.copy(p); } b.updateMatrix(); });
      if (api.blendOut) { const u = (performance.now() - api.blendOut.t0)/1000/BLEND; blendFrom(api.blendOut.S, sm(u)); if (u >= 1) api.blendOut = null; }
      api.posed = true;
    },
    dispose() { if (api.shirtTex) api.shirtTex.dispose(); }
  };
  return api;
}
