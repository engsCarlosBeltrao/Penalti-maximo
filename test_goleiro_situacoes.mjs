// GOLEIRO — as 20 situações pedidas, os 9 setores do gol e as partes do corpo: o goleiro vai na direção da bola, prefere as mãos, só defende com
// contato e o resultado depende da parte tocada.  node test_goleiro_situacoes.mjs
import * as GK from './js/keeper.js';
GK.KEEPER_CFG.saida.ctNoChute = .35;   // MODELO DO GOLEIRO CHEGANDO À BOLA (impulsão no chute): estes testes medem partes do corpo, IK, contato e física; no jogo o mergulho para o lado começa 0,3 s antes do chute (números reais em test_keeper.mjs)
import { BALL_R } from './js/rig.js';
let ok = 0, bad = 0; const t = (n, c, info = '') => { c ? ok++ : (bad++, console.log('FALHOU:', n, info)); };
const semente = s => () => (s = (s*16807) % 2147483647)/2147483647;
const TIPO = { chapada: [.8, .16], medio: [.62, 0], bomba: [.46, 0] };
function cobra({ gx, gy, tipo = 'medio', lado = 'centro', rng = Math.random, dif = 'normal' }) {
  const k = GK.novoGoleiro(); if (lado) GK.escolherLado(k, null, lado, 'teste');
  const b = { gx, gy, t: -1.6, t0: -1.6, tf: TIPO[tipo][0], curl: TIPO[tipo][1], res: null }; let res = null, hand0 = null, handMin = 9;
  const maoBola = tt => { const p = GK.ballFlight({ ...b, fis: null }, tt); let d = 9; for (const c of GK.detalha(GK.colisoresPlano(k, tt), [1, 1])) if (c.grupo === 'mao') { const q = GK.pontoMaisProximo(p, c.a, c.b).c; d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) - c.r - BALL_R); } return d; };
  while (!res && b.t < 6) { const tA = b.t; b.t += 1/120;
    if (!b.fis) { GK.passo(k, b, tA, b.t, { dif, rng }); if (k.plano && b.t >= k.plano.tIni) { const xc = GK.cruzamento(b); const cr = [xc[0], xc[1], 0];
        const mao = GK.detalha(GK.colisoresPlano(k, b.t), [1, 1]).filter(c => c.grupo === 'mao').map(c => Math.hypot(c.a[0] - cr[0], c.a[1] - cr[1])); const dm = Math.min(...mao);
        if (hand0 == null) hand0 = dm; handMin = Math.min(handMin, dm); } }
    else GK.passoBola(k, b, 1/120);
    if (b.fis) { if (b.fis.res) res = b.fis.res; } else if (b.t >= b.tf) { const out = gx < 0 || gx > 1 || gy > 1, post = !out && (gx < .035 || gx > .965 || gy > .955); res = out ? 'fora' : post ? 'trave' : 'gol'; } }
  return { res, k, c: k.contato, hand0, handMin };
}
// ---------- 9 setores (lado certo): o goleiro vai na direção da bola com as mãos ----------
const SET = { esq: .82, centro: .5, dir: .18 }, ALT = { baixa: .1, media: .45, alta: .8 }, tabela = [];
for (const [ln, gx] of Object.entries(SET)) for (const [hn, gy] of Object.entries(ALT)) {
  let def = 0, aproxima = 0, maos = 0, cont = 0, mesmoLado = 0; const N = 30;
  for (let i = 0; i < N; i++) { const r = cobra({ gx, gy, lado: ln, tipo: 'chapada', rng: semente(100 + i*7) }); if (r.res === 'defesa') def++;
    if (r.handMin < r.hand0 - .1 || r.handMin < .45) aproxima++; if (r.c) { cont++; if (r.c.grupo === 'mao') maos++; }
    const lp = r.k.plano.lado; if (ln === 'centro' ? lp === 'centro' || r.k.plano.tipo === 'curta' : lp === ln) mesmoLado++; }
  tabela.push(`${(ln + '_' + hn).padEnd(13)} defesa ${Math.round(def/N*100)}% · mãos chegam perto da bola ${Math.round(aproxima/N*100)}% · contatos com as mãos ${cont ? Math.round(maos/cont*100) : 0}% · ação do lado certo ${Math.round(mesmoLado/N*100)}%`);
  t(`${ln}_${hn}: as mãos vão até a bola (aproximam-se do cruzamento) em ≥ 80% dos chutes`, aproxima/N >= .8, `${aproxima}/${N}`);
  t(`${ln}_${hn}: ação para o lado da bola`, mesmoLado/N >= .9, `${mesmoLado}/${N}`);
  t(`${ln}_${hn}: chute fraco bem escolhido é defendido na maioria`, def/N >= .6, `${def}/${N}`);
}
console.log('9 setores, chute fraco, lado certo:\n  ' + tabela.join('\n  '));
// ---------- partes do corpo e resultados (varredura de muitos chutes) ----------
const porRegiao = {}, porClasse = {}, exemplos = {}; let s = 1; const sorte = semente(777);
for (let i = 0; i < 1500; i++) {
  const gx = .1 + sorte()*.8, gy = .03 + sorte()*.85, lado = ['esq', 'dir', 'centro'][i % 3], tipo = ['chapada', 'medio', 'bomba'][(i/3 | 0) % 3], r = cobra({ gx, gy, lado, tipo, rng: semente(s++) });
  if (!r.c) { if (r.k.dmin && r.k.dmin.d > 0 && r.k.dmin.d < .1) { exemplos.quase ||= r; porRegiao.quase = (porRegiao.quase || 0) + 1; t('passou perto sem tocar: não é defesa', r.res !== 'defesa' || gx < 0 || gx > 1); } else porRegiao.longe = (porRegiao.longe || 0) + 1; continue; }
  const rg = r.c.regiao; porRegiao[rg] = (porRegiao[rg] || 0) + 1; exemplos[rg] ||= r; const cl = GK.classe(r.c.rotulo); porClasse[cl] = (porClasse[cl] || 0) + 1; exemplos['classe_' + cl] ||= r;
  if (['dedos', 'antebraco', 'cotovelo', 'braco', 'ombro', 'lateral', 'cabeca', 'coxa', 'joelho', 'canela', 'pe'].includes(rg)) t(`${rg}: nunca encaixa a bola`, r.c.rotulo !== 'agarrada');
}
console.log('contatos por parte do corpo:', JSON.stringify(porRegiao)); console.log('resultados (A encaixe · B espalmada · C parcial · D rebote):', JSON.stringify(porClasse));
const fam = f => Object.entries(porRegiao).filter(([k]) => GK.REGIAO[k]?.fam === f).reduce((a, [, v]) => a + v, 0), total = Object.entries(porRegiao).filter(([k]) => GK.REGIAO[k]).reduce((a, [, v]) => a + v, 0);
t('prioridade das mãos: a maioria dos contatos é com as mãos', fam('mao')/total > .5, `${fam('mao')}/${total}`);
for (const [rg, nome] of [['palma', '11/7. palma'], ['dedos', '11. ponta dos dedos'], ['peito', '12. peito'], ['abdomen', '14. barriga'], ['pe', '16. pé']]) t(`${nome}: acontece contato nessa parte`, (porRegiao[rg] || 0) > 0, JSON.stringify(porRegiao));
t('13. braço/ombro (o ombro sozinho ficou raro: as luvas chegam antes — também conferido em test_goleiro_sensor.mjs, situação 16)', (porRegiao.ombro || 0) + (porRegiao.braco || 0) + (porRegiao.antebraco || 0) > 0);
t('15. perna (coxa, joelho ou canela)', (porRegiao.coxa || 0) + (porRegiao.joelho || 0) + (porRegiao.canela || 0) > 0);
t('10. passa perto da mão sem tocar', (porRegiao.quase || 0) > 0); t('17. bola fora do alcance (sem contato)', (porRegiao.longe || 0) > 0);
for (const [cl, nome] of [['A', '19. encaixe'], ['B', '20. espalmada'], ['C', 'defesa parcial'], ['D', '18. rebote']]) t(`${nome} acontece`, (porClasse[cl] || 0) > 0, JSON.stringify(porClasse));
t('encaixe só com as DUAS mãos em contato', Object.keys(exemplos).filter(k => GK.REGIAO[k]).every(rg => { const r = exemplos[rg]; return r.c.rotulo !== 'agarrada' || (r.c.duasMaos && r.c.maoE && r.c.maoD); }));
// ---------- situações do pedido (1–9) ----------
const sit = (nome, o, cond, N = 30) => { let n = 0; const regs = {}; for (let i = 0; i < N; i++) { const r = cobra({ ...o, rng: semente(900 + i) }); if (cond(r)) n++; const rg = r.c?.regiao || 'sem contato'; regs[rg] = (regs[rg] || 0) + 1; }
  console.log(`  ${nome.padEnd(34)} ${Math.round(n/N*100)}% · ${JSON.stringify(regs)}`); return n/N; };
