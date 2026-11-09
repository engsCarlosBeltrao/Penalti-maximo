// CONTROLE DO SPOTIFY PELA API OFICIAL (Premium): login PKCE, renovação do token, tocar faixa/playlist no app do PC, pausar, continuar, volume, próxima,
// repetição, erros (sem Premium, Spotify fechado) e o PLAYER DO JOGO com a fonte "spotify" seguindo os eventos da partida. Com um Spotify FALSO
// (node não fala com o Spotify de verdade).  node test_spotify_controle.mjs
const mem = {}, sess = {}; globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
globalThis.sessionStorage = { getItem: k => sess[k] ?? null, setItem: (k, v) => { sess[k] = String(v); }, removeItem: k => { delete sess[k]; } };
const { criaControle, redirectUri, clientIdOk } = await import('./js/spotifyControle.js'), T = await import('./js/torcidas.js'), { Store, defaults } = await import('./js/settingsStore.js');
const { Events } = await import('./js/events.js'), { GS } = await import('./js/gameState.js');
let ok = 0, bad = 0; const t = (n, c, info = '') => { c ? ok++ : (bad++, console.log('FALHOU:', n, info)); if (c) console.log(`ok  ${n}${info !== '' ? ' · ' + info : ''}`); };
const tick = (ms = 5) => new Promise(r => setTimeout(r, ms));
const CID = '0123456789abcdef0123456789abcdef', TR1 = '4uLU6hMCjMI75M1A2tKUQC', TR2 = '0000000000000000000001', PL = '37i9dQZF1DXcBWIGoYBM5M';
// ---- Spotify falso ----
const S = { chamadas: [], premium: true, aberto: true, ativo: false, tokens: 0, expira: 3600 };
const resp = (st, j) => ({ ok: st < 300, status: st, json: async () => j });
async function falso(url, o = {}) { const m = o.method || 'GET', u = new URL(url); S.chamadas.push(m + ' ' + u.pathname + u.search + (o.body && !String(o.body).includes('grant_type') ? ' ' + o.body : ''));
  if (u.host === 'accounts.spotify.com') { const b = new URLSearchParams(o.body); S.ultimoToken = Object.fromEntries(b); S.tokens++; if (b.get('client_id') !== CID) return resp(400, { error: 'invalid_client' }); return resp(200, { access_token: 'AT' + S.tokens, refresh_token: 'RT', expires_in: S.expira }); }
  if (!S.premium && /\/me\/player\/(play|pause|volume|next|repeat)/.test(u.pathname)) return resp(403, { error: { status: 403, message: 'Player command failed: Premium required', reason: 'PREMIUM_REQUIRED' } });
  if (u.pathname === '/v1/me') return resp(200, { display_name: 'Torcedor', product: S.premium ? 'premium' : 'free' });
  if (u.pathname === '/v1/me/player/devices') return resp(200, { devices: S.aberto ? [{ id: 'PC1', type: 'Computer', is_active: S.ativo, name: 'PICHAU' }] : [] });
  if (!S.ativo && !u.searchParams.get('device_id')) return resp(404, { error: { status: 404, message: 'Player command failed: No active device found', reason: 'NO_ACTIVE_DEVICE' } });
  if (u.searchParams.get('device_id') === 'PC1') S.ativo = true; return resp(204); }
