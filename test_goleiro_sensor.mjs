// GOLEIRO — memória de escolha do lado (÷12, ÷2, reinício), sensor de trajetória, mãos guiadas pelo sensor, encaixe só com as duas mãos,
// saída antes do chute/velocidade e as 20 situações do pedido.  node test_goleiro_sensor.mjs
import * as GK from './js/keeper.js';
import { novaMemoria, probabilidades, registrar, sortear, memoriaDe, limparMemorias } from './js/goleiroMemoria.js';
let ok = 0, bad = 0; const t = (n, c, info = '') => { c ? ok++ : (bad++, console.log('FALHOU:', n, info)); };
const perto = (a, b, e = 1e-9) => Math.abs(a - b) < e, semente = s => () => (s = (s*16807) % 2147483647)/2147483647, pc = p => `E ${(p.esq*100).toFixed(2)}% · C ${(p.centro*100).toFixed(2)}% · D ${(p.dir*100).toFixed(2)}%`;
const soma1 = p => perto(p.esq + p.centro + p.dir, 1) && [p.esq, p.centro, p.dir].every(v => v >= 0 && v <= 1);

// ---------- 1. memória de escolha do lado ----------
console.log('Sequências de probabilidade (probabilidades para a PRÓXIMA cobrança):');
const seq = (escolhas) => { const m = novaMemoria(), lin = [`início: ${pc(probabilidades(m))}`]; for (const d of escolhas) { registrar(m, d); lin.push(`${d} → ${pc(probabilidades(m))}`); } console.log('  ' + lin.join('  |  ')); return probabilidades(m); };
{ const p0 = probabilidades(novaMemoria()); t('inicial: 33,33% cada', perto(p0.esq, 1/3) && perto(p0.centro, 1/3) && perto(p0.dir, 1/3)); }
{ const p = seq(['esq']); t('esquerda → próxima: esquerda = 33,33% ÷ 12', perto(p.esq, 1/36)); t('…as outras duas dividem o resto por igual e soma 100%', perto(p.centro, p.dir) && soma1(p)); }
{ const p = seq(['esq', 'esq']); t('esquerda, esquerda → esquerda = 33,33% ÷ 12 ÷ 2', perto(p.esq, 1/72) && soma1(p)); }
{ const p = seq(['esq', 'esq', 'esq']); t('esquerda ×3 → esquerda = 33,33% ÷ 12 ÷ 2 ÷ 2', perto(p.esq, 1/144) && soma1(p)); }
{ const p = seq(['esq', 'dir']); t('esquerda, depois direita → esquerda e direita voltam a 33,33% (sequência reiniciada)', perto(p.esq, 1/3) && perto(p.dir, 1/3) && perto(p.centro, 1/3)); }
{ const p = seq(['dir', 'dir']); t('direita, direita → direita = 33,33% ÷ 12 ÷ 2', perto(p.dir, 1/72) && soma1(p)); }
{ const p = seq(['centro', 'centro']); t('centro, centro → centro = 33,33% ÷ 12 ÷ 2', perto(p.centro, 1/72) && soma1(p)); }
{ const p = seq(['centro', 'esq']); t('centro, depois esquerda → tudo volta a 33,33%', perto(p.esq, 1/3) && perto(p.centro, 1/3) && perto(p.dir, 1/3)); }
{ const p = seq(['esq', 'esq', 'esq', 'centro']); t('esquerda ×3, depois centro → tudo volta a 33,33%', [p.esq, p.centro, p.dir].every(v => perto(v, 1/3))); }
{ const p = seq(['esq', 'dir', 'dir']); t('depois de reiniciar, repetir a nova direção recomeça a redução (÷12)', perto(p.dir, 1/36) && soma1(p)); }
{ let okSoma = true; const m = novaMemoria(), r = semente(3); for (let i = 0; i < 2000; i++) { registrar(m, sortear(m, r)); okSoma &&= soma1(probabilidades(m)); } t('2000 escolhas seguidas: probabilidades sempre válidas (0–100%, soma 100%)', okSoma); }
{ // o sorteio segue as probabilidades (frequência medida)
  const cont = { esq: 0, centro: 0, dir: 0 }, r = semente(9), N = 30000; for (let i = 0; i < N; i++) { const m = novaMemoria(); registrar(m, 'esq'); cont[sortear(m, r)]++; }
  t(`sorteio respeita as probabilidades (depois de esquerda: E ${(cont.esq/N*100).toFixed(1)}% ≈ 2,78%)`, Math.abs(cont.esq/N - 1/36) < .005 && Math.abs(cont.centro/N - cont.dir/N) < .02); }
{ limparMemorias(); registrar(memoriaDe('goleiro-A'), 'esq'); registrar(memoriaDe('goleiro-A'), 'esq'); registrar(memoriaDe('goleiro-B'), 'dir');
  t('memória individual: goleiros diferentes não se misturam', perto(probabilidades(memoriaDe('goleiro-A')).esq, 1/72) && perto(probabilidades(memoriaDe('goleiro-B')).dir, 1/36) && perto(probabilidades(memoriaDe('goleiro-B')).esq, (1 - 1/36)/2));
  t('memória persiste para o mesmo goleiro', memoriaDe('goleiro-A').historico.join() === 'esq,esq'); }

