// VITÓRIAS POR CLUBE (salvas neste computador, localStorage): começam em 0; cada partida vencida por um jogador humano com o clube soma 1.
// Mostradas na seleção de times. Dados corrompidos ou armazenamento bloqueado nunca travam o jogo (contagem volta a 0).
const KEY = 'pm_vitorias_v1';
let dados = null;
const ler = () => { if (dados) return dados; dados = {};
  try { const raw = JSON.parse(localStorage.getItem(KEY) || '{}'); if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) if (/^[a-z0-9-]{1,30}$/.test(k) && Number.isInteger(v) && v > 0) dados[k] = v; } catch {}
  return dados; };
export const vitorias = key => ler()[key] || 0;
export function somaVitoria(key) { if (!key) return 0; const d = ler(); d[key] = (d[key] || 0) + 1; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} return d[key]; }
export function zeraVitorias() { dados = {}; try { localStorage.removeItem(KEY); } catch {} }
