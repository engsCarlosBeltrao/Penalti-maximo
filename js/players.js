// ELENCOS — só entram jogadores com FONTE e DATA. Nada aqui foi inventado; o que não foi confirmado é null/pendente ("?" na camisa).
// Os dados vivem em js/lineups/clubs/<clube>.js (11 titulares por clube + reservas conhecidas) e a aparência em js/lineups/appearance.js.
// Este arquivo só monta a API usada pelo jogo: PLAYERS, squad(clube), pickKicker(...), keeperOf(clube), lineupOf(clube).
import { LINEUPS, buildLineupPlayers, validateLineups } from './lineups/lineups.js';
export const PLAYERS = buildLineupPlayers();
export const REAL_COUNT = c => PLAYERS.filter(p => p.clubId === c.key).length;
export const lineupOf = club => { const lu = LINEUPS.find(l => l.club === club.key), all = PLAYERS.filter(p => p.clubId === club.key); return { meta: lu, xi: all.filter(p => p.starter), bench: all.filter(p => !p.starter), keeper: all.find(p => p.starter && p.posCode === 'GK'), problems: validateLineups(lu ? [lu] : []) }; };
const byRank = (a, b) => b.isStar - a.isStar || (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99);
const SLOTS = [9, 10, 11, 7, 8];
export function squad(club) {                                       // cobradores: estrelas primeiro, depois os demais titulares de linha, depois reservas; o goleiro fica por último
  const all = PLAYERS.filter(p => p.clubId === club.key), field = all.filter(p => p.posCode !== 'GK'), real = [...field.filter(p => p.starter).sort(byRank), ...field.filter(p => !p.starter).sort(byRank), ...all.filter(p => p.posCode === 'GK')], used = new Set(real.map(p => p.jerseyNumber));
  const fill = real.length >= 5 ? [] : SLOTS.filter(n => !used.has(n)).slice(0, 5 - real.length).map(n => ({ id: `${club.key}-pendente-${n}`, name: 'ATLETA', clubId: club.key, jerseyNumber: n, position: null, isStar: false, rating: 75, celebration: 'normal', personality: ['normal'], appearance: { skinTone: n % 4, hairStyle: ['short', 'long', 'bald', 'afro'][n % 4] }, pending: true }));
  return [...real, ...fill];
}
const CELS = ['arms', 'crest', 'confident', 'team', 'normal'];
const lookOf = (p, cel) => ({ id: p.id, gk: p.posCode === 'GK', nome: (p.nickname || p.name).toUpperCase(), num: p.jerseyNumber, star: p.isStar, rating: p.rating, pending: !!p.pending, noNum: p.jerseyNumber == null, cel, skin: p.appearance.skinTone, hair: p.appearance.hair || p.appearance.hairStyle, ap: p.appearance.skinI !== undefined ? p.appearance : null });
// ORDEM DE COBRANÇA: os 11 titulares — os 10 de linha (estrelas primeiro, depois pela camisa) e o GOLEIRO por último; depois do 11º a ordem
// recomeça. Quem o jogador escolheu (ESCOLHER JOGADORES) abre a fila; se for reserva, entra no lugar do último de linha (continuam 11, goleiro no fim).
export function ordemCobranca(club, choiceId) {
  const s = squad(club), xi = s.filter(p => p.starter && p.posCode !== 'GK'), gk = s.find(p => p.starter && p.posCode === 'GK');
  let linha = [...xi, ...s.filter(p => !xi.includes(p) && p.posCode !== 'GK')].slice(0, gk ? 10 : 11);   // titulares; faltando, completa com reservas/pendentes
  const esc = choiceId && s.find(x => x.id === choiceId);
  if (esc && esc !== gk) { linha = [esc, ...linha.filter(p => p !== esc)].slice(0, gk ? 10 : 11); }
  return esc && esc === gk ? [gk, ...linha] : gk ? [...linha, gk] : linha;
}
export function pickKicker(club, n, choiceId) {
  const o = ordemCobranca(club, choiceId), p = o[(Math.max(1, n) - 1) % o.length], cel = p.celebration !== 'normal' ? p.celebration : CELS[(n + (p.jerseyNumber || 0)) % 4];
  return lookOf(p, cel);
}
export function keeperOf(club) {                                     // goleiro titular do clube (aparência e nome próprios); sem dados → null e o jogo usa o goleiro genérico
  const g = PLAYERS.find(p => p.clubId === club.key && p.starter && p.posCode === 'GK'); return g ? lookOf(g, 'normal') : null;
}
