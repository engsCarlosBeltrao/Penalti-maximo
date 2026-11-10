// LCD DO ARCADE: o jogo monta as telas com os DADOS OFICIAIS da partida (GS/Game) e manda só quando algo muda (ou quando um display pequeno precisa
// alternar páginas). O Arduino não calcula placar nem cobrança: só escreve as linhas recebidas.
import { GS } from '../gameState.js';
import { pickKicker } from '../players.js';
import { ENTRY_S } from '../kicks.js';
import { textoLCD, linhaLCD } from './protocolo.js';

const RES = { gol: 'GOL!', defesa: 'DEFESA DO GOLEIRO', fora: 'PARA FORA', trave: 'NA TRAVE' }, RES16 = { gol: 'GOL!', defesa: 'DEFENDEU!', fora: 'PARA FORA', trave: 'NA TRAVE' };
// fotografia do que importa para o LCD (comparável com JSON: muda → reenviar)
export function estadoLCD(game, fim = null) {
  const [a, b] = GS.equipes, nome = t => t?.nome || '---', sig = t => t?.sigla || (t?.nome || '---').slice(0, 3);
  if (fim) return { tela: 'FIM', A: nome(a), B: nome(b), sa: sig(a), sb: sig(b), pa: fim.placar[0], pb: fim.placar[1], venc: fim.vencedor };
  if (game && game.m && game.paused) return { tela: 'PAUSA', A: nome(a), B: nome(b), sa: sig(a), sb: sig(b), pa: GS.placar[0], pb: GS.placar[1] };
  if (game && game.m && !game.fin) {
    const q = GS.cobrador, kt = GS.equipes[q], b_ = game.ball, base = { A: nome(a), B: nome(b), sa: sig(a), sb: sig(b), pa: GS.placar[0], pb: GS.placar[1], cob: GS.cobranca, bat: nome(kt), sbat: sig(kt) };
    if (b_ && b_.res) return { tela: 'RESULTADO', ...base, res: b_.res };
    if (!b_ && game.t < ENTRY_S) { let jog = ''; try { const p = pickKicker(kt, GS.cobranca, game.escolha?.[q]); jog = p.nome + (p.noNum ? '' : ` ${p.num ?? ''}`); } catch { /* sem elenco */ } return { tela: 'PROXIMA', ...base, jog: jog.trim() }; }
    return { tela: 'JOGO', ...base };
  }
  if (GS.estado === 'SELECAO_EQUIPE') return { tela: 'SELECAO' };
  return { tela: 'MENU' };
}
const cob = (n, cols) => n <= 5 ? `${cols < 20 ? 'COB' : 'COBRANCA'}: ${n}/5` : `MORTE SUBITA ${n}`;
// páginas (cada uma com `rows` linhas de até `cols` caracteres) para a fotografia s
export function telas(s, cols = 20, rows = 4) {
  const W = cols >= 20, cabe = `${s.A} x ${s.B}`.length <= cols, metade = Math.floor((cols - 3)/2), cor = n => textoLCD(n).slice(0, metade).trim();
  const vs = cabe ? `${s.A} x ${s.B}` : `${cor(s.A)} x ${cor(s.B)}`, vsc = `${s.sa} ${s.pa} x ${s.pb} ${s.sb}`;   // nomes inteiros se couberem; senão, os dois cortados por igual
  let p;
  switch (s.tela) {
    case 'MENU': p = W ? [['PENALTI MAXIMO', 'MENU PRINCIPAL', '', 'SETAS + ARCADE']] : [['PENALTI MAXIMO', 'MENU PRINCIPAL']]; break;
    case 'SELECAO': p = W ? [['PENALTI MAXIMO', 'ESCOLHA OS TIMES', '', 'SETAS + ARCADE']] : [['PENALTI MAXIMO', 'ESCOLHA OS TIMES']]; break;
    case 'PROXIMA': p = W ? [['PROXIMA COBRANCA', `TIME: ${s.bat}`, `COBRADOR: ${s.jog || '-'}`, `${vsc}  ${cob(s.cob, 16)}`]] : [['PROXIMA COBRANCA', `TIME: ${s.sbat}`], [`COBRADOR:`, s.jog || '-']]; break;
    case 'JOGO': p = W ? [[vs, `PLACAR: ${s.pa} x ${s.pb}`, cob(s.cob, cols), `BATENDO: ${s.bat}`]] : [[vsc, cob(s.cob, cols)], [vsc, `BATENDO: ${s.sbat}`]]; break;
    case 'RESULTADO': p = W ? [[RES[s.res] || '', `${s.bat}`, `PLACAR: ${s.pa} x ${s.pb}`, cob(s.cob, cols)]] : [[RES16[s.res] || '', vsc]]; break;
    case 'PAUSA': p = W ? [['JOGO PAUSADO', `${s.sa} ${s.pa} x ${s.pb} ${s.sb}`, '', 'DESPAUSA P/ VOLTAR']] : [['JOGO PAUSADO', `${s.pa} x ${s.pb} DESPAUSA`]]; break;
    case 'FIM': { const w = s.venc === 0 ? s.A : s.B, ws = s.venc === 0 ? s.sa : s.sb, x = Math.max(s.pa, s.pb), y = Math.min(s.pa, s.pb);
      p = W ? [['FIM DE JOGO!', w, `VITORIA: ${x} x ${y}`, vsc]] : [['FIM DE JOGO!', `${ws} VENCEU ${x}x${y}`]]; break; }
    default: p = [['PENALTI MAXIMO', '']];
  }
  return p.map(pg => Array.from({ length: rows }, (_, i) => textoLCD(pg[i] || '').slice(0, cols).padEnd(cols)));
}
// gerente: guarda o que já foi enviado; envia só quando muda; alterna páginas a cada `troca` s quando a tela não cabe numa página
export class LCD {
  constructor(enviar, { cols = 20, rows = 4, troca = 2.5 } = {}) { this.enviar = enviar; this.cols = cols; this.rows = rows; this.troca = troca; this.ultimo = null; this.chave = null; this.pag = 0; this.tPag = 0; this.fim = null; this.enviadas = 0; }
  tamanho(cols, rows) { if (cols !== this.cols || rows !== this.rows) { this.cols = cols; this.rows = rows; this.forcar(); } }
  forcar() { this.ultimo = null; this.chave = null; }
  atualizar(game, agora) {
    const s = estadoLCD(game, this.fim), chave = JSON.stringify(s), pgs = telas(s, this.cols, this.rows);
    if (chave !== this.chave) { this.chave = chave; this.pag = 0; this.tPag = agora; }
    else if (pgs.length > 1 && agora - this.tPag >= this.troca) { this.pag = (this.pag + 1) % pgs.length; this.tPag = agora; }
    const linhas = pgs[Math.min(this.pag, pgs.length - 1)], msg = linhaLCD(linhas, this.cols);
    if (msg !== this.ultimo) { this.ultimo = msg; this.atual = linhas; this.enviadas++; this.enviar(msg); return linhas; }
    return null;
  }
}
