// DEDOS das poses procedurais (rig.js → retarget.js): sem isto ficavam retos como na T-pose ("garras" duras). Mesma regra de tools/blender/bracos.py:
// cada falange flexiona em torno do SEU eixo de dobradiça, medido no repouso (perpendicular ao dedo e à normal da palma); o polegar fecha atravessando a
// palma (em direção ao mínimo). Nada de rotação universal: o eixo é calculado osso a osso. Convenção glTF: na T-pose do athlete.glb a palma olha para -Y.
import * as THREE from 'three';
const PALM0 = new THREE.Vector3(0, -1, 0), FINGERS = ['index', 'middle', 'ring', 'pinky'];
// graus por falange (01, 02, 03) — os mesmos valores de bracos.py
export const HAND_POSES = { relaxada: [[14, 20, 14], [8, 10, 8]], luva: [[10, 14, 10], [6, 8, 6]] };
export function fingerRig(byName, root) {                 // chamado com o modelo ainda no repouso: eixo local e quaternion local de repouso de cada falange
  root.updateMatrixWorld(true); const out = [], wp = (b, v = new THREE.Vector3()) => b.getWorldPosition(v), q = new THREE.Quaternion();
  for (const s of ['l', 'r']) {
    const i1 = byName[`index_01_${s}`], p1 = byName[`pinky_01_${s}`]; if (!i1 || !p1) continue;
    const knuck = wp(p1).sub(wp(i1)).normalize(), thumbTo = PALM0.clone().add(knuck.clone().multiplyScalar(.8)).normalize();
    for (const f of [...FINGERS, 'thumb']) for (let i = 1; i <= 3; i++) {
      const b = byName[`${f}_0${i}_${s}`]; if (!b) continue; b.getWorldQuaternion(q);
      const nx = byName[`${f}_0${i + 1}_${s}`], pv = byName[`${f}_0${i - 1}_${s}`];                   // direção do dedo: até a falange seguinte (na ponta, a da anterior)
      const d = nx ? wp(nx).sub(wp(b)).normalize() : pv ? wp(b).sub(wp(pv)).normalize() : new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      const ax = d.clone().cross(f === 'thumb' ? thumbTo : PALM0); if (ax.lengthSq() < 1e-8) continue;
      out.push({ b, thumb: f === 'thumb', i: i - 1, L0: b.quaternion.clone(), ax: ax.normalize().applyQuaternion(q.clone().invert()) });   // eixo no referencial local do osso
    } }
  return out;
}
const dq = new THREE.Quaternion();
export function setFingers(rig, pose = 'relaxada') {      // escreve a pose da mão (local = repouso · flexão no eixo próprio de cada falange)
  const P = HAND_POSES[pose] || HAND_POSES.relaxada;
  for (const r of rig) { r.b.quaternion.copy(r.L0).multiply(dq.setFromAxisAngle(r.ax, (r.thumb ? P[1] : P[0])[r.i]*Math.PI/180)); r.b.updateMatrix(); }
}
