// CAMISA PROCEDURAL (canvas 512×192, layout "wrap"): listras/faixas, número, nome e escudo. Usada pelo goleiro e por clubes sem textura do pack.
import { CRESTS } from './teams.js';
import { shade } from './vec.js';
const shirts = new Map(), crestImgs = new Map();
function crestImg(key) { if (!CRESTS.includes(key) || typeof Image === 'undefined') return null; let i = crestImgs.get(key); if (!i) { i = new Image(); i.onload = () => { for (const k of [...shirts.keys()]) if (k.startsWith(key + '|')) shirts.delete(k); }; i.src = `assets/crests/${key}.png`; crestImgs.set(key, i); } return i.complete && i.naturalWidth ? i : null; }
const lumOf = h => { const n = parseInt(h.slice(1), 16); return (.3*(n >> 16) + .59*(n >> 8 & 255) + .11*(n & 255))/255; };
export function shirtTex(kit, p) {
  const key = [kit.key || kit.c1, kit.pat, kit.keeper ? 'k' : '', p.nome, p.num, !!crestImg(kit.key)].join('|'); let cv = shirts.get(key); if (cv) return cv; if (typeof document === 'undefined') return null;
  cv = document.createElement('canvas'); cv.width = 512; cv.height = 192; const c = cv.getContext('2d'); c.fillStyle = kit.c1; c.fillRect(0, 0, 512, 192); c.fillStyle = kit.c2;
  if (kit.pat === 'v') for (let x = 16; x < 512; x += 64) c.fillRect(x, 0, 32, 192); else if (kit.pat === 'h') for (let y = 12; y < 192; y += 42) c.fillRect(0, y, 512, 21);
  else if (kit.pat === 's') { c.fillRect(0, 70, 512, 38); c.fillStyle = kit.c3; c.fillRect(0, 70, 512, 6); c.fillRect(0, 102, 512, 6); } else if (kit.pat === 'd') { c.save(); c.translate(128, 96); c.rotate(-.9); c.fillRect(-300, -22, 600, 44); c.restore(); c.save(); c.translate(384, 96); c.rotate(.9); c.fillRect(-300, -22, 600, 44); c.restore(); } else if (kit.pat === 'f') c.fillRect(0, 0, 256, 192);
  const ink = lumOf(kit.c1) > .55 ? '#101820' : '#fff', stroke = ink === '#fff' ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.5)'; c.textAlign = 'center'; c.fillStyle = ink; c.strokeStyle = stroke; c.lineWidth = 4;
  const num = p.noNum ? '?' : String(p.num);
  c.font = '900 80px Arial'; c.strokeText(num, 384, 126); c.fillText(num, 384, 126); c.font = '700 20px Arial'; c.fillText((p.nome || '').slice(0, 11), 384, 50);   // COSTAS: nome em cima, número grande
  if (!kit.keeper) { c.font = '900 30px Arial'; c.strokeText(num, 96, 70); c.fillText(num, 96, 70); }                                                     // FRENTE: número pequeno
  c.fillStyle = kit.c2; c.fillRect(0, 0, 512, 7);                                                                             // gola
  if (kit.keeper) { shirts.set(key, cv); return cv; }
  const ci = crestImg(kit.key), cx = 168, cy = 62;                                                                                                          // ESCUDO no peito esquerdo (lado direito de quem olha)
  if (ci) c.drawImage(ci, cx - 17, cy - 21, 34, 42); else { c.fillStyle = shade(kit.c2, .85); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(cx - 16, cy - 20); c.lineTo(cx + 16, cy - 20); c.lineTo(cx + 16, cy + 4); c.quadraticCurveTo(cx + 16, cy + 18, cx, cy + 24); c.quadraticCurveTo(cx - 16, cy + 18, cx - 16, cy + 4); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.font = '900 13px Arial'; c.fillText((kit.sigla || '').slice(0, 3), cx, cy + 5); }
  shirts.set(key, cv); return cv;
}
