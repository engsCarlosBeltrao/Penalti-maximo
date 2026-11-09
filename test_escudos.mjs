// ESCUDOS E UNIFORMES DA SELEÇÃO DE TIMES: todo clube cadastrado tem escudo (PNG válido, com fonte registrada) e os três uniformes; o uniforme
// escolhido vai para a partida (js/frame.js → uniDe).  node test_escudos.mjs
import fs from 'fs';
import { TEAMS, CRESTS, CREST_INFO } from './js/teams.js';
import { uniDe } from './js/frame.js';
let ok = 0, bad = 0; const t = (n, c, info = '') => { c ? ok++ : (bad++, console.log('FALHOU:', n, info)); if (c) console.log(`ok  ${n}${info !== '' ? ' · ' + info : ''}`); };
const png = f => { const b = fs.readFileSync(f); return b.length > 24 && b.readUInt32BE(0) === 0x89504e47 ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20), alfa: [4, 6].includes(b[25]) } : null; };
const kits = JSON.parse(fs.readFileSync('assets/kits/kits.json', 'utf8')), fontes = fs.readFileSync('assets/crests/FONTES.md', 'utf8');
t(`${TEAMS.length} clubes cadastrados, todos na lista de escudos`, TEAMS.length === 20 && TEAMS.every(x => CRESTS.includes(x.key)));
const falta = [], ruins = [], semFonte = [], baixos = [];
for (const c of TEAMS) { const f = `assets/crests/${c.key}.png`; if (!fs.existsSync(f)) { falta.push(c.key); continue; } const p = png(f); if (!p || !p.alfa) ruins.push(c.key);
  if (!new RegExp(`\\| ${c.key} \\|`).test(fontes)) semFonte.push(c.key); if (p && Math.max(p.w, p.h) < 400) baixos.push(c.key); }
t('todo clube tem assets/crests/<key>.png', !falta.length, falta.join(' '));
t('escudos são PNG com transparência (canal alfa)', !ruins.length, ruins.join(' '));
t('a origem e a licença de cada escudo estão em assets/crests/FONTES.md', !semFonte.length, semFonte.join(' '));
t('todos os escudos em alta resolução (≥ 400 px)', !baixos.length, `${TEAMS.filter(x => CREST_INFO[x.key] === 'oficial').length} do Commons · ${TEAMS.filter(x => CREST_INFO[x.key] === 'restrito').length} da Wikipédia (restritos)`);
const semUni = TEAMS.filter(c => !['home', 'away', 'third'].every(u => kits[c.key]?.[u]?.file && fs.existsSync(kits[c.key][u].file)));
t('todo clube tem 1º (casa), 2º (fora) e 3º (alternativo) uniformes com arquivo', !semUni.length, semUni.map(x => x.key).join(' '));
t('uniforme na partida: o escolhido na seleção; sem escolha, 1º time casa e 2º fora', uniDe({ uni: 'third' }, 0) === 'third' && uniDe({ uni: 'home' }, 1) === 'home' && uniDe({}, 0) === 'home' && uniDe({}, 1) === 'away');
const main = fs.readFileSync('js/main.js', 'utf8');
t('a seleção exige as duas confirmações e trava o J1 enquanto o J2 escolhe (k !== vez / etapa ok)', /if \(pronto \|\| k !== vez \|\| l\.etapa === 'ok'\) return false/.test(main) && /if \(pronto\) return iniciar\(\)/.test(main));
t('a partida recebe os times com o uniforme confirmado (comUni)', /Game\.start\(comUni\(sel\.a, 0\), comUni\(sel\.b, 1\)/.test(main));
console.log(`ESCUDOS OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
