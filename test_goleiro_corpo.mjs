// GOLEIRO — barreira física do corpo inteiro e contato real das mãos: a bola nunca atravessa o goleiro (antes ou depois do 1º toque, em mergulhos e
// chutes muito fortes), sai da superfície tocada, a mão tem prioridade, o encaixe segura a bola entre as palmas.  node test_goleiro_corpo.mjs
import * as GK from './js/keeper.js';
GK.KEEPER_CFG.saida.ctNoChute = .35;   // MODELO DO GOLEIRO CHEGANDO À BOLA (impulsão no chute): estes testes medem partes do corpo, IK, contato e física; no jogo o mergulho para o lado começa 0,8 s antes do chute (números reais em test_keeper.mjs)
import { BALL_R } from './js/rig.js';
let ok = 0, bad = 0; const t = (n, c, info = '') => { c ? ok++ : (bad++, console.log('FALHOU:', n, info)); if (c) console.log(`ok  ${n}${info !== '' ? ' · ' + info : ''}`); };
const semente = s => () => (s = (s*16807) % 2147483647)/2147483647;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = a => Math.hypot(...a);
// penetração da bola no corpo (m; > 0 = dentro de algum colisor)
const penetra = (k, p, tt) => { let pior = -9, parte = null; const ct = k.contato, cede = ct && ['mao', 'antebraco', 'braco'].includes(ct.grupo) && tt < ct.t + GK.KEEPER_CFG.corpo.cede;
  for (const c of GK.detalha(GK.colisoresPlano(k, tt))) { if (cede && ['mao', 'antebraco', 'braco'].includes(c.grupo)) continue; const q = GK.pontoMaisProximo(p, c.a, c.b).c, d = c.r + BALL_R - len(sub(p, q)); if (d > pior) { pior = d; parte = c.nome; } } return { pen: pior, parte }; };   // (luvas cedendo junto com a bola por 0,25 s não contam)
function cobra({ gx, gy, tf = .62, lado = 'centro', rng, apos = 1.2, semente: sd }) {
  const rng0 = sd != null ? semente(sd) : rng; rng = rng0;
  const k = GK.novoGoleiro(); GK.escolherLado(k, null, lado, 'teste'); const b = { gx, gy, t: -1.6, tf, curl: 0 }; let res = null, penAntes = -9, penDepois = -9, estados = new Set(), tc = null, segura = [];
  while (b.t < 4) { const tA = b.t; b.t += 1/120;
    if (!b.fis) { GK.passo(k, b, tA, b.t, { rng }); if (!b.fis && b.t > 0 && k.plano && b.t >= k.plano.tIni) penAntes = Math.max(penAntes, penetra(k, GK.ballFlight(b, b.t), b.t).pen); }
    else { if (tc == null) tc = b.t; GK.passoBola(k, b, 1/120); estados.add(b.fis.estado);
      if (b.fis.estado === 'livre' && k.plano && b.t < tc + apos) penDepois = Math.max(penDepois, penetra(k, b.fis.p, b.t).pen);
      if (b.fis.estado === 'preso') { const C = GK.detalha(GK.colisoresPlano(k, b.t)), pl = C.find(c => c.nome === 'palma_l'), pr = C.find(c => c.nome === 'palma_r'); const cen = c => c.b ? c.a.map((v, i) => v + (c.b[i] - v)*.55) : c.a, Pl = cen(pl), Pr = cen(pr), dl = len(sub(b.fis.p, Pl)), dr = len(sub(b.fis.p, Pr)); segura.push(len(sub(Pl, Pr)) <= .28 ? Math.max(dl, dr) : Math.min(dl, dr)); (segura.sep ||= []).push(len(sub(Pl, Pr))); } }   // palmas juntas: perto das duas; braços abertos pela animação: presa à mão mais próxima
    if (!res) { if (b.fis) { if (b.fis.res) res = b.fis.res; } else if (b.t >= b.tf) res = 'gol'; }
    if (res && (!b.fis || b.t > (tc ?? 0) + apos)) break; }
  return { k, b, res, c: k.contato, penAntes, penDepois, estados, segura, args: { gx, gy, tf, lado, semente: sd } };
}
const achar = (pred, base = {}, n = 3000) => { for (let i = 0; i < n; i++) { const r = cobra({ gx: .14 + (i % 15)*.052, gy: .03 + ((i/15 | 0) % 14)*.066, lado: ['esq', 'dir', 'centro'][i % 3], tf: [.8, .62, .46][(i/7 | 0) % 3], semente: 15000 + i, ...base }); if (pred(r)) return r; } return null; };
const d = r => r ? `${r.k.plano?.clip} · ${r.c ? `${r.c.defesa} (${r.c.parte}) · ${r.c.vel} → ${r.c.vOutMod} m/s` : 'sem contato'} → ${r.res}` : 'não encontrado';

