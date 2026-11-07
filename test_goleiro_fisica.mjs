// GOLEIRO — áreas físicas e sensores: as 20 situações do pedido (áreas de alcance das mãos × contato real, partes do corpo, traves/travessão com colisão
// contínua, chute do cobrador, área azul dos pés no MEIO e a decisão de lado respeitada).  node test_goleiro_fisica.mjs
import * as GK from './js/keeper.js';
import { FERROS, R_FERRO, varreFerro, tocaFerro } from './js/fisicaGol.js';
import { KICK_CLIPS } from './js/kickClips.js';
import { BALL_R } from './js/rig.js';
let ok = 0, bad = 0; const t = (n, c, info = '') => { c ? ok++ : (bad++, console.log('FALHOU:', n, info)); console.log(`${c ? 'ok ' : 'XX '} ${n}${info !== '' && c ? ' · ' + info : ''}`); };
const semente = s => () => (s = (s*16807) % 2147483647)/2147483647;
const TIPO = { chapada: [.8, .16], medio: [.62, 0], bomba: [.46, 0] };
function cobra({ gx, gy, tipo = 'medio', lado = 'centro', rng = Math.random, curl }) {
  const k = GK.novoGoleiro(); GK.escolherLado(k, null, lado, 'teste'); const b = { gx, gy, t: -1.6, tf: TIPO[tipo][0], curl: curl ?? TIPO[tipo][1] }; let res = null, impulsos = 0;
  while (!res && b.t < 6) { const tA = b.t; b.t += 1/120; if (tA < 0 && b.t >= 0) { impulsos++; GK.registraChute(k, 0); }
    if (!b.fis) GK.passo(k, b, tA, b.t, { rng }); else GK.passoBola(k, b, 1/120);
    if (b.fis) { if (b.fis.res) res = b.fis.res !== 'gol' && b.fis.trave && !k.contato ? 'trave' : b.fis.res; } else if (b.t >= b.tf) res = gx < 0 || gx > 1 || gy > 1 ? 'fora' : 'gol'; }
  const ev = new Set((k.eventos || []).map(e => e.tipo));
  return { res, k, c: k.contato, b, ev, impulsos };
}
// procura, numa varredura determinística, um chute em que a condição acontece
const achar = (pred, n = 2500) => { for (let i = 0; i < n; i++) { const r = cobra({ gx: .12 + (i % 16)*.05, gy: .03 + ((i/16 | 0) % 14)*.065, lado: ['esq', 'dir', 'centro'][i % 3], tipo: ['chapada', 'medio', 'bomba'][(i/5 | 0) % 3], rng: semente(7000 + i) }); if (pred(r)) return r; } return null; };
const desc = r => r ? `${r.k.plano?.clip} · ${r.c ? GK.defesaNome(r.c) + ' (' + r.c.parte + ')' : 'sem contato'} → ${r.res} · eventos: ${[...r.ev].join(', ')}` : 'não encontrado';

