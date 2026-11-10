// MÚSICAS DAS TORCIDAS (arquivos locais do usuário) tocadas PELO JOGO durante a partida.
// Cadastro: Store.data.torcidas = { flamengo: [{ id, nome, arquivo, tamanho, tipo, principal }] } (o áudio fica no IndexedDB: js/torcidaArquivos.js).
// Regras: Store.data.torcidaRegras (quais eventos tocam, pausa, fim, repetição, volume). UM único <audio>: nunca há duas músicas ao mesmo tempo, e o
// mesmo time não recomeça se a música dele já está tocando (eventos repetidos não duplicam).
// ORIGEM (regra 'origem'): 'auto' (padrão) = para cada clube, os ARQUIVOS se houver; senão os LINKS DO SPOTIFY do clube (Store.data.spotify), mandando o
// APLICATIVO Spotify do PC tocar/pausar/mudar o volume pela API oficial (js/spotifyControle.js; Premium + login). 'arquivos' / 'spotify' forçam uma delas.
// MENU: a chave 'menu' (no lugar de um clube) guarda as músicas do menu principal, tocadas fora da partida (regra 'menu').
import { Arquivos } from './torcidaArquivos.js';
export const MENU = 'menu';
export const REGRAS_PADRAO = () => ({ v: 2, origem: 'auto', menu: true, inicio: true, vez: true, gol: true, chute: 'nada', pausa: 'pausar', fim: 'vencedor', repetir: 'todas', volume: .7 });
const OP = { origem: ['auto', 'arquivos', 'spotify'], chute: ['abaixar', 'nada'], pausa: ['pausar', 'abaixar', 'continuar'], fim: ['vencedor', 'parar', 'continuar'], repetir: ['todas', 'uma', 'nao'] };
export const MAX_POR_CLUBE = 20;
const txt = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
export const uidT = () => 't' + Math.random().toString(36).slice(2, 10);
export function limpaRegras(r) { const d = REGRAS_PADRAO(); if (!r || typeof r !== 'object') return d;
  ['menu', 'inicio', 'vez', 'gol'].forEach(k => { if (typeof r[k] === 'boolean') d[k] = r[k]; }); if (r.fonte === 'spotify' && !r.origem) d.origem = 'spotify'; Object.entries(OP).forEach(([k, v]) => { if (v.includes(r[k])) d[k] = r[k]; });   // (r.fonte: regra antiga)
  if (Number.isFinite(+r.volume)) d.volume = Math.min(1, Math.max(0, +r.volume)); if (r.v !== 2) d.chute = 'nada';   // regras antigas: a música não abaixa mais no chute
  return d; }
export function limpaTorcidas(raw) {
  const out = {}; let descartados = 0; if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { lista: out, descartados };
  for (const [k, v] of Object.entries(raw)) { if (!/^[a-z0-9-]{1,30}$/.test(k) || !Array.isArray(v)) { descartados++; continue; } const l = [];
    for (const e of v) { if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !/^t[a-z0-9]{3,12}$/.test(e.id) || l.length >= MAX_POR_CLUBE || l.some(x => x.id === e.id)) { descartados++; continue; }
      l.push({ id: e.id, nome: txt(e.nome, 80) || 'Música', arquivo: txt(e.arquivo, 120), tamanho: Number.isFinite(+e.tamanho) ? +e.tamanho : 0, tipo: txt(e.tipo, 40), principal: e.principal === true }); }
    if (l.length) { if (l.filter(x => x.principal).length !== 1) l.forEach((x, i) => { x.principal = i === (Math.max(0, l.findIndex(y => y.principal))); }); out[k] = l; } }
  return { lista: out, descartados };
}
// ---- cadastro (lista = Store.data.torcidas) ----
export function adiciona(lista, clube, { id = uidT(), nome, arquivo, tamanho = 0, tipo = '' }) {
  const l = lista[clube] ||= []; if (l.length >= MAX_POR_CLUBE) return { ok: false, error: `Limite de ${MAX_POR_CLUBE} músicas por clube.` };
  const e = { id, nome: txt(nome || (arquivo || '').replace(/\.[^.]+$/, ''), 80) || 'Música', arquivo: txt(arquivo, 120), tamanho, tipo: txt(tipo, 40), principal: !l.length }; l.push(e); return { ok: true, entrada: e };
}
export function renomeia(lista, clube, id, nome) { const e = (lista[clube] || []).find(x => x.id === id); if (!e || !txt(nome, 80)) return false; e.nome = txt(nome, 80); return true; }
export function principal(lista, clube, id) { const l = lista[clube] || []; if (!l.some(x => x.id === id)) return false; l.forEach(x => { x.principal = x.id === id; }); return true; }
export function tira(lista, clube, id) { const l = lista[clube] || [], i = l.findIndex(x => x.id === id); if (i < 0) return null; const [e] = l.splice(i, 1);
  if (e.principal && l.length) l[0].principal = true; if (!l.length) delete lista[clube]; return e; }
