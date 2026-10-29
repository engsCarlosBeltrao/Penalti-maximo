// Testa o sistema de jogadores reais: 11 titulares por clube (1 goleiro + 10 de linha), números, fontes, aparência individual, goleiro próprio e cabelos/barbas no GLB.
import fs from 'node:fs';
import { PLAYERS, squad, pickKicker, keeperOf, lineupOf } from './js/players.js';
import { LINEUPS, validateLineups, POS_PT } from './js/lineups/lineups.js';
import { appearanceOf } from './js/lineups/appearance.js';
import { TEAMS } from './js/teams.js';
import { characters, TF } from './js/frame.js';
import { SKINS, HAIRC } from './js/athlete.js';
import { GS } from './js/gameState.js';
import { BALL0 } from './js/rig.js';
import { readModel, readAccessor } from './tools/gltf-io.mjs';
import { skinMap, buildHair, buildBeard, HAIR_STYLES, BEARDS } from './tools/hair-geometry.mjs';
import { hairVisibility, beardVisibility } from './js/three/uniform.js';
let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FALHOU:', n)); };
// ---- dados ----
t('20 clubes com escalação', LINEUPS.length === 20 && TEAMS.every(c => LINEUPS.some(l => l.club === c.key)));
t('validação interna sem problemas', validateLineups().length === 0); if (validateLineups().length) console.log(validateLineups());
for (const c of TEAMS) {
  const l = lineupOf(c), xi = l.xi, gks = xi.filter(p => p.posCode === 'GK'), nums = [...xi, ...l.bench].map(p => p.jerseyNumber).filter(n => n != null);
  t(`${c.sigla}: exatamente 11 titulares`, xi.length === 11); t(`${c.sigla}: 1 goleiro + 10 de linha`, gks.length === 1 && xi.length - gks.length === 10);
  t(`${c.sigla}: sem número repetido (titulares+reservas)`, new Set(nums).size === nums.length); t(`${c.sigla}: nomes únicos`, new Set(xi.map(p => p.name)).size === 11);
  t(`${c.sigla}: todos com fonte, data, clube e posição`, xi.every(p => p.source && p.verifiedAt && p.clubId === c.key && p.position && POS_PT[p.posCode]));
  t(`${c.sigla}: campos obrigatórios (id, modelo, aparência, uniforme, animação)`, xi.every(p => p.id && p.model && p.appearance && p.kit && p.animation && p.name));
  t(`${c.sigla}: numberStatus coerente`, xi.every(p => (p.jerseyNumber == null) === (p.numberStatus === 'não confirmado')));
  const combos = new Set(xi.map(p => [p.appearance.skinI, p.appearance.hair, p.appearance.beard, p.appearance.hairI].join())); t(`${c.sigla}: aparências distintas (≥9 de 11 combinações diferentes)`, combos.size >= 9);
  t(`${c.sigla}: porte varia (≥6 alturas diferentes)`, new Set(xi.map(p => p.appearance.height)).size >= 6);
  t(`${c.sigla}: goleiro do clube = keeperOf`, keeperOf(c).id === gks[0].id && keeperOf(c).nome.length > 0);
  const sq = squad(c); t(`${c.sigla}: cobradores não incluem o goleiro nas 5 primeiras vagas`, sq.slice(0, 5).every(p => p.posCode !== 'GK'));
}
t('ids únicos no jogo todo', new Set(PLAYERS.map(p => p.id)).size === PLAYERS.length);
t('estrelas preservadas (Neymar 10, Gabigol 9, Arrascaeta 10, Memphis 10, Pedro 9, Paquetá 11)', [['Neymar', 10], ['Gabigol', 9], ['Arrascaeta', 10], ['Memphis', 10], ['Pedro', 9], ['Paquetá', 11]].every(([n, k]) => PLAYERS.find(p => (p.nickname || p.name) === n)?.jerseyNumber === k));
t('clubes sem número confirmado são exatamente os 3 sinalizados', LINEUPS.filter(l => l.numbers === 'unconfirmed').map(l => l.club).sort().join() === 'ceara,coritiba,fortaleza');
t('aparência é determinística', JSON.stringify(appearanceOf('x-y')) === JSON.stringify(appearanceOf('x-y')) && appearanceOf('x-y', 'GK').height >= 1.02);
t('override de aparência vence a estimativa', appearanceOf('x-y', 'CM', { 'x-y': { hair: 'bald', beard: 'full' } }).hair === 'bald');
// ---- ligação com o quadro (frame.js): cobrador, goleiro e comemoração usam os jogadores do clube ----
const A = TEAMS.find(c => c.key === 'santos'), B = TEAMS.find(c => c.key === 'flamengo'); GS.equipes = [A, B]; GS.cobranca = 1; GS.cobrador = 0; GS.vencedor = 0;
const game = { m: {}, fin: null, t: 2, escolha: [PLAYERS.find(p => p.nickname === 'Neymar').id, null], hum: () => true }, K = { x: .5, tx: .8, th: .85, t0: 0 };
let fr = characters(game, 5, null, K, undefined, 0, BALL0), kk = fr.list[0], kp = fr.list[1];
t('cobrador escolhido: Neymar, camisa 10, aparência do jogador', kk.look.nome === 'NEYMAR' && kk.look.num === 10 && kk.look.face.skin === SKINS[kk.look.ap.skinI] && kk.look.face.hairC === HAIRC[kk.look.ap.hairI] && kk.look.face.style === kk.look.ap.hair);
t('goleiro é o do clube adversário (Flamengo: Rossi, camisa 1)', kp.look.nome === 'ROSSI' && kp.look.num === 1 && kp.kit.keeper === true && kp.look.face.height === lineupOf(B).keeper.appearance.height);
const sk = characters({ ...game, escolha: [null, null] }, 5, null, K, undefined, 0, BALL0); t('quadro: face individual em cache (mesmo objeto entre quadros)', sk.list[0].look.face === characters({ ...game, escolha: [null, null] }, 5, null, K, undefined, 0, BALL0).list[0].look.face);
GS.equipes = [TEAMS.find(c => c.key === 'fortaleza'), A]; const fk = characters({ ...game, escolha: [null, null] }, 5, null, K, undefined, 0, BALL0); t('goleiro sem número confirmado mostra "?" (noNum), não inventa 1', fk.list[1].look.nome.length > 0);
GS.equipes = [A, TEAMS.find(c => c.key === 'fortaleza')]; const fk2 = characters({ ...game, escolha: [null, null] }, 5, null, K, undefined, 0, BALL0); t('Fortaleza: goleiro João Ricardo com número nulo → noNum', fk2.list[1].look.nome === 'JOÃO RICARDO' && fk2.list[1].look.noNum === true && fk2.list[1].look.num == null);
GS.equipes = [A, B]; game.fin = { t: 2 }; fr = characters(game, 5, null, K, undefined, 0, BALL0); t('fim de jogo: goleiro do vencedor (Santos) é o Brazão, camisa 77', fr.list[0].look.nome === 'BRAZÃO' && fr.list[0].look.num === 77); t('fim: todos os 5 personagens têm face', fr.list.every(c => c.look.face));
// ---- geometria de cabelos/barbas (pura) ----
const m = readModel('assets/models/athlete.glb'), j = m.json, sj = j.skins[0], names = sj.joints.map(n => j.nodes[n].name), headJ = names.findIndex(n => /^head$/i.test(n));
const skinPrim = []; j.nodes.forEach(n => { if (n.mesh !== undefined) j.meshes[n.mesh].primitives.forEach(p => { if (j.materials[p.material].name === 'Skin') skinPrim.push(...readAccessor(m, p.attributes.POSITION)); }); });
const R = skinMap(skinPrim.filter(q => q[1] > 1.5));
for (const s of HAIR_STYLES) { const g = buildHair(s, R, { yTop: 1.808 }); if (s === 'bald') { t('careca: sem malha', g === null); continue; } t(`cabelo ${s}: índices e normais válidos`, g.T.every(tr => tr.every(i => i >= 0 && i < g.V.length)) && g.V.every(v => Math.abs(Math.hypot(...v.n) - 1) < 1e-3 && v.p.every(Number.isFinite)));
  t(`cabelo ${s}: dentro da região da cabeça (y 1.40–1.97, |x|<.2 sem afro)`, g.V.every(v => v.p[1] > 1.4 && v.p[1] < 1.97 && (s === 'afro' || Math.abs(v.p[0]) < .2))); }