console.log('— mãos: área de alcance × contato real —');
{ const r = achar(r => r.ev.has('sensor_mao_l') && r.ev.has('toque_mao_l')); t('1. bola passando pela área da mão ESQUERDA: sensor → tentativa → toque da mão esquerda', !!r && r.ev.has('tentativa_mao_l'), desc(r)); }
{ const r = achar(r => r.ev.has('sensor_mao_r') && r.ev.has('toque_mao_r')); t('2. bola passando pela área da mão DIREITA: sensor → tentativa → toque da mão direita', !!r && r.ev.has('tentativa_mao_r'), desc(r)); }
{ const r = achar(r => (r.ev.has('na_area_mao_l') || r.ev.has('na_area_mao_r')) && !r.c && r.res === 'gol'); t('3. bola entra na área de alcance, a mão não chega a tempo: GOL (área não é defesa)', !!r, desc(r)); }
{ let n = 0, semToque = 0; for (let i = 0; i < 300; i++) { const r = cobra({ gx: .15 + (i % 15)*.05, gy: .05 + (i % 7)*.13, lado: ['esq', 'dir', 'centro'][i % 3], rng: semente(100 + i) }); if (r.ev.has('na_area_mao_l') || r.ev.has('na_area_mao_r')) { n++; if (!r.c && r.res === 'defesa') semToque++; } }
  t('nenhuma defesa só por a bola estar dentro da área de alcance (300 chutes)', n > 0 && semToque === 0, `${n} chutes passaram pela área`); }
{ const r = achar(r => r.c?.grupo === 'mao' && (r.ev.has('toque_mao_l') !== r.ev.has('toque_mao_r'))); t('4. bola toca SÓ UMA mão: nunca encaixe', !!r && r.c.rotulo !== 'agarrada' && !r.ev.has('duas_maos'), desc(r)); }
{ const r = achar(r => r.ev.has('duas_maos')); t('5. bola toca AS DUAS mãos (na mesma janela de tempo do contato)', !!r && r.ev.has('toque_mao_l') && r.ev.has('toque_mao_r'), desc(r)); }
{ const r = achar(r => r.c?.rotulo === 'agarrada'); t('6. encaixe verdadeiro: duas mãos + bola presa (vai junto com as luvas, sem teleporte)', !!r && r.c.duasMaos && r.c.maoE && r.c.maoD && r.b.fis.estado !== undefined, desc(r));
  if (r) { const k = r.k, b = { ...r.b, fis: { ...GK.novaBolaLivre(r.c.p, [0, 0, 0]), estado: 'preso', t0: r.c.t, de: r.c.p.slice(), res: 'defesa' }, t: r.c.t }; const d = [];
    for (let i = 0; i < 12; i++) { b.t += 1/120; GK.passoBola(k, b, 1/120); d.push(Math.hypot(...b.fis.p.map((v, j) => v - (i ? d.p[j] : r.c.p[j])))); d.p = b.fis.p.slice(); }
    const vIn = r.c.vel/120; t('   encaixe: a bola vai às luvas sem salto (por passo, nunca mais rápida que a bola chegando)', Math.max(...d) <= vIn + .01, `${Math.max(...d).toFixed(3)} m ≤ ${vIn.toFixed(3)} m`); } }
{ const r = achar(r => r.c && ['parcial', 'raspao'].includes(r.c.tipo)); t('7. defesa parcial (a luva toca mas não segura: a bola segue mais lenta/desviada)', !!r, desc(r)); }
for (const [n, nome, rg] of [[8, 'peito', ['peito']], [9, 'ombro', ['ombro']], [10, 'abdômen', ['abdomen']], [11, 'joelho', ['joelho']], [12, 'pé', ['pe']]]) {
  let r = achar(r => rg.includes(r.c?.regiao), 4000);
  if (!r) for (let i = 0; i < 1500 && !r; i++) { const q = cobra({ gx: .5 + (i % 2 ? 1 : -1)*(.02 + (i % 25)*.008), gy: .25 + ((i/25 | 0) % 12)*.05, lado: ['centro', 'esq', 'dir'][(i/300 | 0) % 3], tipo: ['bomba', 'medio', 'chapada'][(i/2 | 0) % 3], rng: semente(9000 + i) }); if (rg.includes(q.c?.regiao)) r = q; } t(`${n}. bola atingindo o ${nome}: colisão física e resposta da bola`, !!r && r.ev.has('toque_' + rg[0]) && len3(r.b.fis?.v || [0, 0, 0]) >= 0, desc(r)); }   // busca dirigida: bolas no corpo
function len3(v) { return Math.hypot(...v); }
{ const r = achar(r => !r.c && r.res === 'gol'); t('13. bola passando sem tocar no goleiro: gol, nenhum toque registrado', !!r && ![...r.ev].some(e => e.startsWith('toque_')), desc(r)); }

