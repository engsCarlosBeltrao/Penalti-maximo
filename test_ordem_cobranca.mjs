// ORDEM DE COBRANÇA: os 11 titulares de cada clube batem antes de qualquer um repetir; o goleiro é o 11º; o escolhido abre a fila; canhotos
// (pé no elenco, conferido no Transfermarkt) batem com a esquerda; o goleiro, na vez dele, usa o uniforme de goleiro.   node test_ordem_cobranca.mjs
import { TEAMS } from './js/teams.js';
import { PLAYERS, ordemCobranca, pickKicker } from './js/players.js';
import { kickSpec, styleOf, footOf } from './js/kicks.js';
let ok = 0, bad = 0; const t = (n, c, info = '') => { c ? ok++ : (bad++, console.log('FALHOU:', n, info)); };
for (const club of TEAMS) {
  const o = ordemCobranca(club), ids = o.map(p => p.id), gk = PLAYERS.find(p => p.clubId === club.key && p.starter && p.posCode === 'GK');
  t(`${club.key}: 11 cobradores diferentes`, o.length === 11 && new Set(ids).size === 11, ids.length);
  t(`${club.key}: o goleiro titular é o 11º`, !!gk && ids[10] === gk.id);
  t(`${club.key}: os outros 10 são titulares de linha`, o.slice(0, 10).every(p => p.posCode !== 'GK') && o.slice(0, 10).filter(p => p.starter).length >= Math.min(10, PLAYERS.filter(p => p.clubId === club.key && p.starter && p.posCode !== 'GK').length));
  const seq = [...Array(22).keys()].map(i => pickKicker(club, i + 1).id);
  t(`${club.key}: cobranças 1–11 sem repetir ninguém e 12–22 recomeçam na mesma ordem`, new Set(seq.slice(0, 11)).size === 11 && seq.slice(11).every((id, i) => id === seq[i]));
  t(`${club.key}: na 11ª o cobrador é o goleiro (marcado para usar o uniforme de goleiro)`, pickKicker(club, 11).gk === true && !pickKicker(club, 10).gk);
  const esc = o[5].id, oe = ordemCobranca(club, esc); t(`${club.key}: o escolhido abre a fila e os 11 continuam`, oe[0].id === esc && new Set(oe.map(p => p.id)).size === 11 && oe[10].id === gk.id);
}
// canhotos
const canhotos = PLAYERS.filter(p => p.preferredFoot === 'left' && p.posCode !== 'GK');
t('canhotos cadastrados (Transfermarkt) em vários clubes', canhotos.length >= 50 && new Set(canhotos.map(p => p.clubId)).size >= 18, canhotos.length);
for (const p of canhotos) { const ks = kickSpec(p.id, 'medio'); if (ks.pe !== 'l') t(`${p.id}: canhoto bate com a esquerda`, false, `${ks.id} pé ${ks.pe}`); }
t('todo canhoto bate com a esquerda (clipe canhoto ou rotina própria canhota)', canhotos.every(p => kickSpec(p.id, 'medio').pe === 'l'));
t('canhoto sem rotina própria usa a cobrança padrão canhota', styleOf('flamengo-ayrton-lucas') === 'canhoto' && ['chapada', 'medio', 'bomba'].every(tp => kickSpec('flamengo-ayrton-lucas', tp).id === 'canhoto_' + tp));
t('destro continua batendo com a direita', kickSpec('flamengo-pedro', 'medio').pe === 'r' && footOf('flamengo-pedro') === 'r');
t('craque canhoto mantém a rotina própria (Gabigol)', kickSpec('santos-gabriel-barbosa', 'medio').id === 'gabigol_medio');
console.log(`ORDEM OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
