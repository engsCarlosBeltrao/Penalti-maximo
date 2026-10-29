// Carregamento de modelos GLB/glTF com Three.js: valida o contrato ANTES de carregar, extrai o esqueleto de repouso, e cria instâncias
// independentes (SkeletonUtils.clone) que recebem uniforme/cores sem precisar de um modelo por time ou por jogador. NÃO TESTADO com Three.js real (ver INTEGRACAO_3D.md).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { inspect, SLOTS, OPT_SLOTS } from './glbInspect.js';
import { resolveBones, CANON } from './skeletonMap.js';
import { solvePose } from './retarget.js';
import { composeShirt, uniformColors, hairVisibility, beardVisibility, LAYOUTS, crestImageFor } from './uniform.js';
import { packMeta, packImage } from './kitPack.js';
import { faceOf } from '../athlete.js';
const ALL_SLOTS = { ...SLOTS, ...OPT_SLOTS }, LEG_RIG = .43 + .44;
export async function fetchJSON(url) { try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; } }
export async function loadTemplate(url, { skeletonMap = {}, layout = LAYOUTS.wrap } = {}) {
  const res = await fetch(url); if (!res.ok) { const e = new Error(`${url}: HTTP ${res.status}`); e.status = res.status; throw e; }
  const ab = await res.arrayBuffer(), report = inspect(new Uint8Array(ab), { skeletonMap });
  if (!report.ok) { const e = new Error(`Modelo ${url} recusado:\n - ` + report.errors.join('\n - ')); e.report = report; throw e; }
  report.warnings.forEach(w => console.warn(`[${url}] ${w}`));
  const gltf = await new GLTFLoader().parseAsync(ab, url.replace(/[^/]*$/, '')), skinned = []; gltf.scene.traverse(o => { if (o.isSkinnedMesh) skinned.push(o); });
  if (!skinned.length) throw new Error(`${url}: nenhuma malha com esqueleto (SkinnedMesh) após o carregamento.`);
  const skeleton = skinned[0].skeleton, names = skeleton.bones.map(b => b.name), R = resolveBones(names, skeletonMap); skeleton.pose(); gltf.scene.updateMatrixWorld(true);
  const byName = new Map(skeleton.bones.map(b => [b.name, b])), rest = { bones: {}, scale: 1 }, v = new THREE.Vector3(), q = new THREE.Quaternion();
  CANON.forEach(c => { const b = byName.get(R.map[c]); if (!b) return; b.getWorldPosition(v); b.getWorldQuaternion(q); rest.bones[c] = { pos: [v.x, v.y, v.z], quat: [q.x, q.y, q.z, q.w] }; });     // pose de repouso (bind) no MUNDO
  const d = (a, b) => Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]), leg = s => d(rest.bones[s + 'UpLeg'], rest.bones[s + 'Leg']) + d(rest.bones[s + 'Leg'], rest.bones[s + 'Foot']);
  rest.scale = (leg('Left') + leg('Right'))/2/LEG_RIG;                                                                                         // proporção do modelo em relação ao rig.js
  return { url, scene: gltf.scene, animations: gltf.animations, rest, map: R.map, layout, report, shirtUV: (gltf.asset && gltf.asset.extras && gltf.asset.extras.shirtUV) || null };   // shirtUV: mapa vertical gravado pelo prepare-athlete (null em GLB antigo)
}
export function instantiate(tpl) {
  const root = SkeletonUtils.clone(tpl.scene), bones = {}, byName = {}, slots = Object.fromEntries(Object.keys(ALL_SLOTS).map(k => [k, []])), hair = [], beard = [];
  root.traverse(o => { if (o.isBone) byName[o.name] = o; if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { for (const [s, re] of Object.entries(ALL_SLOTS)) if (re.test(m.name || '')) slots[s].push(m); }); if (/^hair/i.test(o.name)) hair.push(o); else if (/^beard/i.test(o.name)) beard.push(o); } });
  CANON.forEach(c => { if (tpl.map[c]) bones[c] = byName[tpl.map[c]]; });
  const q = new THREE.Quaternion(), pq = new THREE.Quaternion(), p = new THREE.Vector3(), api = {
    root, sig: '', shirtTex: null, hs: 1,
    apply(kit, look) {                                                                                // uniforme + aparência (só recompõe quando algo muda)
      api.last = [kit, look];
      const meta = !kit.keeper ? packMeta(kit.key, kit.variant) : null, pimg = meta ? packImage(meta, () => { api.sig = ''; if (api.last) api.apply(api.last[0], api.last[1]); }) : null, pack = pimg ? { ...meta, img: pimg, uv: tpl.shirtUV } : null;   // uniforme do pack (se houver); senão, o procedural
      const F0 = look.face, sig = [kit.key || kit.c1, kit.pat, kit.sh, kit.keeper ? 1 : 0, look.nome, look.num, look.hair, look.skin, F0 ? [F0.skin, F0.hairC, F0.style, F0.beard, F0.build, F0.height].join(',') : '', meta ? meta.file : '', pimg ? 1 : 0].join('|'); if (sig === api.sig) return; api.sig = sig;
      const face = F0 || faceOf((look.nome || '') + (look.num ?? ''), { hair: look.hair }), col = uniformColors(kit, look, face, pack), cv = composeShirt(tpl.layout, kit, look, crestImageFor(kit.key), pack);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.flipY = false; tex.anisotropy = 4;
      slots.shirt.forEach(m => { m.map = tex; m.color.set('#ffffff'); m.needsUpdate = true; }); if (api.shirtTex) api.shirtTex.dispose(); api.shirtTex = tex;
      ['shorts', 'socks', 'skin', 'hair', 'boots', 'gloves', 'eyes', 'trim', 'sole'].forEach(s => slots[s].forEach(m => m.color.set(col[s])));
      const vis = hairVisibility(hair.map(h => h.name), face.style); hair.forEach(h => { h.visible = vis[h.name] !== false; });
      const bv = beardVisibility(beard.map(h => h.name), face.beard || 'none'); beard.forEach(h => { h.visible = bv[h.name] !== false; });
      api.hs = face.height || 1; const wd = (face.build || 1)*api.hs; root.scale.set(wd, api.hs, wd);                // altura e largura individuais (os pés continuam no chão: ver pose)
    },
    pose(J) {                                                                                         // aplica a pose do rig.js: quaternions de mundo → locais, de pai para filho
      const sol = solvePose(tpl.rest, J);
      CANON.forEach(c => { const b = bones[c], W = sol.world[c]; if (!b || !W) return; b.parent.updateWorldMatrix(true, false); b.parent.getWorldQuaternion(pq); q.set(W[0], W[1], W[2], W[3]); b.quaternion.copy(pq.invert().multiply(q));
        if (c === 'Hips') { b.parent.updateWorldMatrix(true, false); p.set(sol.hips[0], sol.hips[1]*(api.hs || 1), sol.hips[2]); b.parent.worldToLocal(p); b.position.copy(p); } b.updateMatrix(); });
    },
    dispose() { if (api.shirtTex) api.shirtTex.dispose(); }
  };
  return api;
}
