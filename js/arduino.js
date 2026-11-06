// INTEGRAÇÃO DO ARCADE (Arduino): junta a ligação serial (js/hardware/serial.js), o significado dos botões (comandos.js), a navegação dos menus
// (navegacao.js) e o LCD (lcd.js). Opcional: sem Arduino o jogo segue com teclado e mouse; com ele, os botões físicos fazem o mesmo que eles.
import { Events } from './events.js';
import { GS } from './gameState.js';
import { Conexao, WebSerial } from './hardware/serial.js';
import { Simulador } from './hardware/simulador.js';
import { LCD, telas } from './hardware/lcd.js';
import { Navegador } from './hardware/navegacao.js';
import { criarComandos } from './hardware/comandos.js';
import { empacota } from './hardware/protocolo.js';

export const Arduino = {
  estado: 'desconectado', motivo: '', modo: null, info: null, log: [], botoes: {}, sim: null, lcd: null, nav: null, cmd: null, con: null,
  get conectado() { return this.estado === 'conectado' || this.estado === 'sem-resposta'; },
  registra(txt) { this.log.unshift(`${new Date().toLocaleTimeString()}  ${txt}`); if (this.log.length > 40) this.log.pop(); this.onMuda?.(); },
  // game: o Game; raizes(): telas navegáveis (pausa primeiro); pausa: { aberta, abrir, voltar }; emMenu(): há uma tela de menu aberta
  iniciar({ game, raizes, pausa, emMenu, relogio = () => performance.now()/1000, intervalo = 50 }) {
    this.game = game; this.relogio = relogio;
    this.nav = new Navegador(raizes);
    this.cmd = criarComandos({ game, nav: this.nav, pausa, emMenu });
    this.lcd = new LCD(m => this.con?.enviarBruto(m));
    Events.on('partida_encerrada', e => { this.lcd.fim = { placar: e.placar, vencedor: e.vencedor }; });
    Events.on('partida_iniciada', () => { this.lcd.fim = null; });
    if (intervalo) setInterval(() => this.tick(), intervalo);
    return this;
  },
  _nova(criar) {
    const con = new Conexao({ criarTransporte: criar,
      onComando: (c, a) => { const b = c.replace(/_(PRESS|REPEAT|DOWN|UP)$/, ''); this.botoes[b] = { n: (this.botoes[b]?.n || 0) + 1, t: this.relogio(), ev: c };
        const ok = this.cmd.comando(c, a); this.registra(`${c}${a.length ? ' ' + a.join(' ') : ''} → ${ok ? 'executado' : (this.cmd.st.ultimo || 'ignorado')}`); },
      onHello: i => { this.info = i; this.lcd.tamanho(i.cols, i.rows); },
      onEstado: (e, m) => { this.estado = e; this.motivo = m; if (e === 'conectado') this.lcd.forcar(); if (e === 'desconectado') this.cmd.soltarTudo(); this.onMuda?.(); },
      onLog: t => this.registra(t) });
    return con;
  },
  // CONECTAR: Web Serial (o navegador mostra a lista de portas; precisa de clique) ou o simulador
  // a ligação nova só substitui a atual se abrir de verdade (ex.: o navegador recusa abrir a porta sem um clique de mouse → a atual continua)
  async conectar({ simulador = false, escolher = true } = {}) {
    if (simulador && this.modo === 'simulador' && this.conectado) return true;          // já está no simulador
    if (simulador) { this.sim = this.sim || new Simulador(); this.sim.falhar = false; }
    const antiga = this.con, antigoModo = this.modo, nova = this._nova(simulador ? () => this.sim : () => new WebSerial());
    if (antiga) antiga.onEstado = null;
    this.con = nova; this.modo = simulador ? 'simulador' : 'serial';
    const ok = await nova.conectar(escolher, this.relogio());
    if (ok) { if (antiga && antiga !== nova) { antiga.autoReconectar = false; await antiga.desconectar().catch(() => {}); } return true; }
    if (antiga && (antiga.estado === 'conectado' || antiga.estado === 'sem-resposta')) { this.con = antiga; this.modo = antigoModo; antiga.onEstado = nova.onEstado; this.estado = antiga.estado; this.registra('a ligação anterior continua ativa'); this.onMuda?.(); }
    return false;
  },
  async desconectar() { await this.con?.desconectar(); },
  disponivel: () => WebSerial.disponivel(), motivoIndisponivel: () => WebSerial.motivo(),
  // TESTE DO LCD: padrão com todas as colunas/linhas por 3 s; depois volta à tela do jogo
  testarLCD() { const c = this.lcd.cols, r = this.lcd.rows, ls = ['TESTE DO LCD', `${c} x ${r} OK`, '0123456789ABCDEFGHIJ', 'AVANCAR P/ VOLTAR'].slice(0, r).map(l => l.slice(0, c).padEnd(c));
    this.con?.enviarBruto(empacota('L|' + ls.join('|'))); this.lcd.ultimo = null; this.pausaLCD = this.relogio() + 3; this.registra('teste do LCD enviado'); },
  tick() {
    const agora = this.relogio(); this.con?.tick(agora); this.cmd.tick();
    if (this.lcd.fim && (GS.estado === 'MENU' || GS.estado === 'SELECAO_EQUIPE')) this.lcd.fim = null;   // saiu da tela de fim
    if (!(this.pausaLCD > agora)) { const novas = this.lcd.atualizar(this.game, agora); if (novas) this.onMuda?.(); }
  },
  telas
};