// ---------- cobrança isolada ----------
const TIPO = { chapada: [.8, .16], medio: [.62, 0], bomba: [.46, 0] };
function cobra({ gx, gy, tipo = 'medio', lado = 'centro', rng = Math.random, dif = 'normal', semAjuste = false }) {
  const k = GK.novoGoleiro(); if (lado) GK.escolherLado(k, null, lado, 'teste'); const b = { gx, gy, t: -1.6, tf: TIPO[tipo][0], curl: TIPO[tipo][1] }; let res = null; const sens = [];
  const max0 = GK.KEEPER_CFG.ajuste.max; if (semAjuste) GK.KEEPER_CFG.ajuste.max = 0;
  try { while (!res && b.t < 6) { const tA = b.t; b.t += 1/120; if (!b.fis) { GK.passo(k, b, tA, b.t, { dif, rng }); if (k.sensor && b.t < b.tf) sens.push({ ...k.sensor }); } else GK.passoBola(k, b, 1/120);
    if (b.fis) { if (b.fis.res) res = b.fis.res; } else if (b.t >= b.tf) res = gx < 0 || gx > 1 || gy > 1 ? 'fora' : 'gol'; } } finally { GK.KEEPER_CFG.ajuste.max = max0; }
  return { res, k, c: k.contato, sens };
}
// ---------- 2. sensor ----------
{ const r = cobra({ gx: .82, gy: .8, lado: 'esq', tipo: 'chapada', rng: semente(4) }), s0 = r.sens[0], s1 = r.sens.at(-1);
  t('sensor: começa com erro de leitura e converge para o ponto real (≤ 3 cm no fim)', s0.erro > s1.erro && s1.erro <= .03, `${s0.erro} → ${s1.erro}`);
  t('sensor: tempo até a bola chegar só diminui e acaba perto de 0 (ou no toque)', r.sens.every((x, i) => i === 0 || x.tempo <= r.sens[i - 1].tempo + 1e-9) && (s1.tempo < .02 || (r.c && Math.abs(s1.tempo - (.8 - r.c.t)) < .03)), `${s1.tempo} toque ${r.c?.t}`);
  t('sensor: região descrita em coordenadas reais (canto esquerdo, alto)', /canto esquerdo, alto/.test(s1.regiao), s1.regiao);
  t('sensor: indica a parte do corpo mais perto de alcançar a bola', !!s1.parte && s1.dist != null, JSON.stringify(s1));
  console.log(`  sensor no início: ponto (${s0.ponto}) erro ${s0.erro} m, ${s0.regiao}, faltam ${s0.tempo} s · no fim: ponto (${s1.ponto}) erro ${s1.erro} m, parte mais perto ${s1.regiaoParte} a ${Math.round(s1.dist*100)} cm`); }
{ const pts = [[.6, .2], [.7, .55], [.95, .9], [.3, .1], [.12, .7]].map(([gx, gy]) => { const s = cobra({ gx, gy, lado: 'centro', tipo: 'medio', rng: semente(8) }).sens.at(-1); return [gx, gy, s]; });
  t('sensor: pontos diferentes dentro do mesmo lado têm coordenadas diferentes (não só 9 casas)', new Set(pts.map(p => p[2].ponto.join())).size === pts.length, pts.map(p => p[2].ponto.join()).join(' / ')); }