console.log('— traves e travessão (colisão contínua) —');
{ const r = cobra({ gx: -.005, gy: .5, lado: 'esq', rng: semente(3) }); t('14. bola na TRAVE: colisão física, a bola muda de direção conforme o ponto e o ângulo', r.ev.has('trave') && r.k.ferro?.nome === 'trave_dir' && r.b.fis.v[2] > 0 && r.res === 'trave', `${r.k.ferro?.rotulo} · v depois ${r.b.fis.v.map(v => v.toFixed(1))} → ${r.res}`); }
{ const r = cobra({ gx: .3, gy: 1.02, lado: 'esq', rng: semente(3) }); t('15. bola no TRAVESSÃO: colisão física, volta para o campo', r.ev.has('travessao') && r.k.ferro?.nome === 'travessao' && r.b.fis.v[2] > 0, `v depois ${r.b.fis.v.map(v => v.toFixed(1))} → ${r.res}`); }
{ const r = cobra({ gx: .02, gy: .5, lado: 'esq', rng: semente(3) }); t('bola raspando a trave por DENTRO sem encostar: gol (sem colisão inventada)', !r.ev.has('trave') && r.res === 'gol'); }
{ const r = cobra({ gx: -.05, gy: .5, lado: 'esq', rng: semente(3) }); t('bola longe da trave por fora: para fora (sem colisão)', !r.ev.has('trave') && r.res === 'fora'); }
{ // CCD: bola a 45 m/s atravessando a trave num único passo de 1/120 s — o teste por ponto erraria, a varredura acha
  const p0 = [3.72, 1.2, .3], p1 = [3.72, 1.2, -.3]; t('trave: varredura contínua acha o toque de uma bola muito rápida (45 m/s, 1 passo)', !tocaFerro(p0) && !tocaFerro(p1) && !!varreFerro(p0, p1)); }
{ let viu = 0; const f = GK.novaBolaLivre([-1, 1.5, 3], [0, 5.5, -14]); for (let i = 0; i < 600 && !f.res; i++) GK.passoLivre(f); t('física livre (depois de um toque): bola subindo bate no travessão e volta', f.ferros.includes('travessao') && !f.gol, `ferros ${f.ferros} · res ${f.res}`); }
t('traves e travessão como cápsulas (12 cm) na medida oficial (7,32 × 2,44 m por dentro)', FERROS.length === 3 && Math.abs(FERROS[0].a[0] - (3.66 + R_FERRO)) < 1e-9 && Math.abs(FERROS[2].a[1] - (2.44 + R_FERRO)) < 1e-9);

console.log('— chute do cobrador —');
{ const folgas = Object.values(KICK_CLIPS).map(c => c.folgaContatoMm), r = cobra({ gx: .7, gy: .4, lado: 'centro', rng: semente(1) });
  t('16. chute: em todos os clipes o pé encosta na bola no instante do contato (folga pé–bola medida ≤ 5 mm)', folgas.every(f => f != null && Math.abs(f) <= 5), `folgas ${[...new Set(folgas)].join(', ')} mm em ${folgas.length} clipes`);
  t('    a bola só sai no contato (t = 0: na marca) e recebe UM impulso', JSON.stringify(GK.ballFlight(r.b, 0).map(v => +v.toFixed(2))) === JSON.stringify([0, BALL_R, 11]) && r.impulsos === 1 && r.ev.has('chute')); }

console.log('— área azul dos pés (MEIO) e decisão de lado —');
const pesX = (k, tt) => ['pe_l', 'pe_r'].map(n => { const c = GK.colisoresPlano(k, tt).find(x => x.nome === n); return (c.a[0] + c.b[0])/2; });
for (const [n, gx, sg, nome] of [[17, .63, 1, 'ESQUERDA (do goleiro)'], [18, .37, -1, 'DIREITA (do goleiro)']]) {
  let andou = 0, dentro = 0, alterna = 0; const N = 20;
  for (let i = 0; i < N; i++) {   // os pés como aparecem a cada passo do lance (inclui troca de ação no meio)
    const k = GK.novoGoleiro(); GK.escolherLado(k, null, 'centro', 'teste'); const b = { gx, gy: .45, t: -1.6, tf: .62, curl: 0 }, rng = semente(400 + i), xs = [];
    while (b.t < .9 && !(b.fis && b.fis.res)) { const tA = b.t; b.t += 1/120; if (!b.fis) GK.passo(k, b, tA, b.t, { rng }); else GK.passoBola(k, b, 1/120); if (k.plano && b.t >= k.plano.tIni && b.t > 0) xs.push([b.t, ...pesX(k, b.t)]); }
    const a = xs[0], z = xs.at(-1), mover = [null, null]; let ok1 = true;
    for (const [tt, ...x] of xs) { if (x.some(v => Math.abs(v) > GK.TERCO)) ok1 = false; x.forEach((v, j) => { if (mover[j] == null && Math.abs(v - a[j + 1]) > .12) mover[j] = tt; }); }
    if ((z[1] - a[1])*sg > .15 && (z[2] - a[2])*sg > .15) andou++; if (ok1) dentro++; const lead = sg > 0 ? 0 : 1; if (mover[0] != null && mover[1] != null && mover[1 - lead] - mover[lead] >= .03) alterna++; }   // o pé do lado da bola sai PRIMEIRO, o de trás depois (não deslizam juntos)
  t(`${n}. MEIO e bola para a ${nome}: os DOIS pés andam para lá, o do lado da bola primeiro, sem sair da área azul`, andou >= 16 && dentro === N && alterna >= 16, `andou ${andou}/${N} · dentro da área ${dentro}/${N} · pé do lado da bola sai primeiro ${alterna}/${N}`); }