export function embaralha(l, evitar = null) { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  if (evitar && a.length > 1 && a[0].id === evitar) a.push(a.shift()); return a; }   // MENU: ordem sorteada, sem repetir a última em seguida
export const ordemTocar = (lista, clube) => { const l = lista[clube] || [], p = l.findIndex(x => x.principal); return p > 0 ? [...l.slice(p), ...l.slice(0, p)] : l.slice(); };   // começa pela principal

// ---- PLAYER ÚNICO ----
// deps: { store: () => Store.data, Audio, url: blob => objectURL, livre: url => void, pausaOutras: () => void (música do menu) }
export function criaPlayer(deps) {
  const P = { clube: null, faixa: null, estado: 'parado', motivo: '', abaixado: false, onChange: null, tocadas: 0, _el: null, _url: null, _fila: [], _i: 0, _pedido: 0, _fonte: 'arquivos', _ouv: new Set() };
  const regras = () => deps.store().torcidaRegras || REGRAS_PADRAO(), sp = deps.spotify || null;
  const arqs = () => deps.store().torcidas || {}, links = () => deps.store().spotify || {}, spOk = () => !!sp && sp.conectado?.() !== false;
  // de onde vem a música deste clube: 'arquivos' ou 'spotify'
  P.fonte = (clube = P.clube) => { const o = regras().origem; if (o === 'spotify' && sp) return 'spotify'; if (o === 'arquivos' || !sp) return 'arquivos';
    return (arqs()[clube] || []).length ? 'arquivos' : (links()[clube] || []).length && spOk() ? 'spotify' : 'arquivos'; };
  const lista = clube => P.fonte(clube) === 'spotify' ? links() : arqs();
  P.ouvir = fn => { P._ouv.add(fn); return () => P._ouv.delete(fn); };
  const REP_SP = { uma: 'track', todas: 'context', nao: 'off' };
  const emite = () => { try { P.onChange?.(); } catch {} P._ouv.forEach(f => { try { f(P); } catch {} }); };
  const el = () => { if (P._el || !deps.Audio) return P._el; const a = P._el = new deps.Audio(); a.preload = 'auto';
    a.onended = () => { const r = regras().repetir; if (P.clube === MENU && P._fila.length > 1) { P.trocar(true); return; }   // menu: sempre a próxima sorteada
      if (r === 'uma') { a.currentTime = 0; a.play?.()?.catch?.(() => {}); } else if (r === 'todas' && P._fila.length) P.trocar(true); else { P.estado = 'parado'; emite(); } };
    a.onerror = () => { if (P._sp || !P._url || a.src !== P._url || P.estado === 'carregando') return; P.estado = 'erro'; P.motivo = `Não foi possível tocar "${P.faixa?.nome || ''}".`; emite(); }; return a; };   // erro só do arquivo atual
  const vol = (imediato = false) => { const r = regras(), v = Math.max(0, Math.min(1, r.volume*(P.abaixado ? .3 : 1))); if (P._sp) return sp.volume(v, imediato); const a = P._el; if (a) a.volume = v; };
  function vigiaMenu(pedido) {   // o Spotify não avisa quando a música acaba: confere a cada 2 s e troca ~9 s antes do fim (a troca leva 1–3 s)
    clearInterval(P._vigia); if (!sp?.posicao) return;
    P._vigia = setInterval(async () => { if (pedido !== P._pedido || P.clube !== MENU || !P._sp) { clearInterval(P._vigia); return; } if (P.estado !== 'tocando' || P._fila.length < 2 || P._trocando) { (P._log ||= []).push(`pula: ${P.estado} fila=${P._fila.length} trocando=${!!P._trocando}`); return; }
      const s = await sp.posicao(); if (!s || pedido !== P._pedido) return; const fora = !!s.item && !P._fila.some(x => sp.mesma ? sp.mesma(s.item, `spotify:track:${x.sid}`, x.nome) : `spotify:track:${x.sid}` === s.uri); P._fora = fora ? (P._fora || 0) + 1 : 0;
      (P._log ||= []).push(`${new Date().toISOString().slice(14, 19)} ${s.uri?.slice(-6)} ${Math.round(s.prog/1000)}/${Math.round(s.dur/1000)}s fora=${P._fora}`); if (P._log.length > 40) P._log.shift();
      if (performance.now() - (P._tTroca || 0) < 8000) return;   // logo depois de trocar o Spotify ainda pode mostrar a anterior
      if (P._fora >= 2 || (!fora && s.dur && s.dur - s.prog < 9000)) { P._fora = 0; P._trocando = true; clearInterval(P._vigia); await P.trocar(true); P._trocando = false; } }, 2000); }
  async function carregaSpotify(e, pedido) {
    P._tTroca = typeof performance !== 'undefined' ? performance.now() : Date.now();
    P._sp = true; P.faixa = e; if (P._el && !P._el.paused) P._el.pause(); deps.pausaOutras?.();
    const ok = await sp.tocar(P._fila, P._i); if (pedido !== P._pedido) return false;
    if (ok) { P.estado = 'tocando'; P.motivo = ''; P.tocadas++; vol(true); sp.repetir(P.clube === MENU ? (P._fila.length > 1 ? 'off' : 'track') : REP_SP[regras().repetir]); if (P.clube === MENU) { P._ultimoMenu = e.id; vigiaMenu(pedido); } } else { P.estado = 'erro'; P.motivo = sp.msg || 'O Spotify não respondeu.'; }
    emite();
    if (ok && sp.estaTocando) setTimeout(async () => { if (pedido !== P._pedido) return; const t = await sp.estaTocando(); if (pedido !== P._pedido || t !== false) return;   // confirma 3 s depois
      P.estado = 'erro'; P.motivo = 'O Spotify aceitou a ordem mas não tocou: o controle pelo jogo só funciona em conta Premium (ou abra o app Spotify e toque algo uma vez).'; emite(); }, 3000);
    return ok;
  }
  async function carrega(e) {
    if (P._fonte === 'spotify') return carregaSpotify(e, ++P._pedido);
    if (P._sp) { P._sp = false; sp?.pausar(); }
    const pedido = ++P._pedido, b = await Arquivos.ler(e.id); if (pedido !== P._pedido) return false;   // um pedido mais novo venceu: nada de duas músicas
    if (!b) { P.estado = 'erro'; P.motivo = `Arquivo de "${e.nome}" não encontrado (cadastre de novo).`; emite(); return false; }
    const a = el(); if (!a) return false; const velho = P._url; P._url = deps.url(b); a.src = P._url; if (velho) setTimeout(() => deps.livre?.(velho), 1000); P.faixa = e; vol();
    try { deps.pausaOutras?.(); await a.play(); if (pedido !== P._pedido) return false; P.estado = 'tocando'; P.motivo = ''; P.tocadas++; if (P.clube === MENU) P._ultimoMenu = e.id; }
    catch (x) { if (pedido !== P._pedido || x?.name === 'AbortError') return false;   // interrompido por uma troca de música: não é erro
      P.estado = 'erro'; P.motivo = x?.name === 'NotAllowedError' ? 'O navegador bloqueou o áudio: clique na tela e tente de novo.' : `Não foi possível tocar "${e.nome}".`; }
    emite(); return P.estado === 'tocando';
  }
  // toca a música do clube; se já é o clube tocando, não recomeça (a menos que forcar)
  P.tocarClube = async (clube, { forcar = false } = {}) => {
    if (!clube) return false; if (!forcar && P.clube === clube && (P.estado === 'tocando' || P.estado === 'carregando')) return true;
    const fonte = P.fonte(clube), fila = clube === MENU ? embaralha(ordemTocar(lista(clube), clube), P._ultimoMenu) : ordemTocar(lista(clube), clube);
    if (!fila.length) { if (P.clube !== clube) { if (clube === MENU || P.estado !== 'tocando') P.parar(); P.semMusica = clube;   // clube sem música: a que já está tocando continua
      P.motivo = clube === MENU ? 'Sem música do menu cadastrada.' : (links()[clube] || []).length && !spOk() ? 'Este clube só tem links do Spotify e o Spotify não está conectado.' : 'Sem música cadastrada para este clube.'; emite(); } return false; }
    P.semMusica = null; P.motivo = ''; P.clube = clube; P._fonte = fonte; P._fila = fila; P._i = 0; P.estado = 'carregando'; emite(); return carrega(fila[0]);
  };
  P.tocarFaixa = async (clube, id) => { const fonte = (arqs()[clube] || []).some(x => x.id === id) ? 'arquivos' : 'spotify'; P._fonte = fonte; const fila = ordemTocar(fonte === 'spotify' ? links() : arqs(), clube), i = fila.findIndex(x => x.id === id); if (i < 0) return false; P.clube = clube; P._fila = fila; P._i = i; P.estado = 'carregando'; emite(); return carrega(fila[i]); };
  P.trocar = async (auto = false) => { if (P._sp && P._fila.length === 1 && P._fila[0].tipo === 'playlist') { const ok = await sp.proxima(); if (!ok) { P.motivo = sp.msg; emite(); } return ok; }   // playlist: próxima faixa dela
    if (!P._fila.length) return false; if (P._fila.length === 1 && !auto) return false; P._i = (P._i + 1) % P._fila.length;
    if (P._i === 0 && P.clube === MENU && P._fila.length > 1) P._fila = embaralha(P._fila, P.faixa?.id); P.estado = 'carregando'; emite(); return carrega(P._fila[P._i]); };
  P.pausar = () => { if (P.estado !== 'tocando') return false; if (P._sp) sp.pausar(); else P._el?.pause(); P.estado = 'pausado'; emite(); return true; };
  P.continuar = async () => { if (P.estado !== 'pausado') return false;
    if (P._sp) { const ok = await sp.continuar(); P.estado = ok ? 'tocando' : 'erro'; if (!ok) P.motivo = sp.msg; emite(); return ok; }
    if (!P._el) return false; try { await P._el.play(); P.estado = 'tocando'; } catch { P.estado = 'erro'; } emite(); return P.estado === 'tocando'; };
  P.alternar = () => P.estado === 'tocando' ? P.pausar() : P.estado === 'pausado' ? P.continuar() : P.clube ? P.tocarClube(P.clube, { forcar: true }) : false;
  P.parar = () => { P._pedido++; clearInterval(P._vigia); sp?.cancela?.(); if (P._sp && P.estado === 'tocando') sp.pausar(); P._sp = false; if (P._el) { P._el.pause(); try { P._el.currentTime = 0; } catch {} } P.estado = 'parado'; P.clube = null; P.faixa = null; P._fila = []; P.abaixado = false; emite(); return true; };
  P.abaixar = v => { P.abaixado = !!v; vol(); };
  // menu principal: toca as músicas do menu (se houver e a regra estiver ligada); senão silencia o que estiver tocando de partida
  P.tocarMenu = () => { if (regras().menu && ordemTocar(lista(MENU), MENU).length) return P.tocarClube(MENU); if (P.estado !== 'parado' && P.clube !== MENU) P.parar(); return Promise.resolve(false); };
  P.temMusica = clube => !!ordemTocar(lista(clube), clube).length;
  P.atualizaVolume = () => vol();
  // ---- eventos da partida (js/events.js) ----
  P.liga = (Events, GS) => {
    const time = i => GS.equipes[i]?.key;
    // A MÚSICA SEGUE A TORCIDA QUE COMEMORA: gol → a de quem marcou; defesa → a do time do goleiro; pênalti perdido → a do outro time. Enquanto uma
    // torcida comemora, a próxima cobrança NÃO troca a música; ela só muda quando a outra torcida passa a comemorar (o mesmo time nunca recomeça).
    P.comemora = null;
    const comemora = q => { if (q !== 0 && q !== 1) return; P.comemora = q; if (regras().gol) P.tocarClube(time(q)); };   // evento sem equipe válida: não muda nada
    Events.on('partida_iniciada', () => { P.comemora = null; P.abaixar(false); if (regras().inicio) P.tocarClube(time(0), { forcar: true }); });
    Events.on('partida_reiniciada', () => { P.comemora = null; P.abaixar(false); });
    Events.on('cobranca_mudou', e => { P.abaixar(false); if (regras().vez && P.comemora == null) P.tocarClube(time(e.cobrador)); });   // vez: só enquanto ninguém comemora
    Events.on('chute', () => { if (regras().chute === 'abaixar') P.abaixar(true); });
    for (const r of ['defesa', 'fora', 'trave']) Events.on(r, e => { P.abaixar(false); comemora(1 - e.equipe); });   // comemora o time que NÃO cobrou
    Events.on('gol', e => { P.abaixar(false); comemora(e.equipe); });
    Events.on('pausa', () => { const r = regras().pausa; if (r === 'pausar') P._pausouNaPausa = P.pausar(); else if (r === 'abaixar') P.abaixar(true); });
    Events.on('retomada', () => { if (P._pausouNaPausa) P.continuar(); P._pausouNaPausa = false; P.abaixar(false); });
    Events.on('partida_encerrada', e => { P.abaixar(false); const r = regras().fim; if (r === 'vencedor') P.tocarClube(time(e.vencedor), { forcar: P.clube !== time(e.vencedor) }); else if (r === 'parar') P.parar(); });
  };
  return P;
}