// ---------- 3. mãos guiadas pelo sensor ----------
{ let com = 0, sem = 0, N = 60; for (let i = 0; i < N; i++) { const o = { gx: .78 + (i % 5)*.02, gy: .25 + (i % 4)*.12, lado: 'esq', tipo: 'medio', rng: semente(50 + i) };
    if (cobra(o).c) com++; if (cobra({ ...o, rng: semente(50 + i), semAjuste: true }).c) sem++; }
  t(`mãos levadas ao ponto pelo sensor (IK): mais contatos com o ajuste (${com}/${N}) do que sem (${sem}/${N})`, com > sem); }
// ---------- 4. encaixe só com as duas mãos ----------
{ let encaixes = 0, invalidos = 0, umaMao = 0, umaMaoEncaixe = 0, escapou = 0;
  for (let i = 0; i < 600; i++) { const r = cobra({ gx: .25 + (i % 11)*.05, gy: .1 + (i % 7)*.12, lado: ['esq', 'dir', 'centro'][i % 3], tipo: ['chapada', 'medio', 'bomba'][i % 3], rng: semente(700 + i) }); const c = r.c; if (!c) continue;
    if (c.rotulo === 'agarrada') { encaixes++; if (!(c.duasMaos && c.maoE && c.maoD)) invalidos++; }
    if (c.grupo === 'mao' && !(c.maoE && c.maoD)) { umaMao++; if (c.rotulo === 'agarrada') umaMaoEncaixe++; }
    if (c.escapou) escapou++; }
  t(`todo encaixe tem as DUAS mãos em contato (${encaixes} encaixes)`, encaixes > 0 && invalidos === 0, invalidos);
  t(`contato de uma mão só nunca vira encaixe (${umaMao} contatos de uma mão)`, umaMao > 0 && umaMaoEncaixe === 0);
  t(`bola nas duas mãos pode escapar (${escapou} vezes)`, escapou > 0); }
// ---------- 5. saída antes do chute e velocidade ----------
{ const r = cobra({ gx: .85, gy: .5, lado: 'esq', tipo: 'bomba', rng: semente(1) });
  t('com lado escolhido, o goleiro já está em movimento ANTES do chute (≤ 0,2 s, fase inicial)', r.k.log.some(l => /começa a sair para esq a 0\.\d\d s do chute/.test(l)) && r.k.plano.saiuAntes); }
{ // alcance lateral das mãos 0,35 s depois do chute: agora × sem a saída e com a reação antiga (0,12 s)
  const mede = (antes, reac) => { const s0 = GK.KEEPER_CFG.saida.antes, r0 = GK.KEEPER_CFG.reacao.lado.normal; GK.KEEPER_CFG.saida.antes = antes; GK.KEEPER_CFG.reacao.lado.normal = reac; let soma = 0;
    try { for (let i = 0; i < 10; i++) { const k = GK.novoGoleiro(); GK.escolherLado(k, null, 'esq', 't'); const b = { gx: .85, gy: .5, t: -1.6, tf: .62, curl: 0 }; const rng = semente(30 + i);
      while (b.t < .35) { const tA = b.t; b.t += 1/120; GK.passo(k, b, tA, b.t, { rng }); } soma += Math.max(...GK.detalha(GK.colisoresPlano(k, .35)).filter(c => c.grupo === 'mao').map(c => c.a[0])); } }
    finally { GK.KEEPER_CFG.saida.antes = s0; GK.KEEPER_CFG.reacao.lado.normal = r0; } return soma/10; };
  const novo = mede(.2, .08), antigo = mede(0, .12);
  console.log(`  mão mais lateral 0,35 s depois do chute: agora ${novo.toFixed(2)} m · antes (sem saída, reação 0,12 s) ${antigo.toFixed(2)} m`);
  t('goleiro mais rápido: as mãos chegam mais longe no mesmo tempo', novo > antigo + .1); }
