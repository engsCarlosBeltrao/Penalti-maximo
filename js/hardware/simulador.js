// SIMULADOR DO ARDUINO: um transporte que se comporta como o firmware 2 (responde HELLO, PONG e MAPA?, guarda o que o LCD mostraria, valida o
// checksum do que recebe, aprende e grava o mapa dos botões) e "aperta" os botões gerando as MESMAS linhas que o Arduino mandaria.
// Serve para testar tudo sem hardware (testes e tela ARCADE). versao: '1' imita o firmware antigo (sem mapa, AVANÇAR/VOLTAR).
import { empacota, checksum, FUNCOES, PINOS_CANDIDATOS, MAPA_PADRAO } from './protocolo.js';
const IDX = Object.fromEntries(FUNCOES.map(([k], i) => [k, i]));
export class Simulador {
  constructor({ cols = 20, rows = 4, versao = '2' } = {}) {
    Object.assign(this, { cols, rows, versao }); this.nome = 'SIMULADOR'; this.aberto = false; this.lcd = Array(rows).fill(' '.repeat(cols)); this.historico = []; this.erros = 0; this.falhar = false; this.tArcade = 0;
    this.mapa = [...MAPA_PADRAO]; this.aprendendo = false; this.onDados = null; this.onQueda = null;
  }
  get v2() { return Number(this.versao) >= 2; }
  async abrir() { if (this.falhar) throw new Error('simulador: cabo desligado'); this.aberto = true; this._manda(`HELLO|${this.versao}|${this.cols}x${this.rows}`); }
  async fechar() { this.aberto = false; this.aprendendo = false; }
  async escrever(txt) {
    if (!this.aberto) throw new Error('simulador: porta fechada');
    for (const l of txt.split('\n')) { if (!l) continue; const i = l.lastIndexOf('*'), corpo = l.slice(0, i);
      if (i < 0 || checksum(corpo) !== l.slice(i + 1)) { this.erros++; continue; }
      this.historico.push(corpo); if (this.historico.length > 200) this.historico.shift();
      if (corpo === 'PING') this._manda('PONG'); else if (corpo === 'HELLO?') this._manda(`HELLO|${this.versao}|${this.cols}x${this.rows}`);
      else if (corpo.startsWith('L|')) { const ls = corpo.split('|').slice(1); this.lcd = Array.from({ length: this.rows }, (_, k) => (ls[k] || '').slice(0, this.cols).padEnd(this.cols)); }
      else if (this.v2) this._v2(corpo); }
  }
  _v2(c) {
    if (c === 'MAPA?') this._manda('MAPA|' + this.mapa.join(','));
    else if (c === 'APRENDER|1' || c === 'APRENDER|0') { this.aprendendo = c.endsWith('1'); this._manda(c); }
    else if (c === 'MAPA|PADRAO') { this.mapa = [...MAPA_PADRAO]; this._manda('MAPA|' + this.mapa.join(',')); }
    else if (c.startsWith('MAPA|')) { const ps = c.slice(5).split(',');
      if (ps.length !== 7 || ps.some(p => !/^\d{1,2}$/.test(p))) return this._manda('MAPA_ERRO|FORMATO');
      const m = ps.map(Number); if (m.some(p => !PINOS_CANDIDATOS.includes(p)) || new Set(m).size !== 7) return this._manda('MAPA_ERRO|PINO INVALIDO OU REPETIDO');
      this.mapa = m; this._manda('MAPA|' + m.join(',')); }
  }
  _manda(corpo) { if (this.aberto) this.onDados?.(empacota(corpo)); }
  // botão físico ligado no pino n: no modo aprender manda PINO|n; senão, o comando da função que o mapa dá a esse pino (ou nada)
  apertaPino(n, t = 0) { if (this.aprendendo) return this._manda(`PINO|${n}`); const f = this.mapa.indexOf(n); if (f < 0) return; const k = FUNCOES[f][0];
    if (k === 'ARCADE') { this.arcadeDown(t); } else this._manda(`${k}_PRESS`); }
  // botões pela FUNÇÃO: UP DOWN LEFT RIGHT PAUSE RESUME (aperta = um pressionamento); ADVANCE/BACK = firmware antigo; ARCADE com segurar/soltar
  aperta(b) { if (this.aprendendo && b in IDX) return this._manda(`PINO|${this.mapa[IDX[b]]}`); if (!this.aprendendo) this._manda(`${b}_PRESS`); }
  repete(b) { if (!this.aprendendo) this._manda(`${b}_REPEAT`); }
  arcadeDown(t = 0) { if (this.aprendendo) return this._manda(`PINO|${this.mapa[6]}`); this.tArcade = t; this._manda('ARCADE_DOWN'); }
  arcadeUp(t = 0) { if (!this.aprendendo) this._manda(`ARCADE_UP|${Math.round((t - this.tArcade)*1000)}`); }
  ruido(txt) { if (this.aberto) this.onDados?.(txt); }                // bytes soltos/lixo, como um cabo ruim
  cair() { if (!this.aberto) return; this.aberto = false; this.aprendendo = false; this.onQueda?.('simulador: cabo puxado'); }
}
