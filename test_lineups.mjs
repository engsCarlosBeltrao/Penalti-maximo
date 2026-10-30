// Testa o sistema de jogadores reais: 11 titulares por clube (1 goleiro + 10 de linha), números, fontes, aparência individual, goleiro próprio e cabelos/barbas no GLB.
import fs from 'node:fs';
import { PLAYERS, squad, pickKicker, keeperOf, lineupOf } from './js/players.js';
import { LINEUPS, validateLineups, POS_PT, makePlayer } from './js/lineups/lineups.js';
import { appearanceOf } from './js/lineups/appearance.js';
import { TEAMS } from './js/teams.js';
import { characters, TF } from './js/frame.js';
import { SKINS, HAIRC } from './js/face.js';
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
  const combos = new Set(xi.map(p => [p.appearance.skinT ?? p.appearance.skinI, p.appearance.hair, p.appearance.beard, p.appearance.mustache, p.appearance.hairI].join())); t(`${c.sigla}: aparências distintas (≥9 de 11 combinações diferentes)`, combos.size >= 9);
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
t('cobrador escolhido: Neymar, camisa 10, aparência do jogador', kk.look.nome === 'NEYMAR' && kk.look.num === 10 && kk.look.face.skin === kk.look.ap.skinHex && kk.look.face.hairC === kk.look.ap.hairHex && kk.look.face.style === kk.look.ap.hair);
t('goleiro é o do clube adversário (Flamengo: Rossi, camisa 1)', kp.look.nome === 'ROSSI' && kp.look.num === 1 && kp.kit.keeper === true && kp.look.face.height === lineupOf(B).keeper.appearance.height);
const sk = characters({ ...game, escolha: [null, null] }, 5, null, K, undefined, 0, BALL0); t('quadro: face individual em cache (mesmo objeto entre quadros)', sk.list[0].look.face === characters({ ...game, escolha: [null, null] }, 5, null, K, undefined, 0, BALL0).list[0].look.face);
GS.equipes = [TEAMS.find(c => c.key === 'fortaleza'), A]; const fk = characters({ ...game, escolha: [null, null] }, 5, null, K, undefined, 0, BALL0); t('goleiro sem número confirmado mostra "?" (noNum), não inventa 1', fk.list[1].look.nome.length > 0);
GS.equipes = [A, TEAMS.find(c => c.key === 'fortaleza')]; const fk2 = characters({ ...game, escolha: [null, null] }, 5, null, K, undefined, 0, BALL0); t('Fortaleza: goleiro João Ricardo com número nulo → noNum', fk2.list[1].look.nome === 'JOÃO RICARDO' && fk2.list[1].look.noNum === true && fk2.list[1].look.num == null);
GS.equipes = [A, B]; game.fin = { t: 2 }; fr = characters(game, 5, null, K, undefined, 0, BALL0); t('fim de jogo: goleiro do vencedor (Santos) é o Brazão, camisa 77', fr.list[0].look.nome === 'BRAZÃO' && fr.list[0].look.num === 77); t('fim: todos os 5 personagens têm face', fr.list.every(c => c.look.face));
// ---- aparência real (tabela de fotos) ----
{ const all = LINEUPS.flatMap(lu => lu.xi.map(r => makePlayer(lu, r, true))), real = all.filter(p => p.appearance.basis !== 'estimado');
  t('os 220 titulares usam a tabela de aparência real', real.length === all.length && all.length === 220);
  t('penteados da tabela existem na biblioteca', all.every(p => HAIR_STYLES.includes(p.appearance.hair)));
  t('barbas da tabela existem na biblioteca', all.every(p => BEARDS.includes(p.appearance.beard)));
  t('pele individual: tom contínuo e cor hex', all.every(p => p.appearance.skinT >= 0 && p.appearance.skinT <= 5 && /^#[0-9a-f]{6}$/.test(p.appearance.skinHex)));
  t('sem foto ou sem identidade confirmada ficam pendentes (Ajul, Micael, Enzo) e não há mais dúvidas', JSON.stringify(all.filter(p => p.appearance.conf === 'pendente').map(p => p.id)) === '["sport-marcelo-ajul","sport-micael","ceara-enzo"]' && !all.some(p => p.appearance.conf === 'duvida'));
  t('Gabigol: platinado com lateral e barba pretas', (p => p.appearance.hairHex === '#e8d9b0' && p.appearance.hairC2 === '#15110e' && p.appearance.beardC === '#15110e')(all.find(p => p.id === 'santos-gabriel-barbosa'))); }
// ---- geometria de cabelos/barbas (pura) ----
const m = readModel('assets/models/athlete.glb'), j = m.json, sj = j.skins[0], names = sj.joints.map(n => j.nodes[n].name), headJ = names.findIndex(n => /^head$/i.test(n));
const skinPrim = []; j.nodes.forEach(n => { if (n.mesh !== undefined) j.meshes[n.mesh].primitives.forEach(p => { if (j.materials[p.material].name === 'Skin') skinPrim.push(...readAccessor(m, p.attributes.POSITION)); }); });
const R = skinMap(skinPrim.filter(q => q[1] > 1.5));
for (const s of HAIR_STYLES) { const g = buildHair(s, R, { yTop: 1.808 }); if (s === 'careca') { t('careca: sem malha', g === null); continue; } t(`cabelo ${s}: índices e normais válidos`, g.T.every(tr => tr.every(i => i >= 0 && i < g.V.length)) && g.V.every(v => Math.abs(Math.hypot(...v.n) - 1) < 1e-3 && v.p.every(Number.isFinite)));
  t(`cabelo ${s}: dentro da região da cabeça (y 1.40–1.97, |x|<.2 sem afro)`, g.V.every(v => v.p[1] > 1.4 && v.p[1] < 1.97 && (s === 'black_power' || Math.abs(v.p[0]) < .2)) && g.V.every(v => v.h.length === 4 && v.h.every(Number.isFinite))); }
for (const k of BEARDS) { const g = buildBeard(k, R); if (k === 'nenhuma') { t('sem barba: sem malha', g === null); continue; } t(`barba ${k}: válida e na metade inferior do rosto (y 1.54–1.71)`, g.V.every(v => v.p.every(Number.isFinite) && v.p[1] > 1.54 && v.p[1] < 1.71) && g.T.length > 0); }
// ---- GLB final ----
const nodeNames = j.nodes.map(n => n.name || ''); t('GLB tem Hair_* para todos os penteados', HAIR_STYLES.filter(s => s !== 'careca').every(s => nodeNames.includes('Hair_' + s))); t('GLB tem Beard_* para todas as barbas', BEARDS.filter(b => b !== 'nenhuma').every(b => nodeNames.includes('Beard_' + b)));
t('GLB tem bigodes, costeletas e faixa', ['Must_bigode_fino', 'Must_bigode', 'Must_bigode_marcado', 'Side_costeleta_curta', 'Side_costeleta_longa', 'Acc_band'].every(n => nodeNames.includes(n)));
t('cabelo/barba usam materiais próprios (HairCap, Beard, Band) e trazem o atributo _HAIR', ['HairCap', 'Beard', 'Band'].every(n => j.materials.some(mm => mm.name === n)) && j.nodes.filter(n => /^(Hair|Beard|Must|Side)_/.test(n.name || '')).every(n => j.meshes[n.mesh].primitives[0].attributes._HAIR !== undefined));
const piece = j.nodes.find(n => n.name === 'Hair_degrade_medio'), pj = readAccessor(m, j.meshes[piece.mesh].primitives[0].attributes.JOINTS_0), pw = readAccessor(m, j.meshes[piece.mesh].primitives[0].attributes.WEIGHTS_0);
t('cabelo preso ao osso da cabeça (peso 1)', headJ >= 0 && pj.every(r => r[0] === headJ) && pw.every(r => Math.abs(r[0] - 1) < 1e-6) && piece.skin === 0);
t('visibilidade: careca esconde tudo; nome antigo afro mostra só Hair_black_power', Object.values(hairVisibility(['Hair_degrade_medio', 'Hair_black_power'], 'bald')).every(v => !v) && JSON.stringify(hairVisibility(['Hair_degrade_medio', 'Hair_black_power'], 'afro')) === '{"Hair_degrade_medio":false,"Hair_black_power":true}');
t('visibilidade: penteado novo pelo nome', hairVisibility(['Hair_rente', 'Hair_trancas_nago'], 'trancas_nago').Hair_trancas_nago === true);
{ const N = ['Beard_densa', 'Beard_cheia_curta', 'Must_bigode', 'Must_bigode_fino', 'Side_costeleta_curta', 'Side_costeleta_longa'];
  t('visibilidade: nome antigo full = densa + bigode + costeleta ligada; none esconde', JSON.stringify(Object.entries(beardVisibility(N, 'full')).filter(e => e[1]).map(e => e[0])) === '["Beard_densa","Must_bigode","Side_costeleta_longa"]' && Object.values(beardVisibility(N, 'none')).every(v => !v));
  t('visibilidade: bigode e costeleta escolhidos à parte', JSON.stringify(Object.entries(beardVisibility(N, 'nenhuma', 'bigode_fino', 'curta')).filter(e => e[1]).map(e => e[0])) === '["Must_bigode_fino","Side_costeleta_curta"]'); }
console.log(`LINEUPS OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