// ---------- 6. as 20 situações ----------
console.log('20 situações (40 chutes cada; defesa = % que não foi gol):');
const sit = (n, nome, o, cond, min = .5, N = 40) => { let c = 0; const regs = {}; for (let i = 0; i < N; i++) { const r = cobra({ ...o, rng: semente(1000*n + i) }); if (cond(r)) c++; const d = r.c ? GK.defesaNome(r.c) : 'sem contato'; regs[d] = (regs[d] || 0) + 1; }
  const top = Object.entries(regs).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', '); console.log(`  ${String(n).padStart(2)}. ${nome.padEnd(36)} ${Math.round(c/N*100)}% · ${top}`); t(`${n}. ${nome}`, c/N >= min, `${c}/${N}`); };
const def = r => r.res === 'defesa', gol = r => r.res === 'gol';
sit(1, 'escolhe esquerda, bola na esquerda', { gx: .8, gy: .4, lado: 'esq', tipo: 'medio' }, def, .6);
sit(2, 'escolhe esquerda, bola na direita', { gx: .2, gy: .4, lado: 'esq', tipo: 'medio' }, gol, .9);
sit(3, 'escolhe direita, bola na esquerda', { gx: .8, gy: .4, lado: 'dir', tipo: 'medio' }, gol, .9);
sit(4, 'escolhe centro, bola no centro', { gx: .5, gy: .4, lado: 'centro', tipo: 'medio' }, def, .85);
sit(5, 'escolhe centro, bola no canto (passos, sem mergulho)', { gx: .88, gy: .4, lado: 'centro', tipo: 'medio' }, r => r.k.plano.tipo !== 'mergulho' && r.k.plano.lado === 'esq', .9);
sit(6, 'canto inferior (lado certo)', { gx: .82, gy: .08, lado: 'esq', tipo: 'chapada' }, def, .6);
sit(7, 'canto superior (lado certo)', { gx: .82, gy: .85, lado: 'esq', tipo: 'chapada' }, def, .6);
sit(8, 'meio', { gx: .5, gy: .45, lado: 'centro', tipo: 'medio' }, def, .85);
sit(9, 'forte (bomba) no lado escolhido, meia altura', { gx: .78, gy: .45, lado: 'esq', tipo: 'bomba' }, r => r.k.plano.lado === 'esq', .9);
sit(10, 'fraco (chapada) no lado escolhido', { gx: .78, gy: .45, lado: 'esq', tipo: 'chapada' }, def, .7);
sit(11, 'bola próxima das mãos', { gx: .62, gy: .45, lado: 'centro', tipo: 'medio' }, r => r.c?.grupo === 'mao', .7);
sit(12, 'bola fora do alcance das mãos (ângulo)', { gx: .98, gy: .93, lado: 'esq', tipo: 'bomba' }, r => !r.c, .9);
{ const achar = (pred, nome, n) => { for (let i = 0; i < 3000; i++) { const r = cobra({ gx: .15 + (i % 15)*.05, gy: .03 + ((i/15 | 0) % 13)*.07, lado: ['esq', 'dir', 'centro'][i % 3], tipo: ['chapada', 'medio', 'bomba'][(i/7 | 0) % 3], rng: semente(5000 + i) }); if (pred(r)) { console.log(`  ${String(n).padStart(2)}. ${nome.padEnd(36)} encontrado: ${GK.defesaNome(r.c)} (${r.c?.parte ?? '—'}) → ${r.res}`); return true; } } return false; };
  t('13. encaixe com as duas mãos', achar(r => r.c?.rotulo === 'agarrada' && r.c.maoE && r.c.maoD, 'encaixe com as duas mãos', 13));
  t('14. contato com apenas uma mão', achar(r => r.c?.grupo === 'mao' && !(r.c.maoE && r.c.maoD), 'contato com apenas uma mão', 14));
  t('15. contato com o peito', achar(r => r.c?.regiao === 'peito', 'contato com o peito', 15));
  t('16. contato com o ombro', achar(r => r.c?.regiao === 'ombro', 'contato com o ombro', 16));
  t('17. contato com a barriga', achar(r => r.c?.regiao === 'abdomen', 'contato com a barriga', 17));
  t('18. contato com as pernas', achar(r => ['coxa', 'joelho', 'canela'].includes(r.c?.regiao), 'contato com as pernas', 18));
  t('19. contato com os pés', achar(r => r.c?.regiao === 'pe', 'contato com os pés', 19));
  t('20. bola que não encosta no goleiro: nunca é defesa', achar(r => !r.c && r.res === 'gol', 'bola que não encosta em nada', 20)); }
{ let falsas = 0; for (let i = 0; i < 400; i++) { const r = cobra({ gx: .1 + (i % 9)*.1, gy: .05 + (i % 6)*.15, lado: ['esq', 'dir', 'centro'][i % 3], tipo: 'medio', rng: semente(9000 + i) }); if (r.res === 'defesa' && !r.c) falsas++; }
  t('nenhuma defesa sem contato físico em 400 chutes', falsas === 0, falsas); }