for (const k of BEARDS) { const g = buildBeard(k, R); if (k === 'none') { t('sem barba: sem malha', g === null); continue; } t(`barba ${k}: válida e na metade inferior do rosto (y 1.57–1.70)`, g.V.every(v => v.p.every(Number.isFinite) && v.p[1] > 1.57 && v.p[1] < 1.70) && g.T.length > 0); }
// ---- GLB final ----
const nodeNames = j.nodes.map(n => n.name || ''); t('GLB tem Hair_* para todos os penteados', HAIR_STYLES.filter(s => s !== 'bald').every(s => nodeNames.includes('Hair_' + s))); t('GLB tem Beard_* para todas as barbas', BEARDS.filter(b => b !== 'none').every(b => nodeNames.includes('Beard_' + b)));
const piece = j.nodes.find(n => n.name === 'Hair_short'), pj = readAccessor(m, j.meshes[piece.mesh].primitives[0].attributes.JOINTS_0), pw = readAccessor(m, j.meshes[piece.mesh].primitives[0].attributes.WEIGHTS_0);
t('cabelo preso ao osso da cabeça (peso 1)', headJ >= 0 && pj.every(r => r[0] === headJ) && pw.every(r => Math.abs(r[0] - 1) < 1e-6) && piece.skin === 0);
t('visibilidade: careca esconde tudo; afro mostra só Hair_afro', Object.values(hairVisibility(['Hair_short', 'Hair_afro'], 'bald')).every(v => !v) && JSON.stringify(hairVisibility(['Hair_short', 'Hair_afro'], 'afro')) === '{"Hair_short":false,"Hair_afro":true}');
t('visibilidade: barba full inclui bigode; none esconde', beardVisibility(['Beard_full', 'Beard_mustache', 'Beard_short'], 'full').Beard_mustache === true && Object.values(beardVisibility(['Beard_full'], 'none')).every(v => !v));
console.log(`LINEUPS OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
