// APARÊNCIA-BASE DO ATLETA (usada pelo motor 3D e pelo procedural): paletas de pele/cabelo/chuteira e faceOf, o rosto determinístico por atleta.
// A aparência real dos titulares vem de js/lineups/appearance.js; faceOf completa o resto (proporções do rosto, olhos, chuteira).
export const SKINS = ['#f6d0a8', '#e8b88a', '#c68642', '#a0693a', '#7a4a2a', '#53341f'], HAIRC = ['#15110e', '#2b1d12', '#4a3020', '#7a5230', '#c9a45c', '#a6401e', '#9aa0a6', '#e8d9b0'], BOOTS = ['#14161a', '#f4f4f4', '#ff5a1f', '#2bd96b', '#2f7bff', '#ffd23f'];
export const STYLES = ['short', 'buzz', 'long', 'afro', 'curly', 'bald', 'bun'];
const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rngOf = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; }; };
const faces = new Map();
export function faceOf(key, hint = {}) {               // aparência determinística por atleta (rosto, cabelo, pele, porte)
  const id = String(key) + (hint.hair || ''); let f = faces.get(id); if (f) return f; const r = rngOf(hash(id));
  const skin = r() < .5 ? 1 + (r()*3 | 0) : (r()*6 | 0), style = hint.hair && STYLES.includes(hint.hair) ? hint.hair : STYLES[r()*STYLES.length | 0];
  f = { skin: SKINS[skin], skinI: skin, hairC: HAIRC[skin >= 4 ? (r()*3 | 0) : (r()*8 | 0)], style, build: .92 + r()*.16, height: .96 + r()*.08, eyeW: .034 + r()*.012, nose: .8 + r()*.45, brow: .7 + r()*.7, mouth: .8 + r()*.5, ear: .8 + r()*.5, eyeC: ['#3b2a1a', '#2a4a6b', '#3d5a2f', '#1b1b1b'][r()*4 | 0], boot: BOOTS[r()*BOOTS.length | 0], head: .94 + r()*.12 }; faces.set(id, f); return f;
}
// ---- camisa: textura que dá a volta no tronco (frente em u=.25, costas em u=.75; a costura fica na lateral) ----