// ---------- 7. CENTRO: pequenos ajustes com passos (item 14) ----------
console.log('centro com ajuste de passos:');
{ const varre = (o, N = 24) => Array.from({ length: N }, (_, i) => cobra({ ...o, rng: semente(4400 + i) }));
  const tipos = rs => { const m = {}; rs.forEach(r => { const c = r.k.plano.clip; m[c] = (m[c] || 0) + 1; }); return JSON.stringify(m); };
  const esqPerto = varre({ gx: .6, gy: .45, lado: 'centro', tipo: 'medio' }), dirPerto = varre({ gx: .4, gy: .45, lado: 'centro', tipo: 'medio' });
  console.log('  bola um pouco à esquerda:', tipos(esqPerto)); console.log('  bola um pouco à direita:', tipos(dirPerto));
  t('centro + bola um pouco à esquerda: passos para a esquerda (ou fica no meio), nunca mergulho', esqPerto.every(r => r.k.plano.tipo !== 'mergulho' && r.k.plano.lado !== 'dir') && esqPerto.filter(r => r.k.plano.lado === 'esq').length >= 18);
  t('centro + bola um pouco à direita: passos para a direita (ou fica no meio), nunca mergulho', dirPerto.every(r => r.k.plano.tipo !== 'mergulho' && r.k.plano.lado !== 'esq') && dirPerto.filter(r => r.k.plano.lado === 'dir').length >= 18);
  t('centro + bola um pouco à esquerda/direita: defende na grande maioria', [...esqPerto, ...dirPerto].filter(r => r.res === 'defesa').length >= 42);
  const meio = varre({ gx: .5, gy: .45, lado: 'centro', tipo: 'medio' }); t('centro + bola no centro: fica centralizado', meio.filter(r => r.k.plano.tipo === 'centro').length >= 20, tipos(meio));
  const baixa = varre({ gx: .55, gy: .08, lado: 'centro', tipo: 'medio' }), alta = varre({ gx: .55, gy: .8, lado: 'centro', tipo: 'medio' });
  t('centro + bola baixa: abaixa (ação baixa) na grande maioria', baixa.filter(r => /baixa/.test(r.k.plano.clip)).length >= 17, tipos(baixa));
  t('centro + bola alta: levanta os braços (ação alta)', alta.filter(r => /alta/.test(r.k.plano.clip)).length >= 20, tipos(alta));
  const longe = varre({ gx: .92, gy: .45, lado: 'centro', tipo: 'bomba' }); t('centro + bola muito longe: tenta com os passos, sem virar mergulho para o canto', longe.every(r => r.k.plano.tipo !== 'mergulho') && longe.every(r => r.k.plano.lado === 'esq'), tipos(longe));
  // limites do deslocamento: corpo (tronco) não sai demais do centro, não avança/atravessa a linha e não "teleporta"
  let maxX = 0, maxZ = 0, minZ = 9, maxV = 0;
  for (const r of [...esqPerto, ...dirPerto, ...longe]) { let ant = null; for (let tt = r.k.plano.tIni; tt <= r.k.plano.tIni + 1.2; tt += 1/60) { const tr = GK.colisoresPlano(r.k, tt).find(c => c.nome === 'tronco').a;
      maxX = Math.max(maxX, Math.abs(tr[0])); maxZ = Math.max(maxZ, tr[2] - GK.KEEPER_CFG.raiz[2]); minZ = Math.min(minZ, tr[2]); if (ant) maxV = Math.max(maxV, Math.hypot(tr[0] - ant[0], tr[2] - ant[2])*60); ant = tr; } }
  console.log(`  tronco: até ${maxX.toFixed(2)} m do centro, avança até ${maxZ.toFixed(2)} m a partir da base (mínimo ${minZ.toFixed(2)} m da linha), ${maxV.toFixed(1)} m/s no máximo`);
  t('passos não tiram o goleiro demais do centro (tronco ≤ 0,9 m)', maxX <= .9, maxX); t('passos não avançam demais (≤ 0,5 m, o passo frontal de goleiros reais) nem atravessam a linha do gol', maxZ <= .5 && minZ > 0, `${maxZ} ${minZ}`); t('sem deslocamento instantâneo (tronco ≤ 4 m/s)', maxV <= 4, maxV);
  // com lado escolhido, nada de passos para trocar de lado
  const lados = [...varre({ gx: .4, gy: .45, lado: 'esq', tipo: 'medio' }), ...varre({ gx: .6, gy: .45, lado: 'dir', tipo: 'medio' })];
  t('lado escolhido: nunca usa os passos do centro nem passo para o lado oposto', lados.every(r => r.k.plano.tipo !== 'passos' && (r.k.plano.lado === r.k.lado || r.k.plano.lado === 'centro')), tipos(lados));
  t('candidatos: passos só existem quando a escolha é centro', GK.candidatos('centro').some(c => c.tipo === 'passos') && !GK.candidatos('esq').some(c => c.tipo === 'passos') && !GK.candidatos('dir').some(c => c.tipo === 'passos') && !GK.candidatos('centro').some(c => c.tipo === 'mergulho')); }