console.log('situações (30 chutes cada):');
t('1. fraco no canto esquerdo (lado certo): defende na maioria', sit('1. fraco canto esquerdo', { gx: .85, gy: .3, tipo: 'chapada', lado: 'esq' }, r => r.res === 'defesa') >= .6);
t('2. fraco no canto direito (lado certo): defende na maioria', sit('2. fraco canto direito', { gx: .15, gy: .3, tipo: 'chapada', lado: 'dir' }, r => r.res === 'defesa') >= .6);
t('3. forte no canto esquerdo: tenta — mergulha para o canto e as mãos andam ≥ 0,8 m na direção da bola', sit('3. forte canto esquerdo', { gx: .85, gy: .3, tipo: 'bomba', lado: 'esq' }, r => r.k.plano.tipo === 'mergulho' && r.k.plano.lado === 'esq' && r.hand0 - r.handMin >= .8) >= .9);
t('4. forte no canto direito: tenta — mergulha para o canto e as mãos andam ≥ 0,8 m na direção da bola', sit('4. forte canto direito', { gx: .15, gy: .3, tipo: 'bomba', lado: 'dir' }, r => r.k.plano.tipo === 'mergulho' && r.k.plano.lado === 'dir' && r.hand0 - r.handMin >= .8) >= .9);
t('5. centro: defende, sem mergulho', sit('5. centro', { gx: .5, gy: .4, tipo: 'medio' }, r => r.res === 'defesa' && r.k.plano.tipo !== 'mergulho') >= .8);
t('6. rasteiro no meio: defende abaixando (mãos/pernas)', sit('6. rasteiro', { gx: .5, gy: .05, tipo: 'medio' }, r => r.res === 'defesa' && /baixa/.test(r.k.plano.clip)) >= .7);
t('7. altura do peito: defende com mãos ou peito', sit('7. peito', { gx: .5, gy: .5, tipo: 'medio' }, r => r.res === 'defesa' && ['mao', 'tronco'].includes(r.c?.grupo)) >= .8);
t('8. alto no meio: braços para cima/salto', sit('8. alto', { gx: .5, gy: .85, tipo: 'medio' }, r => /alta/.test(r.k.plano.clip) && r.c?.grupo === 'mao') >= .7);
t('9. muito perto do corpo: reação curta (sem mergulho completo)', sit('9. perto do corpo', { gx: .62, gy: .35, tipo: 'medio' }, r => r.k.plano.tipo !== 'mergulho') >= .7);
// ---------- IK das mãos: limites ----------
{ let n = 0, viol = 0; for (let i = 0; i < 200; i++) { const r = cobra({ gx: .2 + (i % 7)*.1, gy: .1 + (i % 5)*.18, tipo: 'medio', lado: ['esq', 'dir', 'centro'][i % 3], rng: semente(i + 5) }); const aj = r.k.plano?.ajuste;
    if (aj) for (const a of Object.values(aj)) { n++; { const M = r.k.lado === 'centro' ? GK.KEEPER_CFG.meio : null; if (a.desloc > (M ? M.ikMax : GK.KEEPER_CFG.ajuste.max) + 1e-6 || (a.angC || 0) > GK.KEEPER_CFG.ajuste.cotovelo + 1e-6 || a.distAntes > Math.hypot(...GK.KEEPER_CFG.caixaMao)*(M ? M.caixa : 1)) viol++; } } }
  t(`IK das mãos dentro dos limites (≤ ${GK.KEEPER_CFG.ajuste.max*100} cm, cotovelo ≤ 34°, só com a bola dentro da área de alcance da mão) em ${n} ajustes`, n > 0 && viol === 0, viol); }
console.log(`SITUACOES OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