console.log('— barreira do corpo inteiro —');
{ const nomes = new Set(GK.detalha(GK.colisores('gk_espera', 0)).map(c => c.nome));
  t('colisores separados: cabeça, pescoço, ombros, braços, antebraços, peito, abdômen, quadril, coxas, joelhos, canelas, pés, palmas, dedos, punhos',
    ['cabeca', 'pescoco', 'peito', 'abdomen', 'quadril'].every(n => nomes.has(n)) && ['ombro', 'braco', 'antebraco', 'cotovelo', 'coxa', 'joelho', 'canela', 'pe', 'palma', 'dedos', 'punho'].every(n => nomes.has(n + '_l') && nomes.has(n + '_r')), [...nomes].join(' ')); }
for (const [n, nome, rg] of [[1, 'peito', ['peito']], [2, 'abdômen', ['abdomen']], [3, 'ombro', ['ombro']], [4, 'braço', ['braco', 'antebraco', 'cotovelo']], [11, 'pernas', ['coxa', 'joelho', 'canela']], [12, 'pés', ['pe']]]) {
  let r = achar(r => rg.includes(r.c?.regiao));
  if (!r) for (let i = 0; i < 1500 && !r; i++) { const q = cobra({ gx: .5 + (i % 2 ? 1 : -1)*(.02 + (i % 25)*.008), gy: .25 + ((i/25 | 0) % 12)*.05, lado: ['centro', 'esq', 'dir'][(i/300 | 0) % 3], tf: [.46, .62, .8][(i/2 | 0) % 3], semente: 9000 + i }); if (rg.includes(q.c?.regiao)) r = q; }
  t(`${n}. bola no(s) ${nome}: colisão física, a bola muda de velocidade/direção e sai do corpo`, !!r && r.c.vOutMod !== r.c.vel && r.penDepois <= .02, d(r)); }
{ const r = achar(r => r.c?.regiao === 'palma' && r.c.parte === 'palma_l' && !r.c.maoD); t('5. bola na palma ESQUERDA (só ela)', !!r, d(r)); }
{ const r = achar(r => r.c?.regiao === 'palma' && r.c.parte === 'palma_r' && !r.c.maoE); t('6. bola na palma DIREITA (só ela)', !!r, d(r)); }
{ const r = achar(r => r.c?.regiao === 'dedos'); t('7. bola nos dedos', !!r, d(r)); }
{ const r = achar(r => r.c?.maoE && r.c?.maoD); t('8. bola nas duas mãos', !!r, d(r)); }
{ const r = achar(r => r.c?.rotulo === 'agarrada'); t('9. encaixe verdadeiro: as duas mãos tocam e a bola fica nas luvas enquanto o encaixe dura (superfície da bola a ≤ 8 cm da palma; com os braços abertos pela animação, junto da mão mais próxima)', !!r && r.c.maoE && r.c.maoD && r.segura.length > 10 && Math.max(...r.segura.slice(12)) - BALL_R - .055 <= .08, r ? `${d(r)} · depois de puxada para as luvas (0,1 s), superfície da bola a no máx. ${((Math.max(...r.segura.slice(12)) - BALL_R - .055)*100).toFixed(1)} cm da palma em ${r.segura.length} passos` : '');
  if (r && process.env.DBG) console.log(r.segura.map((v, i) => `${((v - BALL_R - .055)*100).toFixed(0)}cm/${r.segura.sep[i].toFixed(2)}`).join(' '));
  if (r) { const r2 = cobra({ ...r.args, apos: 3.5 }); t('   encaixe → bola presa → solta no fim da animação: a física volta (estado livre depois de preso)', r2.estados.has('preso') && r2.estados.has('livre')); } }
{ const r = achar(r => r.c && r.c.grupo === 'mao' && !(r.c.maoE && r.c.maoD) && r.res !== 'defesa'); t('10. bola escapando de uma mão (toca e entra/segue)', !!r && r.c.rotulo !== 'agarrada', d(r)); }
{ const r = cobra({ gx: .5, gy: .45, tf: .3, lado: 'centro', rng: semente(5) }); t('13. chute MUITO forte (≈ 37 m/s) contra o corpo: colide, não atravessa', !!r.c && r.penAntes <= .025 && r.penDepois <= .02, `${d(r)} · penetração máx. ${(Math.max(r.penAntes, r.penDepois)*100).toFixed(1)} cm`); }
{ const r = achar(r => r.c?.grupo === 'mao', { tf: .3 }, 1500); t('14. chute MUITO rápido (≈ 37 m/s) contra as mãos: contato real na mão, sem atravessar', !!r && r.penAntes <= .025 && r.penDepois <= .02, d(r)); }
{ const r = achar(r => !r.c && r.k.dmin && r.k.dmin.d > 0 && r.k.dmin.d < .05); t('15. bola passando a menos de 5 cm do corpo SEM contato: não é defesa', !!r && r.res !== 'defesa', r ? `${d(r)} · passou a ${(r.k.dmin.d*100).toFixed(1)} cm (${r.k.dmin.parte})` : ''); }

