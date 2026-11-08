// GOLEIRO — régua roxa: existe SÓ com a decisão MEIO (presa ao goleiro antes do chute, congelada no chute, deslocamento dentro dela); ESQUERDA/DIREITA:
// sem régua, salto/mergulho para o lado escolhido. Bolas fracas, médias e fortes.  node test_goleiro_regua.mjs
import * as GK from './js/keeper.js';
import { novaMemoria, probabilidades, registrar } from './js/goleiroMemoria.js';
let ok = 0, bad = 0; const t = (n, c, info = '') => { c ? ok++ : (bad++, console.log('FALHOU:', n, info)); if (c) console.log(`ok  ${n}${info !== '' ? ' · ' + info : ''}`); };
const semente = s => () => (s = (s*16807) % 2147483647)/2147483647;
const TIPO = { chapada: [.8, .16], medio: [.62, 0], bomba: [.46, 0] }, NOME = { chapada: 'fraca', medio: 'média', bomba: 'forte' };
function cobra({ gx, gy = .45, tipo, lado, rng }) {
  const k = GK.novoGoleiro(); GK.escolherLado(k, null, lado, 'teste'); const b = { gx, gy, t: -1.6, tf: TIPO[tipo][0], curl: TIPO[tipo][1] }, hist = []; let res = null;
  while (!res && b.t < 4) { const tA = b.t; b.t += 1/120; if (!b.fis) GK.passo(k, b, tA, b.t, { rng }); else GK.passoBola(k, b, 1/120);
    hist.push({ t: b.t, regua: k.regua ? { ...k.regua } : null, tr: k.plano && b.t >= k.plano.tIni ? GK.colisoresPlano(k, b.t).find(c => c.nome === 'tronco').a[0] : null });
    if (b.fis) { if (b.fis.res) res = b.fis.res; } else if (b.t >= b.tf) res = 'gol'; }
  return { k, res, hist };
}
for (const tipo of ['chapada', 'medio', 'bomba']) {
  console.log(`— bola ${NOME[tipo]} (${tipo}) —`);
  { // MEIO: régua ativa, acompanha antes do chute, congela no chute, o tronco fica dentro dela, nunca mergulho
    let ativa = 0, congela = 0, dentro = 0, semMerg = 0, anda = 0; const N = 18;
    for (let i = 0; i < N; i++) { const gx = [.35, .42, .5, .58, .65, .7][i % 6], r = cobra({ gx, tipo, lado: 'centro', rng: semente(300 + i) }), H = r.hist;
      const antes = H.filter(h => h.t < 0 && h.regua), depois = H.filter(h => h.t >= 0 && h.regua), R0 = depois[0]?.regua;
      if (antes.length && depois.length && H.every(h => h.t < -1.3 || h.regua?.ativa)) ativa++;
      if (R0 && depois.every(h => h.regua.congelada && h.regua.centro === R0.centro && h.regua.altura === R0.altura) && R0.tCongelada != null && R0.tCongelada < .01) congela++;
      if (H.filter(h => h.tr != null && h.t >= 0).every(h => Math.abs(h.tr - R0.centro) <= R0.meia + 1e-6)) dentro++;
      if (r.k.plano.tipo !== 'mergulho' && r.k.plano.tipo !== 'bloqueio') semMerg++;
      const trs = H.filter(h => h.tr != null && h.t >= 0).map(h => h.tr); if (Math.abs(gx - .5) < .05 || (trs.at(-1) - trs[0])*(gx - .5) > 0) anda++; }
    t(`MEIO (${NOME[tipo]}): a régua aparece e fica presa ao goleiro antes do chute`, ativa === N, `${ativa}/${N}`);
    t(`MEIO (${NOME[tipo]}): a régua CONGELA no instante do chute (centro e altura não mudam mais)`, congela === N, `${congela}/${N}`);
    t(`MEIO (${NOME[tipo]}): depois do chute o goleiro se desloca DENTRO da régua`, dentro === N, `${dentro}/${N}`);
    t(`MEIO (${NOME[tipo]}): nunca mergulho (nem bloqueio lateral) — usa a régua`, semMerg === N, `${semMerg}/${N}`);
    t(`MEIO (${NOME[tipo]}): anda para o lado da bola (ou fica, com a bola no centro)`, anda >= N - 1, `${anda}/${N}`); }
  for (const [lado, sg, nome] of [['esq', 1, 'ESQUERDA'], ['dir', -1, 'DIREITA']]) {
    let semRegua = 0, salto = 0, paraLado = 0; const N = 15;
    for (let i = 0; i < N; i++) { const gx = [.2, .35, .5, .65, .8][i % 5], r = cobra({ gx, tipo, lado, rng: semente(500 + i) }), p = r.k.plano;
      if (r.hist.every(h => !h.regua)) semRegua++; if (p.tipo === 'mergulho' && p.lado === lado) salto++;
      const trs = r.hist.filter(h => h.tr != null && h.t >= 0).map(h => h.tr); if ((trs.at(-1) - GK.colisores('gk_espera', 0).find(c => c.nome === 'tronco').a[0])*sg > .3) paraLado++; }   // desde a posição inicial (o mergulho começa 0,8 s antes do chute)
    t(`${nome} (${NOME[tipo]}): a régua NÃO aparece em nenhum instante`, semRegua === N, `${semRegua}/${N}`);
    t(`${nome} (${NOME[tipo]}): salto/mergulho para a ${nome.toLowerCase()} (com a bola em qualquer lugar)`, salto === N && paraLado === N, `mergulho ${salto}/${N} · corpo foi ≥ 0,3 m para o lado ${paraLado}/${N}`); }
}
{ // MEIO e bola NO MEIO, qualquer força: não pode ser gol (o goleiro está na frente da bola). Posições e alturas sorteadas na área central.
  const r0 = semente(77), z = { miolo: [0, 0], beira: [0, 0] }, tipos = { chapada: 0, medio: 0, bomba: 0 }, gTipo = { chapada: 0, medio: 0, bomba: 0 };
  for (let i = 0; i < 450; i++) { const tipo = ['chapada', 'medio', 'bomba'][i % 3], x = (r0()*2 - 1)*GK.TERCO, gy = .02 + r0()*.9, r = cobra({ gx: x/7.32 + .5, gy, tipo, lado: 'centro', rng: semente(30000 + i) });
    const zona = Math.abs(x) <= .9 ? 'miolo' : 'beira'; z[zona][0]++; tipos[tipo]++; if (r.res !== 'defesa') { z[zona][1]++; gTipo[tipo]++; } }
  console.log(`  MEIO × bola no meio: miolo ${z.miolo[1]} gols em ${z.miolo[0]} · beira ${z.beira[1]} em ${z.beira[0]} · por força: fraca ${gTipo.chapada}/${tipos.chapada}, média ${gTipo.medio}/${tipos.medio}, forte ${gTipo.bomba}/${tipos.bomba}`);
  t('MEIO e bola no MIOLO do meio (até 0,9 m do centro), fraca/média/forte: nenhum gol', z.miolo[1] === 0, `${z.miolo[1]}/${z.miolo[0]}`);
  t('MEIO e bola na BEIRA da área central (0,9–1,22 m): defende ≥ 97%', z.beira[1] <= .03*z.beira[0], `${z.beira[1]}/${z.beira[0]}`); }
t('candidatos: MEIO sem mergulho/bloqueio; ESQUERDA/DIREITA só mergulho para o próprio lado (sem passos da régua)',
  !GK.candidatos('centro').some(c => c.tipo === 'mergulho' || c.tipo === 'bloqueio') && GK.candidatos('esq').every(c => c.tipo === 'mergulho' && c.lado === 'esq') && GK.candidatos('dir').every(c => c.tipo === 'mergulho' && c.lado === 'dir'));
{ const m = novaMemoria(); const p0 = probabilidades(m); registrar(m, 'esq'); const p1 = probabilidades(m);
  t('probabilidades e memória intactas (1/3 cada; depois de esquerda, esquerda ÷ 12)', Math.abs(p0.centro - 1/3) < 1e-9 && Math.abs(p1.esq - 1/36) < 1e-9); }
console.log(`REGUA OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
