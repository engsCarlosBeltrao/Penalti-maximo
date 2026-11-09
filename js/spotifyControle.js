// CONTROLE DO SPOTIFY PELA API OFICIAL (Web API "Player"): o jogo manda o aplicativo Spotify aberto no PC tocar, pausar, continuar, mudar o volume,
// pular faixa e repetir. Exige Spotify PREMIUM e um app cadastrado pelo próprio usuário em https://developer.spotify.com/dashboard (Client ID).
// Login: Authorization Code com PKCE — a senha é digitada só na página do Spotify; o jogo guarda apenas os tokens (neste navegador).
// O áudio sai do aplicativo Spotify; o jogo não baixa, não grava e não reproduz o áudio.
const KEY = 'pm_spotify_conta', AUTH = 'https://accounts.spotify.com', API = 'https://api.spotify.com/v1';
export const ESCOPOS = 'user-modify-playback-state user-read-playback-state';
const ls = () => (typeof localStorage !== 'undefined' ? localStorage : null), ss = () => (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
const ler = () => { try { return JSON.parse(ls()?.getItem(KEY) || '{}') || {}; } catch { return {}; } };
const grava = d => { try { ls()?.setItem(KEY, JSON.stringify(d)); } catch {} };
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const aleatorio = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a).slice(0, n); };
export const redirectUri = (loc = typeof location !== 'undefined' ? location : null) => loc ? loc.origin + loc.pathname : '';
export const clientIdOk = id => /^[0-9a-f]{32}$/i.test(String(id || '').trim());
export function criaControle({ fetch: f = (typeof fetch === 'function' ? (...a) => globalThis.fetch(...a) : null), agora = () => Date.now() } = {}) {
  const C = { msg: '', usuario: null, _dev: null, _vol: null, _tVol: null };
  C.conta = () => ler();
  C.clientId = () => ler().clientId || '';
  C.salvaClientId = id => { const d = ler(); if (d.clientId !== id.trim()) { grava({ clientId: id.trim() }); } return clientIdOk(id); };
  C.conectado = () => !!ler().refresh;
  C.desconectar = () => { grava({ clientId: ler().clientId }); C.usuario = null; C._dev = null; };
  // 1) vai para a página de login do Spotify
  C.conectar = async (loc = location) => {
    const id = C.clientId(); if (!clientIdOk(id)) { C.msg = 'Cole o Client ID do seu app do Spotify (32 caracteres).'; return false; }
    const ver = aleatorio(64), st = aleatorio(16), ch = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ver)));
    ss()?.setItem('pm_sp_ver', ver); ss()?.setItem('pm_sp_st', st);
    const q = new URLSearchParams({ response_type: 'code', client_id: id, scope: ESCOPOS, redirect_uri: redirectUri(loc), code_challenge_method: 'S256', code_challenge: ch, state: st });
    loc.assign(`${AUTH}/authorize?${q}`); return true;
  };
  // 2) volta do login (?code=...&state=...): troca o código pelos tokens e limpa a barra de endereço
  C.retornoLogin = async (loc = location, hist = history) => {
    const p = new URLSearchParams(loc.search); if (!p.has('code') && !p.has('error')) return null;
    const limpa = () => { const q = new URLSearchParams(loc.search); ['code', 'state', 'error'].forEach(k => q.delete(k)); hist.replaceState(null, '', loc.pathname + (q.toString() ? '?' + q : '')); };
    if (p.has('error')) { limpa(); C.msg = p.get('error') === 'access_denied' ? 'Login no Spotify cancelado.' : 'O Spotify recusou o login: ' + p.get('error'); return false; }
    if (p.get('state') !== ss()?.getItem('pm_sp_st')) { limpa(); C.msg = 'Login do Spotify inválido (tente conectar de novo).'; return false; }
    const r = await C._token({ grant_type: 'authorization_code', code: p.get('code'), redirect_uri: redirectUri(loc), client_id: C.clientId(), code_verifier: ss()?.getItem('pm_sp_ver') || '' });
    ss()?.removeItem('pm_sp_ver'); ss()?.removeItem('pm_sp_st'); limpa(); return r;
  };
  C._token = async corpo => {
    try { const r = await f(`${AUTH}/api/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(corpo).toString() }), j = await r.json();
      if (!r.ok) { C.msg = j.error === 'invalid_client' ? 'Client ID inválido.' : j.error_description || j.error || 'Falha no login do Spotify.'; if (j.error === 'invalid_grant') C.desconectar(); return false; }
      const d = ler(); grava({ ...d, access: j.access_token, refresh: j.refresh_token || d.refresh, expira: agora() + (j.expires_in - 60)*1000 }); C.msg = ''; return true; }
    catch { C.msg = 'Sem conexão com o Spotify.'; return false; }
  };
  C.token = async () => { const d = ler(); if (!d.refresh) return null; if (d.access && agora() < d.expira) return d.access;
    return (await C._token({ grant_type: 'refresh_token', refresh_token: d.refresh, client_id: d.clientId })) ? ler().access : null; };
  // chamada à Web API com renovação do token e mensagens claras
  C.api = async (metodo, caminho, corpo, tentou = false) => {
    const tk = await C.token(); if (!tk) { C.msg = 'Spotify não conectado (Músicas e Torcidas → Links do Spotify → CONECTAR).'; return { ok: false }; }
    let r; try { r = await f(API + caminho, { method: metodo, headers: { Authorization: 'Bearer ' + tk, ...(corpo ? { 'Content-Type': 'application/json' } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined }); }
    catch { C.msg = 'Sem conexão com o Spotify.'; return { ok: false }; }
    if (r.status === 401 && !tentou) { const d = ler(); grava({ ...d, access: null, expira: 0 }); return C.api(metodo, caminho, corpo, true); }
    let j = null; if (r.status !== 204) { try { j = await r.json(); } catch {} }
    if (!r.ok) { const raz = j?.error?.reason, m = j?.error?.message || '';
      C.msg = raz === 'PREMIUM_REQUIRED' || /premium/i.test(m) ? 'O Spotify só deixa o jogo controlar a música em contas Premium.' : raz === 'NO_ACTIVE_DEVICE' || r.status === 404 ? 'Abra o aplicativo Spotify no PC (e toque qualquer coisa uma vez) para o jogo poder controlar.' : r.status === 429 ? 'Muitas ordens seguidas ao Spotify; tentando de novo em instantes.' : 'Spotify: ' + (m || r.status);
      return { ok: false, status: r.status, reason: raz }; }
    C.msg = ''; return { ok: true, status: r.status, json: j };
  };
  // o Spotify às vezes ACEITA a ordem (204) mas não toca (conta sem Premium, app sem música carregada): confirma pelo estado do player
  C.estaTocando = async () => { const r = await C.api('GET', '/me/player'); if (!r.ok) return null; if (r.status === 204 || !r.json) return false; return !!r.json.is_playing && !!r.json.item; };
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  C.mesma = (item, uri, nome) => !!item && (item.uri === uri || item.linked_from?.uri === uri || (!!nome && norm(item.name) === norm(nome)));
  C.posicao = async () => { const r = await C.api('GET', '/me/player'); if (!r.ok || r.status === 204 || !r.json) return null; const j = r.json; return { uri: j.item?.uri || null, item: j.item || null, prog: j.progress_ms || 0, dur: j.item?.duration_ms || 0, on: !!j.is_playing }; };
  C.quemSou = async () => { const r = await C.api('GET', '/me'); C.usuario = r.ok ? { nome: r.json?.display_name || r.json?.id, premium: r.json?.product == null ? null : r.json.product === 'premium' } : null; return C.usuario; };
  // dispositivo: o que está ativo; senão o computador (aplicativo do Windows)
  C.dispositivo = async () => { const r = await C.api('GET', '/me/player/devices'); if (!r.ok) return null; const ds = r.json?.devices || [];
    const d = ds.find(x => x.is_active) || ds.find(x => x.type === 'Computer') || ds[0]; C._dev = d?.id || null; if (!d) C.msg = 'Nenhum Spotify aberto: abra o aplicativo Spotify no PC.'; return C._dev; };
  const comDev = async (fn) => { let r = await fn(C._dev); if (!r.ok && (r.status === 404 || r.reason === 'NO_ACTIVE_DEVICE')) { if (await C.dispositivo()) r = await fn(C._dev); } return r; };
  const q = d => d ? `?device_id=${encodeURIComponent(d)}` : '';
  // tocar: playlist → context_uri; faixas → todas as faixas do clube a partir da escolhida (o Spotify segue a ordem sozinho)
  // a API do Spotify (modo de desenvolvimento) aceita 'tocar esta música' mas não toca; pausar/continuar/volume funcionam. Então a música começa pelo
  // APLICATIVO do Windows (link spotify:, aberto pelo servidor do jogo: /spotify-abrir) e o resto segue pela API.
  C.abrirNoPC = async uri => { if (C.local === false || typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return null;
    try { const r = await f(`${location.origin}/spotify-abrir?uri=${encodeURIComponent(uri)}`, { headers: { 'X-Penalti': '1' } }); if (r.status === 404) { C.local = false; return null; } return r.ok; } catch { C.local = false; return null; } };
  // pedidos de tocar vão em FILA (um por vez) e o mais novo cancela os anteriores: dois 'fila + próxima' misturados pulavam duas músicas
  C._ver = 0; C._cadeia = Promise.resolve(); C._sobras = new Set();
  C.tocar = (fila, i = 0) => { const meu = ++C._ver; const p = C._cadeia.then(() => meu === C._ver ? C._tocar(fila, i, () => meu !== C._ver) : false).catch(() => false); C._cadeia = p; return p; };
  C._tocar = async (fila, i, velho) => { const e = fila[i]; if (!e) return false;
    let uri = `spotify:${e.tipo}:${e.sid}`;
    if (e.tipo === 'playlist') { const r = await C.api('GET', `/playlists/${e.sid}/tracks?limit=1&fields=items(track(uri))`); const t = r.ok && r.json?.items?.[0]?.track?.uri; if (t) uri = t; C.msg = ''; }   // playlist: começa pela 1ª música dela
    // SEM ABRIR JANELA: se o Spotify já tem uma música carregada, troca por 'fila + próxima' (~1 s); se já é a mesma música, só continua
    const st = await C.api('GET', '/me/player'), j = st.ok && st.status === 200 ? st.json : null; if (velho()) return false;
    if (C.mesma(j?.item, uri, e.nome)) { if (!j.is_playing) await C.api('PUT', '/me/player/play'); C.msg = ''; return true; }
    if (j?.item) { const a = await C.api('POST', '/me/player/queue?uri=' + encodeURIComponent(uri));   // fila + próxima sempre juntas (cancelar no meio deixava a música sobrando na fila)
      if (a.ok && (await C.api('POST', '/me/player/next')).ok) {
        // o Spotify demora um pouco para mostrar a música nova: espera até 2,5 s; só pula de novo se estiver tocando uma SOBRA que o próprio jogo pôs na fila
        C._sobras.add(uri); for (let k = 0; k < 8; k++) { await new Promise(r => setTimeout(r, 320)); const v = await C.api('GET', '/me/player'), it = v.ok && v.json?.item?.uri; if (!it) continue;
          if (C.mesma(v.json.item, uri, e.nome)) { C._sobras.delete(uri); break; } if (C._sobras.has(it)) { C._sobras.delete(it); await C.api('POST', '/me/player/next'); } }
        if (!j.is_playing) await C.api('PUT', '/me/player/play'); C.msg = ''; return true; } }
    // nada carregado no Spotify: abre a música pelo APLICATIVO do Windows (uma vez; o foco volta para o jogo)
    if (C.local !== false && typeof location !== 'undefined') {
      const ab = await C.abrirNoPC(uri); if (ab) { for (let k = 0; k < 6; k++) { await new Promise(r => setTimeout(r, 400)); if (await C.estaTocando()) return true; }   // abriu: espera começar; se ficou pausado, 'continuar'
        await C.api('PUT', '/me/player/play'); return true; } }
    const corpo = e.tipo === 'playlist' ? { context_uri: `spotify:playlist:${e.sid}` } : { uris: [...fila.slice(i), ...fila.slice(0, i)].filter(x => x.tipo === 'track').map(x => `spotify:track:${x.sid}`) };
    return (await comDev(d => C.api('PUT', '/me/player/play' + q(d), corpo))).ok; };
  C.cancela = () => { C._ver++; };
  C.pausar = async () => (await C.api('PUT', '/me/player/pause' + q(C._dev))).ok || /restriction|already paused/i.test(C.msg) && !(C.msg = '');
  C.continuar = async () => (await comDev(d => C.api('PUT', '/me/player/play' + q(d)))).ok;
  C.proxima = async () => (await comDev(d => C.api('POST', '/me/player/next' + q(d)))).ok;
  C.repetir = async modo => (await C.api('PUT', `/me/player/repeat?state=${modo}` + (C._dev ? '&device_id=' + encodeURIComponent(C._dev) : ''))).ok;   // track | context | off
  C.volume = (v, imediato = false) => { const pct = Math.round(Math.max(0, Math.min(1, v))*100); if (pct === C._vol) return Promise.resolve(true); C._vol = pct;   // agrupa mudanças seguidas (barra de volume)
    clearTimeout(C._tVol); const go = () => C.api('PUT', `/me/player/volume?volume_percent=${pct}` + (C._dev ? '&device_id=' + encodeURIComponent(C._dev) : '')).then(r => r.ok);
    return imediato ? go() : new Promise(res => { C._tVol = setTimeout(() => go().then(res), 250); }); };
  return C;
}