console.log('— nunca atravessa: varredura (mergulhos, quedas, passos; fraca, média, forte e muito forte) —');
{ let n = 0, piorA = -9, piorD = -9, ex = null, contatos = 0;
  for (let i = 0; i < 480; i++) { const r = cobra({ gx: .1 + (i % 17)*.05, gy: .02 + ((i/17 | 0) % 9)*.1, lado: ['esq', 'dir', 'centro'][i % 3], tf: [.8, .62, .46, .32][i % 4], rng: semente(50000 + i) }); n++; if (r.c) contatos++;
    if (r.penAntes > piorA) piorA = r.penAntes; if (r.penDepois > piorD) { piorD = r.penDepois; ex = d(r); } }
  t(`antes do 1º toque a bola nunca entra no corpo mais que o passo da varredura (≤ 2,5 cm) em ${n} chutes`, piorA <= .025, `pior ${(piorA*100).toFixed(1)} cm`);
  t(`depois do 1º toque (rebote) a bola nunca atravessa nem fica presa dentro do goleiro (≤ 2 cm) em ${contatos} contatos`, piorD <= .02, `pior ${(piorD*100).toFixed(1)} cm · ${ex}`); }
{ // prioridade da mão: se o 1º contato é numa luva, o resultado é contato de mão (não vira tronco)
  let n = 0, viraram = 0; for (let i = 0; i < 300; i++) { const r = cobra({ gx: .3 + (i % 9)*.05, gy: .2 + ((i/9 | 0) % 6)*.1, lado: ['esq', 'dir', 'centro'][i % 3], rng: semente(70000 + i) }); if (r.c && ['palma', 'dedos', 'punho', 'maos'].includes(GK.regiaoDe(r.c.primeiro))) { n++; if (r.c.grupo !== 'mao') viraram++; } }
  t('prioridade da mão: 1º toque numa luva → contato de mão, nunca reclassificado como tronco', n > 0 && viraram === 0, `${viraram}/${n}`); }
console.log(`CORPO OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