// ---- login (PKCE) ----
t('Client ID: 32 caracteres hexadecimais', clientIdOk(CID) && !clientIdOk('abc') && !clientIdOk(''));
t('endereço de retorno = o próprio jogo (http://127.0.0.1:8080/index.html)', redirectUri({ origin: 'http://127.0.0.1:8080', pathname: '/index.html' }) === 'http://127.0.0.1:8080/index.html');
const C = criaControle({ fetch: falso });
t('sem Client ID não abre o login', (await C.conectar({ assign: () => {}, origin: 'x', pathname: '/' })) === false && /Client ID/.test(C.msg));
C.salvaClientId(CID); let foi = null; await C.conectar({ assign: u => { foi = new URL(u); }, origin: 'http://127.0.0.1:8080', pathname: '/index.html' });
t('login vai para accounts.spotify.com/authorize com PKCE (S256), escopos de controle e o endereço do jogo', foi.host === 'accounts.spotify.com' && foi.pathname === '/authorize' && foi.searchParams.get('code_challenge_method') === 'S256' && foi.searchParams.get('code_challenge').length === 43 && foi.searchParams.get('scope') === 'user-modify-playback-state user-read-playback-state' && foi.searchParams.get('redirect_uri') === 'http://127.0.0.1:8080/index.html' && !foi.searchParams.has('client_secret'));
const st = foi.searchParams.get('state'); let limpo = null; const hist = { replaceState: (a, b, u) => { limpo = u; } };
t('volta do login com "state" errado é recusada', (await C.retornoLogin({ search: '?code=X&state=errado', pathname: '/index.html', origin: 'http://127.0.0.1:8080' }, hist)) === false && limpo === '/index.html');
await C.conectar({ assign: u => { foi = new URL(u); }, origin: 'http://127.0.0.1:8080', pathname: '/index.html' });
const r = await C.retornoLogin({ search: `?v=1&code=COD&state=${foi.searchParams.get('state')}`, pathname: '/index.html', origin: 'http://127.0.0.1:8080' }, hist);
t('volta do login: troca o código pelos tokens (com code_verifier) e limpa a barra de endereço', r === true && C.conectado() && S.ultimoToken.grant_type === 'authorization_code' && S.ultimoToken.code === 'COD' && S.ultimoToken.code_verifier?.length === 64 && limpo === '/index.html?v=1');
t('cancelar o login avisa', (await C.retornoLogin({ search: '?error=access_denied', pathname: '/index.html', origin: 'x' }, hist)) === false && /cancelado/.test(C.msg));
t('sem ?code na barra: nada a fazer', (await C.retornoLogin({ search: '', pathname: '/index.html', origin: 'x' }, hist)) === null);
// ---- tocar / pausar / volume ----
const fila = [{ tipo: 'track', sid: TR1, nome: 'Hino' }, { tipo: 'track', sid: TR2, nome: 'Raça' }];
S.chamadas = []; t('tocar faixa com o Spotify fechado: mensagem para abrir o app', !(await criaControle({ fetch: async (u, o) => (S.aberto = false, falso(u, o)) }).tocar(fila, 0)) && true); S.aberto = true;
S.chamadas = []; const okT = await C.tocar(fila, 1);
t('tocar: sem app ativo, procura o PC e toca nele (device_id), com as faixas do clube a partir da escolhida', okT && S.chamadas.some(c => c.startsWith('GET /v1/me/player/devices')) && S.chamadas.at(-1) === `PUT /v1/me/player/play?device_id=PC1 {"uris":["spotify:track:${TR2}","spotify:track:${TR1}"]}`, S.chamadas.at(-1));
S.chamadas = []; await C.tocar([{ tipo: 'playlist', sid: PL }], 0); t('tocar playlist: context_uri', S.chamadas.at(-1) === `PUT /v1/me/player/play?device_id=PC1 {"context_uri":"spotify:playlist:${PL}"}`);
S.chamadas = []; await C.pausar(); await C.continuar(); await C.proxima(); await C.repetir('track');
t('pausar, continuar, próxima e repetir', S.chamadas.join() === 'PUT /v1/me/player/pause?device_id=PC1,PUT /v1/me/player/play?device_id=PC1,POST /v1/me/player/next?device_id=PC1,PUT /v1/me/player/repeat?state=track&device_id=PC1', S.chamadas.join());
S.chamadas = []; C.volume(.2); C.volume(.4); await C.volume(.55); await tick(300); t('volume: mudanças seguidas viram UMA ordem ao Spotify', S.chamadas.filter(c => c.includes('/volume')).length === 1 && S.chamadas.at(-1).includes('volume_percent=55'), S.chamadas.join());
{ const d = JSON.parse(mem.pm_spotify_conta); d.expira = 0; mem.pm_spotify_conta = JSON.stringify(d); S.chamadas = []; await C.pausar(); t('token vencido: renova com o refresh_token antes de mandar a ordem', S.ultimoToken.grant_type === 'refresh_token' && S.chamadas.at(-1).startsWith('PUT /v1/me/player/pause')); }
S.premium = false; t('conta sem Premium: mensagem clara', !(await C.continuar()) && /Premium/.test(C.msg)); S.premium = true;
t('quem está conectado', (await C.quemSou()).nome === 'Torcedor');
// ---- player do jogo com fonte Spotify + eventos da partida ----
Store.data = defaults(); Store.data.torcidaRegras.origem = 'spotify'; Store.data.spotify = { flamengo: [{ id: 'sa', tipo: 'track', sid: TR1, nome: 'Hino Fla' }, { id: 'sb', tipo: 'track', sid: TR2, nome: 'Raça Fla' }], corinthians: [{ id: 'sc', tipo: 'playlist', sid: PL, nome: 'Timão' }] };
const P = T.criaPlayer({ store: () => Store.data, spotify: C, Audio: null, url: () => '', pausaOutras: () => {} }); GS.equipes = [{ key: 'flamengo' }, { key: 'corinthians' }]; GS.cobrador = 0; P.liga(Events, GS);
const ult = re => S.chamadas.filter(c => re.test(c)).at(-1) || '';
S.chamadas = []; Events.emit('partida_iniciada', {}); await tick(20);
t('INÍCIO: o jogo manda o Spotify tocar a música do Flamengo', P.fonte() === 'spotify' && P.estado === 'tocando' && ult(/player\/play/).includes(TR1) && ult(/\/repeat/).includes('state=context'), ult(/player\/play/));
S.chamadas = []; Events.emit('cobranca_mudou', { cobrador: 0 }); await tick(20); t('mesmo time de novo: não manda tocar outra vez', !S.chamadas.some(c => c.includes("player/play")));
S.chamadas = []; Events.emit('chute', {}); await tick(300); t('CHUTE (padrão): a música continua no mesmo volume', !S.chamadas.some(c => c.includes('volume'))); Store.data.torcidaRegras.chute = 'abaixar'; Events.emit('chute', {}); await tick(300); t('CHUTE (regra abaixar): abaixa o volume no Spotify', ult(/volume_percent/).includes('volume_percent=21'), ult(/volume/));
Events.emit('defesa', {}); await tick(300); t('depois do lance volta ao volume', ult(/volume_percent/).includes('volume_percent=70')); Store.data.torcidaRegras.chute = 'nada';
S.chamadas = []; Events.emit('pausa'); await tick(20); t('PAUSA da partida: pausa o Spotify', P.estado === 'pausado' && ult(/\/pause/) !== '');
S.chamadas = []; Events.emit('retomada'); await tick(20); t('RETOMADA: continua no Spotify', P.estado === 'tocando' && ult(/PUT \/v1\/me\/player\/play/) !== '');
S.chamadas = []; Events.emit('cobranca_mudou', { cobrador: 1 }); await tick(20); t('MUDANÇA DE EQUIPE: toca a playlist do Corinthians', ult(/player\/play/).includes(`spotify:playlist:${PL}`) && P.faixa.nome === 'Timão');
S.chamadas = []; await P.trocar(); t('TROCAR com uma playlist: próxima faixa da playlist', ult(/\/next/) !== '');
S.chamadas = []; Events.emit('gol', { equipe: 0 }); await tick(20); t('GOL do Flamengo: volta para a música do Flamengo', ult(/player\/play/).includes(TR1));
S.chamadas = []; Events.emit('partida_encerrada', { vencedor: 1 }); await tick(20); t('FIM (vencedor): toca a do Corinthians', ult(/player\/play/).includes(PL));
S.chamadas = []; P.parar(); await tick(20); t('PARAR (sair da partida / menu): pausa o Spotify', ult(/\/pause/) !== '' && P.estado === 'parado');
S.premium = false; S.chamadas = []; Events.emit('partida_iniciada', {}); await tick(20); t('sem Premium na partida: não trava, mostra o motivo', P.estado === 'erro' && /Premium/.test(P.motivo)); S.premium = true;
// ---- ORIGEM AUTOMÁTICA (padrão) + MÚSICA DO MENU ----
{ const { Arquivos } = await import('./js/torcidaArquivos.js'); class FA { constructor() { this.paused = true; this.volume = 1; this.currentTime = 0; } play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; } }
  Store.data = defaults(); t('regra padrão: origem automática e música no menu ligada', Store.data.torcidaRegras.origem === 'auto' && Store.data.torcidaRegras.menu === true);
  Store.data.spotify = { corinthians: [{ id: 'sc', tipo: 'track', sid: TR2, nome: 'Timão SP' }], menu: [{ id: 'sm', tipo: 'playlist', sid: PL, nome: 'Menu SP' }] };
  Store.data.torcidas = { flamengo: [{ id: 'tfla1', nome: 'Hino arquivo', arquivo: 'h.mp3', principal: true }] }; await Arquivos.guardar('tfla1', { b: 1 });
  const P2 = T.criaPlayer({ store: () => Store.data, spotify: C, Audio: FA, url: () => 'blob:x', pausaOutras: () => {} }); const E2 = { h: {}, on(n, f) { (this.h[n] ||= []).push(f); }, emit(n, d = {}) { (this.h[n] || []).forEach(f => f(d)); } };
  const G2 = { equipes: [{ key: 'flamengo' }, { key: 'corinthians' }], cobrador: 0 }; P2.liga(E2, G2);
  S.chamadas = []; await P2.tocarMenu(); t('MENU: toca as músicas do menu (aqui uma playlist do Spotify)', P2.clube === 'menu' && P2._fonte === 'spotify' && ult(/player\/play/).includes(PL) && P2.estado === 'tocando');
  E2.emit('partida_iniciada'); await tick(20); t('partida começa: sai do menu e toca o ARQUIVO do Flamengo (clube com arquivo usa o arquivo)', P2.clube === 'flamengo' && P2._fonte === 'arquivos' && P2.estado === 'tocando' && ult(/player\/pause/) !== '');
  S.chamadas = []; E2.emit('cobranca_mudou', { cobrador: 1 }); await tick(20); t('vez do Corinthians (sem arquivo): toca o link do Spotify dele', P2.clube === 'corinthians' && P2._fonte === 'spotify' && ult(/player\/play/).includes(TR2));
  E2.emit('partida_encerrada', { vencedor: 0 }); await tick(20); t('FIM: Flamengo venceu → volta para a música do Flamengo', P2.clube === 'flamengo' && P2.estado === 'tocando');
  S.chamadas = []; await P2.tocarMenu(); t('volta ao menu: música do menu de novo', P2.clube === 'menu' && P2.estado === 'tocando' && ult(/player\/play/).includes(PL));
  C.desconectar(); E2.emit('cobranca_mudou', { cobrador: 1 }); await tick(20); t('Spotify desconectado + clube só com link do Spotify: aviso claro, sem travar, e a música que já tocava CONTINUA', P2.estado === 'tocando' && P2.clube === 'menu' && /Spotify não está conectado/.test(P2.motivo), P2.estado + ' ' + P2.clube + ' ' + P2.motivo);
  Store.data.torcidaRegras.menu = false; P2.parar(); await P2.tocarMenu(); t('regra "música no menu" desligada: menu fica em silêncio', P2.estado === 'parado'); }
console.log(`SPOTIFY CONTROLE OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