// ---------- 8. três áreas do gol (terços) e transição de pose igual à da tela ----------
{ const T = 7.32/6; t('áreas: terços iguais da largura (meio = |x| ≤ 1,22 m)', Math.abs(GK.TERCO - T) < 1e-9 && GK.areaDe(T + .01) === 'esq' && GK.areaDe(T - .01) === 'centro' && GK.areaDe(-T - .01) === 'dir' && GK.areaDe(0) === 'centro');
  t('áreas: nomes como na tela (esquerda do goleiro = DIREITA da tela)', GK.NOME_AREA.esq === 'DIREITA' && GK.NOME_AREA.dir === 'ESQUERDA' && GK.NOME_AREA.centro === 'MEIO');
  const casos = [[.15, 'dir'], [.5, 'centro'], [.85, 'esq'], [.4, 'centro'], [.3, 'dir']]; let okA = true;
  for (const [gx, a] of casos) { const r = cobra({ gx, gy: .5, lado: 'centro', tipo: 'medio', rng: semente(77) }); okA &&= r.sens.at(-1).area === a && r.sens.at(-1).areaReal === a; }
  t('sensor: identifica a área (terço) em que a bola vai chegar, mantendo as coordenadas exatas', okA);
  const r = cobra({ gx: .45, gy: .4, lado: 'esq', tipo: 'medio', rng: semente(5) }), k = r.k, p = k.plano;
  t('escolha esquerda e bola no meio: prepara para a esquerda (área escolhida ≠ área da bola)', k.lado === 'esq' && r.sens.at(-1).area === 'centro');
  if (p.foto) { const ini = GK.colisoresPlano({ plano: { ...p, ajuste: null } }, p.tIni), fim = GK.colisoresPlano({ plano: { ...p, ajuste: null } }, p.tIni + (p.blend + .05)/(p.ritmo || 1)), puro = GK.colisores(p.clip, GK.ctDe({ plano: p }, p.tIni + (p.blend + .05)/(p.ritmo || 1)));
    const d = (A, B, n) => { const a = A.find(c => c.nome === n).a, b = B.find(c => c.nome === n).a; return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };
    t('transição: no início da ação a física parte da pose que estava na tela (foto)', d(ini, p.foto, 'mao_l') < .01 && d(ini, p.foto, 'mao_r') < .01);
    t('transição: depois do blend a física é o clipe puro', d(fim, puro, 'mao_l') < .01 && d(fim, puro, 'mao_r') < .01); }
  else t('transição: plano tem foto da pose anterior', false); }
console.log(`SENSOR OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
