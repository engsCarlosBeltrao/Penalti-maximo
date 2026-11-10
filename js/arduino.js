// INTEGRAÇÃO DO ARCADE (Arduino): junta a ligação serial (js/hardware/serial.js), o significado dos botões (comandos.js), a navegação dos menus
// (navegacao.js) e o LCD (lcd.js). Opcional: sem Arduino o jogo segue com teclado e mouse; com ele, os botões físicos fazem o mesmo que eles.
import { Events } from './events.js';
import { GS } from './gameState.js';
import { Conexao, WebSerial } from './hardware/serial.js';
import { Simulador } from './hardware/simulador.js';
import { LCD, telas } from './hardware/lcd.js';
import { Navegador } from './hardware/navegacao.js';
import { criarComandos } from './hardware/comandos.js';
import { empacota, linhaLCD, FUNCOES, nomePino } from './hardware/protocolo.js';
const curto = n => n.replace(/^[^A-Z]+/, '').split(' ')[0];   // '▼ BAIXO' → 'BAIXO' (o LCD não tem esses símbolos)

export const Arduino = {
  estado: 'desconectado', motivo: '', modo: null, info: null, log: [], botoes: {}, sim: null, lcd: null, nav: null, cmd: null, con: null,
  mapa: null,       // pinos de cada função (firmware 2), na ordem de FUNCOES
  config: null,     // assistente CONFIGURAR BOTÕES: { passo, pinos, estado: 'aprendendo'|'salvando'|'pronto'|'erro', aviso, msg }
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
      onComando: (c, a) => { if (this._config(c, a)) return; const b = c.replace(/_(PRESS|REPEAT|DOWN|UP)$/, ''); this.botoes[b] = { n: (this.botoes[b]?.n || 0) + 1, t: this.relogio(), ev: c };
        const ok = this.cmd.comando(c, a); this.registra(`${c}${a.length ? ' ' + a.join(' ') : ''} → ${ok ? 'executado' : (this.cmd.st.ultimo || 'ignorado')}`); },
      onHello: i => { this.info = i; this.lcd.tamanho(i.cols, i.rows); if (this.v2) this.con?.enviar('MAPA?'); },
      onEstado: (e, m) => { this.estado = e; this.motivo = m; if (e === 'conectado') this.lcd.forcar(); if (e === 'desconectado') { this.cmd.soltarTudo(); if (this.config && this.config.estado !== 'pronto') Object.assign(this.config, { estado: 'erro', msg: 'A ligação com o Arduino caiu. Conecte de novo e repita.' }); } this.onMuda?.(); },
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
  testarLCD() { const c = this.lcd.cols, r = this.lcd.rows, ls = ['TESTE DO LCD', `${c} x ${r} OK`, '0123456789ABCDEFGHIJ', 'VOLTA SOZINHO EM 3S'].slice(0, r).map(l => l.slice(0, c).padEnd(c));
    this.con?.enviarBruto(empacota('L|' + ls.join('|'))); this.lcd.ultimo = null; this.pausaLCD = this.relogio() + 3; this.registra('teste do LCD enviado'); },
  // ---------- CONFIGURAR BOTÕES (firmware 2) ----------
  // o jogo pede cada função na ordem; o Arduino, no modo aprender, responde PINO|n a cada aperto; no fim o mapa vai para a EEPROM da placa
  get v2() { return Number(this.info?.versao) >= 2; },
  FUNCOES,
  nomePino,
  configurar() {
    if (!this.conectado) return this._cfgErro('Conecte o Arduino primeiro.');
    if (!this.v2) return this._cfgErro(`O Arduino está com o firmware ${this.info?.versao ?? 'antigo'}: grave a versão nova (arduino/enviar.bat) para configurar os botões.`);
    this.config = { passo: 0, pinos: [], estado: 'aprendendo', aviso: '', msg: '' }; this.con.enviar('APRENDER|1'); this.registra('configuração dos botões: iniciada'); this._cfgLCD(); this.onMuda?.(); return true;
  },
  _cfgErro(msg) { this.config = { passo: 0, pinos: [], estado: 'erro', aviso: '', msg }; this.onMuda?.(); return false; },
  configVoltar() { const c = this.config; if (!c || c.estado !== 'aprendendo' || !c.passo) return false; c.pinos.pop(); c.passo--; c.aviso = ''; c.lcd4 = ''; this._cfgLCD(); this.onMuda?.(); return true; },
  configCancelar() { if (this.config?.estado === 'aprendendo') this.con?.enviar('APRENDER|0'); this.config = null; this.lcd.forcar(); this.onMuda?.(); },
  mapaPadrao() { if (!this.v2) return false; this.con.enviar('MAPA|PADRAO'); this.registra('mapa padrão pedido'); return true; },
  _config(c, a) {
    if (c === 'MAPA') { const m = String(a[0] || '').split(',').map(Number); this.mapa = m.length === 7 && m.every(Number.isFinite) ? m : null;
      const k = this.config; if (k && k.estado === 'salvando' && k.pinos.join() === m.join()) { k.estado = 'pronto'; k.msg = 'Botões gravados no Arduino. Já estão valendo.'; this.lcd.forcar(); }
      this.registra(`mapa: ${this.mapa ? this.mapa.map((p, i) => FUNCOES[i][0] + '=' + nomePino(p)).join(' ') : a[0]}`); return true; }
    if (c === 'MAPA_ERRO') { if (this.config) Object.assign(this.config, { estado: 'erro', msg: 'O Arduino recusou o mapa: ' + (a[0] || '') }); this.registra('mapa recusado: ' + (a[0] || '')); this.onMuda?.(); return true; }
    if (c === 'APRENDER') { this.registra(a[0] === '1' ? 'Arduino no modo de configuração' : 'Arduino voltou ao modo normal'); return true; }
    if (c === 'PINO') { const k = this.config, n = Number(a[0]); this.registra(`botão no pino ${nomePino(n)}`);
      if (!k || k.estado !== 'aprendendo') return true;
      const j = k.pinos.indexOf(n); if (j >= 0) { k.aviso = `Esse botão já é ${FUNCOES[j][1]}. Aperte outro.`; k.lcd4 = `JA USADO: ${curto(FUNCOES[j][1])}`; this._cfgLCD(); this.onMuda?.(); return true; }
      k.pinos.push(n); k.passo++; k.aviso = `${FUNCOES[k.passo - 1][1]} = pino ${nomePino(n)}`; k.lcd4 = `OK: ${curto(FUNCOES[k.passo - 1][1])} = ${nomePino(n)}`;
      if (k.passo === FUNCOES.length) { k.estado = 'salvando'; this.con.enviar('APRENDER|0'); this.con.enviar('MAPA|' + k.pinos.join(',')); }
      this._cfgLCD(); this.onMuda?.(); return true; }
    return false;
  },
  _cfgLCD() { const k = this.config; if (!k || !this.con) return; const f = FUNCOES[k.passo];
    const ls = k.estado === 'aprendendo' ? ['CONFIGURAR BOTOES', `${k.passo + 1}/${FUNCOES.length} APERTE:`, f[1].replace(/^[^A-Z]+/, ''), k.lcd4 || ''] : ['CONFIGURAR BOTOES', 'GRAVANDO...', '', ''];
    this.con.enviarBruto(linhaLCD(ls.slice(0, this.lcd.rows), this.lcd.cols)); this.lcd.atual = ls.slice(0, this.lcd.rows); },
  tick() {
    const agora = this.relogio(); this.con?.tick(agora); this.cmd.tick();
    if (this.config && this.config.estado !== 'pronto' && this.config.estado !== 'erro') return;   // durante a configuração o LCD mostra o assistente
    if (this.lcd.fim && (GS.estado === 'MENU' || GS.estado === 'SELECAO_EQUIPE')) this.lcd.fim = null;   // saiu da tela de fim
    if (!(this.pausaLCD > agora)) { const novas = this.lcd.atualizar(this.game, agora); if (novas) this.onMuda?.(); }
  },
  telas
};
