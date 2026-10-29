// Estado único e documentado da partida. Fonte de verdade para HUD e para integração externa.
export const GS = {
  estado: 'MENU',          // MENU | SELECAO_EQUIPE | AGUARDANDO_COBRANCA | MIRANDO | CHUTANDO | RESOLVENDO_COBRANCA | DEFESA_DO_GOLEIRO | RESULTADO | CAMPEONATO_FINALIZADO
  equipes: [null, null],   // [{id,nome,sigla}] índice 0 = jogador
  placar: [0, 0],
  cobranca: 1,             // número da rodada atual (1..5, depois morte súbita)
  cobrancasRealizadas: 0,  // total de chutes já resolvidos
  cobrador: 0,             // 0 = jogador, 1 = adversário
  ultimaCobranca: null,    // {equipe, resultado:'gol'|'defesa'|'fora'|'trave', gx, gy}
  vencedor: null           // 0, 1 ou null
};
// Texto pronto para LCD 16x2
export function getLcd() {
  const [a, b] = GS.equipes.map(t => (t?.sigla || '---'));
  const l1 = `${a} ${GS.placar[0]} x ${GS.placar[1]} ${b}`.padEnd(16).slice(0, 16);
  const l2 = `PENALTIS ${Math.min(GS.cobranca, 5)}/5`.padEnd(16).slice(0, 16);
  return [l1, l2];
}
