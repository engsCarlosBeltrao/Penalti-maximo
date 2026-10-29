// Publicidade das placas. EDITE A LISTA ADS: cada anúncio = um objeto. Imagens (opcionais) em assets/ads/. Sem imagem → texto.
export const ADS = [
 { id:'campo-real', sponsor:'Faculdade Campo Real', text:'Conhecimento que transforma', image:'assets/ads/campo-real.png', backgroundColor:'#123a6b', textColor:'#ffffff', duration:8, priority:100, boardGroup:'main', enabled:true },
 { id:'exemplo-1', sponsor:'xvideos', text:'top pornos', image:'', backgroundColor:'#7a0f1f', textColor:'#ffffff', duration:5, priority:10, boardGroup:'main', enabled:true },
 { id:'exemplo-2', sponsor:'fatalmodel', text:'Futebol é paixão', image:'', backgroundColor:'#0b4a2a', textColor:'#ffffff', duration:5, priority:10, boardGroup:'main', enabled:true }
];                                                        // priority ≥ 100 = destaque (aparece 2x por ciclo)
const imgs = {};
function img(ad) {                                         // carrega uma vez; se falhar, usa texto (fallback)
  if (!ad.image || typeof Image === 'undefined') return null;
  if (!imgs[ad.id]) { const i = new Image(); i.onerror = () => { i.failed = true; console.warn('Anúncio sem imagem:', ad.image); }; i.src = ad.image; imgs[ad.id] = i; }
  const i = imgs[ad.id]; return i.complete && i.naturalWidth && !i.failed ? i : null;
}
function seq(group) {
  const L = ADS.filter(a => a.enabled && a.boardGroup === group).sort((a, b) => b.priority - a.priority), out = [];
  L.forEach((a, i) => { out.push(a); if (a.priority >= 100) out.push(null); }); // marcador para repetir destaque no meio
  const hi = L.filter(a => a.priority >= 100), res = []; out.forEach(a => a ? res.push(a) : null); hi.forEach(a => res.splice(Math.ceil(res.length/2), 0, a)); return res;
}
export const Ads = {
  current(group, t, k) {                                  // anúncio ativo da placa k + opacidade (fade nas trocas)
    const L = seq(group); if (!L.length) return null; const tot = L.reduce((s, a) => s + a.duration, 0); let x = (t + k*L[0].duration) % tot, acc = 0;
    for (const ad of L) { if (x < acc + ad.duration) return { ad, alpha: Math.max(0, Math.min(1, (x-acc)/.5, (acc+ad.duration-x)/.5)), image: img(ad) }; acc += ad.duration; }
    return null;
  }
};
