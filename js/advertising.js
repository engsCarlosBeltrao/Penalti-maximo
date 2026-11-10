// PATROCINADORES das placas de LED atrás do gol. EDITE A LISTA ADS: cada anúncio = um objeto; a arte fica em assets/ads/.
// A placa (js/three/stadium.js) mostra a arte inteira na altura da faixa, repetida lado a lado sobre a cor de fundo (bg) — o "LED" corre devagar
// e troca de patrocinador a cada `duration` segundos. Sem imagem (ou se ela não carregar), aparece o nome do patrocinador em texto.
// As marcas são paródias criadas para o jogo (artes fornecidas pelo dono do projeto).
export const ADS = [
  { id: 'copo-cola', sponsor: 'Copo-Colá', image: 'assets/ads/copo-cola.webp', backgroundColor: '#e10a14', textColor: '#ffffff', duration: 7, priority: 10, boardGroup: 'main', enabled: true },
  { id: 'brahmaia', sponsor: 'Brahmaia', image: 'assets/ads/brahmaia.webp', backgroundColor: '#8b0710', textColor: '#f4e2b0', duration: 7, priority: 10, boardGroup: 'main', enabled: true },
  { id: 'naike', sponsor: 'Naike', image: 'assets/ads/naike.webp', backgroundColor: '#000000', textColor: '#ffffff', duration: 7, priority: 10, boardGroup: 'main', enabled: true },
  { id: 'gramado-real', sponsor: 'Gramado Real', image: 'assets/ads/gramado-real.webp', backgroundColor: '#ffffff', textColor: '#123a5b', duration: 7, priority: 10, boardGroup: 'main', enabled: true },
  { id: 'perdebet', sponsor: 'PerdeBet', image: 'assets/ads/perdebet.webp', backgroundColor: '#aee0f7', textColor: '#0f2a6b', duration: 7, priority: 10, boardGroup: 'main', enabled: true }
];
const imgs = {};
function img(ad) {                                         // carrega uma vez; se falhar, usa texto (fallback)
  if (!ad.image || typeof Image === 'undefined') return null;
  if (!imgs[ad.id]) { const i = new Image(); i.onerror = () => { i.failed = true; console.warn('Anúncio sem imagem:', ad.image); }; i.src = ad.image; imgs[ad.id] = i; }
  const i = imgs[ad.id]; return i.complete && i.naturalWidth && !i.failed ? i : null;
}
const lista = group => ADS.filter(a => a.enabled && a.boardGroup === group).sort((a, b) => b.priority - a.priority);
export const Ads = {
  lista, imagem: img,
  // anúncio da vez (o mesmo na faixa inteira), o anterior e o progresso da troca (0..1 nos primeiros `troca` segundos)
  current(group, t, k = 0, troca = .6) {
    const L = lista(group); if (!L.length) return null; const tot = L.reduce((s, a) => s + a.duration, 0); let x = ((t + k*L[0].duration) % tot + tot) % tot, acc = 0;
    for (let i = 0; i < L.length; i++) { const ad = L[i]; if (x < acc + ad.duration) { const dt = x - acc; return { ad, idx: i, ant: L[(i - 1 + L.length) % L.length], tp: Math.min(1, dt/troca), alpha: 1, image: img(ad) }; } acc += ad.duration; }
    return null;
  }
};
