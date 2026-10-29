// ESCALAÇÕES: junta os arquivos clubs/<clube>.js (11 titulares por clube: 1 goleiro + 10 de linha) em jogadores completos.
// Para atualizar um jogador: edite o arquivo do clube. Para trocar a aparência: appearance.js. Este arquivo não precisa mudar.
import { L_flamengo } from './clubs/flamengo.js';
import { L_corinthians } from './clubs/corinthians.js';
import { L_palmeiras } from './clubs/palmeiras.js';
import { L_saopaulo } from './clubs/saopaulo.js';
import { L_santos } from './clubs/santos.js';
import { L_gremio } from './clubs/gremio.js';
import { L_internacional } from './clubs/internacional.js';
import { L_atletico_mg } from './clubs/atletico-mg.js';
import { L_cruzeiro } from './clubs/cruzeiro.js';
import { L_botafogo } from './clubs/botafogo.js';
import { L_fluminense } from './clubs/fluminense.js';
import { L_vasco } from './clubs/vasco.js';
import { L_bahia } from './clubs/bahia.js';
import { L_sport } from './clubs/sport.js';
import { L_fortaleza } from './clubs/fortaleza.js';
import { L_ceara } from './clubs/ceara.js';
import { L_athletico_pr } from './clubs/athletico-pr.js';
import { L_coritiba } from './clubs/coritiba.js';
import { L_bragantino } from './clubs/bragantino.js';
import { L_vitoria } from './clubs/vitoria.js';
import { appearanceOf } from './appearance.js';
export const LINEUPS = [L_flamengo, L_corinthians, L_palmeiras, L_saopaulo, L_santos, L_gremio, L_internacional, L_atletico_mg, L_cruzeiro, L_botafogo, L_fluminense, L_vasco, L_bahia, L_sport, L_fortaleza, L_ceara, L_athletico_pr, L_coritiba, L_bragantino, L_vitoria];
export const POS_PT = { GK: 'Goleiro', RB: 'Lateral-direito', CB: 'Zagueiro', LB: 'Lateral-esquerdo', DM: 'Volante', CM: 'Meio-campista', AM: 'Meia-atacante', RW: 'Ponta-direita', LW: 'Ponta-esquerda', ST: 'Atacante' };
const HS_LEGACY = ['short', 'long', 'bald', 'afro'], slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function makePlayer(lu, row, starter) {
  const gk = row.pos === 'GK', ap = appearanceOf(`${lu.club}-${slug(row.name)}`, row.pos || 'CM'), id = `${lu.club}-${slug(row.name)}`;
  return { id, name: row.name, nickname: row.nick, clubId: lu.club, jerseyNumber: row.n ?? null, numberStatus: row.n == null ? 'não confirmado' : 'confirmado', position: row.pos ? POS_PT[row.pos] : null, posCode: row.pos || null, posVerified: !lu.posUnverified && !!row.pos,
    starter, isStar: !!row.star, rating: row.r ?? (gk ? 80 : 78), preferredFoot: row.foot ?? null, celebration: row.cel ?? 'normal', personality: row.star ? ['star', row.cel === 'arms' ? 'celebrator' : 'confident'] : ['normal'],
    model: 'assets/models/athlete.glb', kit: { variant: 'home', keeper: gk }, animation: { rig: gk ? 'keeper' : 'field', celebration: row.cel ?? 'normal' },
    appearance: { ...ap, skinTone: Math.min(3, ap.skinI), hairStyle: HS_LEGACY.includes(ap.hair) ? ap.hair : 'short' }, source: lu.source, verifiedAt: lu.verifiedAt, confidence: lu.confidence };
}
export function buildLineupPlayers() { return LINEUPS.flatMap(lu => [...lu.xi.map(r => makePlayer(lu, r, true)), ...(lu.reserves || []).map(r => makePlayer(lu, r, false))]); }
// valida as regras do projeto: 11 titulares, 1 goleiro, números sem repetição, nomes únicos. Devolve a lista de problemas (vazia = ok).
export function validateLineups(lineups = LINEUPS) {
  const bad = []; for (const lu of lineups) { const xi = lu.xi, all = [...xi, ...(lu.reserves || [])], nums = all.map(r => r.n).filter(n => n != null), names = all.map(r => r.name);
    if (xi.length !== 11) bad.push(`${lu.club}: ${xi.length} titulares (esperado 11)`); if (xi.filter(r => r.pos === 'GK').length !== 1) bad.push(`${lu.club}: precisa de exatamente 1 goleiro`);
    if (new Set(nums).size !== nums.length) bad.push(`${lu.club}: número repetido`); if (new Set(names).size !== names.length) bad.push(`${lu.club}: nome repetido`); if (!lu.source || !lu.verifiedAt) bad.push(`${lu.club}: sem fonte/data`);
    if (lu.numbers === 'confirmed' && xi.some(r => r.n == null)) bad.push(`${lu.club}: numbers=confirmed mas há número nulo`); }
  return bad;
}
