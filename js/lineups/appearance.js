// APARÊNCIA DOS TITULARES. Nenhuma foto foi consultada (a pesquisa do projeto lê só texto): os valores abaixo são uma ESTIMATIVA determinística por jogador
// (mesmo atleta = mesma aparência sempre), pensada para que os 11 de cada time fiquem visualmente DIFERENTES. Não é retrato do atleta real.
// Para refinar um jogador com o que você observar em fotos públicas, acrescente uma linha em APPEARANCE_OVERRIDES (chave = id do jogador, ex.: 'santos-neymar-jr'):
//   { skinI: 0..5 (0 clara … 5 escura), hairI: 0..7 (cor: preto, castanho-escuro, castanho, castanho-claro, loiro, ruivo, grisalho, branco),
//     hair: 'bald'|'buzz'|'short'|'curly'|'long'|'afro'|'bun', beard: 'none'|'stubble'|'short'|'full'|'mustache', build: .9..1.1 (largura), height: .95..1.07, note: 'o que foi observado' }
export const APPEARANCE_OVERRIDES = {};
const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; }; };
const pick = (r, table) => { let x = r()*table.reduce((s, [, w]) => s + w, 0); for (const [v, w] of table) { x -= w; if (x <= 0) return v; } return table[0][0]; };
const SKIN_W = [[0, .1], [1, .2], [2, .22], [3, .22], [4, .15], [5, .11]];
const HAIR_W = [['short', .4], ['buzz', .27], ['curly', .15], ['bald', .06], ['long', .03], ['afro', .07], ['bun', .02]];
const BEARD_W = [['none', .42], ['stubble', .2], ['short', .18], ['full', .13], ['mustache', .07]];
export function appearanceOf(id, posCode = 'CM', overrides = APPEARANCE_OVERRIDES) {
  const r = rng(hash('ap|' + id)), skinI = pick(r, SKIN_W); let hair = pick(r, HAIR_W); if (skinI >= 4 && (hair === 'long' || hair === 'bun')) hair = pick(r, [['buzz', 1], ['short', 1], ['afro', 1]]);
  const hairI = skinI >= 4 ? (r() < .9 ? 0 : 1) : skinI >= 2 ? pick(r, [[0, .4], [1, .35], [2, .2], [3, .05]]) : pick(r, [[0, .2], [1, .25], [2, .25], [3, .15], [4, .1], [5, .05]]),
    gk = posCode === 'GK', beard = pick(r, BEARD_W), build = +(.95 + r()*.1).toFixed(3), height = +((gk ? 1.02 : .97) + r()*.06).toFixed(3);
  return { skinI, hairI, hair, beard, build, height, basis: 'estimado', ...(overrides[id] || {}) };
}
