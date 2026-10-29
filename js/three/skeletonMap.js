// Nomes canônicos dos ossos e resolução de nomes de modelos comuns (Mixamo, Unity/Humanoid, Ready Player Me, Blender .L/.R, UE-like).
export const CANON = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
export const PARENT = { Hips: null, Spine: 'Hips', Spine1: 'Spine', Spine2: 'Spine1', Neck: 'Spine2', Head: 'Neck', LeftShoulder: 'Spine2', LeftArm: 'LeftShoulder', LeftForeArm: 'LeftArm', LeftHand: 'LeftForeArm', RightShoulder: 'Spine2', RightArm: 'RightShoulder', RightForeArm: 'RightArm', RightHand: 'RightForeArm', LeftUpLeg: 'Hips', LeftLeg: 'LeftUpLeg', LeftFoot: 'LeftLeg', LeftToeBase: 'LeftFoot', RightUpLeg: 'Hips', RightLeg: 'RightUpLeg', RightFoot: 'RightLeg', RightToeBase: 'RightFoot' };
// Ossos opcionais (podem faltar; o jogo funciona sem eles): Spine1, Spine2 (usa-se Spine), Shoulders, ToeBase.
export const OPTIONAL = ['Spine1', 'Spine2', 'LeftShoulder', 'RightShoulder', 'LeftToeBase', 'RightToeBase', 'Neck'];
const ALIAS = { pelvis: 'Hips', hip: 'Hips', root: null, chest: 'Spine1', upperchest: 'Spine2', spine3: 'Spine2', spine01: 'Spine', spine02: 'Spine1', spine03: 'Spine2', spine001: 'Spine1', spine002: 'Spine2', neck01: 'Neck', clavicle: 'Shoulder', thigh: 'UpLeg', upperleg: 'UpLeg', calf: 'Leg', lowerleg: 'Leg', shin: 'Leg', upperarm: 'Arm', lowerarm: 'ForeArm', forearm: 'ForeArm', toe: 'ToeBase', toes: 'ToeBase', toebase: 'ToeBase', ball: 'ToeBase' };
// Normaliza: remove prefixos (mixamorig:, Armature|, Bip01), separa o lado (.L/_R/-Left/Left…/…Right) e aplica sinônimos
export function normalizeName(raw) {
  let n = String(raw).replace(/^.*[:|]/, '').replace(/^mixamorig\d*/i, '').replace(/^bip\d*[_ ]?/i, ''), side = '';
  let m = /[._\-]([lr])$/i.exec(n) || /[._\-](left|right)$/i.exec(n); if (m) { side = m[1][0].toLowerCase() === 'l' ? 'Left' : 'Right'; n = n.slice(0, m.index); }
  n = n.replace(/[\s_.\-]/g, ''); const pm = /^(left|right)/i.exec(n); if (!side && pm) { side = pm[1][0].toUpperCase() + pm[1].slice(1).toLowerCase(); n = n.slice(pm[1].length); }
  const sm = /(left|right)$/i.exec(n); if (!side && sm) { side = sm[1][0].toUpperCase() + sm[1].slice(1).toLowerCase(); n = n.slice(0, -sm[1].length); }
  const key = n.toLowerCase(), base = key in ALIAS ? ALIAS[key] : n; if (base === null || !base) return null; return side + base[0].toUpperCase() + base.slice(1);
}
// names: lista de nomes de ossos do modelo; override: { Canon: 'NomeNoModelo' } (de assets/models/skeleton-map.json)
export function resolveBones(names, override = {}) {
  const map = {}, norm = {}; names.forEach(n => { const k = normalizeName(n); if (k && !(k in norm)) norm[k] = n; });
  CANON.forEach(c => { if (override[c] && names.includes(override[c])) map[c] = override[c]; else if (c in norm) map[c] = norm[c]; else { const alt = names.find(n => n.toLowerCase() === c.toLowerCase()); if (alt) map[c] = alt; } });
  const missing = CANON.filter(c => !(c in map)), requiredMissing = missing.filter(c => !OPTIONAL.includes(c));
  return { map, missing, requiredMissing, ok: requiredMissing.length === 0 };
}
