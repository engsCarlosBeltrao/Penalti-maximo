// Módulo RESERVADO para a futura integração serial (NÃO implementada; o jogo não depende dele).
import { Events } from './events.js';
import { GS, getLcd } from './gameState.js';
export const Arduino = {
  conectado: false,
  _handlers: {},
  // O jogo registra aqui o que cada comando externo pode fazer (sempre passando pelas regras normais).
  registrarComandos(h) { this._handlers = h; },       // {iniciar, pausar, reiniciar}
  comando(nome) { this._handlers[nome]?.(); },        // futuro: chamar a partir do serial
  // Futuro: aqui você abre a porta serial e envia getLcd()/eventos.
  iniciar() {
    Events.on('*', e => { /* ex.: this.enviar(e.tipo, GS, getLcd()) */ });
  },
  enviar(/* tipo, estado, lcd */) { /* TODO: escrita serial */ }
};
