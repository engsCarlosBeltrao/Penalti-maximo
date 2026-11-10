// HUMOR DA TORCIDA — uma máquina de estados POR LADO da arquibancada (lado 0 = equipe GS.equipes[0], à esquerda; lado 1 = equipe 1, à direita).
// Só reage a eventos CONFIRMADOS da partida (js/events.js). Nunca comemora o resultado do adversário: o lado de cada reação vem do campo
// "equipe" do evento (quem cobrou) — o lado do goleiro é o outro.
// Usado pela torcida 3D (js/three/torcedores.js: poses no shader) e pelo som da torcida (js/torcidaSom.js). Sem DOM: testável no Node.
export const EVENTOS = {                       // nomes pedidos → eventos reais do projeto
  MATCH_START: 'partida_iniciada', PENALTY_START: 'cobranca_mudou', KICK: 'chute', GOAL_SCORED: 'gol', GOALKEEPER_SAVE: 'defesa',
  PENALTY_MISSED: ['fora', 'trave'], MATCH_END: 'partida_encerrada', PAUSE: 'pausa', RESUME: 'retomada', RESET: 'partida_reiniciada'
};
export const HUMOR = { CALMO: 0, TENSAO: 1, EUFORIA: 2, FRUSTRACAO: 3, DECEPCAO: 4, FESTA: 5 };
export const NOME_HUMOR = ['calmo', 'tensão', 'euforia', 'frustração', 'decepção', 'festa'];
// quanto dura cada reação antes de voltar ao normal (s). A COMEMORAÇÃO (euforia de um resultado) não acaba sozinha: continua quando o adversário vai
// bater e só para se ele fizer o gol (se ele errar, segue). FESTA e o fim de jogo também não acabam sozinhos.
const DURA = { 2: 0, 3: 7, 4: 7 };
const SEGURA = 5.5;                            // uma comemoração não é cortada pela próxima cobrança antes disso (o jogo espera 4 s + entrada)
export function criaTorcidaEstado(Events) {
  const lados = [0, 1].map(() => ({ humor: 0, t: 0, I: .5, ant: 0, tAnt: 0, dura: 0, fixo: false, pend: null }));
  const ouvintes = [], log = [];
  let calor = .35, pausado = false, decisiva = false;
  function muda(l, humor, I, motivo, { dura = DURA[humor] ?? 0, fixo = false } = {}) {
    const s = lados[l]; s.ant = s.humor; s.tAnt = s.t; s.humor = humor; s.t = 0; s.I = I; s.dura = dura; s.fixo = fixo; s.pend = null;
    const e = { lado: l, humor, nome: NOME_HUMOR[humor], I, motivo }; log.push(e); if (log.length > 60) log.shift(); ouvintes.forEach(f => { try { f(e); } catch (x) { console.error(x); } });
  }
  // a cobrança seguinte (ou o chute) só troca o humor depois que a reação anterior teve tempo de acontecer; quem está comemorando continua
  const tensao = (l, I, motivo) => { const s = lados[l]; if (s.fixo) return; if ((s.humor === 2 || s.humor === 5) && !s.dura) return; if ((s.humor === 2 || s.humor === 4 || s.humor === 3) && s.t < SEGURA) { s.pend = { humor: 1, I, motivo }; return; } muda(l, 1, I, motivo); };
  const on = (n, f) => Events?.on(n, f);
  on(EVENTOS.MATCH_START, () => { calor = .45; decisiva = false; [0, 1].forEach(l => { lados[l].fixo = false; muda(l, 2, .45, 'entrada dos times', { dura: 4 }); }); });
  on(EVENTOS.RESET, () => [0, 1].forEach(l => { lados[l].fixo = false; muda(l, 0, .4, 'reinício'); }));
  on(EVENTOS.PENALTY_START, e => { decisiva = !!e.decisiva; const k = e.cobrador ?? 0; tensao(k, .7, 'expectativa: o seu time vai cobrar'); tensao(1 - k, .6, 'tensão: o goleiro do seu time vai defender'); });
  on(EVENTOS.KICK, () => [0, 1].forEach(l => { const s = lados[l]; if (s.humor === 1) { s.I = 1; } else tensao(l, 1, 'chute'); }));
  on(EVENTOS.GOAL_SCORED, e => { const q = e.equipe; muda(q, 2, .85, 'gol do seu time'); muda(1 - q, 3, .8, 'gol do adversário'); });
  on(EVENTOS.GOALKEEPER_SAVE, e => { const q = e.equipe; muda(1 - q, 2, 1, 'defesa do seu goleiro'); muda(q, 4, .9, 'o goleiro adversário defendeu'); });
  EVENTOS.PENALTY_MISSED.forEach(n => on(n, e => { const q = e.equipe; muda(1 - q, 2, 1, 'o adversário perdeu o pênalti'); muda(q, 4, 1, 'o seu time perdeu o pênalti'); }));
  on(EVENTOS.MATCH_END, e => { const v = e.vencedor; muda(v, 5, 1, 'título!', { fixo: true }); muda(1 - v, 3, 1, 'eliminado', { dura: 0, fixo: true }); });
  on(EVENTOS.PAUSE, () => { pausado = true; }); on(EVENTOS.RESUME, () => { pausado = false; });
  function update(dt) {
    if (pausado) return;
    calor += ((decisiva ? .75 : .45) - calor)*(1 - Math.exp(-dt*.5));
    lados.forEach((s, l) => { s.t += dt;
      if (s.pend && s.t >= SEGURA) { const p = s.pend; muda(l, p.humor, p.I, p.motivo); return; }
      if (!s.fixo && s.dura && s.t > s.dura) muda(l, 0, .5, 'volta ao normal'); });
  }
  return {
    lados, log, update, muda,
    get calor() { return calor; }, get pausado() { return pausado; },
    onMuda: f => ouvintes.push(f),
    // intensidade sonora/visual de cada lado (0..1) — usada pelo mixer da torcida
    energia(l) { const s = lados[l]; if (pausado) return .15; const k = s.humor === 2 || s.humor === 5 ? s.I*(s.humor === 5 ? 1 : s.dura ? Math.max(.35, 1 - s.t/s.dura) : Math.max(.5, 1 - s.t/14)) : s.humor === 1 ? .25 + .2*s.I : s.humor === 3 ? .12 : s.humor === 4 ? .3*Math.max(0, 1 - s.t/3) + .12 : .3 + .4*calor; return k; }
  };
}
