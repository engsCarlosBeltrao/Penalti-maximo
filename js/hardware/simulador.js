// SIMULADOR DO ARDUINO: um transporte que se comporta como o firmware (responde HELLO e PONG, guarda o que o LCD mostraria, valida o checksum do que
// recebe) e "aperta" os botões gerando as MESMAS linhas que o Arduino mandaria. Serve para testar tudo sem hardware (testes e tela ARCADE).
import { empacota, checksum } from './protocolo.js';
export class Simulador {
  constructor({ cols = 20, rows = 4, versao = '1' } = {}) {
    Object.assign(this, { cols, rows, versao }); this.nome = 'SIMULADOR'; this.aberto = false; this.lcd = Array(rows).fill(' '.repeat(cols)); this.historico = []; this.erros = 0; this.falhar = false; this.tArcade = 0;
    this.onDados = null; this.onQueda = null;
  }
  async abrir() { if (this.falhar) throw new Error('simulador: cabo desligado'); this.aberto = true; this._manda(`HELLO|${this.versao}|${this.cols}x${this.rows}`); }
  async fechar() { this.aberto = false; }
  async escrever(txt) {
    if (!this.aberto) throw new Error('simulador: porta fechada');
    for (const l of txt.split('\n')) { if (!l) continue; const i = l.lastIndexOf('*'), corpo = l.slice(0, i);
      if (i < 0 || checksum(corpo) !== l.slice(i + 1)) { this.erros++; continue; }
      this.historico.push(corpo); if (this.historico.length > 200) this.historico.shift();
      if (corpo === 'PING') this._manda('PONG'); else if (corpo === 'HELLO?') this._manda(`HELLO|${this.versao}|${this.cols}x${this.rows}`);
      else if (corpo.startsWith('L|')) { const ls = corpo.split('|').slice(1); this.lcd = Array.from({ length: this.rows }, (_, k) => (ls[k] || '').slice(0, this.cols).padEnd(this.cols)); } }
  }
  _manda(corpo) { if (this.aberto) this.onDados?.(empacota(corpo)); }
  // botões: UP DOWN LEFT RIGHT ADVANCE BACK  (aperta = um pressionamento); ARCADE com segurar/soltar
  aperta(b) { this._manda(`${b}_PRESS`); }
  repete(b) { this._manda(`${b}_REPEAT`); }
  arcadeDown(t = 0) { this.tArcade = t; this._manda('ARCADE_DOWN'); }
  arcadeUp(t = 0) { this._manda(`ARCADE_UP|${Math.round((t - this.tArcade)*1000)}`); }
  ruido(txt) { if (this.aberto) this.onDados?.(txt); }                // bytes soltos/lixo, como um cabo ruim
  cair() { if (!this.aberto) return; this.aberto = false; this.onQueda?.('simulador: cabo puxado'); }
}
