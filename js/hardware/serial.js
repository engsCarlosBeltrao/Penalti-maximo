// LIGAÇÃO SERIAL com o Arduino: transporte Web Serial (Chrome/Edge, página em localhost/https) ou o SIMULADOR (sem hardware), e a conexão que
// junta as linhas, valida o protocolo, mede a saúde da ligação (PING/PONG), detecta queda e reconecta sozinha à porta já autorizada.
// Nada aqui trava o jogo: toda falha vira estado "desconectado" e o jogo continua com teclado e mouse.
import { BAUD, Linhas, interpreta, empacota } from './protocolo.js';

// ---------- transporte: Web Serial ----------
export class WebSerial {
  static disponivel() { return typeof navigator !== 'undefined' && !!navigator.serial && (typeof isSecureContext === 'undefined' || isSecureContext); }
  static motivo() { if (typeof navigator === 'undefined' || !navigator.serial) return 'Este navegador não tem Web Serial (use Google Chrome ou Microsoft Edge no computador).';
    if (typeof isSecureContext !== 'undefined' && !isSecureContext) return 'A página precisa estar em http://127.0.0.1 ou https (abra o jogo pelo iniciar.bat).'; return ''; }
  constructor() { this.port = null; this.reader = null; this.writer = null; this.onDados = null; this.onQueda = null; this.nome = ''; }
  // escolher = true abre o seletor do navegador (precisa de clique do usuário); false usa uma porta já autorizada antes (reconexão sem clique)
  async abrir(escolher) {
    if (!WebSerial.disponivel()) throw new Error(WebSerial.motivo());
    const port = escolher ? await navigator.serial.requestPort() : (await navigator.serial.getPorts())[0];
    if (!port) throw new Error('Nenhuma porta autorizada ainda: use CONECTAR e escolha a porta do Arduino.');
    await port.open({ baudRate: BAUD }); this.port = port;
    const info = port.getInfo ? port.getInfo() : {}; this.nome = info.usbVendorId ? `USB ${info.usbVendorId.toString(16)}:${(info.usbProductId || 0).toString(16)}` : 'porta serial';
    this.writer = port.writable.getWriter(); this._ler();
    navigator.serial.addEventListener('disconnect', this._desligou = e => { if (e.target === this.port) this._cai('cabo desconectado'); });
  }
  async _ler() {
    const dec = new TextDecoder();
    try { this.reader = this.port.readable.getReader();
      for (;;) { const { value, done } = await this.reader.read(); if (done) break; if (value) this.onDados?.(dec.decode(value, { stream: true })); }
    } catch (e) { this._cai('erro de leitura: ' + (e.message || e)); return; }
    finally { try { this.reader?.releaseLock(); } catch { /* já liberado */ } }
  }
  _cai(motivo) { const p = this.port; if (!p) return; this.port = null; this.onQueda?.(motivo); try { this.writer?.releaseLock(); } catch { /* */ } p.close().catch(() => {}); }
  async escrever(txt) { if (!this.writer) throw new Error('porta fechada'); await this.writer.write(new TextEncoder().encode(txt)); }
  async fechar() { const p = this.port; this.port = null; if (this._desligou) navigator.serial.removeEventListener('disconnect', this._desligou);
    try { await this.reader?.cancel(); } catch { /* */ } try { this.writer?.releaseLock(); } catch { /* */ } try { await p?.close(); } catch { /* */ } }
}

// ---------- conexão (independe do transporte) ----------
export class Conexao {
  constructor({ criarTransporte, onComando, onHello, onEstado, onLog } = {}) {
    Object.assign(this, { criarTransporte, onComando, onHello, onEstado, onLog });
    this.estado = 'desconectado'; this.t = null; this.ultimaValida = 0; this.ultimoPing = 0; this.recebidas = 0; this.invalidas = 0; this.enviadas = 0; this.autoReconectar = false; this.ultimaTentativa = 0;
    this.linhas = new Linhas(l => this._linha(l));
  }
  _muda(e, motivo = '') { if (this.estado === e) return; this.estado = e; this.onEstado?.(e, motivo); this.onLog?.(`estado: ${e}${motivo ? ' (' + motivo + ')' : ''}`); }
  async conectar(escolher = true, agora = 0) {
    if (this.estado === 'conectado' || this.estado === 'conectando') return true;
    this._agora = agora; this._muda('conectando'); const t = this.criarTransporte();
    t.onDados = d => this.linhas.push(d); t.onQueda = m => this._queda(m);
    try { await t.abrir(escolher); } catch (e) { this._muda('desconectado', e.message || String(e)); return false; }
    this.t = t; this.ultimaValida = agora; this.autoReconectar = true; this._muda('conectado', t.nome);
    this.enviar('HELLO?'); return true;
  }
  async desconectar() { this.autoReconectar = false; const t = this.t; this.t = null; this._muda('desconectado', 'pelo usuário'); try { await t?.fechar(); } catch { /* */ } }
  _queda(motivo) { if (!this.t) return; this.t = null; this.ultimaTentativa = this._agora ?? 0; this._muda('desconectado', motivo); }   // reconecta depois de 3 s
  enviar(corpo) { if (!this.t) return false; const txt = empacota(corpo); this.enviadas++;
    this.t.escrever(txt).catch(e => this._queda('falha ao enviar: ' + (e.message || e))); return true; }
  enviarBruto(txt) { if (!this.t) return false; this.enviadas++; this.t.escrever(txt).catch(e => this._queda('falha ao enviar: ' + (e.message || e))); return true; }
  _linha(l) {
    const r = interpreta(l); if (r.erro) { this.invalidas++; this.onLog?.(`descartada (${r.erro}): ${String(l).slice(0, 40)}`); return; }
    this.recebidas++; this.ultimaValida = this._agora ?? 0; if (this.estado === 'sem-resposta') this._muda('conectado', 'voltou a responder');
    if (r.cmd === 'PONG') return;
    if (r.cmd === 'HELLO') { const [v, tam] = r.args, [c, rw] = String(tam || '20x4').split('x').map(Number); this.onHello?.({ versao: v, cols: c || 20, rows: rw || 4 }); this.onLog?.(`Arduino: firmware ${v}, LCD ${c}x${rw}`); return; }
    this.onComando?.(r.cmd, r.args);
  }
  // chamado a cada ~50 ms: PING a cada 2 s, "sem resposta" após 6 s sem linha válida, reconexão automática a cada 3 s
  tick(agora) {
    this._agora = agora;
    if (this.t) {
      if (agora - this.ultimoPing >= 2) { this.ultimoPing = agora; this.enviar('PING'); }
      if (this.estado === 'conectado' && agora - this.ultimaValida > 6) this._muda('sem-resposta', 'o Arduino não responde há 6 s');
    } else if (this.autoReconectar && this.estado === 'desconectado' && agora - this.ultimaTentativa >= 3) { this.ultimaTentativa = agora; this.onLog?.('tentando reconectar…'); this.conectar(false, agora); }
  }
}
