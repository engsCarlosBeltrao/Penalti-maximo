// Barramento de eventos da partida. Qualquer módulo (ex.: Arduino) pode assinar sem alterar a lógica.
const h = {};
export const Events = {
  on(t, f) { (h[t] ??= []).push(f); },            // on('gol', fn) ou on('*', fn)
  emit(t, d = {}) {
    const e = { tipo: t, hora: Date.now(), ...d };
    [...(h['*'] || []), ...(h[t] || [])].forEach(f => { try { f(e); } catch (x) { console.error(x); } });
  }
};
// Eventos: partida_iniciada, gol, defesa, fora, trave, placar_alterado, cobranca_mudou, partida_encerrada, vitoria, derrota, partida_reiniciada,
// chute { equipe, tipoCobranca, estilo, forca }  (o campo "tipo" é reservado ao nome do evento)
