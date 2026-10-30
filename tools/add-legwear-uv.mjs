#!/usr/bin/env node
// Acrescenta mapa de textura (TEXCOORD_0) ao calção (Shorts) e ao meião (Socks) do athlete.glb, que vinham sem UV (só cor lisa).
// Layout usado por tools/build-flamengo-home.mjs: perna ESQUERDA (+x) em u 0–0,5 e DIREITA em u 0,5–1; dentro de cada metade, a FRENTE da perna fica no meio
// e a costura (atrás da perna) nas bordas; u cresce para +x pela frente (logo frontal fica legível nas duas pernas). v = topo da peça (0) → barra/tornozelo (1).
// Só essas duas peças ganham primitivos novos (mesma posição, normal, pesos e ossos; vértices duplicados na costura e no gancho); o resto do modelo fica igual.
// Uso: node tools/add-legwear-uv.mjs [entrada.glb] [saida.glb]   (padrão: assets/models/athlete.glb → assets/models/athlete.legs.glb; nunca sobrescreve a entrada)
import fs from 'node:fs';
import path from 'node:path';
import { readModel, readAccessor, Builder } from './gltf-io.mjs';
const BONES = { Shorts: ['thigh', 'calf'], Socks: ['calf', 'foot'] };   // eixo da perna em cada peça (nomes do esqueleto UE/Quaternius)
export function addLegwearUV(m) {
  const j = m.json; if ((j.asset.extras || {}).legUV) throw new Error('Este modelo já tem o UV de calção/meião (extras.legUV).');
  const sk = j.skins[0], jn = sk.joints.map(i => j.nodes[i].name), ibm = readAccessor(m, sk.inverseBindMatrices);
  const bone = n => { const k = jn.indexOf(n); if (k < 0) throw new Error(`Osso ${n} não encontrado.`); const a = ibm[k], t = [a[12], a[13], a[14]]; return [-(a[0]*t[0] + a[1]*t[1] + a[2]*t[2]), -(a[4]*t[0] + a[5]*t[1] + a[6]*t[2]), -(a[8]*t[0] + a[9]*t[1] + a[10]*t[2])]; };
  const body = j.meshes.find(me => ['Skin', 'Shirt'].every(s => me.primitives.some(p => (j.materials[p.material] || {}).name === s))); if (!body) throw new Error('Malha do corpo não encontrada.');
  const b = new Builder(m), mesh = b.json.meshes[j.meshes.indexOf(body)], st = {};
  mesh.primitives.forEach((p, pi) => { const mat = (j.materials[p.material] || {}).name; if (!BONES[mat]) return;
    const P = readAccessor(m, p.attributes.POSITION), N = readAccessor(m, p.attributes.NORMAL), J = readAccessor(m, p.attributes.JOINTS_0), Wt = readAccessor(m, p.attributes.WEIGHTS_0), I = readAccessor(m, p.indices).map(r => r[0]);
    const ys = P.map(q => q[1]), yTop = Math.max(...ys), yBot = Math.min(...ys), [ba, bb] = BONES[mat], axis = { L: [bone(ba + '_l'), bone(bb + '_l')], R: [bone(ba + '_r'), bone(bb + '_r')] };
    const lu = (q, leg) => { const [A, Z] = axis[leg], t = Math.min(1, Math.max(0, (A[1] - q[1])/(A[1] - Z[1]))), cx = A[0] + (Z[0] - A[0])*t, cz = A[2] + (Z[2] - A[2])*t; return .5 + Math.atan2(q[0] - cx, q[2] - cz)/(2*Math.PI); };   // 0,5 = frente
    const V = [], key = new Map(), T = []; let seam = 0;
    for (let t = 0; t < I.length; t += 3) { const tri = [I[t], I[t + 1], I[t + 2]], leg = tri.reduce((s, k) => s + P[k][0], 0) >= 0 ? 'L' : 'R', us = tri.map(k => lu(P[k], leg)), wrap = Math.max(...us) - Math.min(...us) > .5; if (wrap) seam++;
      T.push(tri.map((k, e) => { const hi = wrap && us[e] < .5, id = k + leg + (hi ? 'h' : ''); let v = key.get(id);   // triângulo que atravessa a costura de trás: o lado baixo vai para a borda alta (tecido liso atrás da perna)
        if (v === undefined) { const u = hi ? .9995 : Math.min(.9995, Math.max(.0005, us[e])); v = V.length; key.set(id, v); V.push({ p: P[k], n: N[k], j: J[k], w: Wt[k], uv: [(leg === 'L' ? 0 : .5) + u*.5, (yTop - P[k][1])/(yTop - yBot)] }); } return v; })); }
    const at = { POSITION: b.accessor(V.map(v => v.p), 'VEC3', 5126, { target: 34962, minmax: true }), NORMAL: b.accessor(V.map(v => v.n), 'VEC3', 5126, { target: 34962 }), TEXCOORD_0: b.accessor(V.map(v => v.uv), 'VEC2', 5126, { target: 34962 }),
      JOINTS_0: b.accessor(V.map(v => v.j), 'VEC4', 5123, { target: 34962 }), WEIGHTS_0: b.accessor(V.map(v => v.w), 'VEC4', 5126, { target: 34962 }) };
    mesh.primitives[pi] = { ...p, attributes: at, indices: b.accessor(T.flat().map(i => [i]), 'SCALAR', V.length > 65535 ? 5125 : 5123, { target: 34963 }) };
    st[mat] = { vertices: `${P.length} → ${V.length}`, triangulos: T.length, naCostura: seam }; });
  if (Object.keys(st).length !== 2) throw new Error('Não achei os primitivos Shorts e Socks na malha do corpo.');
  b.json.asset.extras = { ...(b.json.asset.extras || {}), legUV: { v: 1, layout: 'perna esq. u 0–0,5 · dir. 0,5–1 · frente no meio de cada metade · v topo→barra' } };
  return { glb: b.glb(), st };
}
const entry = process.argv[1] && process.argv[1].endsWith('add-legwear-uv.mjs');
if (entry) {
  const [inp = 'assets/models/athlete.glb', outp = 'assets/models/athlete.legs.glb'] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  try { if (path.resolve(inp) === path.resolve(outp)) throw new Error('A saída não pode ser o próprio arquivo de entrada.'); const r = addLegwearUV(readModel(inp)); fs.writeFileSync(outp, r.glb); console.log(`✔ ${outp} gerado (${(r.glb.length/1024).toFixed(0)} KB)`, r.st); }
  catch (e) { console.log('✖', e.message); process.exit(1); }
}
