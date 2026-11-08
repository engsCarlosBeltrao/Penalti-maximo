// MEMÓRIA DE ESCOLHA DO LADO, uma por goleiro (não se mistura entre goleiros). Só afeta a ESCOLHA inicial do lado (antes do chute), nunca a
// capacidade física de defender.
//
// Regra:
//  - sem histórico: esquerda 40%, meio 20%, direita 40% (o goleiro escolhe menos ficar no meio);
//  - depois de escolher uma direção pela 1ª vez, na cobrança seguinte essa direção tem a sua probabilidade dividida por 12;
//  - a cada repetição CONSECUTIVA da mesma direção, a probabilidade dela é dividida por 2 de novo (÷12, ÷24, ÷48, …);
//  - escolher uma direção DIFERENTE da anterior encerra a sequência: as probabilidades voltam ao normal (40/20/40) e a memória de repetição é
//    reiniciada (a nova direção passa a ser a "anterior", sem redução — só uma nova repetição dela recomeça o ÷12);
//  - normalização: o que a direção reduzida perde é dividido entre as outras duas proporcionalmente aos valores delas; soma sempre 1.
export const DIRECOES = ['esq', 'centro', 'dir'];
export const PESO = { esq: .4, centro: .2, dir: .4 }, BASE = 1/3, DIV_PRIMEIRA = 12, DIV_REPETE = 2;   // BASE: valor antigo (1/3), mantido só como referência
export const novaMemoria = () => ({ ultima: null, repeticoes: 0, reiniciada: false, historico: [] });
// probabilidades atuais { esq, centro, dir } (somam 1)
export function probabilidades(m) {
  const p = { ...PESO };
  if (m.ultima && m.repeticoes > 0) {
    const red = PESO[m.ultima]/DIV_PRIMEIRA/Math.pow(DIV_REPETE, m.repeticoes - 1), resto = 1 - red, outras = DIRECOES.filter(d => d !== m.ultima), soma = outras.reduce((a, d) => a + p[d], 0);
    p[m.ultima] = red; outras.forEach(d => { p[d] = resto*p[d]/soma; });
  }
  return p;
}
// registra a escolha feita (por sorteio ou pelo jogador) e atualiza a sequência
export function registrar(m, d) {
  if (!DIRECOES.includes(d)) return m;
  if (m.ultima === d) m.repeticoes = m.reiniciada ? 1 : m.repeticoes + 1;      // repetiu: reduz (de novo)
  else if (m.ultima == null) m.repeticoes = 1;                                 // 1ª escolha do goleiro: na próxima, ÷12
  else { m.repeticoes = 0; }                                                   // mudou: sequência encerrada, tudo volta a 1/3
  m.reiniciada = m.ultima != null && m.ultima !== d; m.ultima = d;
  m.historico.push(d); if (m.historico.length > 20) m.historico.shift();
  return m;
}
// sorteia uma direção com as probabilidades atuais (não olha a mira nem o cobrador)
export function sortear(m, rng = Math.random) { const p = probabilidades(m), u = rng(); return u < p.esq ? 'esq' : u < p.esq + p.centro ? 'centro' : 'dir'; }
// uma memória por goleiro, durante a sessão
const MEMORIAS = new Map();
export const memoriaDe = id => { let m = MEMORIAS.get(id); if (!m) { m = novaMemoria(); MEMORIAS.set(id, m); } return m; };
export const limparMemorias = () => MEMORIAS.clear();