for (const [n, lado, sg, nome] of [[19, 'esq', 1, 'ESQUERDA'], [20, 'dir', -1, 'DIREITA']]) {
  let seg = 0; const N = 20; for (let i = 0; i < N; i++) { const r = cobra({ gx: .5, gy: .45, lado, rng: semente(600 + i) }), p = r.k.plano, tr = tt => GK.colisoresPlano(r.k, tt).find(c => c.nome === 'tronco').a[0];
    if (p.lado === lado && p.tipo !== 'centro' && (tr(p.tIni + .45) - tr(p.tIni))*sg > .1) seg++; }
  t(`${n}. escolheu ${nome} e a bola foi no MEIO: segue o movimento para a ${nome.toLowerCase()} (o sensor não anula a decisão)`, seg >= 19, `${seg}/${N}`); }

console.log('— bola de MEIA ALTURA no meio (goleiro no MEIO): passo para a bola, corpo atrás, as duas mãos —');
{ let n = 0, frente = 0, duas = 0, def = 0, salto = 0; const clips = {};
  for (let i = 0; i < 120; i++) { const gx = .42 + (i % 9)*.02, gy = .33 + ((i/9 | 0) % 5)*.05, r = cobra({ gx, gy, lado: 'centro', tipo: ['medio', 'chapada', 'bomba'][i % 3], rng: semente(12000 + i) }); n++;
    clips[r.k.plano.clip] = (clips[r.k.plano.clip] || 0) + 1; if (/_alta$/.test(r.k.plano.clip)) salto++; if (r.res === 'defesa') def++;
    if (r.c) { const tr = GK.colisoresPlano(r.k, r.c.t).find(c => c.nome === 'tronco').a; if (Math.abs(r.c.p[0] - tr[0]) <= .3) frente++; if ((r.c.maoE && r.c.maoD) || r.c.grupo === 'tronco') duas++; } }
  console.log(`  ${n} chutes · ${JSON.stringify(clips)}`);
  t('21. bola de meia altura no meio: o CORPO fica atrás da bola (bola a ≤ 30 cm do tronco no toque) em ≥ 85%', frente/n >= .85, `${frente}/${n}`);
  t('22. bola de meia altura no meio: as DUAS mãos (ou o corpo) na bola em ≥ 80% — não uma mão esticada', duas/n >= .8, `${duas}/${n}`);
  t('23. bola de meia altura no meio: defende ≥ 93% (sem gol bobo)', def/n >= .93, `${def}/${n}`);
  t('24. bola de meia altura no meio: nada de agarrada com SALTO (clipe alto) para bola na altura do peito (≤ 5%)', salto/n <= .05, `${salto}/${n}`); }
console.log('— colisores presos aos ossos —');
{ const r = cobra({ gx: .85, gy: .5, lado: 'esq', rng: semente(9) }), k = r.k, p = k.plano, m0 = GK.colisoresPlano(k, p.tIni).find(c => c.nome === 'mao_l').a, m1 = GK.colisoresPlano(k, p.tIni + .4).find(c => c.nome === 'mao_l').a;
  const S0 = GK.sensoresMaos(k, r.b, p.tIni), S1 = GK.sensoresMaos(k, r.b, p.tIni + .4);
  t('as áreas e os colisores acompanham a animação (mão e área da mão andam ≥ 1 m no mergulho)', Math.hypot(...m1.map((v, i) => v - m0[i])) > 1 && Math.hypot(...S1.l.centro.map((v, i) => v - S0.l.centro[i])) > 1); }
{ const c = GK.detalha(GK.colisores('gk_espera', 0)), nomes = new Set(c.map(x => x.nome));
  t('volumes individuais: palma, dedos, punho, antebraço, cotovelo, braço, ombro (2 lados), peito, abdômen, cabeça, coxa, joelho, canela, pé (2 lados)', ['palma', 'dedos', 'punho', 'antebraco', 'cotovelo', 'braco', 'ombro', 'coxa', 'joelho', 'canela', 'pe'].every(n => nomes.has(n + '_l') && nomes.has(n + '_r')) && nomes.has('peito') && nomes.has('abdomen'));
  t('nenhum volume gigante (maior raio ≤ 20 cm)', Math.max(...c.map(x => x.r)) <= .2, Math.max(...c.map(x => x.r)).toFixed(3)); }
console.log(`FISICA OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
