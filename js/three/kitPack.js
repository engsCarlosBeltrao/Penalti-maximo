// Pack de camisas "Brasil Kits 26-27" convertido por tools/build-kits.py → assets/kits/<clube>_<home|away|third>.jpg + kits.json.
// Tudo opcional: sem o pack (ou sem o clube), o uniforme procedural continua sendo usado.
let META = null, loading = null;
const IMGS = new Map();
export const loadKitPack = (base = '') => loading || (loading = (typeof fetch === 'undefined' ? Promise.resolve(null) : fetch(base + 'assets/kits/kits.json').then(r => r.ok ? r.json() : null).catch(() => null)).then(m => (META = m)));
export const kitPackReady = () => !!META;
export const packVariants = key => Object.keys((META && META[key]) || {});
// meta do uniforme (cores de calção/meião/manga/detalhe + arquivo) — cai no titular se a variante não existir
export const packMeta = (key, variant = 'home') => (META && META[key] && (META[key][variant] || META[key].home)) || null;
// imagem do uniforme (cache); devolve null enquanto carrega e chama onLoad quando pronta
export function packImage(meta, onLoad) {
  if (!meta || typeof Image === 'undefined') return null;
  let e = IMGS.get(meta.file);
  if (!e) { const img = new Image(); e = { img, ok: false }; img.onload = () => { e.ok = true; if (onLoad) onLoad(); }; img.onerror = () => { e.bad = true; }; img.src = meta.file; IMGS.set(meta.file, e); }
  return e.ok ? e.img : null;
}
