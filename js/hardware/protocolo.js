// PROTOCOLO SERIAL DO ARCADE (Arduino ⇄ jogo). Texto ASCII, uma mensagem por linha ("\n"), 115200 baud, e no fim de cada linha um checksum:
//   <conteúdo>*HH   onde HH = XOR de todos os bytes do conteúdo, em hexadecimal (2 dígitos maiúsculos). Linha sem checksum válido é descartada.
//
// ARDUINO → JOGO (eventos dos botões e de controle)
//   HELLO|<versão>|<colunas>x<linhas>   ao ligar e em resposta a HELLO?      ex.: HELLO|1|20x4
//   UP_PRESS · DOWN_PRESS · LEFT_PRESS · RIGHT_PRESS                     direcionais (pressionou)
//   UP_REPEAT · DOWN_REPEAT · LEFT_REPEAT · RIGHT_REPEAT                 repetição controlada do direcional segurado
//   ADVANCE_PRESS · BACK_PRESS                                           avançar / voltar
//   ARCADE_DOWN · ARCADE_UP|<ms>                                         botão de chute: apertou / soltou (ms = tempo segurado, informativo)
//   PONG                                                                 resposta ao PING (o jogo sabe que a ligação está viva)
//
// JOGO → ARDUINO (o jogo é a fonte oficial; o Arduino só mostra)
//   HELLO?                            pede a identificação
//   PING                              a cada 2 s; sem nenhuma linha válida por 6 s, o Arduino mostra "SEM CONEXAO"
//   L|<linha1>|<linha2>[|<linha3>|<linha4>]   o que o LCD mostra, já formatado no tamanho do display (sem acentos, sem "|" e "*")
//   T|<0|1>                           luz de fundo
export const BAUD = 115200, MAX_LINHA = 120;
export const COMANDOS = ['UP_PRESS', 'DOWN_PRESS', 'LEFT_PRESS', 'RIGHT_PRESS', 'UP_REPEAT', 'DOWN_REPEAT', 'LEFT_REPEAT', 'RIGHT_REPEAT', 'ADVANCE_PRESS', 'BACK_PRESS', 'ARCADE_DOWN', 'ARCADE_UP', 'PONG', 'HELLO'];
export const checksum = s => { let x = 0; for (let i = 0; i < s.length; i++) x ^= s.charCodeAt(i) & 0xff; return x.toString(16).toUpperCase().padStart(2, '0'); };
export const empacota = s => `${s}*${checksum(s)}\n`;
// valida uma linha recebida; devolve { cmd, args } ou { erro }
export function interpreta(linha) {
  const l = String(linha).replace(/\r/g, '').trim(); if (!l) return { erro: 'vazia' };
  if (l.length > MAX_LINHA) return { erro: 'longa demais' };
  if (/[^\x20-\x7e]/.test(l)) return { erro: 'caractere inválido' };
  const i = l.lastIndexOf('*'); if (i < 0 || l.length - i !== 3) return { erro: 'sem checksum' };
  const corpo = l.slice(0, i), ck = l.slice(i + 1).toUpperCase(); if (checksum(corpo) !== ck) return { erro: 'checksum errado' };
  const [cmd, ...args] = corpo.split('|'); if (!COMANDOS.includes(cmd)) return { erro: 'comando desconhecido: ' + cmd };
  return { cmd, args };
}
// junta pedaços recebidos (a serial entrega bytes soltos) em linhas inteiras; descarta lixo grande demais sem quebra de linha
export class Linhas {
  constructor(onLinha) { this.buf = ''; this.onLinha = onLinha; this.descartes = 0; }
  push(pedaco) {
    this.buf += pedaco;
    let i; while ((i = this.buf.indexOf('\n')) >= 0) { const l = this.buf.slice(0, i); this.buf = this.buf.slice(i + 1); this.onLinha(l); }
    if (this.buf.length > MAX_LINHA * 2) { this.buf = ''; this.descartes++; }   // fluxo sem "\n" (ruído, baud errado): joga fora
  }
}
// texto seguro para o LCD HD44780: sem acentos, maiúsculo, só ASCII imprimível, sem os separadores do protocolo
export const textoLCD = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[|*]/g, '/').replace(/[^\x20-\x7e]/g, '').toUpperCase();
export const linhaLCD = (linhas, cols) => empacota('L|' + linhas.map(l => textoLCD(l).slice(0, cols).padEnd(cols)).join('|'));
